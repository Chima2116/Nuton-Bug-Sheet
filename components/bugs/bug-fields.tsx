"use client";
import { Plus, Sparkles, TriangleAlert, X } from "lucide-react";
import { useRef, type ReactNode } from "react";
import { Hint, Input, Label, Select, Textarea } from "@/components/ui/field";
import { SEVERITY_META } from "@/lib/constants";
import { useDefinitions, useModules } from "@/lib/hooks";
import { CATEGORIES, PRIORITIES, SEVERITIES, type Category, type FieldFlag, type Priority, type Severity } from "@/lib/types";
import { cn } from "@/lib/utils";

export interface FieldValues {
  title: string;
  description: string;
  steps: string[];
  expected: string;
  actual: string;
  requiredFix: string[];
  severity: Severity | "";
  priority: Priority | "";
  category: Category | "";
  moduleId: string;
  environment: string;
}
export type FieldKey = keyof FieldValues;
export type Flags = Partial<Record<FieldKey, FieldFlag>>;
export type Errors = Partial<Record<FieldKey, string>>;

function FlagChip({ flag, empty }: { flag?: FieldFlag; empty: boolean }) {
  if (flag === "suggested" && !empty)
    return (
      <span className="inline-flex items-center gap-1 rounded bg-sev-medium/10 px-1.5 py-px text-[11px] font-medium text-sev-medium" title="Suggested from your text. Check it before confirming.">
        <Sparkles className="size-3" /> Suggested · check
      </span>
    );
  if (flag === "missing" || (flag === "suggested" && empty))
    return (
      <span className="inline-flex items-center gap-1 rounded bg-wash-2 px-1.5 py-px text-[11px] font-medium text-muted" title="Nothing in your report covered this. Add it if you know it.">
        <TriangleAlert className="size-3" /> Needs review
      </span>
    );
  return null;
}

function Row({ label, htmlFor, flag, empty, error, required, hint, children, className }: { label: string; htmlFor?: string; flag?: FieldFlag; empty: boolean; error?: string; required?: boolean; hint?: string; children: ReactNode; className?: string }) {
  return (
    <div className={className}>
      <div className="mb-1.5 flex flex-wrap items-center gap-x-2 gap-y-1">
        <Label htmlFor={htmlFor} className="mb-0">
          {label}
          {required ? <span className="ml-0.5 text-st-reopened" aria-hidden>*</span> : null}
        </Label>
        <FlagChip flag={flag} empty={empty} />
      </div>
      {children}
      {error ? <p className="mt-1.5 text-xs text-st-reopened" role="alert">{error}</p> : hint ? <Hint>{hint}</Hint> : null}
    </div>
  );
}

function Steps({ steps, onChange, invalid, noun = "step" }: { steps: string[]; onChange: (s: string[]) => void; invalid?: boolean; noun?: string }) {
  const refs = useRef<(HTMLInputElement | null)[]>([]);
  const focus = (i: number) => requestAnimationFrame(() => refs.current[i]?.focus());
  const list = steps.length ? steps : [];
  return (
    <div className="space-y-2">
      {list.map((s, i) => (
        <div key={i} className="flex items-center gap-2">
          <span className="tnum flex size-6 shrink-0 items-center justify-center rounded-full bg-wash text-xs text-muted">{i + 1}</span>
          <Input
            ref={(el) => { refs.current[i] = el; }}
            value={s}
            aria-label={`${noun} ${i + 1}`}
            onChange={(e) => onChange(list.map((x, j) => (j === i ? e.target.value : x)))}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                const next = [...list.slice(0, i + 1), "", ...list.slice(i + 1)];
                onChange(next);
                focus(i + 1);
              } else if (e.key === "Backspace" && !s && list.length > 0) {
                e.preventDefault();
                onChange(list.filter((_, j) => j !== i));
                focus(Math.max(0, i - 1));
              }
            }}
            className={cn("h-9", invalid && "border-st-reopened")}
          />
          <button type="button" onClick={() => onChange(list.filter((_, j) => j !== i))} className="rounded-md p-1.5 text-faint hover:bg-wash hover:text-ink" aria-label={`Remove ${noun} ${i + 1}`}>
            <X className="size-4" />
          </button>
        </div>
      ))}
      <button
        type="button"
        onClick={() => { onChange([...list, ""]); focus(list.length); }}
        className="inline-flex items-center gap-1.5 rounded-md py-1 text-[13px] font-medium text-olive-700 hover:text-olive-800"
      >
        <Plus className="size-3.5" /> Add {noun}
      </button>
    </div>
  );
}

