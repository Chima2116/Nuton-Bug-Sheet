import { BadgeCheck } from "lucide-react";
import { PRIORITY_HINTS, SEVERITY_META, STATUS_META } from "@/lib/constants";
import type { Priority, Severity, Status } from "@/lib/types";
import { cn } from "@/lib/utils";

/** Status: dot + label. `pill` adds a soft tint, used in detail headers. */
export function StatusBadge({ status, verified, pill, className }: { status: Status; verified?: boolean; pill?: boolean; className?: string }) {
  const m = STATUS_META[status] ?? STATUS_META.Open;
  return (
    <span className={cn("inline-flex items-center gap-1.5 whitespace-nowrap text-[13px] font-medium", m.text, pill && cn("rounded-full px-2.5 py-1 text-xs", m.tint), className)}>
      <span className={cn("size-1.5 rounded-full", m.dot)} />
      {status}
      {verified && status === "Resolved" ? <BadgeCheck className="size-3.5" aria-label="Verified" /> : null}
    </span>
  );
}

export function SeverityBadge({ severity, pill, className }: { severity: Severity; pill?: boolean; className?: string }) {
  const m = SEVERITY_META[severity];
  return (
    <span className={cn("inline-flex items-center gap-1.5 whitespace-nowrap text-[13px]", pill ? cn("rounded-full px-2.5 py-1 text-xs font-medium", m.tint, m.text) : "text-ink-2", className)}>
      {!pill && <span className={cn("size-1.5 rounded-full", m.dot)} />}
      {pill && <span className={cn("size-1.5 rounded-full", m.dot)} />}
      {severity}
    </span>
  );
}

export function PriorityBadge({ priority, className }: { priority: Priority; className?: string }) {
  return (
    <span
      title={PRIORITY_HINTS[priority]}
      className={cn(
        "tnum inline-flex h-6 min-w-9 items-center justify-center rounded-full border px-2 text-xs font-medium",
        priority === "P0" ? "border-sev-critical/30 bg-sev-critical/8 text-sev-critical" : priority === "P1" ? "border-sev-high/30 bg-sev-high/8 text-sev-high" : "border-line-strong bg-white text-muted",
        className,
      )}
    >
      {priority}
    </span>
  );
}

export function Tag({ children, className }: { children: React.ReactNode; className?: string }) {
  return <span className={cn("inline-flex items-center rounded-full bg-wash-2/70 px-2.5 py-1 text-xs text-ink-2", className)}>{children}</span>;
}
