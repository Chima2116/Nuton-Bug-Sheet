"use client";
import { Check, ChevronDown } from "lucide-react";
import type { ReactNode } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/overlay";
import { Input } from "@/components/ui/field";
import { cn } from "@/lib/utils";
import type { DateRange } from "./filters";
import { useState } from "react";

export interface FilterOption {
  value: string;
  label: string;
  dot?: string;
}

function TriggerButton({ label, count, children }: { label: string; count?: number; children?: ReactNode }) {
  const active = !!count;
  return (
    <button
      className={cn(
        "inline-flex h-8 items-center gap-1.5 whitespace-nowrap rounded-md border px-2.5 text-[13px] transition-colors",
        active ? "border-olive-300 bg-olive-50 text-olive-800" : "border-line-strong bg-white text-ink-2 hover:bg-wash",
      )}
    >
      {label}
      {active ? <span className="tnum rounded bg-olive-600 px-1.5 text-[11px] font-medium leading-[18px] text-white">{count}</span> : null}
      {children}
      <ChevronDown className="size-3.5 text-faint" />
    </button>
  );
}

export function FilterMenu({
  label,
  options,
  selected,
  onChange,
  width = "w-[220px]",
}: {
  label: string;
  options: FilterOption[];
  selected: string[];
  onChange: (v: string[]) => void;
  width?: string;
}) {
  const toggle = (v: string) => onChange(selected.includes(v) ? selected.filter((x) => x !== v) : [...selected, v]);
  return (
    <Popover>
      <PopoverTrigger asChild>
        <span>
          <TriggerButton label={label} count={selected.length} />
        </span>
      </PopoverTrigger>
      <PopoverContent className={cn("p-1", width)}>
        <div className="max-h-72 overflow-y-auto">
          {options.map((o) => {
            const on = selected.includes(o.value);
            return (
              <button key={o.value} onClick={() => toggle(o.value)} className="flex w-full items-center gap-2.5 rounded-md px-2.5 py-1.5 text-left text-[13px] text-ink hover:bg-wash">
                <span className={cn("flex size-4 shrink-0 items-center justify-center rounded-[4px] border", on ? "border-olive-600 bg-olive-600 text-white" : "border-line-strong")}>{on ? <Check className="size-3" strokeWidth={3} /> : null}</span>
                {o.dot ? <span className={cn("size-1.5 shrink-0 rounded-full", o.dot)} /> : null}
                <span className="min-w-0 flex-1 truncate">{o.label}</span>
              </button>
            );
          })}
        </div>
        {selected.length ? (
          <div className="mt-1 border-t border-line pt-1">
            <button onClick={() => onChange([])} className="w-full rounded-md px-2.5 py-1.5 text-left text-[13px] text-muted hover:bg-wash hover:text-ink">
              Clear
            </button>
          </div>
        ) : null}
      </PopoverContent>
    </Popover>
  );
}

const DATE_OPTIONS: { id: DateRange; label: string }[] = [
  { id: "any", label: "Any time" },
  { id: "today", label: "Today" },
  { id: "7d", label: "Last 7 days" },
  { id: "30d", label: "Last 30 days" },
  { id: "custom", label: "Custom range" },
];

export function DateFilter({ value, from, to, onChange }: { value: DateRange; from: string; to: string; onChange: (v: { date: DateRange; from: string; to: string }) => void }) {
  const [open, setOpen] = useState(false);
  const current = DATE_OPTIONS.find((o) => o.id === value)!;
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <span>
          <TriggerButton label={value === "any" ? "Date reported" : current.label} count={undefined}>
            {value !== "any" ? <span className="size-1.5 rounded-full bg-olive-600" /> : null}
          </TriggerButton>
        </span>
      </PopoverTrigger>
      <PopoverContent className="w-[240px] p-1">
        {DATE_OPTIONS.map((o) => (
          <button
            key={o.id}
            onClick={() => {
              onChange({ date: o.id, from: o.id === "custom" ? from : "", to: o.id === "custom" ? to : "" });
              if (o.id !== "custom") setOpen(false);
            }}
            className="flex w-full items-center rounded-md px-2.5 py-1.5 text-left text-[13px] text-ink hover:bg-wash"
          >
            <span className="flex-1">{o.label}</span>
            {value === o.id ? <Check className="size-3.5 text-olive-600" /> : null}
          </button>
        ))}
        {value === "custom" ? (
          <div className="mt-1 space-y-2 border-t border-line p-2.5">
            <label className="block text-xs text-muted">
              From
              <Input type="date" value={from} max={to || undefined} onChange={(e) => onChange({ date: "custom", from: e.target.value, to })} className="mt-1 h-8 text-[13px]" />
            </label>
            <label className="block text-xs text-muted">
              To
              <Input type="date" value={to} min={from || undefined} onChange={(e) => onChange({ date: "custom", from, to: e.target.value })} className="mt-1 h-8 text-[13px]" />
            </label>
          </div>
        ) : null}
      </PopoverContent>
    </Popover>
  );
}
