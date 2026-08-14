import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { readNoteCache, writeNoteCache } from '@/lib/redis';
import { getNoteSessionCookie, verifyNoteSessionJwt } from '@/lib/auth';
import { AccessType } from '@prisma/client';

export async function GET(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;

  // 1. Check Redis cache first
  let note = await readNoteCache(token);
  if (!note) {
    note = await prisma.note.findUnique({ where: { token } });
    if (note) {
      await writeNoteCache(note);
    }
  }

  if (!note) {
    return NextResponse.json({ error: 'Note not found' }, { status: 404 });
  }

  if (note.revoked) {
    return NextResponse.json(
      { error: 'Note has been revoked', consumedAt: note.consumedAt },
      { status: 410 },
    );
  }

  if (note.expiryDate && new Date(note.expiryDate) < new Date()) {
    return NextResponse.json({ error: 'Note has expired' }, { status: 410 });
  }

  // Handle password-protected notes
  if (note.accessType === AccessType.PASSWORD) {
    // Always use DB note for JWT verification to avoid createdAt format mismatch
    const dbNote = await prisma.note.findUnique({ where: { token } });
    if (!dbNote) {
      return NextResponse.json({ error: 'Note not found' }, { status: 404 });
    }

    const sessionJwt = await getNoteSessionCookie(token);
    if (!sessionJwt) {
      return NextResponse.json(
        { error: 'Password required', isPasswordProtected: true },
        { status: 401 },
      );
    }
    const session = await verifyNoteSessionJwt(sessionJwt, dbNote.id, dbNote.createdAt);
    if (!session) {
      return NextResponse.json(
        { error: 'Invalid or expired session cookie', isPasswordProtected: true },
        { status: 401 },
      );
    }
  }

  // Return public payload (exclude passwordHash)
  return NextResponse.json({
    id: note.id,
    token: note.token,
    title: note.title,
    content: note.content,
    shareType: note.shareType,
    accessType: note.accessType,
    expiryDate: note.expiryDate,
    updatedAt: note.updatedAt,
  });
}
