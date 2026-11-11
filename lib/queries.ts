import type { Bug } from "./types";
import { SEGMENTS, type SegmentId } from "./constants";
import type { Status } from "./types";

const prioOrder = { P0: 0, P1: 1, P2: 2, P3: 3 } as const;

/** Bugs assigned to this person that still need work, highest priority first. */
export function myTasks(all: Bug[], userId: string): Bug[] {
  return all
    .filter((b) => b.assigneeId === userId && b.status !== "Resolved")
    .sort((a, b) => prioOrder[a.priority] - prioOrder[b.priority] || +new Date(b.updatedAt) - +new Date(a.updatedAt));
}

export function segmentMatches(seg: SegmentId, status: Status) {
  const s = SEGMENTS.find((x) => x.id === seg);
  return !s || s.statuses === null || (s.statuses as readonly Status[]).includes(status);
}

export function countsByStatus(bugs: Bug[]) {
  const c = { total: bugs.length, open: 0, reopened: 0, progress: 0, testing: 0, resolved: 0 };
  bugs.forEach((b) => {
    if (b.status === "Open") c.open++;
    else if (b.status === "Reopened") {
      c.open++;
      c.reopened++;
    } else if (b.status === "In Progress") c.progress++;
    else if (b.status === "Ready for Testing") c.testing++;
    else c.resolved++;
  });
  return c;
}
