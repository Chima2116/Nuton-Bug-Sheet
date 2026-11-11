"use client";
import { ArrowRight, BadgeCheck, ChevronDown, Link2, MoreHorizontal, Pencil, UserPlus } from "lucide-react";
import Link from "next/link";
import { useState, type ReactNode } from "react";
import { PageBody } from "@/components/layout/page-header";
import { Dropzone } from "@/components/report/dropzone";
import { Avatar } from "@/components/ui/avatar";
import { PriorityBadge, SeverityBadge, StatusBadge, Tag } from "@/components/ui/badges";
import { Button, ButtonLink } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/controls";
import { Menu, MenuContent, MenuItem, MenuLabel, MenuSeparator, MenuTrigger } from "@/components/ui/overlay";
import { useToast } from "@/components/ui/toast";
import { useBug, useMe, useModuleMap, useUserMap } from "@/lib/hooks";
import { visibleAttachments } from "@/lib/blobs";
import { addAttachments } from "@/lib/store";
import { STATUSES, type Bug } from "@/lib/types";
import { formatDate, formatDateTime, timeAgo } from "@/lib/utils";
import { quickActions } from "@/lib/workflow";
import { ActivityLog } from "./activity";
import { AssigneeMenu } from "./assignee-menu";
import { AttachmentGrid } from "./attachments";
import { EditSheet } from "./edit-sheet";
import { useBugActions } from "./use-bug-actions";

function Section({ title, count, children, id }: { title: string; count?: number; children: ReactNode; id?: string }) {
  return (
    <section id={id} className="scroll-mt-6 border-t border-line pt-6">
      <h2 className="mb-4 text-sm font-semibold text-ink">
        {title}
        {count !== undefined ? <span className="tnum ml-1.5 font-normal text-muted">{count}</span> : null}
      </h2>
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
        <EmptyState title="Bug not found" body={`There's no bug with the ID ${id.toUpperCase()}. The link may be wrong.`} action={<ButtonLink href="/bugs">Back to All Bugs</ButtonLink>} />
      </PageBody>
    );
  return <Detail bug={bug} />;
}

