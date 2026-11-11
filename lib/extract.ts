import { SEVERITY_TO_PRIORITY } from "./constants";
import type { AppModule, Category, DraftBug, DraftFields, FieldFlag, Severity } from "./types";
import { uid } from "./utils";

/**
 * MOCK extraction. This is a local, rule-based parser, not an AI service.
 * It only restructures what the reporter wrote and never fills a gap with invented detail.
 * To integrate a real model later, replace `structureReport` with a call that returns DraftBug[].
 */

interface Input {
  text: string;
  moduleHint: string;
  modules: AppModule[];
  attachmentIds: string[];
}

/* ---------------- splitting one submission into separate bugs ---------------- */

const MARKER = /^\s*(?:bug|issue|problem)\s*#?\s*\d+\s*[:.)\-–—]\s*/i;
const NUMBERED = /^\s*\d+[.)]\s+/;
const NEW_ISSUE_LEAD = /^(?:another|a separate|separate|second|third|next|one more|also)\b[^.\n]{0,40}\b(?:issue|bug|problem)\b|^(?:separately|additionally|also)\s*[,:]/i;

export function splitReports(raw: string): string[] {
  const text = raw.replace(/\r\n/g, "\n").trim();
  if (!text) return [];
  const lines = text.split("\n");

  // 1) Explicit "Bug 1: …" / "Issue 2 - …" markers
  if (lines.filter((l) => MARKER.test(l)).length >= 2) {
    const chunks: string[] = [];
    lines.forEach((l) => {
      if (MARKER.test(l)) chunks.push(l.replace(MARKER, ""));
      else if (chunks.length) chunks[chunks.length - 1] += "\n" + l;
    });
    return clean(chunks);
  }

  // 2) Horizontal rules
  if (lines.some((l) => /^\s*([-*_=])\1{2,}\s*$/.test(l))) {
    const chunks = text.split(/\n\s*([-*_=])\1{2,}\s*\n/).filter((_, i) => i % 2 === 0);
    const cleaned = clean(chunks);
    if (cleaned.length >= 2) return cleaned;
  }

  // 3) Paragraphs that open a new issue ("Another issue: …", "Separately, …")
  const paras = text.split(/\n\s*\n/);
  if (paras.length >= 2 && paras.slice(1).some((p) => NEW_ISSUE_LEAD.test(p.trim()))) {
    const chunks: string[] = [];
    paras.forEach((p, i) => {
      if (i === 0 || NEW_ISSUE_LEAD.test(p.trim())) chunks.push(p.replace(/^\s*(?:another|a separate|separate|second|third|next|one more)\b[^:.\n]{0,40}(?:issue|bug|problem)\s*[:.\-–—]?\s*/i, ""));
      else chunks[chunks.length - 1] += "\n\n" + p;
    });
    const cleaned = clean(chunks);
    if (cleaned.length >= 2) return cleaned;
  }

  // 4) A numbered list of long, self-contained items (not a list of short steps)
  const numbered = lines.filter((l) => NUMBERED.test(l));
  const hasStepsWord = /\bsteps?\b|\breproduc/i.test(text);
  if (numbered.length >= 2 && !hasStepsWord) {
    const avg = numbered.reduce((n, l) => n + l.replace(NUMBERED, "").length, 0) / numbered.length;
    const preamble = lines.slice(0, lines.findIndex((l) => NUMBERED.test(l))).join("\n").trim();
    if (avg > 70 && preamble.length < 160) {
      const chunks: string[] = [];
      lines.forEach((l) => {
        if (NUMBERED.test(l)) chunks.push(l.replace(NUMBERED, ""));
        else if (chunks.length) chunks[chunks.length - 1] += "\n" + l;
      });
      return clean(chunks);
    }
  }
  return [text];
}

function clean(chunks: string[]) {
  return chunks.map((c) => c.trim()).filter((c) => c.length > 12);
}

/* ---------------- parsing one bug ---------------- */

