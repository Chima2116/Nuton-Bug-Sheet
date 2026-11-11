import { SEGMENTS, SEVERITY_META, STATUS_META, type SegmentId } from "@/lib/constants";
import { STATUSES, type Bug, type Priority, type Severity, type Status } from "@/lib/types";

export type DateRange = "any" | "today" | "7d" | "30d" | "custom";

export interface Filters {
  q: string;
  segment: SegmentId;
  status: Status[];
  severity: Severity[];
  module: string[];
  assignee: string[]; // user ids, "me", or "unassigned"
  date: DateRange;
  from: string;
  to: string;
}

export const EMPTY_FILTERS: Filters = { q: "", segment: "all", status: [], severity: [], module: [], assignee: [], date: "any", from: "", to: "" };

export function activeFilterCount(f: Filters) {
  return (f.q.trim() ? 1 : 0) + (f.status.length ? 1 : 0) + (f.severity.length ? 1 : 0) + (f.module.length ? 1 : 0) + (f.assignee.length ? 1 : 0) + (f.date !== "any" ? 1 : 0) + (f.segment !== "all" ? 1 : 0);
}

export type SortKey = "id" | "title" | "module" | "severity" | "priority" | "status" | "assignee" | "reporter" | "reportedAt" | "updatedAt";
export interface Sort {
  key: SortKey;
  dir: "asc" | "desc";
}

interface Ctx {
  meId: string;
  moduleName: (id: string) => string;
  userName: (id: string | null) => string;
}

export function applyFilters(bugs: Bug[], f: Filters, ctx: Ctx, now = Date.now()) {
  const q = f.q.trim().toLowerCase();
  const seg = SEGMENTS.find((s) => s.id === f.segment);
  const dayMs = 86_400_000;
  const startOfToday = new Date(new Date(now).setHours(0, 0, 0, 0)).getTime();
  return bugs.filter((b) => {
    if (seg?.statuses && !(seg.statuses as readonly Status[]).includes(b.status)) return false;
    if (f.status.length && !f.status.includes(b.status)) return false;
    if (f.severity.length && !f.severity.includes(b.severity)) return false;
    if (f.module.length && !f.module.includes(b.moduleId)) return false;
    if (f.assignee.length) {
      const ok = f.assignee.some((a) => (a === "unassigned" ? !b.assigneeId : a === "me" ? b.assigneeId === ctx.meId : b.assigneeId === a));
      if (!ok) return false;
    }
    if (f.date !== "any") {
      const t = new Date(b.reportedAt).getTime();
      if (f.date === "today" && t < startOfToday) return false;
      if (f.date === "7d" && t < now - 7 * dayMs) return false;
      if (f.date === "30d" && t < now - 30 * dayMs) return false;
      if (f.date === "custom") {
        if (f.from && t < new Date(f.from + "T00:00:00").getTime()) return false;
        if (f.to && t > new Date(f.to + "T23:59:59").getTime()) return false;
      }
    }
    if (q) {
      const hay = [b.id, b.title, b.description, ctx.moduleName(b.moduleId), ctx.userName(b.assigneeId), ctx.userName(b.reporterId), b.category, b.status, b.severity, b.priority].join(" ").toLowerCase();
      if (!q.split(/\s+/).every((w) => hay.includes(w))) return false;
    }
    return true;
  });
}

const prio: Record<Priority, number> = { P0: 0, P1: 1, P2: 2, P3: 3 };

export function sortBugs(bugs: Bug[], sort: Sort, ctx: Ctx) {
  const dir = sort.dir === "asc" ? 1 : -1;
  const val = (b: Bug): string | number => {
    switch (sort.key) {
      case "id": return b.seq;
      case "title": return b.title.toLowerCase();
      case "module": return ctx.moduleName(b.moduleId).toLowerCase();
      case "severity": return SEVERITY_META[b.severity].order;
      case "priority": return prio[b.priority];
      case "status": return STATUSES.indexOf(b.status);
      case "assignee": return b.assigneeId ? ctx.userName(b.assigneeId).toLowerCase() : "￿";
      case "reporter": return ctx.userName(b.reporterId).toLowerCase();
      case "reportedAt": return +new Date(b.reportedAt);
      case "updatedAt": return +new Date(b.updatedAt);
    }
  };
  return [...bugs].sort((a, b) => {
    const x = val(a), y = val(b);
    const c = x < y ? -1 : x > y ? 1 : 0;
    return c * dir || b.seq - a.seq;
  });
}

export { STATUS_META };
