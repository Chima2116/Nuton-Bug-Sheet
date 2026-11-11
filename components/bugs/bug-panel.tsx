"use client";
import { BadgeCheck, ChevronDown, Link2, MoreHorizontal, Pencil } from "lucide-react";
import { useState, type ReactNode } from "react";
import { Dropzone } from "@/components/report/dropzone";
import { Avatar } from "@/components/ui/avatar";
import { PriorityBadge, SeverityBadge, StatusBadge, Tag } from "@/components/ui/badges";
import { Button } from "@/components/ui/button";
import { UnderlineTabs } from "@/components/ui/controls";
import { Menu, MenuContent, MenuItem, MenuLabel, MenuSeparator, MenuTrigger } from "@/components/ui/overlay";
import { useToast } from "@/components/ui/toast";
import { visibleAttachments } from "@/lib/blobs";
import { useMe, useModuleMap, useUserMap } from "@/lib/hooks";
import { addAttachments } from "@/lib/store";
import { STATUSES, type Bug } from "@/lib/types";
import { formatDate, formatDateTime, timeAgo } from "@/lib/utils";
import { quickActions } from "@/lib/workflow";
import { ActivityLog } from "./activity";
import { AssigneeMenu } from "./assignee-menu";
import { AttachmentGrid } from "./attachments";
import { EditSheet } from "./edit-sheet";
import { useBugActions } from "./use-bug-actions";

type Tab = "details" | "activity" | "files";

function Prop({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="mb-1 text-xs text-muted">{label}</dt>
      <dd className="min-w-0 text-[13px] font-medium text-ink">{children}</dd>
    </div>
  );
}

function Block({ title, children, tone }: { title: string; children: ReactNode; tone?: "good" | "bad" }) {
  return (
    <div>
      <h3 className={`mb-2 text-xs font-medium ${tone === "good" ? "text-st-verified" : tone === "bad" ? "text-st-reopened" : "text-muted"}`}>{title}</h3>
      {children}
    </div>
  );
}

