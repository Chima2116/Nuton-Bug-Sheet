"use client";
import { Camera, ChevronDown, FileText, Loader2, RefreshCw, Sparkles, Trash2, Upload } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AttachmentGrid } from "@/components/bugs/attachments";
import { PageBody, PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Hint, Input, Label, Select, Textarea } from "@/components/ui/field";
import { useToast } from "@/components/ui/toast";
import { deleteAttachment, deleteCapture, ingestCapture, ingestFiles, originalOf, visibleAttachments } from "@/lib/blobs";
import { useNutonCapture, type IncomingShot } from "@/lib/capture";
import { SEVERITY_META, SEVERITY_TO_PRIORITY } from "@/lib/constants";
import { pickCategory, pickModule, structureReport } from "@/lib/extract";
import { useDefinitions, useDrafts, useMe, useModules } from "@/lib/hooks";
import { createBugs, deleteDraft, pruneOldDrafts, saveDraft } from "@/lib/store";
import { CATEGORIES, PRIORITIES, SEVERITIES, type Attachment, type Category, type Draft, type QuickForm } from "@/lib/types";
import { cn, plural, timeAgo } from "@/lib/utils";

const EMPTY: QuickForm = { title: "", description: "", severity: "", moduleId: "", priority: "", category: "", environment: "", steps: [], expected: "", actual: "" };

interface Pending {
  key: string;
  name: string;
  status: "uploading" | "failed";
  shot: IncomingShot;
}

