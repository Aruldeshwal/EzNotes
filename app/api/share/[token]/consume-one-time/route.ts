import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/db';
import { acquireOneTimeLock, invalidateNoteCache } from '@/lib/redis';
import { createNoteSessionJwt, setNoteSessionCookie } from '@/lib/auth';
import { trackNoteView } from '@/lib/analytics';
import { AccessType, ShareType } from '@prisma/client';

export async function POST(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
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
      Array<{
        id: string;
        token: string;
        created_at: Date;
        access_type: string;
        share_type: string;
        content: string;
        title: string;
        consumed_at: Date;
        clerk_user_id: string;
      }>
    >`
      UPDATE notes
      SET revoked = true, consumed_at = NOW()
      WHERE token = ${token} AND revoked = false AND access_type = 'ONE_TIME'::"AccessType"
      RETURNING id, token, created_at, access_type, share_type, content, title, consumed_at, clerk_user_id
    `;

    if (!updatedNotes || updatedNotes.length === 0) {
      // Losing request under concurrent race condition or already consumed
      await invalidateNoteCache(token);
      return NextResponse.json(
        { error: 'Note has already been viewed and destroyed.' },
        { status: 410 },
      );
    }

    const note = updatedNotes[0];

    // Invalidate Redis cache immediately
    await invalidateNoteCache(token);

    const jwt = await createNoteSessionJwt(note.id, note.created_at, note.token, note.access_type);

    const response = NextResponse.json({
      success: true,
      data: {
        id: note.id,
        token: note.token,
        title: note.title,
        content: note.content,
        shareType: note.share_type as ShareType,
        accessType: AccessType.ONE_TIME,
        revoked: true,
        consumedAt: note.consumed_at
          ? new Date(note.consumed_at).toISOString()
          : new Date().toISOString(),
      },
    });

    await setNoteSessionCookie(token, jwt, response);

    // Track view analytics for one time consumption
    try {
      const { userId: viewerUserId } = await auth();
      const ip = req.headers.get('x-forwarded-for')?.split(',')[0] || '127.0.0.1';
      await trackNoteView(token, note.clerk_user_id, viewerUserId, ip);
    } catch (err) {
      console.error('Error tracking one-time view:', err);
    }

    return response;
  } catch (err) {
    console.error('Error consuming one-time note:', err);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
