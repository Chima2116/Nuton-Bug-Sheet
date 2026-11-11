"use client";
import { PriorityBadge, SeverityBadge } from "@/components/ui/badges";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/field";
import { useToast } from "@/components/ui/toast";
import { useDefinitions, usePerms } from "@/lib/hooks";
import { resetDefinitions, setDefinition } from "@/lib/store";
import { PRIORITIES, SEVERITIES } from "@/lib/types";
import { RotateCcw } from "lucide-react";

export function DefinitionsTab() {
  const defs = useDefinitions();
  const { can } = usePerms();
  const { toast } = useToast();
  const manage = can("manage");
  return (
    <div className="space-y-12">
      {[
        { kind: "severity" as const, title: "Severity", body: "How badly the bug affects people using the product.", items: SEVERITIES.map((s) => ({ key: s, badge: <SeverityBadge severity={s} />, text: defs.severity[s] })) },
        { kind: "priority" as const, title: "Priority", body: "How soon the team commits to fixing it.", items: PRIORITIES.map((p) => ({ key: p, badge: <PriorityBadge priority={p} />, text: defs.priority[p] })) },
      ].map((sec) => (
        <section key={sec.kind}>
          <div className="mb-4 flex items-end justify-between gap-4">
            <div>
              <h2 className="text-sm font-semibold text-ink">{sec.title} definitions</h2>
              <p className="mt-0.5 text-[13px] text-muted">{sec.body} These are shown when reporters choose a value.</p>
            </div>
            {sec.kind === "priority" && manage ? <Button size="sm" onClick={async () => { if ((await resetDefinitions()).ok) toast("Definitions reset to defaults"); }}><RotateCcw className="size-3.5" /> Reset all</Button> : null}
          </div>
          <ul className="divide-y divide-line/70 rounded-2xl border border-line">
            {sec.items.map((i) => (
              <li key={i.key} className="grid gap-2 px-4 py-3 sm:grid-cols-[120px_minmax(0,1fr)] sm:items-start sm:gap-6">
                <div className="pt-1.5">{i.badge}</div>
                {manage ? (
                  <Textarea
                    key={i.text}
                    autoGrow
                    rows={1}
                    defaultValue={i.text}
                    aria-label={`${i.key} definition`}
                    onBlur={async (e) => {
                      const v = e.target.value.trim();
                      if (v && v !== i.text && (await setDefinition(sec.kind, i.key, v)).ok) toast(`${i.key} definition saved`);
                    }}
                    className="min-h-9 text-[13px]"
                  />
                ) : (
                  <p className="pt-1.5 text-[13px] text-ink-2">{i.text}</p>
                )}
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
