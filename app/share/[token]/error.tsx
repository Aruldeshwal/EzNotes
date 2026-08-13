'use client';

export default function ShareError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 p-6 flex flex-col items-center justify-center">
      <div className="max-w-md w-full bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900 rounded-lg p-6 text-center">
        <h2 className="text-lg font-bold text-red-700 dark:text-red-400 mb-2">Error Loading Note</h2>
        <p className="text-sm text-red-600 dark:text-red-300 mb-4">
          {error.message || 'An error occurred while attempting to render this note.'}
        </p>
        <button
          onClick={() => reset()}
          className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 transition-colors text-sm font-medium"
        >
          Try again
        </button>
      </div>
    </div>
  );
}
