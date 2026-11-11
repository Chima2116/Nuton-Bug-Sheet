"use client";
import { useEffect, useState } from "react";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/field";
import { useToast } from "@/components/ui/toast";
import { useAuth } from "@/lib/auth";
import { useMe, usePerms } from "@/lib/hooks";
import { updateProfileName } from "@/lib/store";
import { supabase } from "@/lib/supabase";

export function ProfileTab() {
  const me = useMe();
  const { role } = usePerms();
  const { signOut } = useAuth();
  const { toast } = useToast();
  const [name, setName] = useState("");
  const [pw, setPw] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (me) setName(me.name);
  }, [me?.id, me?.name]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!me) return null;
  const dirty = name.trim() !== me.name;

  const changePassword = async () => {
    if (!supabase) return;
    setBusy(true);
    const { error } = await supabase.auth.updateUser({ password: pw });
    setBusy(false);
    if (error) toast(error.message, { tone: "error" });
    else {
      toast("Password updated");
      setPw("");
    }
  };

  return (
    <section className="max-w-[560px] space-y-10">
      <div>
        <div className="mb-6 flex items-center gap-4">
          <Avatar name={me.name} id={me.id} size={56} />
          <div>
            <p className="text-[15px] font-medium text-ink">{me.name}</p>
            <p className="text-[13px] text-muted">{role?.name}</p>
          </div>
        </div>
        <div className="space-y-4">
          <div><Label htmlFor="p-name">Full name</Label><Input id="p-name" value={name} onChange={(e) => setName(e.target.value)} /></div>
          <div>
            <Label htmlFor="p-email">Email</Label>
            <Input id="p-email" value={me.email} disabled />
            <p className="mt-1.5 text-xs text-muted">Your email and role are managed in Supabase.</p>
          </div>
        </div>
        <div className="mt-6 flex items-center gap-2">
          <Button variant="primary" disabled={!dirty || !name.trim()} onClick={async () => { if ((await updateProfileName(name)).ok) toast("Profile updated"); }}>Save changes</Button>
          <Button variant="ghost" disabled={!dirty} onClick={() => setName(me.name)}>Discard</Button>
        </div>
      </div>

      <div className="border-t border-line pt-8">
        <h2 className="text-sm font-semibold text-ink">Password</h2>
        <div className="mt-4 flex flex-wrap items-end gap-2">
          <div className="min-w-0 flex-1 basis-[240px]">
            <Label htmlFor="p-pw">New password</Label>
            <Input id="p-pw" type="password" autoComplete="new-password" value={pw} onChange={(e) => setPw(e.target.value)} placeholder="At least 8 characters" />
          </div>
          <Button disabled={busy || pw.length < 8} onClick={() => void changePassword()} size="lg">Update password</Button>
        </div>
      </div>

      <div className="border-t border-line pt-8">
        <Button onClick={() => void signOut()}>Sign out</Button>
      </div>
    </section>
  );
}
