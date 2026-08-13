import { NoteEditor } from '@/components/NoteEditor';

export default function NewNotePage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
          Create New Note
        </h1>
        <p className="text-sm text-slate-500">
          Compose your note content and set access, sharing, and expiration parameters.
        </p>
      </div>

      <NoteEditor />
    </div>
  );
}
