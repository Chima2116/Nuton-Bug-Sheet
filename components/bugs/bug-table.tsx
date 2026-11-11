"use client";
import { ArrowDown, ArrowUp, ChevronDown, ChevronsUpDown } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Avatar } from "@/components/ui/avatar";
import { PriorityBadge, SeverityBadge, StatusBadge } from "@/components/ui/badges";
import { Checkbox } from "@/components/ui/controls";
import { Menu, MenuContent, MenuItem, MenuLabel, MenuTrigger } from "@/components/ui/overlay";
import { useToast } from "@/components/ui/toast";
import { useModuleMap, usePerms, useUserMap } from "@/lib/hooks";
import { changeStatus } from "@/lib/store";
import type { Bug } from "@/lib/types";
import { cn, formatDate, timeAgo } from "@/lib/utils";
import { availableTransitions, type Transition } from "@/lib/workflow";
import { AssigneeMenu } from "./assignee-menu";
import type { Sort, SortKey } from "./filters";
import { StatusDialog } from "./status-dialog";

export type ColumnId = "id" | "title" | "module" | "severity" | "priority" | "status" | "assignee" | "reporter" | "reportedAt" | "updatedAt";

export const COLUMNS: { id: ColumnId; label: string; width: number; sort: SortKey; locked?: boolean }[] = [
  { id: "id", label: "Bug ID", width: 100, sort: "id", locked: true },
  { id: "title", label: "Bug Title", width: 0, sort: "title", locked: true },
  { id: "module", label: "Module", width: 156, sort: "module" },
  { id: "severity", label: "Severity", width: 100, sort: "severity" },
  { id: "priority", label: "Priority", width: 84, sort: "priority" },
  { id: "status", label: "Status", width: 164, sort: "status" },
  { id: "assignee", label: "Assignee", width: 164, sort: "assignee" },
  { id: "reporter", label: "Reporter", width: 164, sort: "reporter" },
  { id: "reportedAt", label: "Date Reported", width: 124, sort: "reportedAt" },
  { id: "updatedAt", label: "Last Updated", width: 116, sort: "updatedAt" },
];

const cell = "h-11 border-b border-r border-line/70 px-3 align-middle last:border-r-0";
const CHECK_W = 40;
const TITLE_MIN = 300;

