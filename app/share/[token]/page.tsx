export default async function SharePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 p-6 flex flex-col items-center justify-center">
      <div className="max-w-2xl w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-6 shadow-sm">
        <h1 className="text-xl font-bold mb-2">Shared Note</h1>
        <p className="text-sm text-slate-500 mb-4">Token: {token}</p>
      </div>
    </div>
  );
}
