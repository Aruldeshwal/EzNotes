export default function ShareLoading() {
  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 p-6 flex flex-col items-center justify-center">
      <div className="max-w-2xl w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-6 animate-pulse">
        <div className="h-6 bg-slate-200 dark:bg-slate-800 rounded w-1/3 mb-4"></div>
        <div className="h-4 bg-slate-200 dark:bg-slate-800 rounded w-full mb-2"></div>
        <div className="h-4 bg-slate-200 dark:bg-slate-800 rounded w-2/3"></div>
      </div>
    </div>
  );
}
