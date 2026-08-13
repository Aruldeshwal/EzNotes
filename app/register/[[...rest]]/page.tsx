import { SignUp } from '@clerk/nextjs';

export default function RegisterPage() {
  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col items-center justify-center p-6">
      <div className="mb-6 text-center">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
          Create an EzNotes Account
        </h1>
        <p className="text-sm text-slate-500 mt-1">
          Start sharing secure, password-protected, and self-destructing notes.
        </p>
      </div>

      <SignUp
        routing="path"
        path="/register"
        signInUrl="/login"
        fallbackRedirectUrl="/notes"
      />
    </div>
  );
}
