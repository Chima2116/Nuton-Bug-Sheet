import { PRIORITY_HINTS, SEVERITY_META } from "./constants";
import type { AppModule, Bug, Draft, Priority, Role, Severity, User } from "./types";

export interface Definitions {
  severity: Record<Severity, string>;
  priority: Record<Priority, string>;
}

export type SyncStatus = "idle" | "loading" | "ready" | "error";

export interface AppState {
  status: SyncStatus;
  error: string;
  currentUserId: string;
  users: User[];
  roles: Role[];
  modules: AppModule[];
  bugs: Bug[];
  drafts: Draft[];
  definitions: Definitions;
  notificationsSeenAt: string;
}

/**
 * Roles and what they can do. Enforced in the UI here and in the database
 * (see supabase/migrations/0001_init.sql). To add a role later, add it here,
 * to the `role` checks in the migration, and to `change_bug_status`.
 */
export const ROLES: Role[] = [
  {
    id: "designer",
    name: "Product Designer",
    description: "Reports and tests bugs.",
    permissions: ["report", "edit", "assign", "progress", "verify", "archive", "manage"],
  },
  {
    id: "developer",
    name: "Developer",
    description: "Fixes bugs.",
    permissions: ["report", "edit", "assign", "progress", "verify", "archive", "manage"],
  },
];

export function defaultDefinitions(): Definitions {
  return {
    severity: Object.fromEntries((Object.keys(SEVERITY_META) as Severity[]).map((k) => [k, SEVERITY_META[k].hint])) as Record<Severity, string>,
    priority: { ...PRIORITY_HINTS },
  };
}

export const EMPTY_STATE: AppState = {
  status: "idle",
  error: "",
  currentUserId: "",
  users: [],
  roles: ROLES,
  modules: [],
  bugs: [],
  drafts: [],
  definitions: defaultDefinitions(),
  notificationsSeenAt: new Date(0).toISOString(),
};

export type { Bug, Draft };
