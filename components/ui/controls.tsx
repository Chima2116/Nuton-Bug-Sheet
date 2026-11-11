"use client";
import { Check, Minus } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function Checkbox({ checked, indeterminate, onChange, label, className, stop }: { checked: boolean; indeterminate?: boolean; onChange: (v: boolean) => void; label: string; className?: string; stop?: boolean }) {
  const on = checked || indeterminate;
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={indeterminate ? "mixed" : checked}
      aria-label={label}
      onClick={(e) => {
        if (stop) e.stopPropagation();
        onChange(!checked);
      }}
      className={cn(
        "flex size-4 shrink-0 items-center justify-center rounded-[4px] border transition-colors",
        on ? "border-olive-600 bg-olive-600 text-white" : "border-line-strong bg-white hover:border-faint",
        className,
      )}
    >
      {indeterminate ? <Minus className="size-3" strokeWidth={3} /> : checked ? <Check className="size-3" strokeWidth={3} /> : null}
    </button>
  );
}

export function Segmented<T extends string>({
  value,
  onChange,
  options,
  className,
}: {
  value: T;
  onChange: (v: T) => void;
  options: { id: T; label: ReactNode; count?: number }[];
  className?: string;
}) {
  return (
    <div role="tablist" className={cn("inline-flex max-w-full items-center gap-0.5 overflow-x-auto rounded-lg bg-wash p-0.5", className)}>
      {options.map((o) => (
        <button
          key={o.id}
          role="tab"
          aria-selected={value === o.id}
          onClick={() => onChange(o.id)}
          className={cn(
            "inline-flex h-7 items-center gap-1.5 whitespace-nowrap rounded-md px-3 text-[13px] font-medium transition-colors",
            value === o.id ? "bg-white text-ink shadow-[0_0_0_1px_var(--color-line)]" : "text-muted hover:text-ink",
          )}
        >
          {o.label}
          {o.count !== undefined ? <span className={cn("tnum text-xs", value === o.id ? "text-muted" : "text-faint")}>{o.count}</span> : null}
        </button>
      ))}
    </div>
  );
}

export function UnderlineTabs<T extends string>({
  value,
  onChange,
  options,
}: {
  value: T;
  onChange: (v: T) => void;
  options: { id: T; label: string; icon?: ReactNode }[];
}) {
  return (
    <div role="tablist" className="flex gap-1 overflow-x-auto border-b border-line">
      {options.map((o) => (
        <button
          key={o.id}
          role="tab"
          aria-selected={value === o.id}
          onClick={() => onChange(o.id)}
          className={cn(
            "-mb-px inline-flex h-10 items-center gap-2 whitespace-nowrap border-b-2 px-3 text-[13px] font-medium transition-colors",
            value === o.id ? "border-ink text-ink" : "border-transparent text-muted hover:text-ink",
          )}
        >
          {o.icon}
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function EmptyState({ icon, title, body, action }: { icon?: ReactNode; title: string; body?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
      {icon ? <div className="mb-3 flex size-10 items-center justify-center rounded-full bg-wash text-muted">{icon}</div> : null}
      <p className="text-sm font-medium text-ink">{title}</p>
      {body ? <p className="mt-1 max-w-sm text-[13px] text-muted">{body}</p> : null}
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}

export function Kbd({ children }: { children: ReactNode }) {
  return <kbd className="inline-flex h-[18px] min-w-[18px] items-center justify-center rounded bg-wash-2 px-1 font-sans text-[11px] text-muted">{children}</kbd>;
}
