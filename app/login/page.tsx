"use client";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import { useState, type FormEvent } from "react";
import { AuthShell } from "@/components/layout/auth-shell";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/field";
import { supabase } from "@/lib/supabase";

export default function LoginPage() {
  const [mode, setMode] = useState<"signin" | "reset">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);

  const signIn = async (e: FormEvent) => {
    e.preventDefault();
    if (!supabase) return;
    setBusy(true);
    setError("");
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    setBusy(false);
    if (error) setError(/invalid login/i.test(error.message) ? "That email and password don't match." : /confirm/i.test(error.message) ? "This account's email isn't confirmed yet." : error.message);
    // On success the app shell moves you into the app.
  };

  const reset = async (e: FormEvent) => {
    e.preventDefault();
    if (!supabase) return;
    setBusy(true);
    setError("");
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo: `${window.location.origin}/reset-password` });
    setBusy(false);
    if (error) setError(error.message);
    else setSent(true);
  };

  if (mode === "reset")
    return (
      <AuthShell title="Reset password" subtitle="Enter your email and we'll send you a link to choose a new password.">
        {sent ? (
          <div className="space-y-4">
            <p className="rounded-xl bg-wash px-4 py-3 text-[13.5px] text-ink-2">If <b>{email}</b> is on the team, a reset link is on its way. It can take a minute.</p>
            <button onClick={() => { setMode("signin"); setSent(false); }} className="text-[13px] font-medium text-olive-700 hover:underline">Back to sign in</button>
          </div>
        ) : (
          <form onSubmit={reset} className="space-y-5">
            <div>
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" autoComplete="email" autoFocus required value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            {error ? <p role="alert" className="text-[13px] text-st-reopened">{error}</p> : null}
            <Button type="submit" variant="primary" size="lg" className="w-full" disabled={busy || !email.trim()}>
              {busy ? <Loader2 className="size-4 animate-spin" /> : null} Send reset link
            </Button>
            <button type="button" onClick={() => setMode("signin")} className="text-[13px] text-muted hover:text-ink">Back to sign in</button>
          </form>
        )}
      </AuthShell>
    );

  return (
    <AuthShell title="Sign in" subtitle="Welcome back. Sign in to see where the bugs stand.">
      <form onSubmit={signIn} className="space-y-5">
        <div>
          <Label htmlFor="email">Email</Label>
          <Input id="email" type="email" autoComplete="email" autoFocus required value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>
        <div>
          <div className="mb-1.5 flex items-center justify-between">
            <Label htmlFor="password" className="mb-0">Password</Label>
            <button type="button" onClick={() => { setMode("reset"); setError(""); }} className="text-[13px] text-muted hover:text-ink">Forgot password?</button>
          </div>
          <div className="relative">
            <Input id="password" type={show ? "text" : "password"} autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} className="pr-10" />
            <button type="button" onClick={() => setShow((s) => !s)} className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1.5 text-faint hover:text-ink" aria-label={show ? "Hide password" : "Show password"}>
              {show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
            </button>
          </div>
        </div>
        {error ? <p role="alert" className="text-[13px] text-st-reopened">{error}</p> : null}
        <Button type="submit" variant="primary" size="lg" className="w-full" disabled={busy || !email.trim() || !password}>
          {busy ? <Loader2 className="size-4 animate-spin" /> : null} Sign in
        </Button>
      </form>
      <p className="mt-8 text-xs text-muted">This workspace is private to the Nuton team. There is no public sign-up.</p>
    </AuthShell>
  );
}