export function BugFields({ values, onChange, flags = {}, errors = {}, idPrefix = "f" }: { values: FieldValues; onChange: (p: Partial<FieldValues>) => void; flags?: Flags; errors?: Errors; idPrefix?: string }) {
  const modules = useModules();
  const defs = useDefinitions();
  const empty = (k: FieldKey) => (Array.isArray(values[k]) ? !(values[k] as string[]).filter((s) => s.trim()).length : !String(values[k]).trim());
  const err = (k: FieldKey) => errors[k];
  const bad = (k: FieldKey) => (err(k) ? "border-st-reopened focus:border-st-reopened" : "");
  const id = (k: string) => `${idPrefix}-${k}`;

  return (
    <div className="space-y-8">
      <section className="space-y-5">
        <Row label="Bug title" htmlFor={id("title")} flag={flags.title} empty={empty("title")} error={err("title")} required>
          <Input id={id("title")} value={values.title} onChange={(e) => onChange({ title: e.target.value })} className={bad("title")} placeholder="Short, specific summary of the problem" />
        </Row>
        <Row label="Description" htmlFor={id("description")} flag={flags.description} empty={empty("description")} error={err("description")} required>
          <Textarea id={id("description")} autoGrow rows={3} value={values.description} onChange={(e) => onChange({ description: e.target.value })} className={cn("min-h-[84px]", bad("description"))} placeholder="What is wrong, and where?" />
        </Row>
      </section>

      <section className="space-y-5">
        <Row label="Steps to reproduce" flag={flags.steps} empty={empty("steps")}>
          <Steps steps={values.steps} onChange={(steps) => onChange({ steps })} />
        </Row>
        <div className="grid gap-5 md:grid-cols-2">
          <Row label="Expected behaviour" htmlFor={id("expected")} flag={flags.expected} empty={empty("expected")}>
            <Textarea id={id("expected")} autoGrow rows={3} value={values.expected} onChange={(e) => onChange({ expected: e.target.value })} className="min-h-[84px]" placeholder="What should happen?" />
          </Row>
          <Row label="Actual behaviour" htmlFor={id("actual")} flag={flags.actual} empty={empty("actual")}>
            <Textarea id={id("actual")} autoGrow rows={3} value={values.actual} onChange={(e) => onChange({ actual: e.target.value })} className="min-h-[84px]" placeholder="What happens instead?" />
          </Row>
        </div>
      </section>

      <section className="space-y-5">
        <Row label="Required correction" flag={flags.requiredFix} empty={empty("requiredFix")} hint="What has to change, and how we will know it is fixed.">
          <Steps steps={values.requiredFix} noun="point" onChange={(requiredFix) => onChange({ requiredFix })} />
        </Row>
        <div className="grid gap-5 md:grid-cols-2">
          <Row label="Severity" flag={flags.severity} empty={empty("severity")} error={err("severity")} required>
            <div role="radiogroup" aria-label="Severity" className="flex flex-wrap gap-1.5">
              {SEVERITIES.map((s) => {
                const on = values.severity === s;
                return (
                  <button key={s} type="button" role="radio" aria-checked={on} onClick={() => onChange({ severity: s })} className={cn("inline-flex h-8 items-center gap-1.5 rounded-md border px-2.5 text-[13px] transition-colors", on ? "border-olive-500 bg-olive-50 font-medium text-olive-800" : "border-line-strong bg-white text-ink-2 hover:bg-wash", err("severity") && !on && "border-st-reopened/50")}>
                    <span className={cn("size-1.5 rounded-full", SEVERITY_META[s].dot)} />
                    {s}
                  </button>
                );
              })}
            </div>
            {values.severity ? <Hint>{defs.severity[values.severity]}</Hint> : null}
          </Row>
          <Row label="Priority" flag={flags.priority} empty={empty("priority")} error={err("priority")} required>
            <div role="radiogroup" aria-label="Priority" className="flex flex-wrap gap-1.5">
              {PRIORITIES.map((p) => {
                const on = values.priority === p;
                return (
                  <button key={p} type="button" role="radio" aria-checked={on} onClick={() => onChange({ priority: p })} className={cn("tnum inline-flex h-8 min-w-12 items-center justify-center rounded-md border px-2.5 text-[13px] transition-colors", on ? "border-olive-500 bg-olive-50 font-medium text-olive-800" : "border-line-strong bg-white text-ink-2 hover:bg-wash", err("priority") && !on && "border-st-reopened/50")}>
                    {p}
                  </button>
                );
              })}
            </div>
            {values.priority ? <Hint>{defs.priority[values.priority]}</Hint> : null}
          </Row>
        </div>
        <div className="grid gap-5 md:grid-cols-2">
          <Row label="Category" htmlFor={id("category")} flag={flags.category} empty={empty("category")} error={err("category")} required>
            <Select id={id("category")} value={values.category} onChange={(e) => onChange({ category: e.target.value as Category })} className={bad("category")}>
              <option value="" disabled>Select a category</option>
              {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
            </Select>
          </Row>
          <Row label="Affected module" htmlFor={id("module")} flag={flags.moduleId} empty={empty("moduleId")} error={err("moduleId")} required>
            <Select id={id("module")} value={values.moduleId} onChange={(e) => onChange({ moduleId: e.target.value })} className={bad("moduleId")}>
              <option value="" disabled>Select a module</option>
              {modules.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
            </Select>
          </Row>
        </div>
        <Row label="Environment" htmlFor={id("env")} flag={flags.environment} empty={empty("environment")} hint="Browser, operating system, device or screen size.">
          <Input id={id("env")} value={values.environment} onChange={(e) => onChange({ environment: e.target.value })} placeholder="e.g. Chrome 131 · macOS 15 · 1440×900" />
        </Row>
      </section>
    </div>
  );
}
