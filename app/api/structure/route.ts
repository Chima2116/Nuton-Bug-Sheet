import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";
import { buildSystemPrompt, buildUserMessage, MAX_NOTE_CHARS, OUTPUT_SCHEMA, parseModelOutput, type StructureRequest } from "@/lib/ai/structure";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * Turns a free-text bug note into structured bug reports with Claude.
 *
 * - The Anthropic key lives only on the server (ANTHROPIC_API_KEY). It is never sent to the browser.
 * - Only signed-in Bug Sheet team members can call it (their Supabase session is checked on every request).
 * - If no key is set, or the model call fails, the app falls back to its built-in rules.
 */

const MODEL = process.env.ANTHROPIC_MODEL || "claude-opus-5-5";
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

const hits = new Map<string, number[]>();
function rateLimited(userId: string) {
  const now = Date.now();
  const recent = (hits.get(userId) ?? []).filter((t) => now - t < 60_000);
  recent.push(now);
  hits.set(userId, recent);
  return recent.length > 20;
}

/** Confirms the caller is a signed-in member of the team, using their own session. Returns the user id. */
async function authenticate(req: Request): Promise<string | null> {
  const auth = req.headers.get("authorization");
  if (!auth?.startsWith("Bearer ") || !SUPABASE_URL || !SUPABASE_KEY) return null;
  const headers = { Authorization: auth, apikey: SUPABASE_KEY };
  try {
    const u = await fetch(`${SUPABASE_URL}/auth/v1/user`, { headers, cache: "no-store" });
    if (!u.ok) return null;
    const { id } = (await u.json()) as { id?: string };
    if (!id) return null;
    // Row-level security means only team members can read their own profile row.
    const p = await fetch(`${SUPABASE_URL}/rest/v1/profiles?select=id&id=eq.${encodeURIComponent(id)}`, { headers, cache: "no-store" });
    const rows = p.ok ? ((await p.json()) as unknown[]) : [];
    return rows.length ? id : null;
  } catch {
    return null;
  }
}

export async function POST(req: Request) {
  const userId = await authenticate(req);
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!process.env.ANTHROPIC_API_KEY) return NextResponse.json({ error: "not_configured" }, { status: 503 });
  if (rateLimited(userId)) return NextResponse.json({ error: "rate_limited" }, { status: 429 });

  let body: StructureRequest;
  try {
    body = (await req.json()) as StructureRequest;
  } catch {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }
  const text = typeof body.text === "string" ? body.text.trim() : "";
  if (text.length < 8) return NextResponse.json({ error: "too_short" }, { status: 400 });
  if (text.length > MAX_NOTE_CHARS) return NextResponse.json({ error: "too_long" }, { status: 413 });
  const modules = (Array.isArray(body.modules) ? body.modules : []).slice(0, 60).map((m) => ({ name: String(m.name ?? "").slice(0, 80), description: String(m.description ?? "").slice(0, 200) }));

  const client = new Anthropic({ maxRetries: 1, timeout: 45_000 });
  const params = {
    model: MODEL,
    max_tokens: 4096,
    system: buildSystemPrompt({ text, modules, severityDefinitions: body.severityDefinitions }),
    messages: [{ role: "user" as const, content: buildUserMessage(text) }],
    // Extraction is routine, so keep thinking light for speed.
    output_config: { effort: "low" as const, format: { type: "json_schema" as const, schema: OUTPUT_SCHEMA as unknown as Record<string, unknown> } },
  };

  try {
    let message: Anthropic.Message | Anthropic.Beta.BetaMessage;
    try {
      // If the model declines on policy grounds, let the API retry on its fallback model.
      message = await client.beta.messages.create({ ...params, betas: ["server-side-fallback-2026-07-01"], fallbacks: "default" } as Anthropic.Beta.MessageCreateParamsNonStreaming);
    } catch (e) {
      if (!(e instanceof Anthropic.BadRequestError)) throw e;
      message = await client.messages.create(params as Anthropic.MessageCreateParamsNonStreaming);
    }
    if (message.stop_reason === "refusal") return NextResponse.json({ error: "refused" }, { status: 422 });
    if (message.stop_reason === "max_tokens") return NextResponse.json({ error: "too_long_output" }, { status: 502 });
    const textBlock = message.content.find((b) => b.type === "text");
    const bugs = parseModelOutput(textBlock && "text" in textBlock ? textBlock.text : "", modules.map((m) => m.name));
    if (!bugs.length) return NextResponse.json({ error: "unreadable" }, { status: 502 });
    return NextResponse.json({ source: "ai", model: message.model, bugs });
  } catch (e) {
    const status = e instanceof Anthropic.APIError ? e.status : undefined;
    console.error("structure: model call failed", status ?? (e as Error).message);
    return NextResponse.json({ error: "model_error" }, { status: 502 });
  }
}
