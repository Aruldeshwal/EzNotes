'use client';

import React from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { Eye, TrendingUp, FileText } from 'lucide-react';

interface DailyAggregate {
  date: string;
  views: number;
}

interface AnalyticsChartsProps {
  totalNotes: number;
  lifetimeViews: number;
  dailyData: DailyAggregate[];
}

export const AnalyticsCharts: React.FC<AnalyticsChartsProps> = ({
  totalNotes,
  lifetimeViews,
  dailyData,
}) => {
  const hasViews = dailyData.some((d) => d.views > 0) || lifetimeViews > 0;

  return (
    <div className="space-y-6">
      {/* Metric Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 rounded-xl shadow-sm flex items-center gap-4">
          <div className="p-3 bg-blue-50 dark:bg-blue-950/40 text-blue-600 rounded-lg">
            <FileText className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Total Notes</p>
            <h3 className="text-2xl font-bold text-slate-900 dark:text-slate-100">{totalNotes}</h3>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 rounded-xl shadow-sm flex items-center gap-4">
          <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 rounded-lg">
            <Eye className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Lifetime Views</p>
            <h3 className="text-2xl font-bold text-slate-900 dark:text-slate-100">{lifetimeViews.toLocaleString()}</h3>
          </div>
        </div>
      </div>

      {/* Recharts Bar Chart */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 rounded-xl shadow-sm">
        <div className="flex items-center justify-between mb-6">
          <h4 className="font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-blue-500" /> Daily Views (Past 7 Days)
          </h4>
        </div>

        {!hasViews ? (
          <div className="py-12 text-center text-slate-400 dark:text-slate-500 text-sm">
            No views recorded yet. Share your links to track viewer analytics.
          </div>
        ) : (
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={dailyData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                <XAxis dataKey="date" tickLine={false} axisLine={false} className="text-xs text-slate-500" />
                <YAxis allowDecimals={false} tickLine={false} axisLine={false} className="text-xs text-slate-500" />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#0f172a',
                    borderColor: '#1e293b',
                    borderRadius: '8px',
                    color: '#fff',
                  }}
                />
                <Bar dataKey="views" fill="#3b82f6" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    </div>
  );
};
