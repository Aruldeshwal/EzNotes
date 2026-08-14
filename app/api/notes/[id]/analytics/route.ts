import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/db';
import { getPendingViews, getPendingDailyViews } from '@/lib/redis';

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

  // Group by YYYY-MM-DD
  const dateMap = new Map<string, number>();
  for (let i = 0; i < 7; i++) {
    const d = new Date();
    d.setUTCDate(d.getUTCDate() - i);
    const dateStr = d.toISOString().split('T')[0];
    dateMap.set(dateStr, 0);
  }

  for (const item of dailyAggregates) {
    const dateStr = item.date.toISOString().split('T')[0];
    if (dateMap.has(dateStr)) {
      dateMap.set(dateStr, (dateMap.get(dateStr) || 0) + item.viewCount);
    }
  }

  for (const dateStr of dateMap.keys()) {
    const pendingDaily = await getPendingDailyViews(note.token, dateStr);
    dateMap.set(dateStr, (dateMap.get(dateStr) || 0) + pendingDaily);
  }

  const chartData = Array.from(dateMap.entries())
    .map(([date, views]) => ({ date, views }))
    .sort((a, b) => a.date.localeCompare(b.date));

  return NextResponse.json({
    noteId: note.id,
    token: note.token,
    title: note.title,
    lifetimeViews: note.viewCount + pending,
    dailyAggregates: chartData,
  });
}
