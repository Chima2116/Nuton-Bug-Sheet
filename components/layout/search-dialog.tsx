"use client";
import * as Dialog from "@radix-ui/react-dialog";
import { ArrowRight, CornerDownLeft, Plus, Search } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { Kbd } from "@/components/ui/controls";
import { StatusBadge } from "@/components/ui/badges";
import { useActiveBugs, useModuleMap, useUserMap, usePerms } from "@/lib/hooks";
import { cn } from "@/lib/utils";

export function SearchDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const router = useRouter();
  const bugs = useActiveBugs();
  const modules = useModuleMap();
  const users = useUserMap();
  const { can } = usePerms();
  const [q, setQ] = useState("");
  const [active, setActive] = useState(0);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open) {
      setQ("");
      setActive(0);
    }
  }, [open]);

  const results = useMemo(() => {
    const term = q.trim().toLowerCase();
    const sorted = [...bugs].sort((a, b) => +new Date(b.updatedAt) - +new Date(a.updatedAt));
    if (!term) return sorted.slice(0, 6);
    return sorted
      .filter((b) => [b.id, b.title, modules.get(b.moduleId)?.name, users.get(b.assigneeId ?? "")?.name, b.category].some((v) => v?.toLowerCase().includes(term)))
      .slice(0, 8);
  }, [bugs, q, modules, users]);

  const actions = useMemo(() => {
    const a: { id: string; label: string; icon: React.ReactNode; run: () => void }[] = [];
    if (can("report")) a.push({ id: "report", label: "Report a bug", icon: <Plus className="size-4" />, run: () => router.push("/report") });
    if (q.trim()) a.push({ id: "all", label: `See all results for “${q.trim()}” in All Bugs`, icon: <ArrowRight className="size-4" />, run: () => router.push(`/bugs?q=${encodeURIComponent(q.trim())}`) });
    return a;
  }, [can, q, router]);

  const total = results.length + actions.length;
  const go = (i: number) => {
    onOpenChange(false);
    if (i < results.length) router.push(`/bugs/${results[i].id}`);
    else actions[i - results.length]?.run();
  };

  useEffect(() => {
    listRef.current?.querySelector<HTMLElement>(`[data-idx="${active}"]`)?.scrollIntoView({ block: "nearest" });
  }, [active]);

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 animate-fade-in bg-ink/30" />
        <Dialog.Content
          aria-describedby={undefined}
          className="fixed left-1/2 top-[12vh] z-50 w-[calc(100vw-32px)] max-w-[600px] -translate-x-1/2 animate-pop-in overflow-hidden rounded-xl border border-line bg-white shadow-[var(--shadow-pop)] focus:outline-none"
          onKeyDown={(e) => {
            if (e.key === "ArrowDown") {
              e.preventDefault();
              setActive((i) => Math.min(total - 1, i + 1));
            } else if (e.key === "ArrowUp") {
              e.preventDefault();
              setActive((i) => Math.max(0, i - 1));
            } else if (e.key === "Enter" && total) {
              e.preventDefault();
              go(active);
            }
          }}
        >
          <Dialog.Title className="sr-only">Search bugs</Dialog.Title>
          <div className="flex items-center gap-3 border-b border-line px-4">
            <Search className="size-4 text-muted" />
            <input
              autoFocus
              value={q}
              onChange={(e) => {
                setQ(e.target.value);
                setActive(0);
              }}
              placeholder="Search by title, ID, module or assignee…"
              className="h-12 flex-1 bg-transparent text-sm text-ink placeholder:text-faint focus:outline-none"
            />
            <Kbd>Esc</Kbd>
          </div>
          <div ref={listRef} className="max-h-[52vh] overflow-y-auto p-2">
            <p className="px-2.5 pb-1 pt-1.5 text-[11px] font-medium uppercase tracking-wide text-faint">{q.trim() ? "Bugs" : "Recently updated"}</p>
            {results.length === 0 ? <p className="px-2.5 py-6 text-center text-[13px] text-muted">No bugs match “{q}”.</p> : null}
            {results.map((b, i) => (
              <button
                key={b.id}
                data-idx={i}
                onMouseMove={() => setActive(i)}
                onClick={() => go(i)}
                className={cn("flex w-full items-center gap-3 rounded-md px-2.5 py-2 text-left", active === i && "bg-wash")}
              >
                <span className="tnum w-[72px] shrink-0 text-xs text-muted">{b.id}</span>
                <span className="min-w-0 flex-1 truncate text-[13px] text-ink">{b.title}</span>
                <StatusBadge status={b.status} className="hidden text-xs sm:inline-flex" />
              </button>
            ))}
            {actions.length ? <p className="px-2.5 pb-1 pt-3 text-[11px] font-medium uppercase tracking-wide text-faint">Actions</p> : null}
            {actions.map((a, j) => (
              <button
                key={a.id}
                data-idx={results.length + j}
                onMouseMove={() => setActive(results.length + j)}
                onClick={() => go(results.length + j)}
                className={cn("flex w-full items-center gap-3 rounded-md px-2.5 py-2 text-left text-[13px] text-ink", active === results.length + j && "bg-wash")}
              >
                <span className="flex w-[72px] shrink-0 items-center text-muted">{a.icon}</span>
                <span className="min-w-0 flex-1 truncate">{a.label}</span>
              </button>
            ))}
          </div>
          <div className="flex items-center gap-4 border-t border-line bg-wash px-4 py-2 text-xs text-muted">
            <span className="flex items-center gap-1.5">Navigate <Kbd>↑</Kbd><Kbd>↓</Kbd></span>
            <span className="flex items-center gap-1.5">Open <Kbd><CornerDownLeft className="size-3" /></Kbd></span>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
