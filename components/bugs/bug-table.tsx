"use client";
import { ArrowDown, ArrowUp, BadgeCheck, ChevronDown, ChevronsUpDown } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Avatar } from "@/components/ui/avatar";
import { PriorityBadge, SeverityBadge, StatusBadge } from "@/components/ui/badges";
import { Checkbox } from "@/components/ui/controls";
import { Menu, MenuContent, MenuItem, MenuLabel, MenuSeparator, MenuTrigger } from "@/components/ui/overlay";
import { useModuleMap, usePerms, useUserMap } from "@/lib/hooks";
import { STATUSES, type Bug } from "@/lib/types";
import { useBugActions } from "./use-bug-actions";
import { cn, formatDate, timeAgo } from "@/lib/utils";
import { AssigneeMenu } from "./assignee-menu";
import type { Sort, SortKey } from "./filters";

export type ColumnId = "id" | "title" | "module" | "severity" | "priority" | "status" | "assignee" | "reporter" | "reportedAt" | "updatedAt";

export const COLUMNS: { id: ColumnId; label: string; width: number; sort: SortKey; locked?: boolean }[] = [
  { id: "id", label: "ID", width: 96, sort: "id", locked: true },
  { id: "title", label: "Bug", width: 0, sort: "title", locked: true },
  { id: "module", label: "Module", width: 156, sort: "module" },
  { id: "severity", label: "Severity", width: 112, sort: "severity" },
  { id: "priority", label: "Priority", width: 92, sort: "priority" },
  { id: "status", label: "Status", width: 168, sort: "status" },
  { id: "assignee", label: "Assignee", width: 164, sort: "assignee" },
  { id: "reporter", label: "Reporter", width: 164, sort: "reporter" },
  { id: "reportedAt", label: "Date Reported", width: 124, sort: "reportedAt" },
  { id: "updatedAt", label: "Last Updated", width: 116, sort: "updatedAt" },
];

const cell = "h-[54px] border-b border-line/70 px-3 align-middle first:pl-5 last:pr-5";
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
  onOpen,
  activeId,
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
  onOpen?: (b: Bug) => void;
  activeId?: string | null;
  maxHeightClass?: string;
}) {
  const router = useRouter();
  const open = (b: Bug) => (onOpen ? onOpen(b) : router.push(`/bugs/${b.id}`));
  const users = useUserMap();
  const modules = useModuleMap();
  const { can } = usePerms();
  const { setStatus, verify } = useBugActions();
  const cols = COLUMNS.filter((c) => visible.includes(c.id));
  const fixedWidth = cols.reduce((n, c) => n + c.width, 0) + (selectable ? CHECK_W : 0);
  const idLeft = selectable ? CHECK_W : 0;
  const titleLeft = idLeft + (visible.includes("id") ? COLUMNS[0].width : 0);
  // Identifying columns stay in view while the rest scrolls sideways (desktop only).
  const stick = (id: ColumnId | "check") => {
    if (id === "check") return "lg:sticky lg:left-0";
    if (id === "id") return "lg:sticky";
    if (id === "title") return "lg:sticky";
    return "";
  };
  const stickStyle = (id: ColumnId | "check") => (id === "id" ? { left: idLeft } : id === "title" ? { left: titleLeft } : undefined);
  const allSelected = !!selected && bugs.length > 0 && bugs.every((b) => selected.has(b.id));
  const someSelected = !!selected && bugs.some((b) => selected.has(b.id));

  const render = (b: Bug, id: ColumnId) => {
    switch (id) {
      case "id":
        return <span className="tnum whitespace-nowrap text-xs font-medium text-muted">{b.id}</span>;
      case "title":
        return (
          <span className="block truncate text-[13.5px] font-medium tracking-[-0.005em] text-ink" title={b.title}>
            {b.title}
          </span>
        );
      case "module":
        return <span className="block truncate text-[13px] text-ink-2">{modules.get(b.moduleId)?.name ?? "—"}</span>;
      case "severity":
        return <SeverityBadge severity={b.severity} pill />;
      case "priority":
        return <PriorityBadge priority={b.priority} />;
      case "status": {
        const inner = <StatusBadge status={b.status} verified={!!b.verifiedAt} pill />;
        if (!can("progress") && !can("verify")) return inner;
        return (
          <Menu>
            <MenuTrigger asChild>
              <button onClick={(e) => e.stopPropagation()} className="group -mx-1 inline-flex items-center gap-1 rounded-full px-1 py-0.5 hover:bg-wash-2 data-[state=open]:bg-wash-2" aria-label={`Change status of ${b.id}`}>
                {inner}
                <ChevronDown className="size-3 text-faint opacity-0 group-hover:opacity-100 group-data-[state=open]:opacity-100" />
              </button>
            </MenuTrigger>
            <MenuContent align="start" className="w-[212px]" onClick={(e) => e.stopPropagation()}>
              <MenuLabel>Status</MenuLabel>
              {STATUSES.map((st) => (
                <MenuItem key={st} selected={b.status === st} onSelect={() => void setStatus(b, st)}>
                  <StatusBadge status={st} className="text-[13px]" />
                </MenuItem>
              ))}
              {(b.status === "Ready for Testing" || (b.status === "Resolved" && !b.verifiedAt)) && (
                <>
                  <MenuSeparator />
                  <MenuItem icon={<BadgeCheck className="size-4" />} onSelect={() => void verify(b)}>Mark as verified</MenuItem>
                </>
              )}
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
    <div className={cn("overflow-auto rounded-2xl border border-line bg-white", maxHeightClass, className)}>
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
              <th className={cn("sticky top-0 z-30 h-11 border-b border-line bg-white px-3 pl-5", stick("check"))}>
                <Checkbox checked={allSelected} indeterminate={!allSelected && someSelected} onChange={(v) => onToggleAll?.(v)} label="Select all rows on this page" />
              </th>
            ) : null}
            {cols.map((c) => {
              const active = sort?.key === c.sort;
              return (
                <th key={c.id} style={stickStyle(c.id)} aria-sort={active ? (sort!.dir === "asc" ? "ascending" : "descending") : "none"} className={cn("sticky top-0 h-11 border-b border-line bg-white px-3 text-xs font-medium text-muted first:pl-5 last:pr-5", stick(c.id) ? "z-30" : "z-20", stick(c.id))}>
                  {onSort ? (
                    <button onClick={() => onSort(c.sort)} className={cn("-mx-1.5 inline-flex items-center gap-1 rounded-md px-1.5 py-1 hover:text-ink", active && "text-ink")}>
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
                onClick={() => open(b)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && e.target === e.currentTarget) open(b);
                }}
                className={cn("group cursor-pointer transition-colors focus-visible:outline-offset-[-2px]", isSel ? "bg-olive-50" : "hover:bg-wash/70")}
              >
                {selectable ? (
                  <td className={cn(cell, "z-10", stick("check"), isSel ? "bg-olive-50" : "bg-white group-hover:bg-wash/70")} onClick={(e) => e.stopPropagation()}>
                    <Checkbox checked={!!isSel} onChange={() => onToggle?.(b.id)} label={`Select ${b.id}`} />
                  </td>
                ) : null}
                {cols.map((c) => (
                  <td key={c.id} style={stickStyle(c.id)} className={cn(cell, "overflow-hidden", stick(c.id) && "z-10", stick(c.id), stick(c.id) && (isSel ? "bg-olive-50" : "bg-white group-hover:bg-wash/70"))}>
                    {render(b, c.id)}
                  </td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
      {bugs.length === 0 ? emptyState : null}
    </div>
  );
}
