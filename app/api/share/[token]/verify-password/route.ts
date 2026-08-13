import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/db';
import { checkLockout, recordPasswordFailure, readNoteCache } from '@/lib/redis';
import { verifyPassword } from '@/lib/password';
import { createNoteSessionJwt, setNoteSessionCookie } from '@/lib/auth';
import { trackNoteView } from '@/lib/analytics';
import { AccessType } from '@prisma/client';

export async function POST(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0] || '127.0.0.1';

  // 1. Check IP lockout first (fail fast before bcrypt call)
  const isLocked = await checkLockout(token, ip);
  if (isLocked) {
    return NextResponse.json(
      { error: 'Too many failed password attempts. Account locked out for 15 minutes.' },
      { status: 403 },
    );
  }

  let body: { password?: string } = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  if (!body.password) {
    return NextResponse.json({ error: 'Password is required' }, { status: 400 });
  }

  // 2. Fetch note from Redis cache or DB
  let note = await readNoteCache(token);
  if (!note) {
    note = await prisma.note.findUnique({ where: { token } });
  }

  if (!note) {
    return NextResponse.json({ error: 'Note not found' }, { status: 404 });
  }

  if (note.revoked) {
    return NextResponse.json({ error: 'Note has been revoked' }, { status: 410 });
  }

  if (note.accessType !== AccessType.PASSWORD || !note.passwordHash) {
    return NextResponse.json({ error: 'Note is not password-protected' }, { status: 400 });
  }

  // 3. Constant-time password comparison
  const isValid = await verifyPassword(body.password, note.passwordHash);

  if (!isValid) {
    const { isLockedOut } = await recordPasswordFailure(token, ip);
    if (isLockedOut) {
      return NextResponse.json(
        { error: 'Maximum password attempts exceeded. Locked out for 15 minutes.' },
        { status: 403 },
      );
    }
    return NextResponse.json({ error: 'Incorrect password' }, { status: 401 });
  }

  // 4. Issue session cookie on success
  const jwt = await createNoteSessionJwt(note.id, note.createdAt, note.token, note.accessType);
  await setNoteSessionCookie(token, jwt);

  // 5. Record view analytics for password protected note
  const { userId: viewerUserId } = await auth();
  await trackNoteView(token, note.clerkUserId, viewerUserId, ip);

  return NextResponse.json({
    success: true,
    data: {
      id: note.id,
      token: note.token,
      title: note.title,
      content: note.content,
      shareType: note.shareType,
      accessType: note.accessType,
      expiryDate: note.expiryDate ? note.expiryDate.toISOString() : null,
      revoked: note.revoked,
      consumedAt: note.consumedAt ? note.consumedAt.toISOString() : null,
    },
  });
}
