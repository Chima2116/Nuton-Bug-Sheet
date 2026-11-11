"use client";
import Link from "next/link";
import { CheckCircle2, Info, X, AlertCircle } from "lucide-react";
import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";

interface Toast {
  id: number;
  message: string;
  tone: "success" | "info" | "error";
  action?: { label: string; href?: string; onClick?: () => void };
}

const Ctx = createContext<{ toast: (message: string, opts?: { tone?: Toast["tone"]; action?: Toast["action"] }) => void }>({ toast: () => {} });

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const idRef = useRef(0);
  const dismiss = useCallback((id: number) => setToasts((t) => t.filter((x) => x.id !== id)), []);
  const toast = useCallback<(m: string, o?: { tone?: Toast["tone"]; action?: Toast["action"] }) => void>(
    (message, opts) => {
      const id = ++idRef.current;
      setToasts((t) => [...t.slice(-2), { id, message, tone: opts?.tone ?? "success", action: opts?.action }]);
      setTimeout(() => dismiss(id), opts?.action ? 6000 : 4000);
    },
    [dismiss],
  );
  const value = useMemo(() => ({ toast }), [toast]);
  return (
    <Ctx.Provider value={value}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 bottom-5 z-[100] flex flex-col items-center gap-2 px-4" role="status" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} className="pointer-events-auto flex max-w-[460px] animate-toast-in items-center gap-2.5 rounded-lg bg-ink py-2.5 pl-3.5 pr-2.5 text-[13px] text-white shadow-[var(--shadow-pop)]">
            {t.tone === "success" ? <CheckCircle2 className="size-4 shrink-0 text-olive-300" /> : t.tone === "error" ? <AlertCircle className="size-4 shrink-0 text-[#f2a39a]" /> : <Info className="size-4 shrink-0 text-white/70" />}
            <span className="min-w-0 flex-1">{t.message}</span>
            {t.action?.href ? (
              <Link href={t.action.href} onClick={() => dismiss(t.id)} className="rounded px-1.5 py-0.5 font-medium text-olive-300 hover:bg-white/10">
                {t.action.label}
              </Link>
            ) : t.action?.onClick ? (
              <button
                onClick={() => {
                  t.action?.onClick?.();
                  dismiss(t.id);
                }}
                className="rounded px-1.5 py-0.5 font-medium text-olive-300 hover:bg-white/10"
              >
                {t.action.label}
              </button>
            ) : null}
            <button onClick={() => dismiss(t.id)} className={cn("rounded p-1 text-white/60 hover:bg-white/10 hover:text-white")} aria-label="Dismiss">
              <X className="size-3.5" />
            </button>
          </div>
        ))}
      </div>
    </Ctx.Provider>
  );
}

export const useToast = () => useContext(Ctx);