export function BugTable({
  bugs,
  visible,
  sort,
  onSort,
  selectable,
  selected,
  onToggle,
  onToggleAll,
  className,
  emptyState,
  maxHeightClass = "max-h-[calc(100dvh-380px)] min-h-[320px]",
}: {
  bugs: Bug[];
  visible: ColumnId[];
  sort?: Sort;
  onSort?: (k: SortKey) => void;
  selectable?: boolean;
  selected?: Set<string>;
  onToggle?: (id: string) => void;
  onToggleAll?: (all: boolean) => void;
  className?: string;
  emptyState?: React.ReactNode;
  maxHeightClass?: string;
}) {
  const router = useRouter();
  const users = useUserMap();
  const modules = useModuleMap();
  const { permissions, can } = usePerms();
  const { toast } = useToast();
  const [pending, setPending] = useState<{ bug: Bug; transition: Transition } | null>(null);
  const cols = COLUMNS.filter((c) => visible.includes(c.id));
  const fixedWidth = cols.reduce((n, c) => n + c.width, 0) + (selectable ? CHECK_W : 0);
  const idLeft = selectable ? CHECK_W : 0;
  const titleLeft = idLeft + (visible.includes("id") ? COLUMNS[0].width : 0);
  // Identifying columns stay in view while the rest scrolls sideways (desktop only).
  const stick = (id: ColumnId | "check") => {
    if (id === "check") return "lg:sticky lg:left-0";
    if (id === "id") return "lg:sticky";
    if (id === "title") return "lg:sticky lg:shadow-[1px_0_0_var(--color-line-strong)]";
    return "";
  };
  const stickStyle = (id: ColumnId | "check") => (id === "id" ? { left: idLeft } : id === "title" ? { left: titleLeft } : undefined);
  const allSelected = !!selected && bugs.length > 0 && bugs.every((b) => selected.has(b.id));
  const someSelected = !!selected && bugs.some((b) => selected.has(b.id));

  const runTransition = async (bug: Bug, t: Transition) => {
    if (t.needs) return setPending({ bug, transition: t });
    const res = await changeStatus(bug.id, t.to);
    if (res.ok) toast(`${bug.id} moved to ${t.to}`);
    else toast(res.error, { tone: "error" });
  };

  const render = (b: Bug, id: ColumnId) => {
    switch (id) {
      case "id":
        return <span className="tnum whitespace-nowrap text-[13px] text-muted">{b.id}</span>;
      case "title":
        return (
          <span className="block truncate text-[13.5px] font-medium text-ink" title={b.title}>
            {b.title}
          </span>
        );
      case "module":
        return <span className="block truncate text-[13px] text-ink-2">{modules.get(b.moduleId)?.name ?? "—"}</span>;
      case "severity":
        return <SeverityBadge severity={b.severity} />;
      case "priority":
        return <PriorityBadge priority={b.priority} />;
      case "status": {
        const trs = availableTransitions(b.status, permissions);
        if (!trs.length) return <StatusBadge status={b.status} />;
        return (
          <Menu>
            <MenuTrigger asChild>
              <button onClick={(e) => e.stopPropagation()} className="group -mx-1.5 inline-flex items-center gap-1 rounded-md px-1.5 py-1 hover:bg-wash-2 data-[state=open]:bg-wash-2" aria-label={`Change status of ${b.id}`}>
                <StatusBadge status={b.status} />
                <ChevronDown className="size-3 text-faint opacity-0 group-hover:opacity-100 group-data-[state=open]:opacity-100" />
              </button>
            </MenuTrigger>
            <MenuContent align="start" className="w-[220px]" onClick={(e) => e.stopPropagation()}>
              <MenuLabel>Move to</MenuLabel>
              {trs.map((t) => (
                <MenuItem key={t.to} onSelect={() => void runTransition(b, t)}>
                  <span className="flex items-center justify-between gap-3">
                    <StatusBadge status={t.to} className="text-[13px]" />
                  </span>
                </MenuItem>
              ))}
            </MenuContent>
          </Menu>
        );
      }
      case "assignee": {
        const u = b.assigneeId ? users.get(b.assigneeId) : null;
        const inner = u ? (
          <span className="flex min-w-0 items-center gap-2 text-[13px] text-ink">
            <Avatar name={u.name} id={u.id} size={20} />
            <span className="truncate">{u.name}</span>
          </span>
        ) : (
          <span className="text-[13px] text-faint">Unassigned</span>
        );
        if (!can("assign")) return inner;
        return (
          <AssigneeMenu bug={b}>
            <button onClick={(e) => e.stopPropagation()} className="-mx-1.5 flex max-w-full items-center rounded-md px-1.5 py-1 hover:bg-wash-2 data-[state=open]:bg-wash-2" aria-label={`Assign ${b.id}`}>
              {inner}
            </button>
          </AssigneeMenu>
        );
      }
      case "reporter": {
        const u = users.get(b.reporterId);
        return (
          <span className="flex min-w-0 items-center gap-2 text-[13px] text-ink-2">
            <Avatar name={u?.name ?? "?"} id={u?.id} size={20} />
            <span className="truncate">{u?.name ?? "Unknown"}</span>
          </span>
        );
      }
      case "reportedAt":
        return <span className="tnum text-[13px] text-ink-2">{formatDate(b.reportedAt)}</span>;
      case "updatedAt":
        return (
          <span className="tnum text-[13px] text-ink-2" title={new Date(b.updatedAt).toLocaleString()}>
            {timeAgo(b.updatedAt)}
          </span>
        );
    }
  };

  return (
    <div className={cn("overflow-auto rounded-lg border border-line bg-white", maxHeightClass, className)}>
      <table className="w-full table-fixed border-separate border-spacing-0 text-left" style={{ minWidth: fixedWidth + TITLE_MIN }}>
        <colgroup>
          {selectable ? <col style={{ width: CHECK_W }} /> : null}
          {cols.map((c) => (
            <col key={c.id} style={c.width ? { width: c.width } : undefined} />
          ))}
        </colgroup>
        <thead>
          <tr>
            {selectable ? (
              <th className={cn("sticky top-0 z-30 h-10 border-b border-r border-line/70 bg-wash px-3", stick("check"))}>
                <Checkbox checked={allSelected} indeterminate={!allSelected && someSelected} onChange={(v) => onToggleAll?.(v)} label="Select all rows on this page" />
              </th>
            ) : null}
            {cols.map((c) => {
              const active = sort?.key === c.sort;
              return (
                <th key={c.id} style={stickStyle(c.id)} aria-sort={active ? (sort!.dir === "asc" ? "ascending" : "descending") : "none"} className={cn("sticky top-0 h-10 border-b border-r border-line/70 bg-wash px-3 text-xs font-medium text-muted last:border-r-0", stick(c.id) ? "z-30" : "z-20", stick(c.id))}>
                  {onSort ? (
                    <button onClick={() => onSort(c.sort)} className={cn("-mx-1.5 inline-flex items-center gap-1 rounded px-1.5 py-1 hover:text-ink", active && "text-ink")}>
                      {c.label}
                      {active ? sort!.dir === "asc" ? <ArrowUp className="size-3" /> : <ArrowDown className="size-3" /> : <ChevronsUpDown className="size-3 text-faint" />}
                    </button>
                  ) : (
                    c.label
                  )}
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {bugs.map((b) => {
            const isSel = selected?.has(b.id);
            return (
              <tr
                key={b.id}
                tabIndex={0}
                onClick={() => router.push(`/bugs/${b.id}`)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && e.target === e.currentTarget) router.push(`/bugs/${b.id}`);
                }}
                className={cn("group cursor-pointer transition-colors focus-visible:outline-offset-[-2px]", isSel ? "bg-olive-50" : "hover:bg-wash")}
              >
                {selectable ? (
                  <td className={cn(cell, "z-10", stick("check"), isSel ? "bg-olive-50" : "bg-white group-hover:bg-wash")} onClick={(e) => e.stopPropagation()}>
                    <Checkbox checked={!!isSel} onChange={() => onToggle?.(b.id)} label={`Select ${b.id}`} />
                  </td>
                ) : null}
                {cols.map((c) => (
                  <td key={c.id} style={stickStyle(c.id)} className={cn(cell, "overflow-hidden", stick(c.id) && "z-10", stick(c.id), stick(c.id) && (isSel ? "bg-olive-50" : "bg-white group-hover:bg-wash"))}>
                    {render(b, c.id)}
                  </td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
      {bugs.length === 0 ? emptyState : null}
      {pending ? <StatusDialog bug={pending.bug} transition={pending.transition} onClose={() => setPending(null)} /> : null}
    </div>
  );
}
