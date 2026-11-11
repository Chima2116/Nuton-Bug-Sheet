"use client";
import { useSyncExternalStore } from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { bugIdFromSeq } from "./utils";
import { defaultDefinitions, EMPTY_STATE, ROLES, type AppState, type Definitions } from "./state";
import { supabase } from "./supabase";
import type { ActivityItem, AppModule, Attachment, Bug, Draft, Permission, Priority, Severity, Status, User } from "./types";

/* ------------------------------------------------------------------ store */
let state: AppState = EMPTY_STATE;
const listeners = new Set<() => void>();
function set(fn: (s: AppState) => AppState) {
  state = fn(state);
  listeners.forEach((l) => l());
}

export function useStore<T>(selector: (s: AppState) => T): T {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => selector(state),
    () => selector(EMPTY_STATE),
  );
}
export function getState() {
  return state;
}

export function currentUserOf(s: AppState): User | undefined {
  return s.users.find((u) => u.id === s.currentUserId);
}
export function permissionsOf(s: AppState, userId = s.currentUserId): Permission[] {
  const u = s.users.find((x) => x.id === userId);
  return s.roles.find((r) => r.id === u?.roleId)?.permissions ?? [];
}

/* ------------------------------------------------------------------ errors */
let errorHandler: (message: string) => void = () => {};
export function setErrorHandler(fn: (message: string) => void) {
  errorHandler = fn;
}
type Result = { ok: true } | { ok: false; error: string };
function friendly(message: string) {
  if (/violates foreign key constraint.*module/i.test(message)) return "That module is used by existing bugs.";
  if (/row-level security/i.test(message)) return "You don't have permission to do that.";
  if (/Failed to fetch|NetworkError/i.test(message)) return "Can't reach Supabase. Check your connection and try again.";
  return message;
}
function fail(e: { message?: string } | null | undefined, quiet = false): Result {
  const error = friendly(e?.message ?? "Something went wrong.");
  if (!quiet) errorHandler(error);
  return { ok: false, error };
}
const OK: Result = { ok: true };

/* ------------------------------------------------------------------ mapping */
/* eslint-disable @typescript-eslint/no-explicit-any */
function toAttachment(r: any): Attachment {
  return { id: r.id, name: r.name, kind: r.kind, mime: r.mime, size: Number(r.size), path: r.path, variant: r.variant ?? "upload", sourceId: r.source_id ?? undefined, meta: r.meta ?? undefined, addedAt: r.created_at, addedById: r.uploaded_by };
}
function toActivity(r: any): ActivityItem {
  const legacy = (v: string | null) => (v === "Verified" || v === "Closed" ? "Resolved" : v);
  return { id: r.id, type: r.type, actorId: r.actor_id, at: r.created_at, text: r.text ?? undefined, from: r.type === "status" ? legacy(r.from_value) : r.from_value, to: r.type === "status" ? legacy(r.to_value) : r.to_value };
}
/** Until migration 0002 has run, the database may still hold the old statuses. Show them as Resolved. */
function normalizeStatus(s: string): Status {
  return s === "Verified" || s === "Closed" ? "Resolved" : (s as Status);
}
function toBug(r: any): Bug {
  return {
    uuid: r.id,
    id: bugIdFromSeq(Number(r.seq)),
    seq: Number(r.seq),
    title: r.title,
    description: r.description,
    steps: r.steps ?? [],
    expected: r.expected,
    actual: r.actual,
    severity: r.severity,
    priority: r.priority,
    category: r.category,
    moduleId: r.module_id ?? "",
    environment: r.environment,
    attachments: (r.bug_attachments ?? []).map((x: any) => x.attachments).filter(Boolean).map(toAttachment),
    reporterId: r.reporter_id,
    reportedAt: r.created_at,
    updatedAt: r.updated_at,
    status: normalizeStatus(r.status),
    assigneeId: r.assignee_id,
    devNotes: r.dev_notes,
    fixDescription: r.fix_description,
    fixedAt: r.fixed_at ?? undefined,
    resolvedAt: r.resolved_at ?? undefined,
    verifiedAt: r.verified_at ?? undefined,
    verifiedById: r.verified_by ?? undefined,
    archived: r.archived,
    originalReport: r.original_report,
    activity: (r.bug_activity ?? []).map(toActivity).sort((a: ActivityItem, b: ActivityItem) => +new Date(a.at) - +new Date(b.at)),
  };
}
function toUser(r: any): User {
  return { id: r.id, name: r.name, email: r.email, roleId: r.role, lastActiveAt: r.last_active_at };
}
function toModule(r: any): AppModule {
  return { id: r.id, name: r.name, description: r.description, keywords: r.keywords ?? [] };
}

