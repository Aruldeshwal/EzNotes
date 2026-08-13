'use client';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="p-6 bg-red-50 dark:bg-red-950/30 text-red-700 dark:text-red-400 rounded-lg">
      <h2 className="text-lg font-bold mb-2">Something went wrong!</h2>
      <p className="text-sm mb-4">{error.message || 'Failed to load dashboard'}</p>
      <button
        onClick={() => reset()}
        className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 transition-colors text-sm font-medium"
      >
        Try again
      </button>
    </div>
  );
}
