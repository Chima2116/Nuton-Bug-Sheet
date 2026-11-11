"use client";
import { Archive, ArchiveRestore, ArrowRight, Check, ChevronDown, Link2, MessageSquarePlus, MoreHorizontal, Pencil, RotateCcw, UserPlus } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { PageBody } from "@/components/layout/page-header";
import { Avatar } from "@/components/ui/avatar";
import { PriorityBadge, SeverityBadge, StatusBadge, Tag } from "@/components/ui/badges";
import { Button, ButtonLink } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/controls";
import { Label, Textarea } from "@/components/ui/field";
import { Menu, MenuContent, MenuItem, MenuLabel, MenuSeparator, MenuTrigger } from "@/components/ui/overlay";
import { useToast } from "@/components/ui/toast";
import { useBug, useModuleMap, usePerms, useUserMap, useMe } from "@/lib/hooks";
import { addAttachments, changeStatus, saveDevFields, setArchived } from "@/lib/store";
import type { Bug } from "@/lib/types";
import { formatDate, formatDateTime, timeAgo } from "@/lib/utils";
import { availableTransitions, type Transition } from "@/lib/workflow";
import { Dropzone } from "@/components/report/dropzone";
import { ActivityLog } from "./activity";
import { AssigneeMenu } from "./assignee-menu";
import { AttachmentGrid } from "./attachments";
import { EditSheet } from "./edit-sheet";
import { StatusDialog } from "./status-dialog";

function Section({ title, count, children, id, action }: { title: string; count?: number; children: ReactNode; id?: string; action?: ReactNode }) {
  return (
    <section id={id} className="scroll-mt-6 border-t border-line pt-6">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-ink">
          {title}
          {count !== undefined ? <span className="tnum ml-1.5 font-normal text-muted">{count}</span> : null}
        </h2>
        {action}
      </div>
      {children}
    </section>
  );
}

function Prop({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 py-2">
      <dt className="w-24 shrink-0 pt-0.5 text-[13px] text-muted">{label}</dt>
      <dd className="min-w-0 flex-1 text-right text-[13px] text-ink sm:text-left">{children}</dd>
    </div>
  );
}

export function BugDetail({ id }: { id: string }) {
  const bug = useBug(id);
  if (!bug)
    return (
      <PageBody>
        <EmptyState title="Bug not found" body={`There's no bug with the ID ${id.toUpperCase()}. It may have been removed or the link is wrong.`} action={<ButtonLink href="/bugs">Back to All Bugs</ButtonLink>} />
      </PageBody>
    );
  return <Detail bug={bug} />;
}

