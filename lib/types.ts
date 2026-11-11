export const SEVERITIES = ["Critical", "High", "Medium", "Low"] as const;
export type Severity = (typeof SEVERITIES)[number];

export const PRIORITIES = ["P0", "P1", "P2", "P3"] as const;
export type Priority = (typeof PRIORITIES)[number];

export const CATEGORIES = ["UI/Visual", "Functional", "Responsive", "Performance", "Data", "Accessibility"] as const;
export type Category = (typeof CATEGORIES)[number];

export const STATUSES = ["Open", "In Progress", "Ready for Testing", "Resolved", "Reopened"] as const;
export type Status = (typeof STATUSES)[number];

export type Permission = "report" | "edit" | "assign" | "progress" | "verify" | "archive" | "manage";

export const PERMISSIONS: { id: Permission; label: string; hint: string }[] = [
  { id: "report", label: "Report bugs", hint: "Create and submit new bug reports" },
  { id: "edit", label: "Edit bugs", hint: "Change bug details and classification" },
  { id: "assign", label: "Assign bugs", hint: "Change who is responsible for a bug" },
  { id: "progress", label: "Work on bugs", hint: "Start work, record fixes, submit for testing" },
  { id: "verify", label: "Verify fixes", hint: "Verify, reopen and close bugs (QA)" },
  { id: "archive", label: "Archive bugs", hint: "Move closed bugs to the archive" },
  { id: "manage", label: "Manage settings", hint: "Team, modules and definitions" },
];

export type RoleId = "designer" | "developer";

export interface Role {
  id: RoleId;
  name: string;
  description: string;
  permissions: Permission[];
}

export interface User {
  id: string;
  name: string;
  email: string;
  roleId: RoleId;
  lastActiveAt: string;
}

export interface AppModule {
  id: string;
  name: string;
  description: string;
  keywords: string[];
}

/** Page context saved with a screenshot captured from Nuton. Never includes cookies, storage or query strings. */
export interface CaptureMeta {
  /** e.g. nuton.app/lesson/photosynthesis (no query or hash) */
  path: string;
  title: string;
  capturedAt: string;
  browser: string;
  os: string;
  screen: string;
  viewport: string;
  /** True when the screenshot came from the fallback renderer rather than tab capture. */
  approximate?: boolean;
}

export interface Attachment {
  id: string;
  name: string;
  kind: "image" | "video" | "file";
  mime: string;
  size: number;
  /** Path of the original file in the private Supabase Storage bucket. */
  path: string;
  /** upload: chosen file. capture: screenshot from Nuton. annotated: the capture with annotations drawn in. */
  variant: "upload" | "capture" | "annotated";
  /** For an annotated image, the id of the untouched original capture. */
  sourceId?: string;
  meta?: CaptureMeta;
  addedAt: string;
  addedById: string;
}

export type ActivityType =
  | "reported"
  | "status"
  | "assignment"
  | "comment"
  | "edit"
  | "attachment"
  | "archive"
  | "verified";

export interface ActivityItem {
  id: string;
  type: ActivityType;
  actorId: string;
  at: string;
  /** Comment body, status note or summary. */
  text?: string;
  from?: string | null;
  to?: string | null;
}

export interface Bug {
  /** Database row id (uuid). */
  uuid: string;
  /** Human-friendly ID, e.g. NUT-0007. Used in URLs. */
  id: string;
  seq: number;
  title: string;
  description: string;
  steps: string[];
  expected: string;
  actual: string;
  severity: Severity;
  priority: Priority;
  category: Category;
  moduleId: string;
  environment: string;
  attachments: Attachment[];
  reporterId: string;
  reportedAt: string;
  updatedAt: string;
  status: Status;
  assigneeId: string | null;
  devNotes: string;
  fixDescription: string;
  fixedAt?: string;
  resolvedAt?: string;
  verifiedAt?: string;
  verifiedById?: string;
  archived: boolean;
  originalReport: string;
  activity: ActivityItem[];
}

export type FieldFlag = "extracted" | "suggested" | "missing";

export type DraftFields = Pick<
  Bug,
  | "title"
  | "description"
  | "steps"
  | "expected"
  | "actual"
  | "environment"
> & {
  severity: Severity | "";
  priority: Priority | "";
  category: Category | "";
  moduleId: string;
};

export interface DraftBug extends DraftFields {
  key: string;
  /** Optional: who the bug is assigned to when it is added to the sheet. */
  assigneeId?: string;
  excerpt: string;
  attachmentIds: string[];
  flags: Partial<Record<keyof DraftFields, FieldFlag>>;
}

/** The evidence-first Report a Bug form (stored in the same drafts table). */
export interface QuickForm {
  title: string;
  description: string;
  severity: Severity | "";
  moduleId: string;
  priority: Priority | "";
  category: Category | "";
  environment: string;
  steps: string[];
  expected: string;
  actual: string;
}

export interface Draft {
  id: string;
  /** "note" for a free-text report; "form" for the older evidence-first form; absent for the oldest drafts. */
  kind?: "form" | "note";
  form?: QuickForm;
  /** Free-text report in progress (kind "note"). */
  note?: string;
  assigneeId?: string;
  original: string;
  attachments: Attachment[];
  moduleHint: string;
  bugs: DraftBug[];
  reporterId: string;
  createdAt: string;
  updatedAt: string;
}
