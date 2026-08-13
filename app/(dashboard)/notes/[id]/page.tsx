import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/db';
import { NoteEditor } from '@/components/NoteEditor';
import { notFound, redirect } from 'next/navigation';

export default async function EditNotePage({ params }: { params: Promise<{ id: string }> }) {
  const { userId } = await auth();
  if (!userId) {
    redirect('/login');
  }

  const { id } = await params;
  const note = await prisma.note.findUnique({
    where: { id },
  });

  if (!note || note.clerkUserId !== userId) {
    notFound();
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
          Edit Note
        </h1>
        <p className="text-sm text-slate-500">
          Update note content or adjust permissions and expiration parameters.
        </p>
      </div>

      <NoteEditor initialNote={note} />
    </div>
  );
}
