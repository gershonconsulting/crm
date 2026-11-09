import { useState, type FormEvent, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { useUserRole } from "@/hooks/use-user-role";

export default function SignInGate({ children }: { children: ReactNode }) {
  const { user, isLoading, error } = useUserRole();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loginError, setLoginError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const { data: methods } = useQuery<{ google: boolean }>({
    queryKey: ["/api/auth/methods"], retry: false,
    queryFn: async () => { const r = await fetch('/api/auth/methods'); if (!r.ok) throw new Error('Unavailable'); return r.json(); },
  });
  const login = async (event: FormEvent) => {
    event.preventDefault(); setSubmitting(true); setLoginError("");
    try {
      const response = await fetch('/api/auth/login', { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password }) });
      if (!response.ok) { const body = await response.json(); throw new Error(body.message || 'Sign-in failed'); }
      window.location.assign('/');
    } catch (error) { setLoginError(error instanceof Error ? error.message : 'Sign-in failed. Please try again.'); }
    finally { setSubmitting(false); }
  };
  if (isLoading) return <main className="min-h-screen grid place-items-center bg-slate-50">Checking your sign-in…</main>;
  if (user && !error) return <>{children}</>;
  const reason = new URLSearchParams(window.location.search).get("signin");
  return <main className="min-h-screen flex items-center justify-center bg-slate-50 p-6">
    <section className="w-full max-w-md rounded-2xl border bg-white p-8 shadow-sm">
      <p className="text-sm font-semibold text-red-700">Gershon.AI</p>
      <h1 className="mt-3 text-3xl font-semibold text-slate-900">Welcome to your CRM</h1>
      <p className="mt-4 text-slate-600">Your client pipeline, contacts, and follow-ups in one place.</p>
      <p className="mt-3 text-sm text-slate-500">Private pilot · Access is currently limited to Olivier.</p>
      {(loginError || error || reason) && <p role="alert" className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-800">
        {loginError || error?.message || (reason === "restricted" ? "This Google account does not have access to the pilot. Please use your approved account." : "Sign-in could not be completed. Please try again.")}
      </p>}
      <form onSubmit={login} className="mt-6 space-y-4">
        <div><label htmlFor="login-email" className="block text-sm font-medium text-slate-700">Email address</label>
          <input id="login-email" type="email" autoComplete="username" value={email} onChange={e => setEmail(e.target.value)} required className="mt-1 w-full rounded-lg border px-3 py-2" /></div>
        <div><label htmlFor="login-password" className="block text-sm font-medium text-slate-700">Password</label>
          <input id="login-password" type="password" autoComplete="current-password" value={password} onChange={e => setPassword(e.target.value)} required maxLength={1024} className="mt-1 w-full rounded-lg border px-3 py-2" /></div>
        <button disabled={submitting} className="w-full rounded-lg bg-red-700 px-4 py-3 font-medium text-white hover:bg-red-800 disabled:opacity-50">{submitting ? 'Signing in…' : 'Sign in'}</button>
      </form>
      {methods?.google && <><a href="/api/auth/google" className="mt-7 flex items-center justify-center gap-3 rounded-lg border px-4 py-3 font-medium text-slate-800 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-red-700">
        Sign in with Google
      </a>
      <p className="mt-5 text-xs leading-relaxed text-slate-500">Google sign-in uses your name and email address. It does not request access to your Gmail messages.</p></>}
    </section>
  </main>;
}
