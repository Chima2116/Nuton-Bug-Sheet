import type { Bug, Status } from "./types";

/**
 * Statuses can be changed to anything, by either person, with no reason required.
 * Quick actions are just shortcuts for the most likely next step.
 */
export interface QuickAction {
  id: "start" | "testing" | "resolve" | "verify" | "reopen";
  label: string;
  /** Target status. "verify" also resolves the bug and marks it verified. */
  to: Status;
  verify?: boolean;
  tone: "primary" | "default" | "danger";
}

const START: QuickAction = { id: "start", label: "Start work", to: "In Progress", tone: "primary" };
const TESTING: QuickAction = { id: "testing", label: "Ready for testing", to: "Ready for Testing", tone: "primary" };
const RESOLVE: QuickAction = { id: "resolve", label: "Resolve", to: "Resolved", tone: "default" };
const VERIFY: QuickAction = { id: "verify", label: "Verify", to: "Resolved", verify: true, tone: "primary" };
const REOPEN: QuickAction = { id: "reopen", label: "Reopen", to: "Reopened", tone: "danger" };

export function quickActions(bug: Pick<Bug, "status" | "verifiedAt">): QuickAction[] {
  switch (bug.status) {
    case "Open":
    case "Reopened":
      return [START, RESOLVE];
    case "In Progress":
      return [TESTING, RESOLVE];
    case "Ready for Testing":
      return [VERIFY, REOPEN];
    case "Resolved":
      return bug.verifiedAt ? [REOPEN] : [{ ...VERIFY, label: "Mark as verified", tone: "default" }, REOPEN];
  }
}

/** Toast copy for a status change. */
export function statusToast(to: Status): string {
  if (to === "Resolved") return "Bug marked as resolved.";
  if (to === "Reopened") return "Bug reopened.";
  return "Status updated.";
}
