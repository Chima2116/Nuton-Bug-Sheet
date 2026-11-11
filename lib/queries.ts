import type { Bug, Permission, Status } from "./types";
import { SEGMENTS, type SegmentId } from "./constants";

export interface TaskGroup {
  id: string;
  label: string;
  description: string;
  bugs: Bug[];
  actionable: boolean;
}

const prioOrder = { P0: 0, P1: 1, P2: 2, P3: 3 } as const;
const byPriorityThenUpdated = (a: Bug, b: Bug) => prioOrder[a.priority] - prioOrder[b.priority] || +new Date(b.updatedAt) - +new Date(a.updatedAt);

export function myTaskGroups(all: Bug[], userId: string, perms: Permission[]): TaskGroup[] {
  const bugs = all.filter((b) => !b.archived);
  const groups: TaskGroup[] = [];
  if (perms.includes("verify")) {
    groups.push({
      id: "verify",
      label: "Ready for your verification",
      description: "Fixes submitted for testing. Review them, then verify or reopen.",
      bugs: bugs.filter((b) => b.status === "Ready for Testing").sort((a, b) => Number(b.reporterId === userId) - Number(a.reporterId === userId) || +new Date(b.fixedAt ?? b.updatedAt) - +new Date(a.fixedAt ?? a.updatedAt)),
      actionable: true,
    });
    groups.push({
      id: "reopened",
      label: "Reopened by you",
      description: "Bugs you reopened that are waiting on a developer.",
      bugs: bugs.filter((b) => b.status === "Reopened" && b.activity.some((a) => a.type === "status" && a.to === "Reopened" && a.actorId === userId)).sort(byPriorityThenUpdated),
      actionable: false,
    });
  }
  groups.push({
    id: "assigned",
    label: "Assigned to you",
    description: "Bugs waiting on you or in progress, highest priority first.",
    bugs: bugs.filter((b) => b.assigneeId === userId && ["Open", "Reopened", "In Progress"].includes(b.status)).sort(byPriorityThenUpdated),
    actionable: true,
  });
  if (perms.includes("progress")) {
    groups.push({
      id: "in-review",
      label: "Submitted, awaiting verification",
      description: "Your fixes that are waiting on the reporter.",
      bugs: bugs.filter((b) => b.assigneeId === userId && b.status === "Ready for Testing").sort(byPriorityThenUpdated),
      actionable: false,
    });
  }
  return groups;
}

export function myTasks(all: Bug[], userId: string, perms: Permission[]) {
  const seen = new Set<string>();
  return myTaskGroups(all, userId, perms)
    .filter((g) => g.actionable)
    .flatMap((g) => g.bugs)
    .filter((b) => (seen.has(b.id) ? false : (seen.add(b.id), true)));
}

export function segmentMatches(seg: SegmentId, status: Status) {
  const s = SEGMENTS.find((x) => x.id === seg);
  return !s || s.statuses === null || (s.statuses as readonly Status[]).includes(status);
}

export function countsByStatus(bugs: Bug[]) {
  const c = { total: bugs.length, open: 0, progress: 0, testing: 0, resolved: 0 };
  bugs.forEach((b) => {
    if (b.status === "Open" || b.status === "Reopened") c.open++;
    else if (b.status === "In Progress") c.progress++;
    else if (b.status === "Ready for Testing") c.testing++;
    else c.resolved++;
  });
  return c;
}