/* ------------------------------------------------------------------ sync */
let channel: RealtimeChannel | null = null;
let reloadTimer: ReturnType<typeof setTimeout> | null = null;
let activeUser = "";

export async function loadAll(): Promise<boolean> {
  if (!supabase || !activeUser) return false;
  const [profiles, modules, bugs, drafts, settings] = await Promise.all([
    supabase.from("profiles").select("*"),
    supabase.from("modules").select("*").order("name"),
    supabase.from("bugs").select("*, bug_activity(*), bug_attachments(attachments(*))").order("created_at", { ascending: false }),
    supabase.from("drafts").select("*").eq("owner_id", activeUser).order("updated_at", { ascending: false }),
    supabase.from("settings").select("*"),
  ]);
  const err = [profiles, modules, bugs, drafts, settings].find((r) => r.error)?.error;
  if (err) {
    const missing = /relation|schema cache|does not exist|Could not find the table/i.test(err.message);
    set((s) => ({
      ...s,
      status: "error",
      error: missing ? "The database isn't set up yet. Run supabase/migrations/0001_init.sql in the Supabase SQL editor, then reload." : friendly(err.message),
    }));
    return false;
  }
  const users = (profiles.data ?? []).map(toUser);
  const me = (profiles.data ?? []).find((p: any) => p.id === activeUser);
  if (!me) {
    set((s) => ({ ...s, status: "error", error: "Your account has no team profile. Make sure your email is listed in team_members, then sign in again." }));
    return false;
  }
  const defs = (settings.data ?? []).find((s: any) => s.key === "definitions")?.value as Partial<Definitions> | undefined;
  const base = defaultDefinitions();
  set((s) => ({
    ...s,
    status: "ready",
    error: "",
    currentUserId: activeUser,
    users,
    roles: ROLES,
    modules: (modules.data ?? []).map(toModule),
    bugs: (bugs.data ?? []).map(toBug),
    drafts: (drafts.data ?? []).map((d: any) => ({ ...d.data, id: d.id, createdAt: d.created_at, updatedAt: d.updated_at }) as Draft),
    definitions: { severity: { ...base.severity, ...defs?.severity }, priority: { ...base.priority, ...defs?.priority } },
    notificationsSeenAt: me.notifications_seen_at,
  }));
  return true;
}

function scheduleReload() {
  if (reloadTimer) clearTimeout(reloadTimer);
  reloadTimer = setTimeout(() => void loadAll(), 350);
}

export async function startSync(userId: string) {
  if (!supabase || activeUser === userId) return;
  stopSync();
  activeUser = userId;
  set((s) => ({ ...s, status: "loading", error: "", currentUserId: userId }));
  const ok = await loadAll();
  if (!ok) return;
  void supabase.from("profiles").update({ last_active_at: new Date().toISOString() }).eq("id", userId);
  channel = supabase
    .channel("nuton-sync")
    .on("postgres_changes", { event: "*", schema: "public" }, scheduleReload)
    .subscribe();
}

export function stopSync() {
  if (channel && supabase) void supabase.removeChannel(channel);
  channel = null;
  if (reloadTimer) clearTimeout(reloadTimer);
  activeUser = "";
  set(() => EMPTY_STATE);
}

export const retryLoad = () => loadAll();

/* ------------------------------------------------------------------ helpers */
const uuidOf = (displayId: string) => state.bugs.find((b) => b.id === displayId)?.uuid;

async function commit<T>(op: PromiseLike<{ error: { message?: string } | null; data?: T }>, quiet = false): Promise<Result> {
  const { error } = await op;
  if (error) return fail(error, quiet);
  await loadAll();
  return OK;
}

/* ------------------------------------------------------------------ bugs */
export interface NewBugInput {
  title: string;
  description: string;
  steps: string[];
  expected: string;
  actual: string;
  severity: Severity;
  priority: Priority;
  category: Bug["category"];
  moduleId: string;
  environment: string;
  attachments: Attachment[];
  originalReport: string;
  assigneeId?: string;
}

