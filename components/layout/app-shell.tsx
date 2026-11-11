"use client";
import { Loader2 } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Sheet } from "@/components/ui/overlay";
import { useAuth } from "@/lib/auth";
import { useReady, useSyncError, useSyncStatus } from "@/lib/hooks";
import { retryLoad } from "@/lib/store";
import { isConfigured } from "@/lib/supabase";
import { AuthShell } from "./auth-shell";
import { Skeleton } from "./page-header";
import { SetupNeeded } from "./setup-needed";
import { SidebarContent } from "./sidebar";
import { Topbar } from "./topbar";

const PUBLIC = ["/login", "/reset-password"];

function Splash() {
  return (
    <div className="flex min-h-dvh items-center justify-center bg-white text-muted">
      <Loader2 className="size-5 animate-spin" aria-label="Loading" />
    </div>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { session, loading, signOut } = useAuth();
  const ready = useReady();
  const status = useSyncStatus();
  const error = useSyncError();
  const [drawer, setDrawer] = useState(false);
  const isPublic = PUBLIC.includes(pathname);

  useEffect(() => setDrawer(false), [pathname]);
  useEffect(() => {
    if (!isConfigured || loading) return;
    if (!session && !isPublic) router.replace("/login");
    if (session && pathname === "/login") router.replace("/");
  }, [loading, session, isPublic, pathname, router]);

  if (!isConfigured) return <SetupNeeded />;
  if (loading) return <Splash />;
  if (isPublic) return <>{children}</>;
  if (!session) return <Splash />;

  if (status === "error")
    return (
      <AuthShell title="Something's not right" subtitle={error}>
        <div className="flex gap-2">
          <Button variant="primary" onClick={() => void retryLoad()}>Try again</Button>
          <Button onClick={() => void signOut()}>Sign out</Button>
        </div>
      </AuthShell>
    );

  return (
    <div className="flex h-dvh overflow-hidden bg-white">
      <aside className="hidden w-[232px] shrink-0 border-r border-line bg-white lg:block">
        <SidebarContent />
      </aside>
      <Sheet open={drawer} onOpenChange={setDrawer} title="Navigation" side="left" width="sm:w-[272px] w-[272px]">
        <div className="-mx-6 -my-5 h-[calc(100dvh-65px)]">
          <SidebarContent onNavigate={() => setDrawer(false)} />
        </div>
      </Sheet>
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar onMenu={() => setDrawer(true)} />
        <main id="main" className="min-h-0 flex-1 overflow-y-auto">
          {ready ? children : <Skeleton />}
        </main>
      </div>
    </div>
  );
}
