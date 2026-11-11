"use client";
import { CheckCheck } from "lucide-react";
import { useMemo } from "react";
import { BugTable, type ColumnId } from "@/components/bugs/bug-table";
import { PageBody, PageHeader } from "@/components/layout/page-header";
import { EmptyState } from "@/components/ui/controls";
import { useActiveBugs, useMe, usePerms } from "@/lib/hooks";
import { myTaskGroups } from "@/lib/queries";
import { plural } from "@/lib/utils";

const COLS: ColumnId[] = ["id", "title", "module", "severity", "priority", "status", "assignee", "updatedAt"];

export default function MyTasksPage() {
  const bugs = useActiveBugs();
  const me = useMe();
  const { permissions, role } = usePerms();
  const groups = useMemo(() => (me ? myTaskGroups(bugs, me.id, permissions) : []), [bugs, me, permissions]);
  const todo = groups.filter((g) => g.actionable).reduce((n, g) => n + g.bugs.length, 0);
  const visible = groups.filter((g) => g.actionable || g.bugs.length);

  return (
    <PageBody wide>
      <PageHeader title="My Tasks" description={`${plural(todo, "bug")} waiting on you as ${role?.name ?? "a team member"}.`} />
      <div className="mt-8 space-y-10">
        {todo === 0 ? (
          <div className="rounded-lg border border-line">
            <EmptyState icon={<CheckCheck className="size-4" />} title="You're all caught up" body="Nothing needs your attention right now. New assignments and fixes to verify will appear here." />
          </div>
        ) : null}
        {visible.map((g) => (
          <section key={g.id}>
            <div className="mb-3 flex items-baseline gap-2.5">
              <h2 className="text-sm font-semibold text-ink">{g.label}</h2>
              <span className="tnum text-[13px] text-muted">{g.bugs.length}</span>
              <span className="hidden text-[13px] text-muted sm:inline">· {g.description}</span>
            </div>
            {g.bugs.length ? (
              <BugTable bugs={g.bugs} visible={COLS} maxHeightClass="max-h-[420px]" />
            ) : (
              <p className="rounded-lg border border-dashed border-line-strong px-4 py-6 text-center text-[13px] text-muted">Nothing here.</p>
            )}
          </section>
        ))}
      </div>
    </PageBody>
  );
}