/** Creates bugs and links their attachments. Returns the new bug IDs, or null if it failed. */
export async function createBugs(inputs: NewBugInput[]): Promise<string[] | null> {
  if (!supabase) return null;
  const rows = inputs.map((i) => ({
    title: i.title, description: i.description, steps: i.steps, expected: i.expected, actual: i.actual,
    severity: i.severity, priority: i.priority, category: i.category, module_id: i.moduleId || null, environment: i.environment,
    reporter_id: state.currentUserId, original_report: i.originalReport,
  }));
  const { data, error } = await supabase.from("bugs").insert(rows).select("id, seq");
  if (error || !data) {
    fail(error);
    return null;
  }
  // Assign after insert so the assignment is recorded in the activity log by the database.
  for (const assignee of new Set(inputs.map((i) => i.assigneeId).filter(Boolean) as string[])) {
    const ids = data.filter((_: any, i: number) => inputs[i].assigneeId === assignee).map((r: any) => r.id);
    const a = await supabase.from("bugs").update({ assignee_id: assignee }).in("id", ids);
    if (a.error) fail(a.error);
  }
  const links = data.flatMap((row: any, i: number) => inputs[i].attachments.map((a) => ({ bug_id: row.id, attachment_id: a.id })));
  if (links.length) {
    const l = await supabase.from("bug_attachments").insert(links);
    if (l.error) fail(l.error);
  }
  await loadAll();
  return data.map((r: any) => bugIdFromSeq(Number(r.seq)));
}

const COLUMN: Partial<Record<keyof Bug, string>> = {
  title: "title", description: "description", steps: "steps", expected: "expected", actual: "actual", severity: "severity",
  priority: "priority", category: "category", moduleId: "module_id", environment: "environment", devNotes: "dev_notes", fixDescription: "fix_description",
};

export async function updateBugFields(id: string, patch: Partial<Bug>, summary?: string): Promise<Result> {
  const uuid = uuidOf(id);
  if (!supabase || !uuid) return fail({ message: "Bug not found." });
  const row = Object.fromEntries(Object.entries(patch).flatMap(([k, v]) => (COLUMN[k as keyof Bug] ? [[COLUMN[k as keyof Bug]!, v]] : [])));
  const up = await supabase.from("bugs").update(row).eq("id", uuid);
  if (up.error) return fail(up.error);
  if (summary) {
    const a = await supabase.from("bug_activity").insert({ bug_id: uuid, type: "edit", actor_id: state.currentUserId, text: summary });
    if (a.error) return fail(a.error);
  }
  await loadAll();
  return OK;
}
export const saveDevFields = (id: string, patch: Pick<Partial<Bug>, "devNotes" | "fixDescription">, summary: string) => updateBugFields(id, patch, summary);

/** Changes a bug's status immediately. A note is optional. */
export async function changeStatus(id: string, to: Status, opts: { note?: string } = {}): Promise<Result> {
  const bug = state.bugs.find((b) => b.id === id);
  if (!supabase || !bug) return fail({ message: "Bug not found." });
  if (bug.status === to) return OK;
  // Show the change straight away; the database is the source of truth and we re-sync right after.
  patchLocal(id, { status: to, resolvedAt: to === "Resolved" ? new Date().toISOString() : undefined, verifiedAt: to === "Resolved" ? bug.verifiedAt : undefined, verifiedById: to === "Resolved" ? bug.verifiedById : undefined });
  const { error } = await supabase.rpc("change_bug_status", { p_bug: bug.uuid, p_to: to, p_note: opts.note?.trim() || null });
  if (error) {
    await loadAll();
    return fail(error);
  }
  await loadAll();
  return OK;
}

/** Marks the fix as verified (and resolves the bug if it isn't already). */
export async function verifyBug(id: string, opts: { note?: string } = {}): Promise<Result> {
  const bug = state.bugs.find((b) => b.id === id);
  if (!supabase || !bug) return fail({ message: "Bug not found." });
  patchLocal(id, { status: "Resolved", verifiedAt: new Date().toISOString(), verifiedById: state.currentUserId });
  const { error } = await supabase.rpc("verify_bug", { p_bug: bug.uuid, p_note: opts.note?.trim() || null });
  await loadAll();
  return error ? fail(error) : OK;
}

function patchLocal(id: string, patch: Partial<Bug>) {
  set((s) => ({ ...s, bugs: s.bugs.map((b) => (b.id === id ? { ...b, ...patch } : b)) }));
}

export async function assignBug(id: string, userId: string | null): Promise<Result> {
  const uuid = uuidOf(id);
  if (!supabase || !uuid) return fail({ message: "Bug not found." });
  patchLocal(id, { assigneeId: userId });
  return commit(supabase.from("bugs").update({ assignee_id: userId }).eq("id", uuid));
}

