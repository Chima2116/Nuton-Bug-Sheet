import type { Permission, Status } from "./types";

export type TransitionNeeds = "fix" | "comment" | "note" | null;

export interface Transition {
  to: Status;
  label: string;
  permission: Permission;
  /** "fix" = fix description required, "comment" = comment required, "note" = optional note */
  needs: TransitionNeeds;
  tone?: "primary" | "danger" | "default";
  description: string;
}

const T: Record<Status, Transition[]> = {
  Open: [
    { to: "In Progress", label: "Start work", permission: "progress", needs: null, tone: "primary", description: "You are actively working on this bug." },
    { to: "Closed", label: "Close without fix", permission: "verify", needs: "comment", description: "Duplicate, won't fix or no longer relevant." },
  ],
  "In Progress": [
    { to: "Ready for Testing", label: "Submit for testing", permission: "progress", needs: "fix", tone: "primary", description: "The fix is implemented and ready to be verified by the reporter." },
    { to: "Open", label: "Move back to Open", permission: "progress", needs: "note", description: "Pause work and return it to the queue." },
  ],
  "Ready for Testing": [
    { to: "Verified", label: "Verify fix", permission: "verify", needs: "note", tone: "primary", description: "You tested it and the issue is resolved." },
    { to: "Reopened", label: "Reopen", permission: "verify", needs: "comment", tone: "danger", description: "The issue persists or the fix is unsuccessful." },
    { to: "In Progress", label: "Return to In Progress", permission: "progress", needs: "note", description: "Pull the fix back for more work." },
  ],
  Reopened: [
    { to: "In Progress", label: "Start work", permission: "progress", needs: null, tone: "primary", description: "Pick this bug up again." },
    { to: "Closed", label: "Close", permission: "verify", needs: "comment", description: "Formally close without further work." },
  ],
  Verified: [
    { to: "Closed", label: "Close bug", permission: "verify", needs: "note", tone: "primary", description: "Formally close this bug." },
    { to: "Reopened", label: "Reopen", permission: "verify", needs: "comment", tone: "danger", description: "The issue has come back." },
  ],
  Closed: [{ to: "Reopened", label: "Reopen", permission: "verify", needs: "comment", tone: "danger", description: "The issue has come back." }],
};

export function allTransitions(status: Status) {
  return T[status];
}

export function availableTransitions(status: Status, perms: Permission[]) {
  return T[status].filter((t) => perms.includes(t.permission));
}

export function canTransition(from: Status, to: Status, perms: Permission[]) {
  return availableTransitions(from, perms).some((t) => t.to === to);
}
