"use client";
import { ArrowRight, Bug, Plus } from "lucide-react";
import Link from "next/link";
import { useMemo } from "react";
import { CompactList } from "@/components/bugs/compact-list";
import { PageBody, PageHeader } from "@/components/layout/page-header";
import { Avatar } from "@/components/ui/avatar";
import { ButtonLink } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/controls";
import { feedVerb } from "@/lib/activity";
import { useActiveBugs, useMe, usePerms, useUserMap } from "@/lib/hooks";
import { countsByStatus, myTaskGroups } from "@/lib/queries";
import { timeAgo } from "@/lib/utils";

function Metric({ label, value, note, href }: { label: string; value: number; note: string; href: string }) {
  return (
    <Link href={href} className="group rounded-lg bg-wash px-4 py-4 transition-colors hover:bg-wash-2">
      <p className="text-[13px] text-muted">{label}</p>
      <p className="tnum mt-3 text-[28px] font-medium leading-none tracking-tight text-ink">{value}</p>
      <p className="mt-2.5 truncate text-xs text-muted">{note}</p>
    </Link>
  );
}

function Panel({ title, href, hrefLabel = "View all", children }: { title: string; href?: string; hrefLabel?: string; children: React.ReactNode }) {
  return (
    <section className="overflow-hidden rounded-lg border border-line bg-white">
      <div className="flex items-center justify-between border-b border-line px-4 py-3">
        <h2 className="text-sm font-semibold text-ink">{title}</h2>
        {href ? (
          <Link href={href} className="inline-flex items-center gap-1 text-[13px] text-muted hover:text-ink">
            {hrefLabel} <ArrowRight className="size-3.5" />
          </Link>
        ) : null}
      </div>
      {children}
    </section>
  );
}

export default function OverviewPage() {
  const bugs = useActiveBugs();
  const me = useMe();
  const users = useUserMap();
  const { permissions, can } = usePerms();
  const counts = useMemo(() => countsByStatus(bugs), [bugs]);
  const recent = useMemo(() => [...bugs].sort((a, b) => +new Date(b.updatedAt) - +new Date(a.updatedAt)).slice(0, 6), [bugs]);
  const groups = useMemo(() => (me ? myTaskGroups(bugs, me.id, permissions).filter((g) => g.actionable) : []), [bugs, me, permissions]);
  const feed = useMemo(
    () =>
      bugs
        .flatMap((b) => b.activity.filter((a) => a.type !== "attachment").map((a) => ({ a, b })))
        .sort((x, y) => +new Date(y.a.at) - +new Date(x.a.at))
        .slice(0, 8),
    [bugs],
  );
  const urgent = bugs.filter((b) => (b.status === "Open" || b.status === "Reopened") && (b.severity === "Critical" || b.severity === "High")).length;
  const weekAgo = Date.now() - 7 * 86_400_000;
  const newThisWeek = bugs.filter((b) => +new Date(b.reportedAt) > weekAgo).length;
  const unassigned = bugs.filter((b) => !b.assigneeId && b.status === "Open").length;

  return (
    <PageBody>
      <PageHeader title={`Welcome back, ${me?.name.split(" ")[0] ?? ""}`} description="Where your team's bugs stand right now." />

      <div className="mt-8 grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
        <Metric label="Total Bugs" value={counts.total} note={`${newThisWeek} reported this week`} href="/bugs" />
        <Metric label="Open" value={counts.open} note={`${urgent} critical or high · ${unassigned} unassigned`} href="/bugs?segment=open" />
        <Metric label="In Progress" value={counts.progress} note="Being worked on" href="/bugs?segment=progress" />
        <Metric label="Ready for Testing" value={counts.testing} note="Waiting for verification" href="/bugs?segment=testing" />
        <Metric label="Resolved" value={counts.resolved} note="Verified or closed" href="/bugs?segment=resolved" />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
        <Panel title="Recently updated" href="/bugs">
          {recent.length ? (
            <CompactList bugs={recent} showAssignee />
          ) : (
            <EmptyState
              icon={<Bug className="size-4" />}
              title="No bugs yet"
              body="When you find something that's off, write it up the way you'd note it down. It becomes a structured bug here."
              action={can("report") ? <ButtonLink href="/report" variant="primary"><Plus className="size-4" strokeWidth={2.25} /> Report your first bug</ButtonLink> : undefined}
            />
          )}
        </Panel>

        <div className="space-y-6">
          {groups.map((g) => (
            <Panel key={g.id} title={g.label} href={g.id === "assigned" ? "/bugs?assignee=me" : g.id === "verify" ? "/bugs?segment=testing" : "/my-tasks"} hrefLabel={g.id === "assigned" ? "Open in sheet" : "View all"}>
              {g.bugs.length ? <CompactList bugs={g.bugs.slice(0, 4)} showStatus={false} /> : <p className="px-4 py-8 text-center text-[13px] text-muted">{g.id === "verify" ? "Nothing is waiting for you to verify." : "Nothing assigned to you right now."}</p>}
            </Panel>
          ))}
          <Panel title="Activity">
            {feed.length === 0 ? <p className="px-4 py-8 text-center text-[13px] text-muted">Updates from both of you will show up here.</p> : (
              <ul className="divide-y divide-line">
                {feed.map(({ a, b }) => {
                  const actor = users.get(a.actorId);
                  return (
                    <li key={a.id}>
                      <Link href={`/bugs/${b.id}`} className="flex gap-3 px-4 py-3 hover:bg-wash">
                        <Avatar name={actor?.name ?? "?"} id={actor?.id} size={24} className="mt-0.5" />
                        <div className="min-w-0 flex-1">
                          <p className="text-[13px] leading-snug text-ink-2"><span className="font-medium text-ink">{actor?.name}</span> {feedVerb(a, b, users)}</p>
                          {a.text && (a.type === "comment" || a.type === "status") ? <p className="mt-0.5 line-clamp-1 text-xs text-muted">{a.text}</p> : null}
                        </div>
                        <span className="shrink-0 pt-0.5 text-xs text-faint">{timeAgo(a.at)}</span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </Panel>
        </div>
      </div>
    </PageBody>
  );
}
