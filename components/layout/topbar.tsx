"use client";
import { Menu as MenuIcon, Plus, Search } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Fragment, useEffect, useState } from "react";
import { useReport } from "@/components/report/report-host";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Kbd } from "@/components/ui/controls";
import { useMe, usePerms } from "@/lib/hooks";
import { Notifications } from "./notifications";
import { SearchDialog } from "./search-dialog";
import { UserMenu } from "./user-menu";

function crumbs(pathname: string): { label: string; href?: string }[] {
  const parts = pathname.split("/").filter(Boolean);
  if (!parts.length) return [{ label: "Overview" }];
  const [a, b] = parts;
  switch (a) {
    case "bugs":
      return b ? [{ label: "All Bugs", href: "/bugs" }, { label: decodeURIComponent(b).toUpperCase() }] : [{ label: "All Bugs" }];
    case "my-tasks":
      return [{ label: "My Tasks" }];
    case "settings":
      return [{ label: "Settings" }];
    default:
      return [{ label: "Overview" }];
  }
}

export function Topbar({ onMenu }: { onMenu: () => void }) {
  const pathname = usePathname();
  const me = useMe();
  const { can } = usePerms();
  const { open: openReport } = useReport();
  const [searchOpen, setSearchOpen] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setSearchOpen((o) => !o);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const trail = crumbs(pathname);

  return (
    <header className="flex h-16 shrink-0 items-center gap-2 border-b border-line px-3 sm:gap-3 sm:px-6">
      <Button variant="ghost" size="icon" className="lg:hidden" onClick={onMenu} aria-label="Open navigation">
        <MenuIcon className="size-[18px]" />
      </Button>
      <nav aria-label="Breadcrumb" className="hidden min-w-0 shrink-0 items-center gap-2 text-sm sm:flex lg:w-[200px]">
        {trail.map((c, i) => (
          <Fragment key={i}>
            {i > 0 ? <span className="text-faint">/</span> : null}
            {c.href ? (
              <Link href={c.href} className="text-muted hover:text-ink">
                {c.label}
              </Link>
            ) : (
              <span className="truncate font-semibold tracking-[-0.01em] text-ink">{c.label}</span>
            )}
          </Fragment>
        ))}
      </nav>

      <div className="flex flex-1 justify-end sm:justify-center">
        <button
          onClick={() => setSearchOpen(true)}
          className="flex h-9 w-9 items-center justify-center gap-2 rounded-full bg-wash-2/70 text-[13px] text-muted transition-colors hover:bg-wash-2 sm:w-full sm:max-w-[400px] sm:justify-start sm:px-4"
          aria-label="Search bugs"
        >
          <Search className="size-[15px]" />
          <span className="hidden flex-1 truncate text-left sm:inline">Search bugs, IDs, people…</span>
          <span className="hidden items-center gap-0.5 sm:flex">
            <Kbd>⌘</Kbd>
            <Kbd>K</Kbd>
          </span>
        </button>
      </div>

      <div className="flex shrink-0 items-center gap-1.5">
        <Notifications />
        {can("report") ? (
          <Button variant="primary" className="ml-1 rounded-full pl-3 pr-4" onClick={() => openReport()}>
            <Plus className="size-4" strokeWidth={2.25} />
            <span className="hidden sm:inline">New bug</span>
            <span className="sr-only sm:hidden">New bug</span>
          </Button>
        ) : null}
        {me ? (
          <UserMenu>
            <button className="ml-1 rounded-full" aria-label="Account menu">
              <Avatar name={me.name} id={me.id} size={32} />
            </button>
          </UserMenu>
        ) : null}
      </div>
      <SearchDialog open={searchOpen} onOpenChange={setSearchOpen} />
    </header>
  );
}
