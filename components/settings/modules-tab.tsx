"use client";
import { Check, Pencil, Plus, Trash2, X } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/field";
import { useToast } from "@/components/ui/toast";
import { useBugs, useModules, usePerms } from "@/lib/hooks";
import { addModule, removeModule, updateModule } from "@/lib/store";
import { plural } from "@/lib/utils";

export function ModulesTab() {
  const modules = useModules();
  const bugs = useBugs();
  const { can } = usePerms();
  const { toast } = useToast();
  const manage = can("manage");
  const [name, setName] = useState("");
  const [desc, setDesc] = useState("");
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState({ name: "", description: "" });

  const add = async () => {
    if (!name.trim()) return;
    if (modules.some((m) => m.name.toLowerCase() === name.trim().toLowerCase())) return toast("A module with that name already exists", { tone: "error" });
    const res = await addModule(name, desc);
    if (!res.ok) return;
    toast(`${name.trim()} added`);
    setName("");
    setDesc("");
  };

  return (
    <section>
      <div className="mb-4">
        <h2 className="text-sm font-semibold text-ink">Product modules</h2>
        <p className="mt-0.5 text-[13px] text-muted">Areas of the product that bugs can be filed against. They appear in filters and the reporting form.</p>
      </div>

      {manage ? (
        <div className="mb-4 flex flex-wrap items-center gap-2 rounded-2xl bg-wash p-3.5">
          <Input value={name} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => e.key === "Enter" && void add()} placeholder="Module name" className="w-full bg-white sm:w-[220px]" aria-label="Module name" />
          <Input value={desc} onChange={(e) => setDesc(e.target.value)} onKeyDown={(e) => e.key === "Enter" && void add()} placeholder="Short description (optional)" className="min-w-0 flex-1 bg-white sm:basis-[260px]" aria-label="Module description" />
          <Button variant="primary" size="lg" onClick={() => void add()} disabled={!name.trim()}><Plus className="size-4" /> Add module</Button>
        </div>
      ) : null}

      <ul className="divide-y divide-line/70 rounded-2xl border border-line">
        {modules.map((m) => {
          const count = bugs.filter((b) => b.moduleId === m.id).length;
          const isEditing = editing === m.id;
          return (
            <li key={m.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3">
              {isEditing ? (
                <>
                  <Input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} className="h-8 w-full sm:w-[220px]" aria-label="Module name" autoFocus />
                  <Input value={draft.description} onChange={(e) => setDraft({ ...draft, description: e.target.value })} className="h-8 min-w-0 flex-1 sm:basis-[240px]" aria-label="Module description" />
                  <div className="flex gap-1">
                    <Button size="icon-sm" variant="primary" aria-label="Save" disabled={!draft.name.trim()} onClick={async () => { if ((await updateModule(m.id, { name: draft.name.trim(), description: draft.description.trim() })).ok) { setEditing(null); toast("Module updated"); } }}><Check className="size-4" /></Button>
                    <Button size="icon-sm" aria-label="Cancel" onClick={() => setEditing(null)}><X className="size-4" /></Button>
                  </div>
                </>
              ) : (
                <>
                  <div className="min-w-0 flex-1 basis-[240px]">
                    <p className="text-[13.5px] font-medium text-ink">{m.name}</p>
                    <p className="truncate text-[13px] text-muted">{m.description || "No description"}</p>
                  </div>
                  <span className="tnum w-20 text-[13px] text-muted">{plural(count, "bug")}</span>
                  {manage ? (
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon-sm" aria-label={`Edit ${m.name}`} onClick={() => { setEditing(m.id); setDraft({ name: m.name, description: m.description }); }}><Pencil className="size-3.5" /></Button>
                      <Button variant="ghost" size="icon-sm" aria-label={`Delete ${m.name}`} disabled={count > 0} title={count > 0 ? `Used by ${plural(count, "bug")}` : "Delete module"} onClick={async () => { if ((await removeModule(m.id)).ok) toast(`${m.name} deleted`); }}><Trash2 className="size-3.5" /></Button>
                    </div>
                  ) : null}
                </>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
