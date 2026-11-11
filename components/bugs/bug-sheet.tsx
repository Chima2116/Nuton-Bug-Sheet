"use client";
import { Archive, ArchiveRestore, Plus, ChevronLeft, ChevronRight, Columns3, Download, Search, UserRound, X, ListChecks } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { Button, ButtonLink } from "@/components/ui/button";
import { Checkbox, EmptyState, Segmented } from "@/components/ui/controls";
import { Input } from "@/components/ui/field";
import { Menu, MenuContent, MenuItem, MenuLabel, MenuSeparator, MenuTrigger, Popover, PopoverContent, PopoverTrigger } from "@/components/ui/overlay";
import { useToast } from "@/components/ui/toast";
import { SEGMENTS, SEVERITY_META, STATUS_META, type SegmentId } from "@/lib/constants";
import { useAssignable, useMe, useModuleMap, useModules, usePerms, useUserMap } from "@/lib/hooks";
import { segmentMatches } from "@/lib/queries";
import { assignBug, changeStatus, setArchived } from "@/lib/store";
import { SEVERITIES, STATUSES, type Bug, type Severity, type Status } from "@/lib/types";
import { csvCell, downloadText, formatDate, plural } from "@/lib/utils";
import { availableTransitions } from "@/lib/workflow";
import { BugTable, COLUMNS, type ColumnId } from "./bug-table";
import { DateFilter, FilterMenu } from "./filter-menu";
import { EMPTY_FILTERS, activeFilterCount, applyFilters, sortBugs, type Filters, type Sort, type SortKey } from "./filters";

const COL_KEY = "nuton-bugs:columns";
const DEFAULT_COLS: ColumnId[] = COLUMNS.map((c) => c.id);

