export default async function EditNotePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <div>
      <h1 className="text-2xl font-bold mb-4">Edit Note</h1>
      <p className="text-slate-600 dark:text-slate-400">Editing note ID: {id}</p>
    </div>
  );
}