/** The whole bug: header, quick actions, and tabs. Used inside the side drawer and on the full page. */
export function BugPanel({ bug, toolbar, className }: { bug: Bug; toolbar?: ReactNode; className?: string }) {
  const users = useUserMap();
  const modules = useModuleMap();
  const me = useMe();
  const { toast } = useToast();
  const { setStatus, verify, run } = useBugActions();
  const [tab, setTab] = useState<Tab>("details");
  const [editOpen, setEditOpen] = useState(false);

  const reporter = users.get(bug.reporterId);
  const assignee = bug.assigneeId ? users.get(bug.assigneeId) : null;
  const verifier = bug.verifiedById ? users.get(bug.verifiedById) : null;
  const files = visibleAttachments(bug.attachments);
  const actions = quickActions(bug);
  const canVerify = bug.status === "Ready for Testing" || (bug.status === "Resolved" && !bug.verifiedAt);

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/bugs/${bug.id}`);
      toast("Link copied.");
    } catch {
      toast("Couldn't copy the link.", { tone: "error" });
    }
  };

  const statusMenu = (trigger: ReactNode) => (
    <Menu>
      <MenuTrigger asChild>{trigger}</MenuTrigger>
      <MenuContent align="start" className="w-[212px]">
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
    <div className={className}>
      {toolbar}
      <div className="px-6 pb-2 pt-5 sm:px-8">
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <span className="tnum text-xs font-medium text-muted">{bug.id}</span>
          <StatusBadge status={bug.status} verified={!!bug.verifiedAt} pill />
          <SeverityBadge severity={bug.severity} pill />
          <PriorityBadge priority={bug.priority} />
        </div>
        <h2 className="font-display text-[22px] leading-[1.25] text-ink sm:text-[24px]">{bug.title}</h2>
        <p className="mt-2 text-[13px] text-muted">
          Reported by <span className="text-ink-2">{reporter?.name}</span> · {formatDate(bug.reportedAt)} · Updated {timeAgo(bug.updatedAt)}
        </p>

        <div className="mt-5 flex flex-wrap items-center gap-2">
          {actions.map((a) => (
            <Button key={a.id} variant={a.tone === "primary" ? "primary" : "secondary"} className="rounded-full" onClick={() => void run(bug, a)}>
              {a.verify ? <BadgeCheck className="size-4" /> : null}
              {a.label}
            </Button>
          ))}
          {statusMenu(<Button className="rounded-full">Status <ChevronDown className="size-3.5 text-muted" /></Button>)}
          <Button className="rounded-full" onClick={() => setEditOpen(true)}><Pencil className="size-3.5" /> Edit</Button>
          <Menu>
            <MenuTrigger asChild>
              <Button size="icon" variant="secondary" className="rounded-full" aria-label="More actions"><MoreHorizontal className="size-4" /></Button>
            </MenuTrigger>
            <MenuContent className="w-[180px]">
              <MenuItem icon={<Link2 className="size-4" />} onSelect={copyLink}>Copy link</MenuItem>
            </MenuContent>
          </Menu>
        </div>
      </div>

      <div className="mt-3 px-6 sm:px-8">
        <UnderlineTabs
          value={tab}
          onChange={setTab}
          options={[
            { id: "details", label: "Details" },
            { id: "activity", label: "Activity", count: bug.activity.length },
            { id: "files", label: "Files", count: files.length },
          ]}
        />
      </div>

      <div className="px-6 pb-10 pt-6 sm:px-8">
        {tab === "details" ? (
          <div className="space-y-7">
            <dl className="grid grid-cols-2 gap-x-6 gap-y-5 rounded-2xl bg-wash p-5 sm:grid-cols-3">
              <Prop label="Status">
                {statusMenu(
                  <button className="-mx-1.5 flex items-center gap-1 rounded-md px-1.5 py-0.5 hover:bg-wash-2" aria-label="Change status">
                    <StatusBadge status={bug.status} verified={!!bug.verifiedAt} />
                    <ChevronDown className="size-3 text-faint" />
                  </button>,
                )}
              </Prop>
              <Prop label="Assignee">
                <AssigneeMenu bug={bug}>
                  <button className="-mx-1.5 flex max-w-full items-center gap-2 rounded-md px-1.5 py-0.5 hover:bg-wash-2" aria-label="Change assignee">
                    {assignee ? <><Avatar name={assignee.name} id={assignee.id} size={20} /><span className="truncate">{assignee.name}</span></> : <span className="font-normal text-muted">Unassigned</span>}
                    <ChevronDown className="size-3 shrink-0 text-faint" />
                  </button>
                </AssigneeMenu>
              </Prop>
              <Prop label="Module">{modules.get(bug.moduleId)?.name ?? <span className="font-normal text-faint">None</span>}</Prop>
              <Prop label="Severity"><SeverityBadge severity={bug.severity} /></Prop>
              <Prop label="Priority"><PriorityBadge priority={bug.priority} /></Prop>
              <Prop label="Category"><Tag className="bg-white">{bug.category}</Tag></Prop>
              <Prop label="Environment">{bug.environment ? <span className="font-normal leading-relaxed">{bug.environment}</span> : <span className="font-normal text-faint">Not provided</span>}</Prop>
              <Prop label="Reported"><span title={formatDateTime(bug.reportedAt)}>{formatDate(bug.reportedAt)}</span></Prop>
              {bug.verifiedAt ? (
                <Prop label="Verified"><span title={formatDateTime(bug.verifiedAt)}>{verifier?.name ? `${verifier.name.split(" ")[0]} · ` : ""}{formatDate(bug.verifiedAt)}</span></Prop>
              ) : bug.status === "Resolved" && bug.resolvedAt ? (
                <Prop label="Resolved"><span title={formatDateTime(bug.resolvedAt)}>{formatDate(bug.resolvedAt)}</span></Prop>
              ) : null}
            </dl>

            <Block title="Summary">
              <p className="whitespace-pre-wrap text-[14.5px] leading-[1.65] text-ink">{bug.description || <span className="text-faint">No summary.</span>}</p>
            </Block>

            {bug.steps.length ? (
              <Block title="Steps to reproduce">
                <ol className="space-y-2.5">
                  {bug.steps.map((s, i) => (
                    <li key={i} className="flex gap-3 text-[14px] leading-relaxed text-ink">
                      <span className="tnum mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-wash-2 text-xs text-muted">{i + 1}</span>
                      {s}
                    </li>
                  ))}
                </ol>
              </Block>
            ) : null}

            {bug.expected || bug.actual ? (
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="rounded-2xl bg-wash p-4">
                  <Block title="Expected" tone="good"><p className="whitespace-pre-wrap text-[13.5px] leading-relaxed text-ink">{bug.expected || <span className="text-faint">Not provided.</span>}</p></Block>
                </div>
                <div className="rounded-2xl bg-wash p-4">
                  <Block title="Actual" tone="bad"><p className="whitespace-pre-wrap text-[13.5px] leading-relaxed text-ink">{bug.actual || <span className="text-faint">Not provided.</span>}</p></Block>
                </div>
              </div>
            ) : null}

            {bug.originalReport ? (
              <details className="group rounded-2xl border border-line">
                <summary className="flex cursor-pointer list-none items-center justify-between rounded-2xl px-4 py-3 text-[13px] text-ink-2 hover:bg-wash">
                  Original note, as written
                  <ChevronDown className="size-4 text-muted transition-transform group-open:rotate-180" />
                </summary>
                <p className="whitespace-pre-wrap border-t border-line px-4 py-3.5 text-[13px] leading-relaxed text-muted">{bug.originalReport}</p>
              </details>
            ) : null}
          </div>
        ) : null}

        {tab === "activity" ? <ActivityLog bug={bug} /> : null}

        {tab === "files" ? (
          <div>
            {files.length ? <AttachmentGrid items={bug.attachments} columns="grid-cols-2 sm:grid-cols-3" /> : <p className="mb-3 text-[13px] text-muted">No screenshots or recordings were attached.</p>}
            <div className="mt-4">
              <Dropzone userId={me?.id ?? ""} compact pasteTarget={false} onAdd={async (a) => { if ((await addAttachments(bug.id, a)).ok) toast(a.length === 1 ? "Attachment added." : `${a.length} attachments added.`); }} />
            </div>
          </div>
        ) : null}
      </div>

      <EditSheet bug={bug} open={editOpen} onOpenChange={setEditOpen} />
    </div>
  );
}
