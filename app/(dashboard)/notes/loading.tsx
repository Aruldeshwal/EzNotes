export default function Loading() {
  return (
    <div className="space-y-4 animate-pulse">
      <div className="h-8 bg-slate-200 dark:bg-slate-800 rounded w-1/4"></div>
      <div className="h-4 bg-slate-200 dark:bg-slate-800 rounded w-1/2"></div>
      <div className="h-64 bg-slate-200 dark:bg-slate-800 rounded"></div>
    </div>
  );
}
