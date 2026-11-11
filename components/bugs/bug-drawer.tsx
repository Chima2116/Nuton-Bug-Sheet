"use client";
import * as Dialog from "@radix-ui/react-dialog";
import { ChevronDown, ChevronUp, Link2, Maximize2, X } from "lucide-react";
import Link from "next/link";
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { useBugs } from "@/lib/hooks";
import { BugPanel } from "./bug-panel";

interface DrawerApi {
  /** Opens a bug in the side drawer. `siblings` is the list to step through with the arrows. */
  open: (id: string, siblings?: string[]) => void;
}
const Ctx = createContext<DrawerApi>({ open: () => {} });
export const useBugDrawer = () => useContext(Ctx);

export function BugDrawerProvider({ children }: { children: ReactNode }) {
  const bugs = useBugs();
  const { toast } = useToast();
  const [state, setState] = useState<{ id: string; siblings: string[] } | null>(null);
  const open = useCallback((id: string, siblings: string[] = []) => setState({ id, siblings: siblings.length ? siblings : [id] }), []);
  const api = useMemo(() => ({ open }), [open]);

  const bug = state ? bugs.find((b) => b.id === state.id) : undefined;
  useEffect(() => {
    if (state && !bug) setState(null);
  }, [state, bug]);

  const idx = state ? state.siblings.indexOf(state.id) : -1;
  const go = (d: number) => {
    if (!state) return;
    const next = state.siblings[idx + d];
    if (next) setState({ ...state, id: next });
  };

  useEffect(() => {
    if (!state) return;
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      if (el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.isContentEditable)) return;
      if (e.key === "j" || e.key === "ArrowDown") {
        e.preventDefault();
        go(1);
      } else if (e.key === "k" || e.key === "ArrowUp") {
        e.preventDefault();
        go(-1);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const copy = async () => {
    if (!bug) return;
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/bugs/${bug.id}`);
      toast("Link copied.");
    } catch {
      toast("Couldn't copy the link.", { tone: "error" });
    }
  };

  return (
    <Ctx.Provider value={api}>
      {children}
      <Dialog.Root open={!!bug} onOpenChange={(o) => !o && setState(null)}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-40 animate-fade-in bg-ink/25" />
          <Dialog.Content
            aria-describedby={undefined}
            className="fixed inset-y-2 right-2 z-40 flex w-full max-w-[calc(100vw-16px)] animate-slide-in-right flex-col overflow-hidden rounded-[20px] bg-white shadow-[var(--shadow-sheet)] focus:outline-none sm:w-[680px]"
          >
            <Dialog.Title className="sr-only">{bug?.title ?? "Bug"}</Dialog.Title>
            {bug ? (
              <div className="min-h-0 flex-1 overflow-y-auto">
                <BugPanel
                  key={bug.id}
                  bug={bug}
                  toolbar={
                    <div className="sticky top-0 z-20 flex items-center justify-between gap-2 border-b border-line bg-white/90 px-4 py-3 backdrop-blur sm:px-6">
                      <div className="flex items-center gap-1">
                        <Button variant="secondary" size="icon-sm" className="rounded-full" disabled={idx <= 0} onClick={() => go(-1)} aria-label="Previous bug"><ChevronUp className="size-4" /></Button>
                        <Button variant="secondary" size="icon-sm" className="rounded-full" disabled={idx < 0 || idx >= (state?.siblings.length ?? 0) - 1} onClick={() => go(1)} aria-label="Next bug"><ChevronDown className="size-4" /></Button>
                        {state && state.siblings.length > 1 ? <span className="tnum ml-2 text-xs text-muted">{idx + 1} of {state.siblings.length}</span> : null}
                      </div>
                      <div className="flex items-center gap-1">
                        <Button variant="ghost" size="icon-sm" className="rounded-full" onClick={copy} aria-label="Copy link"><Link2 className="size-4" /></Button>
                        <Link href={`/bugs/${bug.id}`} onClick={() => setState(null)} className="inline-flex size-8 items-center justify-center rounded-full text-muted transition-colors hover:bg-wash-2/70 hover:text-ink" aria-label="Open as full page" title="Open as full page">
                          <Maximize2 className="size-4" />
                        </Link>
                        <Dialog.Close className="inline-flex size-8 items-center justify-center rounded-full text-muted transition-colors hover:bg-wash-2/70 hover:text-ink" aria-label="Close">
                          <X className="size-4" />
                        </Dialog.Close>
                      </div>
                    </div>
                  }
                />
              </div>
            ) : null}
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </Ctx.Provider>
  );
}
