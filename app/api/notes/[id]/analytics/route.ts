import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/db';
import { getPendingViews } from '@/lib/redis';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;

  // Re-verify ownership
  const note = await prisma.note.findUnique({
    where: { id },
  });

  if (!note || note.clerkUserId !== userId) {
    return NextResponse.json({ error: 'Note not found or access denied' }, { status: 404 });
  }

  const pending = await getPendingViews(note.token);

  // Fetch daily aggregates for the past 7 days
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setUTCDate(sevenDaysAgo.getUTCDate() - 7);
  sevenDaysAgo.setUTCHours(0, 0, 0, 0);

  const dailyAggregates = await prisma.noteViewAggregate.findMany({
    where: {
      noteToken: note.token,
      date: { gte: sevenDaysAgo },
    },
    orderBy: { date: 'asc' },
  });

  return NextResponse.json({
    noteId: note.id,
    token: note.token,
    title: note.title,
    lifetimeViews: note.viewCount + pending,
    dailyAggregates: dailyAggregates.map((item) => ({
      date: item.date.toISOString().split('T')[0],
      views: item.viewCount,
    })),
  });
}
