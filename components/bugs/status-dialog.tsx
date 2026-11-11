"use client";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Hint, Label, Textarea } from "@/components/ui/field";
import { Modal } from "@/components/ui/overlay";
import { StatusBadge } from "@/components/ui/badges";
import { useToast } from "@/components/ui/toast";
import { changeStatus } from "@/lib/store";
import type { Bug } from "@/lib/types";
import type { Transition } from "@/lib/workflow";
import { ArrowRight } from "lucide-react";

export function StatusDialog({ bug, transition, onClose }: { bug: Bug; transition: Transition | null; onClose: () => void }) {
  const { toast } = useToast();
  const [text, setText] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (transition) {
      setText(transition.needs === "fix" ? bug.fixDescription : "");
      setError("");
    }
  }, [transition, bug.fixDescription]);

  if (!transition) return null;
  const t = transition;
  const required = t.needs === "fix" || t.needs === "comment";
  const label =
    t.needs === "fix" ? "Fix description" : t.needs === "comment" ? (t.to === "Reopened" ? "What still goes wrong?" : "Comment") : t.to === "Verified" ? "Verification note (optional)" : "Note (optional)";
  const placeholder =
    t.needs === "fix"
      ? "Describe what you changed and how to check it, e.g. where it's deployed."
      : t.to === "Reopened"
        ? "Describe what you tested and what is still wrong, so the developer can reproduce it."
        : t.to === "Verified"
          ? "What did you test? e.g. Checked at 1440 and 768 widths in Chrome and Safari."
          : "Add context for the team.";

  const submit = async () => {
    if (busy) return;
    setBusy(true);
    const res = await changeStatus(bug.id, t.to, t.needs === "fix" ? { fix: text, note: text } : { note: text });
    setBusy(false);
    if (!res.ok) return setError(res.error);
    toast(`${bug.id} moved to ${t.to}`);
    onClose();
  };

  return (
    <Modal
      open
      onOpenChange={(o) => !o && onClose()}
      title={t.label}
      description={t.description}
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant={t.tone === "danger" ? "danger" : "primary"} onClick={submit} disabled={busy || (required && !text.trim())}>
            {t.label}
          </Button>
        </>
      }
    >
      <div className="mb-4 flex items-center gap-2 rounded-md bg-wash px-3 py-2 text-[13px]">
        <span className="tnum text-muted">{bug.id}</span>
        <span className="min-w-0 flex-1 truncate text-ink">{bug.title}</span>
      </div>
      <div className="mb-4 flex items-center gap-2">
        <StatusBadge status={bug.status} pill />
        <ArrowRight className="size-3.5 text-faint" />
        <StatusBadge status={t.to} pill />
      </div>
      <Label htmlFor="status-note">{label}</Label>
      <Textarea
        id="status-note"
        autoFocus
        rows={4}
        value={text}
        onChange={(e) => {
          setText(e.target.value);
          setError("");
        }}
        placeholder={placeholder}
        onKeyDown={(e) => {
          if ((e.metaKey || e.ctrlKey) && e.key === "Enter" && (!required || text.trim())) void submit();
        }}
      />
      {error ? <p className="mt-1.5 text-xs text-st-reopened">{error}</p> : <Hint>{t.needs === "fix" ? "Required. This is saved on the bug and shown to the reporter." : t.needs === "comment" ? "Required. This is added to the activity log." : "This is added to the activity log."}</Hint>}
    </Modal>
  );
}
