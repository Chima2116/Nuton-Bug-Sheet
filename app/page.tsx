"use client";
import { ArrowRight, Bug, Plus } from "lucide-react";
import Link from "next/link";
import { useMemo } from "react";
import { CompactList } from "@/components/bugs/compact-list";
import { PageBody, PageHeader } from "@/components/layout/page-header";
import { Avatar } from "@/components/ui/avatar";
import { useReport } from "@/components/report/report-host";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/controls";
import { feedVerb } from "@/lib/activity";
import { useActiveBugs, useMe, usePerms, useUserMap } from "@/lib/hooks";
import { countsByStatus, myTasks } from "@/lib/queries";
import { timeAgo } from "@/lib/utils";

function Metric({ label, value, note, href, dot }: { label: string; value: number; note: string; href: string; dot?: string }) {
  return (
    <Link href={href} className="group rounded-2xl bg-wash px-5 py-5 transition-all hover:bg-wash-2 hover:shadow-[var(--shadow-card)]">
      <p className="flex items-center gap-2 text-[13px] text-muted">
        {dot ? <span className={`size-2 rounded-full ${dot}`} /> : null}
        {label}
      </p>
      <p className="tnum mt-4 text-[34px] font-semibold leading-none tracking-[-0.03em] text-ink">{value}</p>
      <p className="mt-3 truncate text-xs text-muted">{note}</p>
    </Link>
  );
}

function Panel({ title, href, hrefLabel = "View all", children }: { title: string; href?: string; hrefLabel?: string; children: React.ReactNode }) {
  return (
    <section className="overflow-hidden rounded-2xl border border-line bg-white">
      <div className="flex items-center justify-between border-b border-line px-5 py-3.5">
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
  const { can } = usePerms();
  const { open } = useReport();
  const counts = useMemo(() => countsByStatus(bugs), [bugs]);
  const recent = useMemo(() => [...bugs].sort((a, b) => +new Date(b.updatedAt) - +new Date(a.updatedAt)).slice(0, 8), [bugs]);
  const mine = useMemo(() => (me ? myTasks(bugs, me.id) : []), [bugs, me]);
  const feed = useMemo(
    () =>
      bugs
        .flatMap((b) => b.activity.filter((a) => a.type !== "attachment").map((a) => ({ a, b })))
        .sort((x, y) => +new Date(y.a.at) - +new Date(x.a.at))
        .slice(0, 8),
    [bugs],
  );
  const weekAgo = Date.now() - 7 * 86_400_000;
  const newThisWeek = bugs.filter((b) => +new Date(b.reportedAt) > weekAgo).length;

  return (
    <PageBody>
      <PageHeader title={`Welcome back, ${me?.name.split(" ")[0] ?? ""}`} description="Where your team's bugs stand right now." />

      <div className="mt-7 grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
        <Metric label="Total Bugs" value={counts.total} note={`${newThisWeek} reported this week`} href="/bugs" />
        <Metric dot="bg-st-open" label="Open" value={counts.open} note={counts.reopened ? `Includes ${counts.reopened} reopened` : "Waiting to be picked up"} href="/bugs?segment=open" />
        <Metric dot="bg-st-progress" label="In Progress" value={counts.progress} note="Being worked on" href="/bugs?segment=progress" />
        <Metric dot="bg-st-testing" label="Ready for Testing" value={counts.testing} note="Waiting to be checked" href="/bugs?segment=testing" />
        <Metric dot="bg-st-verified" label="Resolved" value={counts.resolved} note="Fixed and on record" href="/bugs?segment=resolved" />
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
              action={can("report") ? <Button variant="primary" className="rounded-full" onClick={() => open()}><Plus className="size-4" strokeWidth={2.25} /> New bug</Button> : undefined}
            />
          )}
        </Panel>

        <div className="space-y-6">
          <Panel title="Assigned to you" href="/my-tasks">
            {mine.length ? <CompactList bugs={mine.slice(0, 4)} showStatus={false} /> : <p className="px-5 py-8 text-center text-[13px] text-muted">Nothing assigned to you right now.</p>}
          </Panel>
          <Panel title="Activity">
            {feed.length === 0 ? (
              <p className="px-4 py-8 text-center text-[13px] text-muted">Updates from both of you will show up here.</p>
            ) : (
              <ul className="divide-y divide-line/70">
                {feed.map(({ a, b }) => {
                  const actor = users.get(a.actorId);
                  return (
                    <li key={a.id}>
                      <Link href={`/bugs/${b.id}`} className="flex gap-3 px-5 py-3.5 hover:bg-wash/70">
                        <Avatar name={actor?.name ?? "?"} id={actor?.id} size={24} className="mt-0.5" />
                        <div className="min-w-0 flex-1">
                          <p className="text-[13px] leading-snug text-ink-2"><span className="font-medium text-ink">{actor?.name}</span> {feedVerb(a, b, users)}</p>
                          {a.text && (a.type === "comment" || a.type === "status" || a.type === "verified") ? <p className="mt-0.5 line-clamp-1 text-xs text-muted">{a.text}</p> : null}
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