function Detail({ bug }: { bug: Bug }) {
  const users = useUserMap();
  const modules = useModuleMap();
  const me = useMe();
  const { permissions, can } = usePerms();
  const { toast } = useToast();
  const [editOpen, setEditOpen] = useState(false);
  const [pending, setPending] = useState<Transition | null>(null);
  const composer = useRef<HTMLTextAreaElement>(null);

  const reporter = users.get(bug.reporterId);
  const assignee = bug.assigneeId ? users.get(bug.assigneeId) : null;
  const trs = availableTransitions(bug.status, permissions);
  const inline = trs.filter((t) => t.tone === "primary" || t.tone === "danger");
  const canWork = can("progress");

  const [notes, setNotes] = useState(bug.devNotes);
  const [fix, setFix] = useState(bug.fixDescription);
  useEffect(() => setNotes(bug.devNotes), [bug.devNotes, bug.id]);
  useEffect(() => setFix(bug.fixDescription), [bug.fixDescription, bug.id]);

  const run = async (t: Transition) => {
    if (t.needs === "fix" && fix !== bug.fixDescription) await saveDevFields(bug.id, { fixDescription: fix }, "Updated fix description");
    if (t.needs) return setPending(t);
    const res = await changeStatus(bug.id, t.to);
    if (res.ok) toast(`${bug.id} moved to ${t.to}`);
    else toast(res.error, { tone: "error" });
  };

  const lastStatus = [...bug.activity].reverse().find((a) => a.type === "status" && a.to === bug.status);
  const lastActor = lastStatus ? users.get(lastStatus.actorId) : null;

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      toast("Link copied");
    } catch {
      toast("Couldn't copy the link", { tone: "error" });
    }
  };

  const goComment = () => {
    composer.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    setTimeout(() => composer.current?.focus(), 350);
  };

  const devDirty = notes !== bug.devNotes || fix !== bug.fixDescription;
  const saveDev = async () => {
    const changed: string[] = [];
    if (notes !== bug.devNotes) changed.push("developer notes");
    if (fix !== bug.fixDescription) changed.push("fix description");
    const res = await saveDevFields(bug.id, { devNotes: notes, fixDescription: fix }, `Updated ${changed.join(" and ")}`);
    if (res.ok) toast("Saved");
  };

  return (
    <PageBody>
      <Link href="/bugs" className="mb-5 inline-flex items-center gap-1.5 text-[13px] text-muted hover:text-ink">
        <ArrowRight className="size-3.5 rotate-180" /> All Bugs
      </Link>

      {bug.archived ? (
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-lg bg-wash px-4 py-2.5 text-[13px] text-ink-2">
          <span className="flex items-center gap-2"><Archive className="size-4 text-muted" /> This bug is archived. It is read-only until restored.</span>
          {can("archive") ? <Button size="sm" onClick={async () => { if ((await setArchived([bug.id], false)).ok) toast(`${bug.id} restored`); }}><ArchiveRestore className="size-3.5" /> Restore</Button> : null}
        </div>
      ) : null}

      {/* Header */}
      <header className="flex flex-wrap items-start justify-between gap-x-8 gap-y-4">
        <div className="min-w-0 flex-1 basis-[420px]">
          <div className="mb-2.5 flex flex-wrap items-center gap-2.5">
            <span className="tnum text-[13px] font-medium text-muted">{bug.id}</span>
            <StatusBadge status={bug.status} pill />
            <SeverityBadge severity={bug.severity} pill />
            <PriorityBadge priority={bug.priority} />
          </div>
          <h1 className="font-display text-[28px] leading-[1.2] text-ink sm:text-[32px]">{bug.title}</h1>
          <p className="mt-2 text-[13px] text-muted">
            Reported by <span className="text-ink-2">{reporter?.name}</span> on {formatDate(bug.reportedAt)} · Updated {timeAgo(bug.updatedAt)}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {!bug.archived
            ? inline.map((t) => (
                <Button key={t.to} variant={t.tone === "danger" ? "danger" : "primary"} onClick={() => void run(t)}>
                  {t.to === "Ready for Testing" ? <Check className="size-4" /> : t.to === "Reopened" ? <RotateCcw className="size-3.5" /> : null}
                  {t.label}
                </Button>
              ))
            : null}
          {can("edit") && !bug.archived ? (
            <Button onClick={() => setEditOpen(true)}><Pencil className="size-3.5" /> Edit Bug</Button>
          ) : null}
          {!bug.archived ? (
            <Menu>
              <MenuTrigger asChild>
                <Button>Change Status <ChevronDown className="size-3.5 text-muted" /></Button>
              </MenuTrigger>
              <MenuContent className="w-[260px]">
                <MenuLabel>Move to</MenuLabel>
                {trs.length ? (
                  trs.map((t) => (
                    <MenuItem key={t.to} onSelect={() => void run(t)}>
                      <span className="flex flex-col gap-0.5 py-0.5">
                        <StatusBadge status={t.to} />
                        <span className="whitespace-normal text-xs font-normal text-muted">{t.label}</span>
                      </span>
                    </MenuItem>
                  ))
                ) : (
                  <p className="px-2.5 py-2 text-xs text-muted">
                    {bug.status === "Ready for Testing" || bug.status === "Verified" ? "Only the reporter can verify or reopen this bug." : "No status changes are available for your role."}
                  </p>
                )}
              </MenuContent>
            </Menu>
          ) : null}
          {can("assign") && !bug.archived ? (
            <AssigneeMenu bug={bug} align="end">
              <Button><UserPlus className="size-3.5" /> Assign</Button>
            </AssigneeMenu>
          ) : null}
          <Button onClick={goComment}><MessageSquarePlus className="size-3.5" /> Add Comment</Button>
          <Menu>
            <MenuTrigger asChild>
              <Button size="icon" variant="secondary" aria-label="More actions"><MoreHorizontal className="size-4" /></Button>
            </MenuTrigger>
            <MenuContent className="w-[200px]">
              <MenuItem icon={<Link2 className="size-4" />} onSelect={copyLink}>Copy link</MenuItem>
              {can("archive") ? (
                <>
                  <MenuSeparator />
                  {bug.archived ? (
                    <MenuItem icon={<ArchiveRestore className="size-4" />} onSelect={async () => { if ((await setArchived([bug.id], false)).ok) toast(`${bug.id} restored`); }}>Restore from archive</MenuItem>
                  ) : (
                    <MenuItem icon={<Archive className="size-4" />} disabled={bug.status !== "Verified" && bug.status !== "Closed"} onSelect={async () => { if ((await setArchived([bug.id], true)).ok) toast(`${bug.id} archived`); }}>
                      Archive
                    </MenuItem>
                  )}
                </>
              ) : null}
            </MenuContent>
          </Menu>
        </div>
      </header>

      {/* Contextual banner */}
      {!bug.archived && bug.status === "Ready for Testing" ? (
        <div className="mt-6 rounded-lg border border-st-testing/25 bg-st-testing/[0.05] px-4 py-3 text-[13px] text-ink-2">
          <span className="font-medium text-st-testing">Ready for verification.</span>{" "}
          {lastActor?.name ?? "A developer"} submitted a fix {lastStatus ? timeAgo(lastStatus.at) : ""}. {can("verify") ? "Test the original issue, then verify the fix or reopen the bug with what you found." : "Waiting on the reporter to verify."}
        </div>
      ) : null}
      {!bug.archived && bug.status === "Reopened" ? (
        <div className="mt-6 rounded-lg border border-st-reopened/25 bg-st-reopened/[0.05] px-4 py-3 text-[13px] text-ink-2">
          <span className="font-medium text-st-reopened">Reopened by {lastActor?.name ?? "the reporter"}.</span> {lastStatus?.text ? <>“{lastStatus.text}”</> : null}
        </div>
      ) : null}

      <div className="mt-8 grid gap-x-12 gap-y-10 lg:grid-cols-[minmax(0,1fr)_340px]">
        {/* Main column */}
        <div className="min-w-0 space-y-8">
          <Section title="Bug information" id="info">
            <div className="space-y-6">
              <div>
                <h3 className="mb-1.5 text-xs font-medium uppercase tracking-wide text-faint">Description</h3>
                <p className="whitespace-pre-wrap text-sm leading-relaxed text-ink">{bug.description || <span className="text-faint">No description.</span>}</p>
              </div>
              <div>
                <h3 className="mb-2 text-xs font-medium uppercase tracking-wide text-faint">Steps to reproduce</h3>
                {bug.steps.length ? (
                  <ol className="space-y-2">
                    {bug.steps.map((s, i) => (
                      <li key={i} className="flex gap-3 text-sm leading-relaxed text-ink">
                        <span className="tnum mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-wash text-xs text-muted">{i + 1}</span>
                        {s}
                      </li>
                    ))}
                  </ol>
                ) : (
                  <p className="text-sm text-faint">Not provided.</p>
                )}
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="rounded-lg bg-wash px-4 py-3.5">
                  <h3 className="mb-1.5 text-xs font-medium uppercase tracking-wide text-st-verified">Expected behaviour</h3>
                  <p className="whitespace-pre-wrap text-sm leading-relaxed text-ink">{bug.expected || <span className="text-faint">Not provided.</span>}</p>
                </div>
                <div className="rounded-lg bg-wash px-4 py-3.5">
                  <h3 className="mb-1.5 text-xs font-medium uppercase tracking-wide text-st-reopened">Actual behaviour</h3>
                  <p className="whitespace-pre-wrap text-sm leading-relaxed text-ink">{bug.actual || <span className="text-faint">Not provided.</span>}</p>
                </div>
              </div>
              {bug.originalReport ? (
                <details className="group rounded-lg border border-line">
                  <summary className="flex cursor-pointer list-none items-center justify-between px-4 py-2.5 text-[13px] text-ink-2 hover:bg-wash">
                    Original report
                    <ChevronDown className="size-4 text-muted transition-transform group-open:rotate-180" />
                  </summary>
                  <p className="whitespace-pre-wrap border-t border-line px-4 py-3 text-[13px] leading-relaxed text-muted">{bug.originalReport}</p>
                </details>
              ) : null}
            </div>
          </Section>

          <Section title="Attachments" count={bug.attachments.length} id="attachments">
            {bug.attachments.length ? <AttachmentGrid items={bug.attachments} columns="grid-cols-2 sm:grid-cols-3" /> : <p className="mb-3 text-[13px] text-muted">No screenshots or recordings were attached.</p>}
            {!bug.archived ? (
              <div className="mt-4">
                <Dropzone userId={me?.id ?? ""} compact pasteTarget={false} onAdd={async (a) => { if ((await addAttachments(bug.id, a)).ok) toast(a.length === 1 ? "Attachment added" : `${a.length} attachments added`); }} />
              </div>
            ) : null}
          </Section>

          <Section title="Activity" count={bug.activity.length} id="activity">
            <ActivityLog bug={bug} composerRef={composer} />
          </Section>
        </div>

        {/* Side column */}
        <aside className="min-w-0 space-y-8 lg:sticky lg:top-6 lg:self-start">
          <section>
            <h2 className="mb-3 text-sm font-semibold text-ink">Development</h2>
            <dl className="divide-y divide-line border-y border-line">
              <Prop label="Status"><StatusBadge status={bug.status} /></Prop>
              <Prop label="Assignee">
                {can("assign") && !bug.archived ? (
                  <AssigneeMenu bug={bug}>
                    <button className="-mx-1.5 flex items-center gap-2 rounded-md px-1.5 py-0.5 hover:bg-wash">
                      {assignee ? <><Avatar name={assignee.name} id={assignee.id} size={20} />{assignee.name}</> : <span className="text-muted">Unassigned</span>}
                      <ChevronDown className="size-3 text-faint" />
                    </button>
                  </AssigneeMenu>
                ) : assignee ? (
                  <span className="flex items-center gap-2"><Avatar name={assignee.name} id={assignee.id} size={20} />{assignee.name}</span>
                ) : (
                  <span className="text-muted">Unassigned</span>
                )}
              </Prop>
              <Prop label="Fix submitted">{bug.fixedAt ? formatDate(bug.fixedAt) : <span className="text-faint">—</span>}</Prop>
              <Prop label="Resolved">{bug.resolvedAt ? formatDate(bug.resolvedAt) : <span className="text-faint">—</span>}</Prop>
            </dl>

            <div className="mt-4 space-y-4">
              <div>
                <Label htmlFor="dev-notes">Developer notes</Label>
                {canWork && !bug.archived ? (
                  <Textarea id="dev-notes" autoGrow rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Findings, root cause, implementation approach…" className="min-h-[76px] text-[13px]" />
                ) : (
                  <p className="whitespace-pre-wrap text-[13px] leading-relaxed text-ink-2">{bug.devNotes || <span className="text-faint">None yet.</span>}</p>
                )}
              </div>
              <div>
                <Label htmlFor="fix-desc">Fix description</Label>
                {canWork && !bug.archived ? (
                  <Textarea id="fix-desc" autoGrow rows={3} value={fix} onChange={(e) => setFix(e.target.value)} placeholder="What was changed and where it's deployed. Required to submit for testing." className="min-h-[76px] text-[13px]" />
                ) : (
                  <p className="whitespace-pre-wrap text-[13px] leading-relaxed text-ink-2">{bug.fixDescription || <span className="text-faint">No fix recorded yet.</span>}</p>
                )}
              </div>
              {canWork && !bug.archived && devDirty ? (
                <div className="flex items-center justify-end gap-2">
                  <Button size="sm" variant="ghost" onClick={() => { setNotes(bug.devNotes); setFix(bug.fixDescription); }}>Discard</Button>
                  <Button size="sm" variant="primary" onClick={() => void saveDev()}>Save</Button>
                </div>
              ) : null}
            </div>
          </section>

          <section>
            <h2 className="mb-3 text-sm font-semibold text-ink">Classification</h2>
            <dl className="divide-y divide-line border-y border-line">
              <Prop label="Severity"><SeverityBadge severity={bug.severity} /></Prop>
              <Prop label="Priority"><PriorityBadge priority={bug.priority} /></Prop>
              <Prop label="Category"><Tag>{bug.category}</Tag></Prop>
              <Prop label="Module">{modules.get(bug.moduleId)?.name ?? "—"}</Prop>
              <Prop label="Environment">{bug.environment ? <span className="leading-relaxed">{bug.environment}</span> : <span className="text-faint">Not provided</span>}</Prop>
            </dl>
          </section>

          <section>
            <h2 className="mb-3 text-sm font-semibold text-ink">Details</h2>
            <dl className="divide-y divide-line border-y border-line">
              <Prop label="Reporter">
                <span className="flex items-center gap-2"><Avatar name={reporter?.name ?? "?"} id={reporter?.id} size={20} />{reporter?.name}</span>
              </Prop>
              <Prop label="Reported"><span title={formatDateTime(bug.reportedAt)}>{formatDate(bug.reportedAt)}</span></Prop>
              <Prop label="Updated"><span title={formatDateTime(bug.updatedAt)}>{timeAgo(bug.updatedAt)}</span></Prop>
            </dl>
          </section>
        </aside>
      </div>

      <EditSheet bug={bug} open={editOpen} onOpenChange={setEditOpen} />
      <StatusDialog bug={bug} transition={pending} onClose={() => setPending(null)} />
    </PageBody>
  );
}
