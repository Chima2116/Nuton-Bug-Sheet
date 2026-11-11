"use client";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Sheet } from "@/components/ui/overlay";
import { useToast } from "@/components/ui/toast";
import { useModuleMap } from "@/lib/hooks";
import { updateBugFields } from "@/lib/store";
import type { Bug } from "@/lib/types";
import { BugFields, type Errors, type FieldKey, type FieldValues } from "./bug-fields";

const LABELS: Record<FieldKey, string> = { title: "title", description: "description", steps: "steps to reproduce", expected: "expected behaviour", actual: "actual behaviour", severity: "severity", priority: "priority", category: "category", moduleId: "module", environment: "environment" };

function toValues(b: Bug): FieldValues {
  return { title: b.title, description: b.description, steps: b.steps, expected: b.expected, actual: b.actual, severity: b.severity, priority: b.priority, category: b.category, moduleId: b.moduleId, environment: b.environment };
}

export function EditSheet({ bug, open, onOpenChange }: { bug: Bug; open: boolean; onOpenChange: (o: boolean) => void }) {
  const { toast } = useToast();
  const modules = useModuleMap();
  const [values, setValues] = useState<FieldValues>(() => toValues(bug));
  const [errors, setErrors] = useState<Errors>({});

  useEffect(() => {
    if (open) {
      setValues(toValues(bug));
      setErrors({});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const save = async () => {
    const e: Errors = {};
    (["title", "description", "severity", "priority", "category", "moduleId"] as FieldKey[]).forEach((k) => {
      if (!String(values[k]).trim()) e[k] = "Required";
    });
    setErrors(e);
    if (Object.keys(e).length) return;
    const orig = toValues(bug);
    const changed = (Object.keys(values) as FieldKey[]).filter((k) => JSON.stringify(values[k]) !== JSON.stringify(orig[k]));
    if (!changed.length) return onOpenChange(false);
    const res = await updateBugFields(
      bug.id,
      {
        title: values.title.trim(),
        description: values.description.trim(),
        steps: values.steps.map((s) => s.trim()).filter(Boolean),
        expected: values.expected.trim(),
        actual: values.actual.trim(),
        severity: values.severity as Bug["severity"],
        priority: values.priority as Bug["priority"],
        category: values.category as Bug["category"],
        moduleId: values.moduleId,
        environment: values.environment.trim(),
      },
      `Edited ${changed.map((k) => (k === "moduleId" ? `module to ${modules.get(values.moduleId)?.name}` : LABELS[k])).join(", ")}`,
    );
    if (!res.ok) return;
    toast(`${bug.id} updated`);
    onOpenChange(false);
  };

  return (
    <Sheet
      open={open}
      onOpenChange={onOpenChange}
      title={`Edit ${bug.id}`}
      description="Changes are recorded in the activity log. The original report is never altered."
      width="sm:w-[680px]"
      footer={
        <>
          <Button onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button variant="primary" onClick={() => void save()}>Save changes</Button>
        </>
      }
    >
      <BugFields idPrefix="edit" values={values} errors={errors} onChange={(p) => { setValues((v) => ({ ...v, ...p })); setErrors((e) => { const n = { ...e }; (Object.keys(p) as FieldKey[]).forEach((k) => delete n[k]); return n; }); }} />
    </Sheet>
  );
}
