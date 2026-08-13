import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { acquireOneTimeLock, invalidateNoteCache } from '@/lib/redis';
import { createNoteSessionJwt, setNoteSessionCookie } from '@/lib/auth';
import { AccessType } from '@prisma/client';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;

  if (!token) {
    return NextResponse.json({ error: 'Token is required' }, { status: 400 });
  }

  // Fast-path Redis lock check
  const lockAcquired = await acquireOneTimeLock(token);
  if (!lockAcquired) {
    return NextResponse.json({ error: 'Note already consumed or processing' }, { status: 410 });
  }

  try {
    // Atomic DB correctness guarantee: row-level lock via UPDATE ... WHERE revoked = false
    const updatedNotes = await prisma.$queryRaw<
      Array<{ id: string; token: string; created_at: Date; access_type: string; content: string; title: string }>
    >`
      UPDATE notes
      SET revoked = true, consumed_at = NOW()
      WHERE token = ${token} AND revoked = false AND access_type = 'ONE_TIME'::"AccessType"
      RETURNING id, token, created_at, access_type, content, title
    `;

    if (!updatedNotes || updatedNotes.length === 0) {
      // Losing request under concurrent race condition or already consumed
      await invalidateNoteCache(token);
      return NextResponse.json({ error: 'Note has already been viewed and destroyed.' }, { status: 410 });
    }

    const note = updatedNotes[0];

    // Invalidate Redis cache immediately
    await invalidateNoteCache(token);

    // Issue short-lived JWT session cookie (httpOnly)
    const jwt = await createNoteSessionJwt(note.id, note.created_at, note.token, note.access_type);
    await setNoteSessionCookie(token, jwt);

    return NextResponse.json({
      success: true,
      data: {
        id: note.id,
        title: note.title,
        content: note.content,
        accessType: AccessType.ONE_TIME,
        revoked: true,
      },
    });
  } catch (err) {
    console.error('Error consuming one-time note:', err);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