function Detail({ bug }: { bug: Bug }) {
  const users = useUserMap();
  const modules = useModuleMap();
  const me = useMe();
  const { toast } = useToast();
  const { setStatus, verify, run } = useBugActions();
  const [editOpen, setEditOpen] = useState(false);

  const reporter = users.get(bug.reporterId);
  const assignee = bug.assigneeId ? users.get(bug.assigneeId) : null;
  const verifier = bug.verifiedById ? users.get(bug.verifiedById) : null;
  const actions = quickActions(bug);
  const canVerify = bug.status === "Ready for Testing" || (bug.status === "Resolved" && !bug.verifiedAt);

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      toast("Link copied.");
    } catch {
      toast("Couldn't copy the link.", { tone: "error" });
    }
  };

  const statusMenu = (trigger: ReactNode, align: "start" | "end" = "start") => (
    <Menu>
      <MenuTrigger asChild>{trigger}</MenuTrigger>
      <MenuContent align={align} className="w-[212px]">
        <MenuLabel>Status</MenuLabel>
        {STATUSES.map((st) => (
          <MenuItem key={st} selected={bug.status === st} onSelect={() => void setStatus(bug, st)}>
            <StatusBadge status={st} />
          </MenuItem>
        ))}
        {canVerify ? (
          <>
            <MenuSeparator />
            <MenuItem icon={<BadgeCheck className="size-4" />} onSelect={() => void verify(bug)}>Mark as verified</MenuItem>
          </>
        ) : null}
      </MenuContent>
    </Menu>
  );

  return (
    <PageBody>
      <Link href="/bugs" className="mb-5 inline-flex items-center gap-1.5 text-[13px] text-muted hover:text-ink">
        <ArrowRight className="size-3.5 rotate-180" /> All Bugs
      </Link>

      <header className="flex flex-wrap items-start justify-between gap-x-8 gap-y-4">
        <div className="min-w-0 flex-1 basis-[420px]">
          <div className="mb-2.5 flex flex-wrap items-center gap-2.5">
            <span className="tnum text-[13px] font-medium text-muted">{bug.id}</span>
            <StatusBadge status={bug.status} verified={!!bug.verifiedAt} pill />
            <SeverityBadge severity={bug.severity} pill />
            <PriorityBadge priority={bug.priority} />
          </div>
          <h1 className="font-display text-[28px] leading-[1.2] text-ink sm:text-[32px]">{bug.title}</h1>
          <p className="mt-2 text-[13px] text-muted">
            Reported by <span className="text-ink-2">{reporter?.name}</span> on {formatDate(bug.reportedAt)} · Updated {timeAgo(bug.updatedAt)}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {actions.map((a) => (
            <Button key={a.id} variant={a.tone === "primary" ? "primary" : a.tone === "danger" ? "danger" : "secondary"} onClick={() => void run(bug, a)}>
              {a.verify ? <BadgeCheck className="size-4" /> : null}
              {a.label}
            </Button>
          ))}
          {statusMenu(<Button>Status <ChevronDown className="size-3.5 text-muted" /></Button>, "end")}
          <AssigneeMenu bug={bug} align="end">
            <Button><UserPlus className="size-3.5" /> Assign</Button>
          </AssigneeMenu>
          <Button onClick={() => setEditOpen(true)}><Pencil className="size-3.5" /> Edit</Button>
          <Menu>
            <MenuTrigger asChild>
              <Button size="icon" variant="secondary" aria-label="More actions"><MoreHorizontal className="size-4" /></Button>
            </MenuTrigger>
            <MenuContent className="w-[180px]">
              <MenuItem icon={<Link2 className="size-4" />} onSelect={copyLink}>Copy link</MenuItem>
            </MenuContent>
          </Menu>
        </div>
      </header>

      <div className="mt-8 grid gap-x-12 gap-y-10 lg:grid-cols-[minmax(0,1fr)_320px]">
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

          <Section title="Attachments" count={visibleAttachments(bug.attachments).length} id="attachments">
            {visibleAttachments(bug.attachments).length ? <AttachmentGrid items={bug.attachments} columns="grid-cols-2 sm:grid-cols-3" /> : <p className="mb-3 text-[13px] text-muted">No screenshots or recordings were attached.</p>}
            <div className="mt-4">
              <Dropzone userId={me?.id ?? ""} compact pasteTarget={false} onAdd={async (a) => { if ((await addAttachments(bug.id, a)).ok) toast(a.length === 1 ? "Attachment added." : `${a.length} attachments added.`); }} />
            </div>
          </Section>

          <Section title="Activity" count={bug.activity.length} id="activity">
            <ActivityLog bug={bug} />
          </Section>
        </div>

        <aside className="min-w-0 space-y-8 lg:sticky lg:top-6 lg:self-start">
          <section>
            <h2 className="mb-3 text-sm font-semibold text-ink">Status</h2>
            <dl className="divide-y divide-line border-y border-line">
              <Prop label="Status">
                {statusMenu(
                  <button className="-mx-1.5 flex items-center gap-1.5 rounded-md px-1.5 py-0.5 hover:bg-wash" aria-label="Change status">
                    <StatusBadge status={bug.status} verified={!!bug.verifiedAt} />
                    <ChevronDown className="size-3 text-faint" />
                  </button>,
                )}
              </Prop>
              <Prop label="Assignee">
                <AssigneeMenu bug={bug}>
                  <button className="-mx-1.5 flex items-center gap-2 rounded-md px-1.5 py-0.5 hover:bg-wash" aria-label="Change assignee">
                    {assignee ? <><Avatar name={assignee.name} id={assignee.id} size={20} />{assignee.name}</> : <span className="text-muted">Unassigned</span>}
                    <ChevronDown className="size-3 text-faint" />
                  </button>
                </AssigneeMenu>
              </Prop>
              {bug.verifiedAt ? <Prop label="Verified"><span title={formatDateTime(bug.verifiedAt)}>{verifier?.name ? `${verifier.name.split(" ")[0]} · ` : ""}{formatDate(bug.verifiedAt)}</span></Prop> : null}
              {bug.status === "Resolved" && bug.resolvedAt ? <Prop label="Resolved"><span title={formatDateTime(bug.resolvedAt)}>{formatDate(bug.resolvedAt)}</span></Prop> : null}
            </dl>
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
              <Prop label="Reporter"><span className="flex items-center gap-2"><Avatar name={reporter?.name ?? "?"} id={reporter?.id} size={20} />{reporter?.name}</span></Prop>
              <Prop label="Reported"><span title={formatDateTime(bug.reportedAt)}>{formatDate(bug.reportedAt)}</span></Prop>
              <Prop label="Updated"><span title={formatDateTime(bug.updatedAt)}>{timeAgo(bug.updatedAt)}</span></Prop>
            </dl>
          </section>
        </aside>
      </div>

      <EditSheet bug={bug} open={editOpen} onOpenChange={setEditOpen} />
    </PageBody>
  );
}
