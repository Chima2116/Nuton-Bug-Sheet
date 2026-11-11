"use client";
import { Archive, BadgeCheck, Bug, ChevronsUpDown, LayoutGrid, ListTodo, Settings } from "lucide-react";
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
    <Link href="/" className="flex items-center gap-2.5 rounded-md px-2 py-1.5">
      <span className="font-display flex size-6 items-center justify-center rounded-md bg-olive-600 text-[16px] leading-none text-white">N</span>
      <span className="text-sm font-semibold tracking-tight text-ink">Nuton</span>
      <span className="text-sm text-faint">Bug sheet</span>
    </Link>
  );
}

function NavItem({ href, icon: Icon, label, count, active, onNavigate }: { href: string; icon: typeof Bug; label: string; count?: number; active: boolean; onNavigate?: () => void }) {
  return (
    <Link
      href={href}
      onClick={onNavigate}
      aria-current={active ? "page" : undefined}
      className={cn("group flex h-9 items-center gap-3 rounded-md px-2.5 text-sm transition-colors", active ? "bg-wash-2 font-medium text-ink" : "text-ink-2 hover:bg-wash")}
    >
      <Icon className={cn("size-[17px] shrink-0", active ? "text-olive-700" : "text-muted group-hover:text-ink-2")} strokeWidth={1.75} />
      <span className="flex-1 truncate">{label}</span>
      {count ? <span className="tnum text-xs text-muted">{count}</span> : null}
    </Link>
  );
}

export function SidebarContent({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  const bugs = useActiveBugs();
  const me = useMe();
  const { role } = usePerms();
  const perms = usePerms();
  const tasks = useMemo(() => (me ? myTasks(bugs, me.id, perms.permissions).length : 0), [bugs, me, perms.permissions]);
  const isActive = (href: string) => (href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(href + "/"));
  const items = [
    { href: "/", icon: LayoutGrid, label: "Overview" },
    { href: "/bugs", icon: Bug, label: "All Bugs", count: bugs.length },
    { href: "/my-tasks", icon: ListTodo, label: "My Tasks", count: tasks },
    { href: "/verified", icon: BadgeCheck, label: "Verified" },
    { href: "/archived", icon: Archive, label: "Archived" },
  ];
  return (
    <div className="flex h-full flex-col px-3 pb-3 pt-3.5">
      <Brand />
      <nav className="mt-5 flex flex-col gap-0.5" aria-label="Primary">
        {items.map((i) => (
          <NavItem key={i.href} {...i} active={isActive(i.href)} onNavigate={onNavigate} />
        ))}
      </nav>
      <div className="mt-auto flex flex-col gap-0.5">
        <NavItem href="/settings" icon={Settings} label="Settings" active={isActive("/settings")} onNavigate={onNavigate} />
        <div className="mx-1 my-2 h-px bg-line" />
        {me ? (
          <UserMenu side="top" align="start">
            <button className="flex w-full items-center gap-2.5 rounded-md px-2 py-1.5 text-left transition-colors hover:bg-wash" aria-label="Account menu">
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
