import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";
import { buildSystemPrompt, buildUserContent, MAX_IMAGE_B64, MAX_IMAGES, MAX_NOTE_CHARS, OUTPUT_SCHEMA, parseModelOutput, type StructureImage, type StructureRequest } from "@/lib/ai/structure";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * Turns a free-text bug note (and screenshots) into structured bug reports with an AI model.
 *
 * - Provider keys live only on the server. They are never sent to the browser.
 *   GEMINI_API_KEY uses Google Gemini (has a free tier). ANTHROPIC_API_KEY uses Claude.
 *   If both are set, Claude is used unless AI_PROVIDER=gemini.
 * - Only signed-in Bug Sheet team members can call it (their Supabase session is checked on every request).
 * - If no key is set, or the model call fails, the app falls back to its built-in rules.
 */

const CLAUDE_MODEL = process.env.ANTHROPIC_MODEL || "claude-opus-5-5";
const GEMINI_MODELS = Array.from(new Set([process.env.GEMINI_MODEL || "gemini-3.5-flash-lite", "gemini-3.6-flash"]));
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

type Provider = "claude" | "gemini";
function pickProvider(): Provider | null {
  const claude = !!process.env.ANTHROPIC_API_KEY;
  const gemini = !!process.env.GEMINI_API_KEY;
  if (process.env.AI_PROVIDER === "gemini" && gemini) return "gemini";
  if (process.env.AI_PROVIDER === "claude" && claude) return "claude";
  return claude ? "claude" : gemini ? "gemini" : null;
}

/** A model call that failed in a way the caller should hear about. */
class ModelFailure extends Error {
  constructor(public status: number, public code: string) {
    super(code);
  }
}

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

/* ------------------------------------------------------------------ Claude */
async function callClaude(system: string, text: string, images: StructureImage[]): Promise<string> {
  const client = new Anthropic({ maxRetries: 1, timeout: 45_000 });
  const params = {
    model: CLAUDE_MODEL,
    max_tokens: 4096,
    system,
    messages: [{ role: "user" as const, content: buildUserContent(text, images) }],
    // A short think keeps replies quick while still writing a careful report.
    output_config: { effort: "medium" as const, format: { type: "json_schema" as const, schema: OUTPUT_SCHEMA as unknown as Record<string, unknown> } },
  };
  let message: Anthropic.Message | Anthropic.Beta.BetaMessage;
  try {
    // If the model declines on policy grounds, let the API retry on its fallback model.
    message = await client.beta.messages.create({ ...params, betas: ["server-side-fallback-2026-07-01"], fallbacks: "default" } as Anthropic.Beta.MessageCreateParamsNonStreaming);
  } catch (e) {
    if (!(e instanceof Anthropic.BadRequestError)) throw e;
    message = await client.messages.create(params as Anthropic.MessageCreateParamsNonStreaming);
  }
  if (message.stop_reason === "refusal") throw new ModelFailure(422, "refused");
  if (message.stop_reason === "max_tokens") throw new ModelFailure(502, "too_long_output");
  const block = message.content.find((b) => b.type === "text");
  return block && "text" in block ? block.text : "";
}

/* ------------------------------------------------------------------ Gemini */
interface GeminiStep {
  type?: string;
  content?: { type?: string; text?: string }[];
}

async function callGemini(system: string, text: string, images: StructureImage[]): Promise<string> {
  const input: Record<string, unknown>[] = [];
  images.forEach((img, i) => {
    input.push({ type: "text", text: `Screenshot ${i + 1}:` });
    input.push({ type: "image", data: img.data, mime_type: img.mediaType });
  });
  input.push({ type: "text", text: `<note>\n${text.trim()}\n</note>` });

  // Try the main model first; if it is busy or unavailable, try the next one.
  let res: Response | null = null;
  let lastStatus = 0;
  for (const model of GEMINI_MODELS) {
    try {
      res = await fetch("https://generativelanguage.googleapis.com/v1beta/interactions", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-goog-api-key": process.env.GEMINI_API_KEY ?? "" },
        body: JSON.stringify({
          model,
          system_instruction: system,
          input,
          response_format: { type: "text", mime_type: "application/json", schema: OUTPUT_SCHEMA },
          generation_config: { max_output_tokens: 8192 },
        }),
        signal: AbortSignal.timeout(27_000),
        cache: "no-store",
      });
    } catch {
      res = null;
      lastStatus = 0;
      continue;
    }
    if (res.ok) break;
    lastStatus = res.status;
    // The body can name the reason (bad key, quota). Log it for the server owner; never return it to the browser.
    console.error("structure: gemini error", model, res.status, (await res.text().catch(() => "")).slice(0, 300));
    res = null;
    if (res === null && (lastStatus === 400 || lastStatus === 401 || lastStatus === 403)) break; // the key or request is wrong; another model won't help
  }
  if (!res) throw new ModelFailure(lastStatus === 429 ? 429 : 502, lastStatus === 429 ? "rate_limited" : "model_error");
  const data = (await res.json()) as { steps?: GeminiStep[]; output_text?: string };
  const fromSteps = (data.steps ?? [])
    .filter((s) => !s.type || s.type === "model_output")
    .flatMap((s) => s.content ?? [])
    .filter((c) => c.type === "text" && typeof c.text === "string")
    .map((c) => c.text)
    .join("");
  return fromSteps || data.output_text || "";
}

export async function POST(req: Request) {
  const userId = await authenticate(req);
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const provider = pickProvider();
  if (!provider) return NextResponse.json({ error: "not_configured" }, { status: 503 });
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

  const kinds = ["image/jpeg", "image/png", "image/webp", "image/gif"];
  const images: StructureImage[] = (Array.isArray(body.images) ? body.images : [])
    .filter((i) => i && kinds.includes(i.mediaType) && typeof i.data === "string" && /^[A-Za-z0-9+/=]+$/.test(i.data) && i.data.length <= MAX_IMAGE_B64)
    .slice(0, MAX_IMAGES);

  const system = buildSystemPrompt({ text, modules, severityDefinitions: body.severityDefinitions, images });
  try {
    const raw = provider === "gemini" ? await callGemini(system, text, images) : await callClaude(system, text, images);
    const bugs = parseModelOutput(raw, modules.map((m) => m.name));
    if (!bugs.length) return NextResponse.json({ error: "unreadable" }, { status: 502 });
    return NextResponse.json({ source: "ai", provider, bugs });
  } catch (e) {
    if (e instanceof ModelFailure) return NextResponse.json({ error: e.code }, { status: e.status });
    const status = e instanceof Anthropic.APIError ? e.status : undefined;
    console.error("structure: model call failed", provider, status ?? (e as Error).message);
    return NextResponse.json({ error: "model_error" }, { status: 502 });
  }
}