const LABELS: Record<string, string> = {
  title: "title", summary: "title", "bug title": "title",
  steps: "steps", "steps to reproduce": "steps", "how to reproduce": "steps", repro: "steps", "reproduction steps": "steps",
  expected: "expected", "expected behaviour": "expected", "expected behavior": "expected", "expected result": "expected",
  actual: "actual", "actual behaviour": "actual", "actual behavior": "actual", "actual result": "actual", observed: "actual",
  environment: "environment", env: "environment", device: "environment", browser: "environment",
  severity: "severity", priority: "priority", module: "module", area: "module", feature: "module", category: "category", type: "category",
};
const LABEL_LINE = /^\s*(?:[-*•]\s*)?(title|bug title|summary|steps to reproduce|steps|how to reproduce|reproduction steps|repro|expected behaviou?r|expected result|expected|actual behaviou?r|actual result|actual|observed|environment|env|device|browser|severity|priority|module|area|feature|category|type)\s*[:\-–]\s*(.*)$/i;

function readLabelled(text: string) {
  const out: Record<string, string> = {};
  let current: string | null = null;
  const rest: string[] = [];
  text.split("\n").forEach((line) => {
    const m = line.match(LABEL_LINE);
    if (m) {
      current = LABELS[m[1].toLowerCase()];
      out[current] = (out[current] ? out[current] + "\n" : "") + m[2];
    } else if (current && line.trim()) {
      out[current] += "\n" + line;
    } else if (!line.trim()) {
      current = null;
      rest.push(line);
    } else {
      rest.push(line);
    }
  });
  return { labelled: out, prose: rest.join("\n").trim() };
}

