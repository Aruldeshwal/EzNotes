import { UserButton } from '@clerk/nextjs';
import Link from 'next/link';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-50">
      <header className="border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center space-x-6">
          <Link href="/notes" className="text-xl font-bold tracking-tight">
            EzNotes
          </Link>
          <nav className="flex items-center space-x-4">
            <Link
              href="/notes"
              className="text-sm font-medium text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100"
            >
              My Notes
            </Link>
            <Link
              href="/notes/new"
              className="text-sm font-medium text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100"
            >
              New Note
            </Link>
          </nav>
        </div>
        <UserButton />
      </header>
      <main className="max-w-7xl mx-auto px-6 py-8">{children}</main>
    </div>
  );
}
