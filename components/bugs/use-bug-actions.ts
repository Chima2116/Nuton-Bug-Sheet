"use client";
import { useToast } from "@/components/ui/toast";
import { assignBug, changeStatus, verifyBug } from "@/lib/store";
import type { Bug, Status } from "@/lib/types";
import { statusToast, type QuickAction } from "@/lib/workflow";

/**
 * Every routine action runs immediately: no confirmation, no required reason.
 * A toast confirms it, with Undo for status changes.
 */
export function useBugActions() {
  const { toast } = useToast();

  const setStatus = async (bug: Bug, to: Status) => {
    if (bug.status === to) return;
    const previous = bug.status;
    const res = await changeStatus(bug.id, to);
    if (res.ok) toast(statusToast(to), { action: { label: "Undo", onClick: () => void changeStatus(bug.id, previous) } });
  };

  const verify = async (bug: Bug) => {
    const previous = bug.status;
    const res = await verifyBug(bug.id);
    if (!res.ok) return;
    // Undo can only step back to an earlier status; a bug that was already Resolved just stays verified.
    toast("Bug verified.", previous !== "Resolved" ? { action: { label: "Undo", onClick: () => void changeStatus(bug.id, previous) } } : undefined);
  };

  const assign = async (bug: Bug, userId: string | null, name?: string) => {
    if (bug.assigneeId === userId) return;
    const previous = bug.assigneeId;
    const res = await assignBug(bug.id, userId);
    if (res.ok) toast(userId ? `Assigned to ${name ?? "teammate"}.` : "Bug unassigned.", { action: { label: "Undo", onClick: () => void assignBug(bug.id, previous) } });
  };

  const run = (bug: Bug, action: QuickAction) => (action.verify ? verify(bug) : setStatus(bug, action.to));

  return { setStatus, verify, assign, run };
}