function sentences(text: string): string[] {
  return text
    .replace(/\n+/g, " ")
    .split(/(?<=[.!?])\s+(?=[A-Z"“'(])/)
    .map((s) => s.trim())
    .filter(Boolean);
}

const EXPECT_RE = /\b(should|expected|expect|ought to|supposed to|must|needs? to|would like|ideally|i'd like)\b/i;

function mainClause(sentence: string) {
  const m = sentence.match(/^(?:when|whenever|after|while|if|once|every time)\b[^,]+,\s*(.+)$/i);
  return (m ? m[1] : sentence).trim();
}
function cap(s: string) {
  return s ? s[0].toUpperCase() + s.slice(1) : s;
}
function endStop(s: string) {
  return /[.!?]$/.test(s) ? s : s + ".";
}

const ENV_WORDS = /\b(chrome|chromium|safari|firefox|edge|arc|brave|macos|windows|ios|ipados|android|linux|iphone|ipad|macbook|pixel|\d{3,4}\s?(?:px|x|×))\b/i;

function makeTitle(sentence: string) {
  // Drop an environment lead-in such as "On Safari 18, macOS 15, …" from the title (it's kept in Environment).
  const lead = sentence.match(/^(?:on|in|using|with|from)\s+[^.]*?,\s+(?=(?:the|a|an|it|i|when|after|while|whenever|every)\b)/i);
  if (lead && ENV_WORDS.test(lead[0])) sentence = sentence.slice(lead[0].length);
  let t = mainClause(sentence)
    .replace(/^(?:i\s+(?:noticed|found|saw|see|think)\s+(?:that\s+)?|it\s+seems\s+(?:that\s+)?|there(?:'s| is| are)\s+)/i, "")
    .replace(/^(?:the|a|an)\s+/i, "")
    .replace(/[.!?]+$/, "")
    .trim();
  t = cap(t);
  if (t.length > 90) {
    const cut = t.slice(0, 90);
    t = cut.slice(0, Math.max(cut.lastIndexOf(" "), 50)).replace(/[,;:\s]+$/, "") + "…";
  }
  return t;
}

function explicitSteps(text: string): string[] {
  const items = text
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => /^(\d+[.)]|[-•*])\s+/.test(l))
    .map((l) => l.replace(/^(\d+[.)]|[-•*])\s+/, "").trim());
  if (items.length >= 2) return items;
  // "First, … then … finally …" style sequences are left for the reporter to confirm
  return [];
}

function stepFromWhenClause(sentence: string): string | null {
  const m = sentence.match(/\b(?:when|whenever|after|while|if|once)\s+(?:i|we|you|a user|the user|users?)\s+([^,]+),/i);
  if (!m) return null;
  let clause = m[1].trim();
  if (/^(?:am|was|are|were|have|had|do|did|don't|didn't|can't|cannot)\b/i.test(clause)) return null;
  clause = clause.replace(/^(?:try to|tried to|try|tried)\s+/i, "");
  // "opens" / "opened" → "open" (simple, conservative)
  clause = clause.replace(/^(\w+?)(?:ed|s)\b/i, (w, stem) => (["open", "click", "tap", "select", "navigat", "scroll", "resiz", "refresh", "generat", "load", "creat", "upload", "search", "start", "turn"].some((v) => stem.toLowerCase().startsWith(v)) ? stem + (/(navigat|resiz|generat|creat)$/i.test(stem) ? "e" : "") : w));
  return endStop(cap(clause));
}

const SEVERITY_RULES: [Severity, RegExp][] = [
  ["Critical", /\b(crash(?:es|ed)?|data loss|lose[sd]? (?:all|everything)|can'?t (?:log ?in|sign ?in|pay|access (?:my )?account)|security|leak(?:s|ed)?|blank screen|white screen|never (?:loads?|completes?|finish(?:es)?)|stuck forever|indefinitely)\b/i],
  ["High", /\b(broken|doesn'?t work|does not work|not working|fails?|failed|unable|can'?t|cannot|missing|not (?:appear|show|save[sd]?|load|update[sd]?)|(?:doesn'?t|don'?t|does not|do not|didn'?t|did not)\s+(?:show|appear|save|load|update|work)|wrong|incorrect|loses?|lost|freez(?:es|ing)|resets?|disappear(?:s|ed)?)\b/i],
  ["Medium", /\b(overlap(?:s|ping)?|inconsistent|flicker(?:s|ing)?|slow|lag(?:s|gy)?|difficult|confusing|unexpected|cut off|clipped|truncat\w+|overflow(?:s|ing)?|scrolls?)\b/i],
  ["Low", /\b(typo|slight(?:ly)?|minor|cosmetic|alignment|misaligned|padding|spacing|colou?rs?|fonts?|pixels?|hover|differs?)\b/i],
];

const CATEGORY_RULES: [Category, RegExp][] = [
  ["Accessibility", /\b(screen ?reader|aria|contrast|keyboard|focus ring|tab order|alt text|a11y|accessib\w+)\b/gi],
  ["Performance", /\b(slow|lag(?:s|gy)?|performance|freez\w+|takes? (?:\w+ )?(?:seconds|forever)|loading time|flicker\w*|janky|memory)\b/gi],
  ["Responsive", /\b(mobile|tablet|responsive|breakpoint|viewport|small screen|narrow|phone|\d{3}\s?px)\b/gi],
  ["Data", /\b(wrong (?:number|count|score|data|total|value)|incorrect (?:data|count|score|total)|duplicate[sd]?|stale|out of date|missing data|count|score)\b/gi],
  ["UI/Visual", /\b(overlap\w*|padding|spacing|margin|align\w*|colou?r|font|icon|design system|inconsistent|layout|looks?|visual|border|shadow|radius|hover)\b/gi],
  ["Functional", /\b(loses?|lost|disappear\w*|resets?|clears?|cleared|doesn'?t work|does not work|not working|broken|fails?|error|can'?t|cannot|nothing happens|click(?:ing)?|button|submit|save[sd]?|not (?:appear|show|load|update)|(?:doesn'?t|don'?t|does not|do not|didn'?t|did not)\s+(?:show|appear|save|load|update|work))\b/gi],
];

function pickCategory(text: string): Category | "" {
  let best: Category | "" = "";
  let bestScore = 0;
  CATEGORY_RULES.forEach(([cat, re]) => {
    const n = (text.match(re) ?? []).length;
    if (n > bestScore) {
      best = cat;
      bestScore = n;
    }
  });
  return best;
}

function pickModule(text: string, modules: AppModule[]): string {
  const lower = text.toLowerCase();
  let best = "";
  let bestScore = 0;
  modules.forEach((m) => {
    let score = 0;
    m.keywords.forEach((k) => {
      const kw = k.toLowerCase();
      const count = lower.split(kw).length - 1;
      score += count * (kw.includes(" ") ? 2 : 1);
    });
    if (lower.includes(m.name.toLowerCase())) score += 3;
    if (score > bestScore) {
      best = m.id;
      bestScore = score;
    }
  });
  return best;
}

export function extractEnvironment(text: string): string {
  const parts: string[] = [];
  const browser = text.match(/\b(Chrome|Chromium|Safari|Firefox|Edge|Arc|Brave|Opera)\b(?:\s+v?(\d+(?:\.\d+)*))?/i);
  if (browser) parts.push([cap(browser[1]), browser[2]].filter(Boolean).join(" "));
  const os = text.match(/\b(macOS(?:\s?\d+(?:\.\d+)?)?|Mac OS(?: X)?|Windows(?:\s?\d+)?|iPadOS(?:\s?\d+)?|iOS(?:\s?\d+(?:\.\d+)?)?|Android(?:\s?\d+)?|Linux|Ubuntu)\b/i);
  if (os) parts.push(os[1].replace(/^mac os( x)?$/i, "macOS"));
  const device = text.match(/\b(iPhone(?:\s?\d+)?(?:\s?(?:Pro|Max|Plus|mini))*|iPad(?:\s?(?:Air|Pro|mini))?|MacBook(?:\s(?:Pro|Air))?|Pixel\s?\d+|Galaxy\s?[A-Z]\d+)\b/i);
  if (device) parts.push(device[1]);
  else {
    const kind = text.match(/\b(?:on|using)\s+(?:a\s+|my\s+)?(mobile|tablet|desktop|phone)\b/i);
    if (kind) parts.push(cap(kind[1].toLowerCase()));
  }
  const size = text.match(/\b(\d{3,4})\s?[x×]\s?(\d{3,4})\b/);
  if (size) parts.push(`${size[1]}×${size[2]}`);
  else {
    const w = text.match(/\b(\d{3,4})\s?px(?:\s+(?:wide|width))?\b/i);
    if (w) parts.push(`${w[1]}px wide`);
  }
  return parts.join(" · ");
}

function coerceSeverity(v: string): Severity | "" {
  const m = v.match(/critical|high|medium|low/i)?.[0];
  return m ? ((cap(m.toLowerCase()) as Severity)) : "";
}
function coercePriority(v: string) {
  const m = v.match(/p[0-3]/i)?.[0];
  return m ? (m.toUpperCase() as DraftFields["priority"]) : "";
}
function coerceCategory(v: string): Category | "" {
  const l = v.toLowerCase();
  if (/ui|visual/.test(l)) return "UI/Visual";
  if (/function/.test(l)) return "Functional";
  if (/responsive/.test(l)) return "Responsive";
  if (/perform/.test(l)) return "Performance";
  if (/data/.test(l)) return "Data";
  if (/access/.test(l)) return "Accessibility";
  return "";
}

function parseOne(chunk: string, input: Input): DraftBug {
  const flags: DraftBug["flags"] = {};
  const { labelled, prose } = readLabelled(chunk);
  const body = prose || chunk;
  const sents = sentences(body);
  const expectedSents = sents.filter((s) => EXPECT_RE.test(s));
  const problemSents = sents.filter((s) => !EXPECT_RE.test(s));
  const lead = problemSents[0] ?? sents[0] ?? "";

  const set = <K extends keyof DraftFields>(key: K, value: DraftFields[K], flag: FieldFlag) => {
    flags[key] = value === "" || (Array.isArray(value) && !value.length) ? "missing" : flag;
    return value;
  };

  const title = labelled.title?.trim() ? set("title", labelled.title.trim().split("\n")[0], "extracted") : set("title", lead ? makeTitle(lead) : "", lead ? "suggested" : "missing");

  const description = set("description", problemSents.length ? problemSents.join(" ") : sents.join(" "), "extracted");

  let steps: string[] = [];
  let stepsFlag: FieldFlag = "extracted";
  if (labelled.steps) steps = explicitSteps(labelled.steps).length ? explicitSteps(labelled.steps) : labelled.steps.split("\n").map((s) => s.trim().replace(/^(\d+[.)]|[-•*])\s+/, "")).filter(Boolean);
  else if (explicitSteps(chunk).length) steps = explicitSteps(chunk);
  else {
    const fromWhen = lead ? stepFromWhenClause(lead) : null;
    if (fromWhen) {
      steps = [fromWhen];
      stepsFlag = "suggested";
    }
  }
  set("steps", steps, stepsFlag);

  const expected = labelled.expected?.trim()
    ? set("expected", labelled.expected.trim(), "extracted")
    : set("expected", expectedSents.length ? expectedSents.map(endStop).join(" ") : "", "extracted");

  const actual = labelled.actual?.trim()
    ? set("actual", labelled.actual.trim(), "extracted")
    : set("actual", problemSents[0] ? endStop(cap(mainClause(problemSents[0]))) : "", "extracted");

  // Severity & priority are a judgement call: only ever "suggested", never silently final.
  let severity: Severity | "" = labelled.severity ? coerceSeverity(labelled.severity) : "";
  let sevFlag: FieldFlag = "extracted";
  if (!severity) {
    const hit = SEVERITY_RULES.find(([, re]) => re.test(chunk));
    severity = hit ? hit[0] : "";
    sevFlag = "suggested";
  }
  set("severity", severity, sevFlag);

  let priority: DraftFields["priority"] = labelled.priority ? coercePriority(labelled.priority) : "";
  let priFlag: FieldFlag = "extracted";
  if (!priority && severity) {
    priority = SEVERITY_TO_PRIORITY[severity];
    priFlag = "suggested";
  }
  set("priority", priority, priFlag);

  const category = labelled.category ? coerceCategory(labelled.category) || pickCategory(chunk) : pickCategory(chunk);
  set("category", category, labelled.category ? "extracted" : "suggested");

  let moduleId = "";
  let modFlag: FieldFlag = "suggested";
  if (input.moduleHint) {
    moduleId = input.moduleHint;
    modFlag = "extracted";
  } else {
    if (labelled.module) {
      const lm = labelled.module.trim().toLowerCase();
      moduleId = input.modules.find((m) => m.name.toLowerCase() === lm || lm.includes(m.name.toLowerCase()))?.id ?? "";
      if (moduleId) modFlag = "extracted";
    }
    if (!moduleId) moduleId = pickModule(chunk, input.modules);
  }
  set("moduleId", moduleId, modFlag);

  const env = labelled.environment?.trim() || extractEnvironment(chunk);
  set("environment", env, "extracted");

  return {
    key: uid("bug"),
    excerpt: chunk,
    attachmentIds: input.attachmentIds,
    title, description, steps, expected, actual, severity, priority, category, moduleId, environment: env,
    flags,
  };
}

export function structureReport(input: Input): DraftBug[] {
  const chunks = splitReports(input.text);
  return chunks.map((c) => parseOne(c, input));
}

export function blankDraftBug(attachmentIds: string[], excerpt = ""): DraftBug {
  const empty: DraftFields = { title: "", description: "", steps: [], expected: "", actual: "", severity: "", priority: "", category: "", moduleId: "", environment: "" };
  return {
    key: uid("bug"),
    excerpt,
    attachmentIds,
    ...empty,
    flags: Object.fromEntries(Object.keys(empty).map((k) => [k, "missing"])) as DraftBug["flags"],
  };
}

export const EXAMPLE_REPORT =
  "When I open the AI tutor while reading a lesson, the chat panel overlaps the lesson content instead of resizing the lesson area. This makes the lesson difficult to read. It should behave like the design system, where the lesson content and tutor panel share the available screen width.";
