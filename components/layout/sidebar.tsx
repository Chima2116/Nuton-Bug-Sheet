"use client";
import { Bug, ChevronsUpDown, LayoutGrid, ListTodo, Settings } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useMemo } from "react";
import { Avatar } from "@/components/ui/avatar";
import { useActiveBugs, useMe, usePerms } from "@/lib/hooks";
import { myTasks } from "@/lib/queries";
import { cn } from "@/lib/utils";
import { UserMenu } from "./user-menu";

export function Brand() {
  return (
    <Link href="/" className="flex items-center gap-2.5 rounded-xl px-2 py-1.5">
      <span className="flex size-8 items-center justify-center rounded-[10px] bg-olive-600 text-[15px] font-semibold leading-none text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.18)]">N</span>
      <span className="leading-tight">
        <span className="block text-[14px] font-semibold tracking-[-0.01em] text-ink">Nuton</span>
        <span className="block text-xs text-muted">Bug sheet</span>
      </span>
    </Link>
  );
}

function NavItem({ href, icon: Icon, label, count, active, onNavigate }: { href: string; icon: typeof Bug; label: string; count?: number; active: boolean; onNavigate?: () => void }) {
  return (
    <Link
      href={href}
      onClick={onNavigate}
      aria-current={active ? "page" : undefined}
      className={cn("group flex h-10 items-center gap-3 rounded-[10px] px-3 text-sm transition-all", active ? "bg-white font-medium text-ink shadow-[var(--shadow-card)]" : "text-ink-2 hover:bg-white/60")}
    >
      <Icon className={cn("size-[17px] shrink-0", active ? "text-olive-700" : "text-muted group-hover:text-ink-2")} strokeWidth={1.75} />
      <span className="flex-1 truncate">{label}</span>
      {count ? <span className={cn("tnum rounded-full px-1.5 text-xs", active ? "bg-wash-2 text-ink-2" : "text-muted")}>{count}</span> : null}
    </Link>
  );
}

export function SidebarContent({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  const bugs = useActiveBugs();
  const me = useMe();
  const { role } = usePerms();
  const tasks = useMemo(() => (me ? myTasks(bugs, me.id).length : 0), [bugs, me]);
  const isActive = (href: string) => (href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(href + "/"));
  const items = [
    { href: "/", icon: LayoutGrid, label: "Overview" },
    { href: "/bugs", icon: Bug, label: "All Bugs", count: bugs.length },
    { href: "/my-tasks", icon: ListTodo, label: "My Tasks", count: tasks },
  ];
  return (
    <div className="flex h-full flex-col px-3 pb-3 pt-4">
      <Brand />
      <nav className="mt-6 flex flex-col gap-1" aria-label="Primary">
        {items.map((i) => (
          <NavItem key={i.href} {...i} active={isActive(i.href)} onNavigate={onNavigate} />
        ))}
      </nav>
      <div className="mt-auto flex flex-col gap-0.5">
        <NavItem href="/settings" icon={Settings} label="Settings" active={isActive("/settings")} onNavigate={onNavigate} />
        <div className="mx-1 my-2 h-px bg-line-strong/60" />
        {me ? (
          <UserMenu side="top" align="start">
            <button className="flex w-full items-center gap-2.5 rounded-xl px-2 py-2 text-left transition-colors hover:bg-white/70" aria-label="Account menu">
              <Avatar name={me.name} id={me.id} size={28} />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[13px] font-medium leading-tight text-ink">{me.name}</span>
                <span className="block truncate text-xs leading-tight text-muted">{role?.name ?? ""}</span>
              </span>
              <ChevronsUpDown className="size-3.5 shrink-0 text-faint" />
            </button>
          </UserMenu>
        ) : null}
      </div>
    </div>
  );
}
