import type { Category, Permission, Priority, Severity, Status } from "./types";

export const STATUS_META: Record<Status, { color: string; dot: string; text: string; tint: string; hint: string }> = {
  Open: { color: "var(--color-st-open)", dot: "bg-st-open", text: "text-st-open", tint: "bg-st-open/10", hint: "Reported and awaiting developer action" },
  "In Progress": { color: "var(--color-st-progress)", dot: "bg-st-progress", text: "text-st-progress", tint: "bg-st-progress/10", hint: "A developer is actively working on it" },
  "Ready for Testing": { color: "var(--color-st-testing)", dot: "bg-st-testing", text: "text-st-testing", tint: "bg-st-testing/10", hint: "Fix submitted and waiting for verification" },
  Verified: { color: "var(--color-st-verified)", dot: "bg-st-verified", text: "text-st-verified", tint: "bg-st-verified/10", hint: "The reporter has confirmed the fix" },
  Reopened: { color: "var(--color-st-reopened)", dot: "bg-st-reopened", text: "text-st-reopened", tint: "bg-st-reopened/10", hint: "The issue persists or the fix was unsuccessful" },
  Closed: { color: "var(--color-st-closed)", dot: "bg-st-closed", text: "text-st-closed", tint: "bg-st-closed/10", hint: "Formally closed" },
};

export const SEVERITY_META: Record<Severity, { dot: string; text: string; tint: string; order: number; hint: string }> = {
  Critical: { dot: "bg-sev-critical", text: "text-sev-critical", tint: "bg-sev-critical/10", order: 0, hint: "Blocks a core task or loses data. No workaround." },
  High: { dot: "bg-sev-high", text: "text-sev-high", tint: "bg-sev-high/10", order: 1, hint: "Major feature is broken or unusable. A workaround is hard." },
  Medium: { dot: "bg-sev-medium", text: "text-sev-medium", tint: "bg-sev-medium/10", order: 2, hint: "Noticeable problem with a reasonable workaround." },
  Low: { dot: "bg-sev-low", text: "text-sev-low", tint: "bg-sev-low/10", order: 3, hint: "Cosmetic or minor issue with no effect on the task." },
};

export const PRIORITY_HINTS: Record<Priority, string> = {
  P0: "Drop everything. Fix before anything else ships.",
  P1: "Fix in the current cycle, ahead of planned work.",
  P2: "Schedule into the upcoming cycle.",
  P3: "Backlog. Fix when capacity allows.",
};

export const SEVERITY_TO_PRIORITY: Record<Severity, Priority> = { Critical: "P0", High: "P1", Medium: "P2", Low: "P3" };

/** Segment filters: "Open" groups Open + Reopened, "Resolved" groups Verified + Closed. */
export const SEGMENTS = [
  { id: "all", label: "All", statuses: null },
  { id: "open", label: "Open", statuses: ["Open", "Reopened"] },
  { id: "progress", label: "In Progress", statuses: ["In Progress"] },
  { id: "testing", label: "Ready for Testing", statuses: ["Ready for Testing"] },
  { id: "resolved", label: "Resolved", statuses: ["Verified", "Closed"] },
] as const satisfies readonly { id: string; label: string; statuses: readonly Status[] | null }[];

export type SegmentId = (typeof SEGMENTS)[number]["id"];

export const CATEGORY_HINT: Record<Category, string> = {
  "UI/Visual": "Layout, spacing, colour or design-system mismatches",
  Functional: "Behaviour that doesn't work as intended",
  Responsive: "Problems at specific screen sizes or devices",
  Performance: "Slowness, lag or excessive loading",
  Data: "Wrong, missing or stale information",
  Accessibility: "Keyboard, screen reader or contrast issues",
};

export const ALL_PERMISSIONS: Permission[] = ["report", "edit", "assign", "progress", "verify", "archive", "manage"];