export function BugSheet({
  bugs,
  mode = "all",
  emptyTitle = "No bugs yet",
  emptyBody,
}: {
  bugs: Bug[];
  mode?: "all" | "verified" | "archived";
  emptyTitle?: string;
  emptyBody?: string;
}) {
  const params = useSearchParams();
  const me = useMe();
  const { permissions, can } = usePerms();
  const users = useUserMap();
  const modules = useModules();
  const moduleMap = useModuleMap();
  const devs = useAssignable();
  const { toast } = useToast();

  const [filters, setFilters] = useState<Filters>(() => {
    const f = { ...EMPTY_FILTERS };
    const q = params.get("q");
    const seg = params.get("segment") as SegmentId | null;
    const assignee = params.get("assignee");
    const status = params.get("status") as Status | null;
    if (q) f.q = q;
    if (seg && SEGMENTS.some((s) => s.id === seg)) f.segment = seg;
    if (assignee) f.assignee = [assignee];
    if (status && STATUSES.includes(status)) f.status = [status];
    return f;
  });
  const [sort, setSort] = useState<Sort>({ key: "updatedAt", dir: "desc" });
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [visible, setVisible] = useState<ColumnId[]>(DEFAULT_COLS);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(COL_KEY);
      if (raw) {
        const parsed = (JSON.parse(raw) as ColumnId[]).filter((c) => DEFAULT_COLS.includes(c));
        if (parsed.length) setVisible(Array.from(new Set(["id", "title", ...parsed])) as ColumnId[]);
      }
    } catch {}
  }, []);
  const saveCols = (cols: ColumnId[]) => {
    setVisible(cols);
    try {
      localStorage.setItem(COL_KEY, JSON.stringify(cols));
    } catch {}
  };

  const ctx = useMemo(
    () => ({ meId: me?.id ?? "", moduleName: (id: string) => moduleMap.get(id)?.name ?? "", userName: (id: string | null) => (id ? users.get(id)?.name ?? "" : "") }),
    [me, moduleMap, users],
  );

  const patch = (p: Partial<Filters>) => {
    setFilters((f) => ({ ...f, ...p }));
    setPage(1);
  };

  const filtered = useMemo(() => sortBugs(applyFilters(bugs, filters, ctx), sort, ctx), [bugs, filters, sort, ctx]);
  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
  const safePage = Math.min(page, pageCount);
  const rows = filtered.slice((safePage - 1) * pageSize, safePage * pageSize);

  // Keep selection to rows that still exist
  useEffect(() => {
    setSelected((s) => {
      const ids = new Set(bugs.map((b) => b.id));
      const next = new Set([...s].filter((id) => ids.has(id)));
      return next.size === s.size ? s : next;
    });
  }, [bugs]);

  const segCounts = useMemo(() => {
    const base = applyFilters(bugs, { ...filters, segment: "all", status: [] }, ctx);
    return Object.fromEntries(SEGMENTS.map((s) => [s.id, base.filter((b) => segmentMatches(s.id, b.status)).length])) as Record<SegmentId, number>;
  }, [bugs, filters, ctx]);

  const onSort = (key: SortKey) => {
    setSort((s) => (s.key === key ? { key, dir: s.dir === "asc" ? "desc" : "asc" } : { key, dir: key === "reportedAt" || key === "updatedAt" || key === "id" ? "desc" : "asc" }));
    setPage(1);
  };

  const nonSegmentFilters = activeFilterCount({ ...filters, segment: "all" });
  const anyFilter = activeFilterCount(filters) > 0;
  const selectedBugs = bugs.filter((b) => selected.has(b.id));

  const exportCsv = (list: Bug[]) => {
    const head = ["Bug ID", "Title", "Module", "Severity", "Priority", "Status", "Assignee", "Reporter", "Date Reported", "Last Updated"];
    const lines = list.map((b) => [b.id, b.title, ctx.moduleName(b.moduleId), b.severity, b.priority, b.status, ctx.userName(b.assigneeId) || "Unassigned", ctx.userName(b.reporterId), formatDate(b.reportedAt), formatDate(b.updatedAt)].map(csvCell).join(","));
    downloadText(`nuton-bugs-${new Date().toISOString().slice(0, 10)}.csv`, [head.join(","), ...lines].join("\n"));
    toast(`Exported ${plural(list.length, "bug")}`);
  };

  const bulkStatus = async (to: Status) => {
    let ok = 0;
    for (const b of selectedBugs) {
      const t = availableTransitions(b.status, permissions).find((x) => x.to === to);
      if (t && (!t.needs || t.needs === "note") && (await changeStatus(b.id, to)).ok) ok++;
    }
    const skipped = selectedBugs.length - ok;
    toast(ok ? `${plural(ok, "bug")} moved to ${to}${skipped ? ` · ${skipped} skipped` : ""}` : `None of the selected bugs can move to ${to} from here`, { tone: ok ? "success" : "error" });
    if (ok) setSelected(new Set());
  };
  const bulkAssign = async (id: string | null, name?: string) => {
    for (const b of selectedBugs) await assignBug(b.id, id);
    toast(id ? `${plural(selectedBugs.length, "bug")} assigned to ${name}` : `${plural(selectedBugs.length, "bug")} unassigned`);
    setSelected(new Set());
  };
  const bulkArchive = async (archive: boolean) => {
    const eligible = archive ? selectedBugs.filter((b) => b.status === "Verified" || b.status === "Closed") : selectedBugs;
    if (!eligible.length) return toast("Only Verified or Closed bugs can be archived", { tone: "error" });
    const res = await setArchived(eligible.map((b) => b.id), archive);
    if (!res.ok) return;
    toast(`${plural(eligible.length, "bug")} ${archive ? "archived" : "restored"}${eligible.length < selectedBugs.length ? ` · ${selectedBugs.length - eligible.length} skipped` : ""}`);
    setSelected(new Set());
  };

  const showSegments = mode === "all";
  const statusOptions = STATUSES.map((s) => ({ value: s, label: s, dot: STATUS_META[s].dot }));

  return (
    <div className="space-y-3">
      {showSegments ? (
        <Segmented
          value={filters.segment}
          onChange={(v) => patch({ segment: v, status: [] })}
          options={SEGMENTS.map((s) => ({ id: s.id, label: s.label, count: segCounts[s.id] }))}
        />
      ) : null}

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative w-full sm:w-[260px]">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-faint" />
          <Input value={filters.q} onChange={(e) => patch({ q: e.target.value })} placeholder="Search bugs" className="h-8 pl-8 pr-7 text-[13px]" aria-label="Search bugs" />
          {filters.q ? (
            <button onClick={() => patch({ q: "" })} className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded p-1 text-faint hover:text-ink" aria-label="Clear search">
              <X className="size-3.5" />
            </button>
          ) : null}
        </div>
        {mode !== "verified" ? <FilterMenu label="Status" options={statusOptions} selected={filters.status} onChange={(v) => patch({ status: v as Status[], segment: v.length ? "all" : filters.segment })} /> : null}
        <FilterMenu label="Severity" options={SEVERITIES.map((s) => ({ value: s, label: s, dot: SEVERITY_META[s].dot }))} selected={filters.severity} onChange={(v) => patch({ severity: v as Severity[] })} />
        <FilterMenu label="Module" options={modules.map((m) => ({ value: m.id, label: m.name }))} selected={filters.module} onChange={(v) => patch({ module: v })} width="w-[240px]" />
        <FilterMenu
          label="Assignee"
          options={[{ value: "me", label: "Assigned to me" }, { value: "unassigned", label: "Unassigned" }, ...devs.filter((d) => d.id !== me?.id).map((d) => ({ value: d.id, label: d.name }))]}
          selected={filters.assignee}
          onChange={(v) => patch({ assignee: v })}
          width="w-[232px]"
        />
        <DateFilter value={filters.date} from={filters.from} to={filters.to} onChange={(v) => patch(v)} />
        {nonSegmentFilters > 0 || filters.segment !== "all" ? (
          <Button variant="ghost" size="md" onClick={() => { setFilters(EMPTY_FILTERS); setPage(1); }} className="text-muted">
            <X className="size-3.5" /> Clear filters
          </Button>
        ) : null}
        <div className="ml-auto flex items-center gap-2">
          <Popover>
            <PopoverTrigger asChild>
              <Button size="md"><Columns3 className="size-4" /> <span className="hidden sm:inline">Columns</span></Button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-[220px] p-1.5">
              <p className="px-2 pb-1 pt-1 text-[11px] font-medium uppercase tracking-wide text-faint">Visible columns</p>
              {COLUMNS.map((c) => (
                <label key={c.id} className={`flex items-center gap-2.5 rounded-md px-2 py-1.5 text-[13px] ${c.locked ? "text-muted" : "cursor-pointer text-ink hover:bg-wash"}`}>
                  <Checkbox checked={visible.includes(c.id)} onChange={(v) => !c.locked && saveCols(v ? COLUMNS.map((x) => x.id).filter((id) => id === c.id || visible.includes(id)) : visible.filter((id) => id !== c.id))} label={c.label} className={c.locked ? "opacity-50" : ""} />
                  {c.label}
                </label>
              ))}
              <div className="mt-1 border-t border-line pt-1">
                <button onClick={() => saveCols(DEFAULT_COLS)} className="w-full rounded-md px-2 py-1.5 text-left text-[13px] text-muted hover:bg-wash hover:text-ink">Reset to default</button>
              </div>
            </PopoverContent>
          </Popover>
          <Button size="md" onClick={() => exportCsv(filtered)} disabled={!filtered.length}>
            <Download className="size-4" /> <span className="hidden sm:inline">Export</span>
          </Button>
        </div>
      </div>

      {selected.size > 0 ? (
        <div className="flex flex-wrap items-center gap-2 rounded-lg border border-olive-200 bg-olive-50 px-3 py-2">
          <span className="mr-1 text-[13px] font-medium text-olive-800">{selected.size} selected</span>
          {can("assign") && mode !== "archived" ? (
            <Menu>
              <MenuTrigger asChild>
                <Button size="sm"><UserRound className="size-3.5" /> Assign</Button>
              </MenuTrigger>
              <MenuContent align="start" className="w-[220px]">
                <MenuLabel>Assign to</MenuLabel>
                {devs.map((d) => (
                  <MenuItem key={d.id} onSelect={() => void bulkAssign(d.id, d.name)}>{d.name}</MenuItem>
                ))}
                <MenuSeparator />
                <MenuItem onSelect={() => void bulkAssign(null)}>Unassign</MenuItem>
              </MenuContent>
            </Menu>
          ) : null}
          {mode !== "archived" ? (
            <Menu>
              <MenuTrigger asChild>
                <Button size="sm"><ListChecks className="size-3.5" /> Set status</Button>
              </MenuTrigger>
              <MenuContent align="start" className="w-[220px]">
                <MenuLabel>Move selected to</MenuLabel>
                {STATUSES.map((s) => (
                  <MenuItem key={s} onSelect={() => void bulkStatus(s)}>
                    <span className="flex items-center gap-2"><span className={`size-1.5 rounded-full ${STATUS_META[s].dot}`} />{s}</span>
                  </MenuItem>
                ))}
                <MenuSeparator />
                <p className="px-2.5 py-1.5 text-xs text-muted">Moves that need a fix description or a comment are skipped. Open those bugs individually.</p>
              </MenuContent>
            </Menu>
          ) : null}
          {can("archive") ? (
            <Button size="sm" onClick={() => void bulkArchive(mode !== "archived")}>
              {mode === "archived" ? <ArchiveRestore className="size-3.5" /> : <Archive className="size-3.5" />}
              {mode === "archived" ? "Restore" : "Archive"}
            </Button>
          ) : null}
          <Button size="sm" onClick={() => exportCsv(selectedBugs)}><Download className="size-3.5" /> Export</Button>
          <Button size="sm" variant="ghost" className="ml-auto" onClick={() => setSelected(new Set())}>Clear selection</Button>
        </div>
      ) : null}

      <div>
        <BugTable
          bugs={rows}
          visible={visible}
          sort={sort}
          onSort={onSort}
          selectable
          selected={selected}
          onToggle={(id) => setSelected((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; })}
          onToggleAll={(all) => setSelected((s) => { const n = new Set(s); rows.forEach((b) => (all ? n.add(b.id) : n.delete(b.id))); return n; })}
          emptyState={
            <EmptyState
              icon={<Search className="size-4" />}
              title={anyFilter ? "No bugs match these filters" : emptyTitle}
              body={anyFilter ? "Try removing a filter or searching for something else." : emptyBody}
              action={anyFilter ? <Button onClick={() => { setFilters(EMPTY_FILTERS); setPage(1); }}>Clear filters</Button> : mode === "all" && can("report") ? <ButtonLink href="/report" variant="primary"><Plus className="size-4" strokeWidth={2.25} /> Report your first bug</ButtonLink> : undefined}
            />
          }
        />
        <div className="mt-2 flex flex-wrap items-center justify-between gap-3 px-1 text-[13px] text-muted">
          <span className="tnum">
            {filtered.length === 0 ? "0 bugs" : `${(safePage - 1) * pageSize + 1}–${Math.min(safePage * pageSize, filtered.length)} of ${plural(filtered.length, "bug")}`}
          </span>
          <div className="flex items-center gap-3">
            <label className="flex items-center gap-2">
              Rows
              <select value={pageSize} onChange={(e) => { setPageSize(Number(e.target.value)); setPage(1); }} className="h-7 rounded-md border border-line-strong bg-white px-1.5 text-[13px] text-ink">
                {[10, 25, 50].map((n) => <option key={n}>{n}</option>)}
              </select>
            </label>
            <div className="flex items-center gap-1">
              <Button variant="secondary" size="icon-sm" disabled={safePage <= 1} onClick={() => setPage(safePage - 1)} aria-label="Previous page"><ChevronLeft className="size-4" /></Button>
              <span className="tnum min-w-16 text-center">Page {safePage} / {pageCount}</span>
              <Button variant="secondary" size="icon-sm" disabled={safePage >= pageCount} onClick={() => setPage(safePage + 1)} aria-label="Next page"><ChevronRight className="size-4" /></Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