export function QuickReport() {
  const router = useRouter();
  const params = useSearchParams();
  const { toast } = useToast();
  const me = useMe();
  const modules = useModules();
  const drafts = useDrafts();
  const defs = useDefinitions();

  const draftParam = params.get("draft");
  const [draftId] = useState(() => draftParam ?? crypto.randomUUID());
  const [createdAt] = useState(() => new Date().toISOString());
  const [form, setForm] = useState<QuickForm>(EMPTY);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [pending, setPending] = useState<Pending[]>([]);
  const [saved, setSaved] = useState<{ at: string; state: "idle" | "saving" | "saved" }>({ at: "", state: "idle" });
  const [submitting, setSubmitting] = useState(false);
  const [showMore, setShowMore] = useState(false);
  const [touched, setTouched] = useState(false);
  const fileIn = useRef<HTMLInputElement>(null);
  const loaded = useRef(false);

  const shown = useMemo(() => visibleAttachments(attachments), [attachments]);
  const patch = (p: Partial<QuickForm>) => {
    setForm((f) => ({ ...f, ...p }));
    setTouched(true);
  };

  /* ---- resume an existing draft ---- */
  useEffect(() => {
    if (loaded.current || !draftParam) return;
    const d = drafts.find((x) => x.id === draftParam && x.kind === "form");
    if (!d?.form) return;
    loaded.current = true;
    setForm({ ...EMPTY, ...d.form });
    setAttachments(d.attachments ?? []);
    setSaved({ at: d.updatedAt, state: "saved" });
  }, [draftParam, drafts]);

  useEffect(() => {
    void pruneOldDrafts();
  }, []);

  /* ---- capture handoff ---- */
  const acceptShot = useCallback(
    async (shot: IncomingShot) => {
      const key = shot.id;
      setPending((p) => [...p.filter((x) => x.key !== key), { key, name: shot.meta.title || shot.meta.path, status: "uploading", shot }]);
      try {
        const made = await ingestCapture(shot, me?.id ?? "");
        setAttachments((a) => [...a, ...made]);
        setPending((p) => p.filter((x) => x.key !== key));
        setTouched(true);
        setForm((f) => (f.environment ? f : { ...f, environment: [shot.meta.browser, shot.meta.os, shot.meta.viewport].filter(Boolean).join(" · ") }));
        toast(shot.annotated ? "Annotated screenshot added to your bug." : "Screenshot added to your bug.");
        try {
          window.focus();
        } catch {}
        setTimeout(() => document.getElementById("evidence")?.scrollIntoView({ behavior: "smooth", block: "center" }), 120);
      } catch (e) {
        setPending((p) => p.map((x) => (x.key === key ? { ...x, status: "failed" } : x)));
        toast(`Couldn't save the screenshot: ${(e as Error).message}. It's kept here so you can retry.`, { tone: "error" });
        throw e;
      }
    },
    [me?.id, toast],
  );
  const retry = (key: string) => {
    const p = pending.find((x) => x.key === key);
    if (p) void acceptShot(p.shot).catch(() => {});
  };
  const capture = useNutonCapture({ onShot: acceptShot, onProblem: (m) => toast(m, { tone: "error" }), count: shown.length });

  /* ---- uploads ---- */
  const addFiles = useCallback(
    async (files: File[]) => {
      if (!files.length || !me) return;
      const { attachments: made, rejected } = await ingestFiles(files, me.id);
      if (made.length) {
        setAttachments((a) => [...a, ...made]);
        setTouched(true);
      }
      if (rejected.length) toast(`Skipped: ${rejected.join(", ")}`, { tone: "error" });
    },
    [me, toast],
  );
  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      const files = Array.from(e.clipboardData?.files ?? []).filter((f) => f.type.startsWith("image/") || f.type.startsWith("video/"));
      if (!files.length) return;
      e.preventDefault();
      void addFiles(files);
    };
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  }, [addFiles]);

  const removeShot = async (a: Attachment) => {
    setAttachments((list) => list.filter((x) => x.id !== a.id && x.id !== originalOf(a, list)?.id));
    setTouched(true);
    if (a.variant === "upload") await deleteAttachment(a);
    else await deleteCapture(a, attachments);
    toast("Screenshot removed.");
  };

  /* ---- autosave: the draft exists from the first thing you add, so nothing is lost ---- */
  const hasContent = !!(form.title || form.description || attachments.length);
  const latest = useRef({ form, attachments });
  latest.current = { form, attachments };
  const persist = useCallback(async () => {
    if (!me) return false;
    const { form: f, attachments: a } = latest.current;
    setSaved((s) => ({ ...s, state: "saving" }));
    const draft: Draft = { id: draftId, kind: "form", form: f, original: "", attachments: a, moduleHint: "", bugs: [], reporterId: me.id, createdAt, updatedAt: new Date().toISOString() };
    const res = await saveDraft(draft, { quiet: true });
    setSaved({ at: new Date().toISOString(), state: res.ok ? "saved" : "idle" });
    if (res.ok && !draftParam) window.history.replaceState(null, "", `/report?draft=${draftId}`);
    return res.ok;
  }, [me, draftId, createdAt, draftParam]);
  useEffect(() => {
    if (!touched || !hasContent) return;
    const t = setTimeout(() => void persist(), 800);
    return () => clearTimeout(t);
  }, [form, attachments, touched, hasContent, persist]);

  // The window opens immediately (pop-up blockers need that) and goes to Nuton once the draft is saved.
  const startCapture = () => {
    capture.open(persist);
  };

  /* ---- helpers ---- */
  const suggest = () => {
    const found = structureReport({ text: form.description, moduleHint: "", modules, attachmentIds: [] })[0];
    if (!found) return;
    patch({
      title: form.title || found.title,
      severity: form.severity || found.severity,
      moduleId: form.moduleId || found.moduleId,
      category: form.category || found.category,
      steps: form.steps.length ? form.steps : found.steps,
      expected: form.expected || found.expected,
      actual: form.actual || found.actual,
    });
    toast("Filled what the description allows. Check it before submitting.");
  };

  const missing = [!form.title.trim() && "title", !form.description.trim() && "description", !form.severity && "severity"].filter(Boolean) as string[];

  const submit = async () => {
    setTouched(true);
    if (missing.length || submitting || !form.severity) return;
    setSubmitting(true);
    const text = `${form.title} ${form.description} ${shown.map((a) => `${a.meta?.title ?? ""} ${a.meta?.path ?? ""}`).join(" ")}`;
    const category: Category = form.category || (pickCategory(text) as Category) || "Functional";
    const moduleId = form.moduleId || pickModule(text, modules);
    const created = await createBugs([
      {
        title: form.title.trim(),
        description: form.description.trim(),
        steps: form.steps.map((s) => s.trim()).filter(Boolean),
        expected: form.expected.trim(),
        actual: form.actual.trim(),
        severity: form.severity,
        priority: form.priority || SEVERITY_TO_PRIORITY[form.severity],
        category,
        moduleId,
        environment: form.environment.trim(),
        attachments,
        originalReport: form.description.trim(),
      },
    ]);
    setSubmitting(false);
    if (!created) return;
    capture.cancel();
    await deleteDraft(draftId);
    toast(`${created[0]} added to the bug sheet.`, { action: { label: "View bug", href: `/bugs/${created[0]}` } });
    router.push("/bugs");
  };

  const cancel = async () => {
    if (hasContent) {
      await persist();
      toast("Draft saved. Pick it up from Report a Bug.");
    }
    capture.cancel();
    router.push("/bugs");
  };

  const otherDrafts = drafts.filter((d) => d.id !== draftId);
  const busy = capture.state === "opening" || capture.state === "connected";
  const savedLabel = saved.state === "saving" ? "Saving…" : saved.state === "saved" ? `Draft saved ${timeAgo(saved.at)}` : hasContent ? "Not saved yet" : "Nothing to save yet";

  return (
    <div className="flex min-h-full flex-col">
      <PageBody className="max-w-[780px] flex-1">
        <PageHeader title="Report a Bug" description="Capture the problem on Nuton first, then describe it. Your draft stays here the whole time." />

        {/* ---------------- evidence ---------------- */}
        <section id="evidence" className="mt-8 scroll-mt-6">
          <div className="mb-2.5 flex items-baseline justify-between">
            <h2 className="text-sm font-semibold text-ink">Evidence</h2>
            <span className="text-xs text-muted">{shown.length ? `${shown.length} attached` : "Optional, but it helps"}</span>
          </div>

          {capture.state === "blocked" ? (
            <div className="mb-3 flex flex-wrap items-center gap-3 rounded-lg bg-wash px-4 py-3 text-[13px] text-ink-2" role="alert">
              <span className="min-w-0 flex-1">Your browser blocked the pop-up window. Open Nuton in a new tab instead. You can also allow pop-ups for this site.</span>
              <a
                href={capture.fallbackHref}
                target="_blank"
                rel="opener"
                onClick={() => { void persist(); capture.linkOpened(); }}
                className="inline-flex h-8 items-center gap-1.5 rounded-md bg-olive-600 px-3 text-[13px] font-medium text-white hover:bg-olive-700"
              >
                <Camera className="size-4" /> Open Nuton in a new tab
              </a>
              <Button size="sm" variant="ghost" onClick={capture.cancel}>Dismiss</Button>
            </div>
          ) : null}

          {busy && capture.state !== "blocked" ? (
            <div className="mb-3 flex flex-wrap items-center gap-3 rounded-lg bg-olive-50 px-4 py-3 text-[13px] text-olive-800" role="status">
              {capture.state === "opening" ? <Loader2 className="size-4 animate-spin" /> : <Camera className="size-4" />}
              <span className="min-w-0 flex-1">
                {capture.state === "opening" ? "Opening Nuton…" : `Capture window is open${shown.length ? ` · ${plural(shown.length, "screenshot")} added` : ""}. Add to bug there and you'll land back here.`}
              </span>
              <Button size="sm" onClick={capture.focus}>Show window</Button>
              <Button size="sm" variant="ghost" onClick={capture.cancel}>Close it</Button>
            </div>
          ) : null}

          {!shown.length && !pending.length ? (
            <div className="grid gap-3 sm:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
              <button onClick={startCapture} disabled={busy} className="flex min-h-[132px] flex-col gap-3 rounded-xl bg-olive-600 p-[18px] text-left text-white transition-colors hover:bg-olive-700 disabled:opacity-70">
                <span className="flex size-[34px] items-center justify-center rounded-[9px] bg-white/15"><Camera className="size-[18px]" /></span>
                <span>
                  <strong className="block text-[15px] font-semibold">Capture from Nuton</strong>
                  <span className="mt-0.5 block text-[12.5px] leading-snug text-white/80">Opens nuton.app in a capture window. Draw on the problem, add it to this bug, and you&apos;re back here.</span>
                </span>
                <span className="mt-auto text-[11px] uppercase tracking-wide text-white/70">Recommended</span>
              </button>
              <button onClick={() => fileIn.current?.click()} className="flex min-h-[132px] flex-col gap-3 rounded-xl border border-line-strong bg-white p-[18px] text-left transition-colors hover:bg-wash">
                <span className="flex size-[34px] items-center justify-center rounded-[9px] bg-wash-2 text-ink-2"><Upload className="size-[18px]" /></span>
                <span>
                  <strong className="block text-[15px] font-semibold text-ink">Upload screenshot</strong>
                  <span className="mt-0.5 block text-[12.5px] leading-snug text-muted">Choose, drop or paste an image or screen recording.</span>
                </span>
              </button>
            </div>
          ) : (
            <div className="flex flex-wrap gap-2">
              <Button variant="primary" onClick={startCapture} disabled={busy}><Camera className="size-4" /> Capture another</Button>
              <Button onClick={() => fileIn.current?.click()}><Upload className="size-4" /> Upload</Button>
            </div>
          )}
          <input ref={fileIn} type="file" accept="image/*,video/*" multiple hidden onChange={(e) => { void addFiles(Array.from(e.target.files ?? [])); e.target.value = ""; }} />

          {pending.length ? (
            <ul className="mt-3 space-y-2">
              {pending.map((p) => (
                <li key={p.key} className="flex items-center gap-3 rounded-lg border border-line px-3 py-2.5 text-[13px]">
                  {p.status === "uploading" ? <Loader2 className="size-4 animate-spin text-muted" /> : <RefreshCw className="size-4 text-st-reopened" />}
                  <span className="min-w-0 flex-1 truncate">{p.name}</span>
                  {p.status === "failed" ? (
                    <>
                      <span className="text-xs text-st-reopened">Upload failed, kept here</span>
                      <Button size="sm" onClick={() => retry(p.key)}>Retry</Button>
                      <Button size="sm" variant="ghost" onClick={() => setPending((x) => x.filter((y) => y.key !== p.key))}>Discard</Button>
                    </>
                  ) : (
                    <span className="text-xs text-muted">Saving…</span>
                  )}
                </li>
              ))}
            </ul>
          ) : null}

          {shown.length ? (
            <div className="mt-3">
              <AttachmentGrid items={attachments} onRemove={(a) => void removeShot(a)} columns="grid-cols-1 min-[480px]:grid-cols-2 sm:grid-cols-3" />
            </div>
          ) : null}
        </section>

        {/* ---------------- fields ---------------- */}
        <div className="mt-8 space-y-5">
          <div>
            <Label htmlFor="q-title">Bug title <span className="text-st-reopened">*</span></Label>
            <Input id="q-title" value={form.title} onChange={(e) => patch({ title: e.target.value })} placeholder="Short, specific summary of the problem" autoComplete="off" />
          </div>
          <div>
            <Label htmlFor="q-desc">Description <span className="text-st-reopened">*</span></Label>
            <Textarea id="q-desc" autoGrow rows={4} value={form.description} onChange={(e) => patch({ description: e.target.value })} placeholder="What did you expect, and what happened instead?" className="min-h-[120px]" />
            <div className="mt-1.5 flex flex-wrap items-center justify-between gap-2">
              <Hint className="mt-0">Describe it after you capture. The screenshot and page details are attached automatically.</Hint>
              {form.description.trim().length >= 20 ? (
                <button onClick={suggest} className="inline-flex items-center gap-1.5 text-xs font-medium text-olive-700 hover:text-olive-800"><Sparkles className="size-3.5" /> Fill fields from my description</button>
              ) : null}
            </div>
          </div>
          <div className="grid gap-5 sm:grid-cols-2">
            <div>
              <div className="mb-1.5 text-[13px] font-medium text-ink-2" id="q-sev">Severity <span className="text-st-reopened">*</span></div>
              <div role="radiogroup" aria-labelledby="q-sev" className="flex flex-wrap gap-1.5">
                {SEVERITIES.map((s) => (
                  <button key={s} type="button" role="radio" aria-checked={form.severity === s} onClick={() => patch({ severity: s })} className={cn("inline-flex h-8 items-center gap-1.5 rounded-md border px-2.5 text-[13px] transition-colors", form.severity === s ? "border-olive-500 bg-olive-50 font-medium text-olive-800" : "border-line-strong bg-white text-ink-2 hover:bg-wash")}>
                    <span className={cn("size-1.5 rounded-full", SEVERITY_META[s].dot)} />
                    {s}
                  </button>
                ))}
              </div>
              <Hint>{form.severity ? defs.severity[form.severity] : "Pick how badly it affects people."}</Hint>
            </div>
            <div>
              <Label htmlFor="q-mod">Module <span className="font-normal text-faint">(optional)</span></Label>
              <Select id="q-mod" value={form.moduleId} onChange={(e) => patch({ moduleId: e.target.value })}>
                <option value="">Detect from the page</option>
                {modules.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
              </Select>
            </div>
          </div>

          <div>
            <button onClick={() => setShowMore((v) => !v)} aria-expanded={showMore} className="inline-flex items-center gap-1.5 text-[13px] text-muted hover:text-ink">
              <ChevronDown className={cn("size-4 transition-transform", showMore && "rotate-180")} /> More details
            </button>
            {showMore ? (
              <div className="mt-3 grid gap-4 sm:grid-cols-2">
                <div>
                  <Label htmlFor="q-pri">Priority</Label>
                  <Select id="q-pri" value={form.priority} onChange={(e) => patch({ priority: e.target.value as QuickForm["priority"] })}>
                    <option value="">{form.severity ? `Automatic (${SEVERITY_TO_PRIORITY[form.severity]})` : "Automatic"}</option>
                    {PRIORITIES.map((p) => <option key={p}>{p}</option>)}
                  </Select>
                </div>
                <div>
                  <Label htmlFor="q-cat">Category</Label>
                  <Select id="q-cat" value={form.category} onChange={(e) => patch({ category: e.target.value as Category })}>
                    <option value="">Automatic</option>
                    {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
                  </Select>
                </div>
                <div className="sm:col-span-2">
                  <Label htmlFor="q-env">Environment</Label>
                  <Input id="q-env" value={form.environment} onChange={(e) => patch({ environment: e.target.value })} placeholder="Filled in from your capture" />
                </div>
              </div>
            ) : null}
          </div>
        </div>

        <p className="mt-10 text-[13px] text-muted">
          Reporting several issues at once? <Link href="/report/notes" className="font-medium text-olive-700 hover:underline">Write them as notes</Link>.
        </p>

        {otherDrafts.length ? (
          <section id="drafts" className="mt-10 scroll-mt-6">
            <h2 className="text-sm font-semibold text-ink">Other drafts</h2>
            <ul className="mt-3 divide-y divide-line rounded-lg border border-line">
              {otherDrafts.map((d) => (
                <li key={d.id} className="flex items-center gap-3 px-4 py-3">
                  <FileText className="size-4 shrink-0 text-muted" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13.5px] font-medium text-ink">{(d.kind === "form" ? d.form?.title : d.bugs[0]?.title) || (d.kind === "form" ? "Untitled draft" : d.original.slice(0, 80)) || "Untitled draft"}</p>
                    <p className="text-xs text-muted">{d.kind === "form" ? `${plural(visibleAttachments(d.attachments ?? []).length, "screenshot")}` : plural(d.bugs.length, "bug")} · saved {timeAgo(d.updatedAt)}</p>
                  </div>
                  <Link href={d.kind === "form" ? `/report?draft=${d.id}` : `/report/notes?draft=${d.id}`} className="rounded-md px-2.5 py-1 text-[13px] font-medium text-olive-700 hover:bg-olive-50">Continue</Link>
                  <button onClick={async () => { if ((await deleteDraft(d.id)).ok) toast("Draft deleted.", { tone: "info" }); }} className="rounded-md p-1.5 text-faint hover:bg-wash hover:text-st-reopened" aria-label="Delete draft"><Trash2 className="size-4" /></button>
                </li>
              ))}
            </ul>
          </section>
        ) : null}
      </PageBody>

      <div className="sticky bottom-0 z-20 border-t border-line bg-white">
        <div className="mx-auto flex w-full max-w-[780px] flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6 lg:px-10">
          <p className="text-xs text-muted">{savedLabel}</p>
          <div className="flex flex-wrap items-center gap-2">
            {touched && missing.length ? <span className="text-xs text-muted">Still needed: {missing.join(", ")}</span> : null}
            <Button onClick={() => void cancel()}>Cancel</Button>
            <Button variant="primary" onClick={() => void submit()} disabled={submitting || missing.length > 0 || pending.some((p) => p.status === "uploading")}>
              {submitting ? <Loader2 className="size-4 animate-spin" /> : null} Submit bug
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
