import { SignIn } from '@clerk/nextjs';

export default function LoginPage() {
  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col items-center justify-center p-6">
      <div className="mb-6 text-center">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
          Sign In to EzNotes
        </h1>
        <p className="text-sm text-slate-500 mt-1">
          Access your notes, settings, and analytics.
        </p>
      </div>

      <SignIn
        routing="path"
        path="/login"
        signUpUrl="/register"
        fallbackRedirectUrl="/notes"
      />
    </div>
  );
}