export async function addComment(id: string, text: string): Promise<Result> {
  const uuid = uuidOf(id);
  if (!supabase || !uuid || !text.trim()) return OK;
  return commit(supabase.from("bug_activity").insert({ bug_id: uuid, type: "comment", actor_id: state.currentUserId, text: text.trim() }));
}

export async function addAttachments(id: string, atts: Attachment[]): Promise<Result> {
  const uuid = uuidOf(id);
  if (!supabase || !uuid || !atts.length) return OK;
  const l = await supabase.from("bug_attachments").insert(atts.map((a) => ({ bug_id: uuid, attachment_id: a.id })));
  if (l.error) return fail(l.error);
  return commit(supabase.from("bug_activity").insert({ bug_id: uuid, type: "attachment", actor_id: state.currentUserId, text: atts.length === 1 ? `Added ${atts[0].name}` : `Added ${atts.length} attachments` }));
}

/* ------------------------------------------------------------------ drafts */
export async function saveDraft(draft: Draft, opts: { quiet?: boolean } = {}): Promise<Result> {
  if (!supabase) return fail({ message: "Not connected." });
  const { id, createdAt: _c, updatedAt: _u, ...data } = draft; // eslint-disable-line @typescript-eslint/no-unused-vars
  const now = new Date().toISOString();
  const op = supabase.from("drafts").upsert({ id, owner_id: state.currentUserId, data, updated_at: now });
  if (!opts.quiet) return commit(op);
  // Autosave: write through and update the local list without re-reading everything.
  const { error } = await op;
  if (error) return fail(error, true);
  set((s) => {
    const next: Draft = { ...draft, updatedAt: now, createdAt: draft.createdAt || now };
    return { ...s, drafts: s.drafts.some((d) => d.id === id) ? s.drafts.map((d) => (d.id === id ? next : d)) : [next, ...s.drafts] };
  });
  return OK;
}
export async function deleteDraft(id: string): Promise<Result> {
  if (!supabase) return OK;
  return commit(supabase.from("drafts").delete().eq("id", id), true);
}

/** Drafts nobody touched for two weeks are removed so abandoned captures don't pile up. */
export async function pruneOldDrafts(days = 14) {
  if (!supabase) return;
  const cutoff = new Date(Date.now() - days * 86_400_000).toISOString();
  const stale = state.drafts.filter((d) => d.updatedAt < cutoff);
  if (!stale.length) return;
  await supabase.from("drafts").delete().in("id", stale.map((d) => d.id));
  set((s) => ({ ...s, drafts: s.drafts.filter((d) => d.updatedAt >= cutoff) }));
}

/* ------------------------------------------------------------------ team & settings */
export async function markNotificationsSeen() {
  if (!supabase) return;
  const at = new Date().toISOString();
  set((s) => ({ ...s, notificationsSeenAt: at }));
  await supabase.from("profiles").update({ notifications_seen_at: at }).eq("id", state.currentUserId);
}
export async function updateProfileName(name: string): Promise<Result> {
  if (!supabase) return fail({ message: "Not connected." });
  return commit(supabase.from("profiles").update({ name: name.trim() }).eq("id", state.currentUserId));
}
export async function addModule(name: string, description: string): Promise<Result> {
  if (!supabase) return fail({ message: "Not connected." });
  const keywords = name.toLowerCase().split(/\s+/).filter((w) => w.length > 2);
  return commit(supabase.from("modules").insert({ name: name.trim(), description: description.trim(), keywords }));
}
export async function updateModule(id: string, patch: Partial<AppModule>): Promise<Result> {
  if (!supabase) return fail({ message: "Not connected." });
  return commit(supabase.from("modules").update(patch).eq("id", id));
}
export async function removeModule(id: string): Promise<Result> {
  if (!supabase) return fail({ message: "Not connected." });
  return commit(supabase.from("modules").delete().eq("id", id));
}
async function saveDefinitions(next: Definitions): Promise<Result> {
  if (!supabase) return fail({ message: "Not connected." });
  return commit(supabase.from("settings").upsert({ key: "definitions", value: next, updated_at: new Date().toISOString() }));
}
export function setDefinition(kind: "severity" | "priority", key: string, text: string) {
  const d = state.definitions;
  return saveDefinitions({ ...d, [kind]: { ...d[kind], [key]: text } } as Definitions);
}
export const resetDefinitions = () => saveDefinitions(defaultDefinitions());
