import type { AppModule } from "./types";
import { SEVERITY_TO_PRIORITY } from "./constants";
import type { Definitions } from "./state";
import { structureReport } from "./extract";
import { supabase } from "./supabase";
import type { StructureImage, UnderstoodBug } from "./ai/structure";

export type { UnderstoodBug };

export interface Understanding {
  bugs: UnderstoodBug[];
  /** "ai" when Claude read the note; "basic" when the built-in rules did. */
  source: "ai" | "basic";
}

/** The built-in, rule-based reading. It only restructures what was written and leaves gaps empty. */
export function understandBasic(text: string, modules: AppModule[]): UnderstoodBug[] {
  const names = new Map(modules.map((m) => [m.id, m.name]));
  return structureReport({ text, moduleHint: "", modules, attachmentIds: [] }).map((b) => ({
    title: b.title,
    description: b.description,
    steps: b.steps,
    expected: b.expected,
    actual: b.actual,
    requiredFix: [],
    severity: b.severity,
    priority: b.priority || (b.severity ? SEVERITY_TO_PRIORITY[b.severity] : ""),
    category: b.category,
    module: names.get(b.moduleId) ?? "",
    environment: b.environment,
    uncertain: Object.entries(b.flags)
      .filter(([, f]) => f === "suggested" || f === "missing")
      .map(([k]) => (k === "moduleId" ? "module" : k)),
  }));
}

/** Reads a free-text note. Tries Claude through the server route and quietly falls back to the built-in rules. */
export async function understand(text: string, ctx: { modules: AppModule[]; definitions: Definitions; images?: StructureImage[]; signal?: AbortSignal }): Promise<Understanding> {
  const basic = (): Understanding => ({ bugs: understandBasic(text, ctx.modules), source: "basic" });
  try {
    const token = (await supabase?.auth.getSession())?.data.session?.access_token;
    if (!token) return basic();
    const res = await fetch("/api/structure", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        text,
        modules: ctx.modules.map((m) => ({ name: m.name, description: m.description })),
        severityDefinitions: ctx.definitions.severity,
        images: ctx.images?.length ? ctx.images : undefined,
      }),
      signal: ctx.signal,
    });
    if (!res.ok) return basic();
    const data = (await res.json()) as { bugs?: UnderstoodBug[] };
    if (!Array.isArray(data.bugs) || !data.bugs.length) return basic();
    return { bugs: data.bugs, source: "ai" };
  } catch (e) {
    if ((e as Error).name === "AbortError") throw e;
    return basic();
  }
}
