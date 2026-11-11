"use client";
import Link from "next/link";
import { PriorityBadge, StatusBadge } from "@/components/ui/badges";
import { Avatar } from "@/components/ui/avatar";
import { useModuleMap, useUserMap } from "@/lib/hooks";
import type { Bug } from "@/lib/types";
import { timeAgo } from "@/lib/utils";

export function CompactList({ bugs, showStatus = true, showAssignee }: { bugs: Bug[]; showStatus?: boolean; showAssignee?: boolean }) {
  const modules = useModuleMap();
  const users = useUserMap();
  return (
    <ul className="divide-y divide-line">
      {bugs.map((b) => {
        const u = b.assigneeId ? users.get(b.assigneeId) : null;
        return (
          <li key={b.id}>
            <Link href={`/bugs/${b.id}`} className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-wash">
              <div className="min-w-0 flex-1">
                <p className="truncate text-[13.5px] font-medium text-ink" title={b.title}>{b.title}</p>
                <p className="mt-0.5 flex items-center gap-1.5 truncate text-xs text-muted">
                  <span className="tnum">{b.id}</span>
                  <span className="text-faint">·</span>
                  <span className="truncate">{modules.get(b.moduleId)?.name}</span>
                  <span className="text-faint">·</span>
                  <span>{timeAgo(b.updatedAt)}</span>
                </p>
              </div>
              {showAssignee && u ? <Avatar name={u.name} id={u.id} size={22} /> : null}
              <PriorityBadge priority={b.priority} className="hidden sm:inline-flex" />
              {showStatus ? <StatusBadge status={b.status} verified={!!b.verifiedAt} className="hidden w-[138px] justify-start text-xs md:inline-flex" /> : null}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
