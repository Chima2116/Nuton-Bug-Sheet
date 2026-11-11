"use client";
import { CheckCheck } from "lucide-react";
import { useMemo } from "react";
import { useBugDrawer } from "@/components/bugs/bug-drawer";
import { BugTable, type ColumnId } from "@/components/bugs/bug-table";
import { PageBody, PageHeader } from "@/components/layout/page-header";
import { EmptyState } from "@/components/ui/controls";
import { useActiveBugs, useMe } from "@/lib/hooks";
import { myTasks } from "@/lib/queries";
import { plural } from "@/lib/utils";

const COLS: ColumnId[] = ["id", "title", "module", "severity", "priority", "status", "updatedAt"];

export default function MyTasksPage() {
  const bugs = useActiveBugs();
  const me = useMe();
  const drawer = useBugDrawer();
  const tasks = useMemo(() => (me ? myTasks(bugs, me.id) : []), [bugs, me]);

  return (
    <PageBody wide>
      <PageHeader title="My Tasks" description={tasks.length ? `${plural(tasks.length, "unresolved bug")} assigned to you, highest priority first.` : "Unresolved bugs assigned to you."} />
      <div className="mt-7">
        {tasks.length ? (
          <BugTable bugs={tasks} visible={COLS} onOpen={(b) => drawer.open(b.id, tasks.map((t) => t.id))} maxHeightClass="max-h-[calc(100dvh-260px)]" />
        ) : (
          <div className="rounded-2xl border border-line">
            <EmptyState icon={<CheckCheck className="size-4" />} title="You're all caught up" body="Bugs assigned to you appear here until they're resolved." />
          </div>
        )}
      </div>
    </PageBody>
  );
}
