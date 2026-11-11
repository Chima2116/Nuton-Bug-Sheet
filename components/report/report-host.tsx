"use client";
import { useRouter, useSearchParams } from "next/navigation";
import { createContext, Suspense, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { usePerms } from "@/lib/hooks";
import { Composer } from "./composer";

interface ReportApi {
  /** Opens the New bug composer, optionally resuming a saved draft. */
  open: (draftId?: string) => void;
}

const Ctx = createContext<ReportApi>({ open: () => {} });
export const useReport = () => useContext(Ctx);

/** Opens the composer when the URL has ?report=1 (also what the old /report link redirects to). */
function UrlTrigger({ open }: { open: () => void }) {
  const params = useSearchParams();
  const router = useRouter();
  const wanted = params.get("report");
  useEffect(() => {
    if (!wanted) return;
    open();
    const next = new URLSearchParams(params.toString());
    next.delete("report");
    const qs = next.toString();
    router.replace(`${window.location.pathname}${qs ? `?${qs}` : ""}`);
  }, [wanted, open, params, router]);
  return null;
}

export function ReportProvider({ children }: { children: ReactNode }) {
  const { can } = usePerms();
  const [state, setState] = useState<{ open: boolean; draftId?: string }>({ open: false });
  const open = useCallback((draftId?: string) => {
    if (can("report")) setState({ open: true, draftId });
  }, [can]);
  const api = useMemo(() => ({ open }), [open]);
  return (
    <Ctx.Provider value={api}>
      {children}
      <Suspense fallback={null}>
        <UrlTrigger open={open} />
      </Suspense>
      <Composer open={state.open} draftId={state.draftId} onOpenChange={(o) => setState((s) => ({ ...s, open: o, draftId: o ? s.draftId : undefined }))} onPickDraft={(id) => setState({ open: true, draftId: id })} />
    </Ctx.Provider>
  );
}
