"use client";
import { Loader2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import { AuthShell } from "@/components/layout/auth-shell";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/field";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/lib/supabase";

export default function ResetPasswordPage() {
  const { session, loading } = useAuth();
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [expired, setExpired] = useState(false);

  // The emailed link signs you in; give Supabase a moment to read it from the URL.
  useEffect(() => {
    if (loading || session) return;
    const t = setTimeout(() => setExpired(true), 2500);
    return () => clearTimeout(t);
  }, [loading, session]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!supabase) return;
    if (password.length < 8) return setError("Use at least 8 characters.");
    if (password !== confirm) return setError("The two passwords don't match.");
    setBusy(true);
    const { error } = await supabase.auth.updateUser({ password });
    setBusy(false);
    if (error) setError(error.message);
    else router.replace("/");
  };

  if (!session)
    return (
      <AuthShell title="Choose a new password">
        {expired ? (
          <div className="space-y-4">
            <p className="rounded-xl bg-wash px-4 py-3 text-[13.5px] text-ink-2">This reset link is invalid or has expired.</p>
            <Link href="/login" className="text-[13px] font-medium text-olive-700 hover:underline">Request a new link</Link>
          </div>
        ) : (
          <p className="flex items-center gap-2 text-[13.5px] text-muted"><Loader2 className="size-4 animate-spin" /> Checking your link…</p>
        )}
      </AuthShell>
    );

  return (
    <AuthShell title="Choose a new password" subtitle="Pick something you don't use anywhere else.">
      <form onSubmit={submit} className="space-y-5">
        <div><Label htmlFor="pw">New password</Label><Input id="pw" type="password" autoComplete="new-password" autoFocus value={password} onChange={(e) => setPassword(e.target.value)} /></div>
        <div><Label htmlFor="pw2">Confirm password</Label><Input id="pw2" type="password" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} /></div>
        {error ? <p role="alert" className="text-[13px] text-st-reopened">{error}</p> : null}
        <Button type="submit" variant="primary" size="lg" className="w-full" disabled={busy || !password}>
          {busy ? <Loader2 className="size-4 animate-spin" /> : null} Save password
        </Button>
      </form>
    </AuthShell>
  );
}
