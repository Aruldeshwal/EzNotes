import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { readNoteCache, writeNoteCache } from '@/lib/redis';
import { ShareType, AccessType } from '@prisma/client';
import { getNoteSessionCookie, verifyNoteSessionJwt } from '@/lib/auth';

const MAX_CONTENT_LENGTH = 100_000;

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;

  let body: { content?: string } = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  if (body.content === undefined) {
    return NextResponse.json({ error: 'Content is required' }, { status: 400 });
  }

  if (body.content.length > MAX_CONTENT_LENGTH) {
    return NextResponse.json(
      { error: `Content exceeds limit of ${MAX_CONTENT_LENGTH.toLocaleString()} characters` },
      { status: 400 },
    );
  }

  // Fetch note
  let note = await readNoteCache(token);
  if (!note) {
    note = await prisma.note.findUnique({ where: { token } });
  }

  if (!note) {
    return NextResponse.json({ error: 'Note not found' }, { status: 404 });
  }

  if (note.revoked) {
    return NextResponse.json({ error: 'Note is revoked' }, { status: 410 });
  }

  if (note.shareType !== ShareType.COLLABORATIVE) {
    return NextResponse.json({ error: 'Note is read-only and does not allow edits' }, { status: 403 });
  }

  // Auth check for password protected notes
  if (note.accessType === AccessType.PASSWORD) {
    const sessionCookie = await getNoteSessionCookie(token);
    if (!sessionCookie) {
      return NextResponse.json({ error: 'Unauthorized: Session cookie required' }, { status: 401 });
    }
    const session = await verifyNoteSessionJwt(sessionCookie, note.id, note.createdAt);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized: Invalid session' }, { status: 401 });
    }
  }

  // 1. Immediate Redis write-through
  const updatedNote = {
    ...note,
    content: body.content,
    updatedAt: new Date(),
  };
  await writeNoteCache(updatedNote);

  // 2. Async/Write-behind DB update
  try {
    await prisma.note.update({
      where: { token },
      data: { content: body.content },
    });
  } catch (err) {
    console.error('Error in write-behind DB update:', err);
  }

  return NextResponse.json({ success: true, updatedAt: updatedNote.updatedAt });
}
