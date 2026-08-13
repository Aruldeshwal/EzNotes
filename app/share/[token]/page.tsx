import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/db';
import { readNoteCache, writeNoteCache } from '@/lib/redis';
import { ShareViewerMachine } from '@/components/ShareViewerMachine';
import { trackNoteView } from '@/lib/analytics';
import { headers } from 'next/headers';
import { AccessType } from '@prisma/client';
import { redirect } from 'next/navigation';

export default async function SharePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const { userId } = await auth();

  // Redirect to login if user is not signed in
  if (!userId) {
    redirect(`/login?redirect_url=/share/${token}`);
  }

  const reqHeaders = await headers();
  const ip = reqHeaders.get('x-forwarded-for')?.split(',')[0] || '127.0.0.1';

  // Check Redis cache first
  let note = await readNoteCache(token);
  if (!note) {
    note = await prisma.note.findUnique({ where: { token } });
    if (note) {
      await writeNoteCache(note);
    }
  }

  const isOwner = Boolean(note && note.clerkUserId === userId);

  // Track view if note exists, is public/read-only, and not password/one-time locked
  if (note && !note.revoked && note.accessType === AccessType.PUBLIC) {
    await trackNoteView(token, note.clerkUserId, userId, ip);
  }

  const noteData = note
    ? {
        id: note.id,
        token: note.token,
        title: note.title,
        content: note.accessType === AccessType.PUBLIC ? note.content : '', // withhold content if password/one-time locked
        shareType: note.shareType,
        accessType: note.accessType,
        expiryDate: note.expiryDate ? note.expiryDate.toISOString() : null,
        revoked: note.revoked,
        consumedAt: note.consumedAt ? note.consumedAt.toISOString() : null,
      }
    : null;

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 p-6 flex flex-col justify-center">
      <ShareViewerMachine token={token} initialNote={noteData} isOwner={isOwner} />
    </div>
  );
}
