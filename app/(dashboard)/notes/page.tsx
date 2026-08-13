import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/db';
import { NotesTable } from '@/components/NotesTable';
import { AnalyticsCharts } from '@/components/AnalyticsCharts';
import Link from 'next/link';

export default async function NotesDashboardPage() {
  const { userId } = await auth();

  let notes: Array<import('@prisma/client').Note> = [];
  let lifetimeViews = 0;
  let dailyAggregates: Array<{ date: string; views: number }> = [];

  if (userId) {
    notes = await prisma.note.findMany({
      where: { clerkUserId: userId },
      orderBy: { createdAt: 'desc' },
    });

    lifetimeViews = notes.reduce((acc, note) => acc + note.viewCount, 0);

    const sevenDaysAgo = new Date();
    sevenDaysAgo.setUTCDate(sevenDaysAgo.getUTCDate() - 7);

    const userTokens = notes.map((n) => n.token);
    if (userTokens.length > 0) {
      const aggregates = await prisma.noteViewAggregate.findMany({
        where: {
          noteToken: { in: userTokens },
          date: { gte: sevenDaysAgo },
        },
      });

      // Group by YYYY-MM-DD
      const dateMap = new Map<string, number>();
      for (let i = 0; i < 7; i++) {
        const d = new Date();
        d.setUTCDate(d.getUTCDate() - i);
        const dateStr = d.toISOString().split('T')[0];
        dateMap.set(dateStr, 0);
      }

      for (const agg of aggregates) {
        const dateStr = agg.date.toISOString().split('T')[0];
        if (dateMap.has(dateStr)) {
          dateMap.set(dateStr, (dateMap.get(dateStr) || 0) + agg.viewCount);
        }
      }

      dailyAggregates = Array.from(dateMap.entries())
        .map(([date, views]) => ({ date, views }))
        .sort((a, b) => a.date.localeCompare(b.date));
    }
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
            Notes Dashboard
          </h1>
          <p className="text-sm text-slate-500">
            Manage your shared notes, configure expiration & security parameters, and monitor analytics.
          </p>
        </div>

        <Link
          href="/notes/new"
          className="px-4 py-2 bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 font-semibold text-sm rounded-lg hover:opacity-90 transition-opacity"
        >
          + Create New Note
        </Link>
      </div>

      <AnalyticsCharts
        totalNotes={notes.length}
        lifetimeViews={lifetimeViews}
        dailyData={dailyAggregates}
      />

      <div>
        <h2 className="text-lg font-bold mb-4 text-slate-900 dark:text-slate-100">Your Shared Notes</h2>
        <NotesTable initialNotes={notes} />
      </div>
    </div>
  );
}
