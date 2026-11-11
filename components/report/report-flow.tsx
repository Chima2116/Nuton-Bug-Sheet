"use client";
import { ArrowLeft, ArrowRight, Check, CircleCheck, FileText, Info, Loader2, Plus, Trash2 } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AttachmentGrid } from "@/components/bugs/attachments";
import { BugFields, type Errors, type FieldKey, type FieldValues } from "@/components/bugs/bug-fields";
import { PageBody, PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/controls";
import { Label, Select, Textarea } from "@/components/ui/field";
import { Modal } from "@/components/ui/overlay";
import { useToast } from "@/components/ui/toast";
import { deleteAttachment } from "@/lib/blobs";
import { blankDraftBug, EXAMPLE_REPORT, structureReport } from "@/lib/extract";
import { useBugs, useDrafts, useMe, useModules, useUsers } from "@/lib/hooks";
import { createBugs, deleteDraft, saveDraft } from "@/lib/store";
import type { Attachment, Draft, DraftBug } from "@/lib/types";
import { bugIdFromSeq, cn, formatDate, plural, timeAgo, uid } from "@/lib/utils";
import { Dropzone } from "./dropzone";

type Stage = "compose" | "processing" | "review";

const REQUIRED: { key: FieldKey; label: string }[] = [
  { key: "title", label: "Add a title" },
  { key: "description", label: "Add a description" },
  { key: "severity", label: "Choose a severity" },
  { key: "priority", label: "Choose a priority" },
  { key: "category", label: "Choose a category" },
  { key: "moduleId", label: "Choose the affected module" },
];

function validate(b: DraftBug): Errors {
  const e: Errors = {};
  REQUIRED.forEach(({ key, label }) => {
    const v = b[key as keyof DraftBug];
    if (!String(v ?? "").trim()) e[key] = label;
  });
  return e;
}

export function ReportFlow() {
  const router = useRouter();
  const params = useSearchParams();
  const { toast } = useToast();
  const me = useMe();
  const modules = useModules();
  const drafts = useDrafts();
  const team = useUsers();
  const allBugs = useBugs();
  const nextSeq = useMemo(() => allBugs.reduce((m, b) => Math.max(m, b.seq), 0) + 1, [allBugs]);
  const [submitting, setSubmitting] = useState(false);

  const [stage, setStage] = useState<Stage>("compose");
  const [text, setText] = useState("");
  const [moduleHint, setModuleHint] = useState("");
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [bugs, setBugs] = useState<DraftBug[]>([]);
  const [activeKey, setActiveKey] = useState("");
  const [draftId, setDraftId] = useState(() => crypto.randomUUID());
  const [createdAt, setCreatedAt] = useState(() => new Date().toISOString());
  const [dirty, setDirty] = useState(false);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, Errors>>({});
  const [confirmBack, setConfirmBack] = useState(false);
  const [progress, setProgress] = useState(0);
  const topRef = useRef<HTMLDivElement>(null);

  // Open an existing draft
  const draftParam = params.get("draft");
  useEffect(() => {
    if (!draftParam) return;
    const d = drafts.find((x) => x.id === draftParam);
    if (d && d.id !== draftId) {
      setDraftId(d.id);
      setCreatedAt(d.createdAt);
      setText(d.original);
      setModuleHint(d.moduleHint);
      setAttachments(d.attachments);
      setBugs(d.bugs);
      setActiveKey(d.bugs[0]?.key ?? "");
      setStage("review");
      setDirty(false);
      setSavedAt(d.updatedAt);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draftParam]);

  useEffect(() => {
    if (stage !== "review" || !dirty) return;
    const h = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", h);
    return () => window.removeEventListener("beforeunload", h);
  }, [stage, dirty]);

  const addAttachments = useCallback(
    (a: Attachment[]) => {
      setAttachments((cur) => [...cur, ...a]);
      setBugs((cur) => cur.map((b) => ({ ...b, attachmentIds: [...b.attachmentIds, ...a.map((x) => x.id)] })));
      if (stage === "review") setDirty(true);
    },
    [stage],
  );
  const removeAttachment = (a: Attachment) => {
    setAttachments((cur) => cur.filter((x) => x.id !== a.id));
    setBugs((cur) => cur.map((b) => ({ ...b, attachmentIds: b.attachmentIds.filter((id) => id !== a.id) })));
    void deleteAttachment(a);
    if (stage === "review") setDirty(true);
  };

  const structure = async () => {
    setStage("processing");
    setProgress(0);
    const steps = [350, 450, 450];
    for (let i = 0; i < steps.length; i++) {
      await new Promise((r) => setTimeout(r, steps[i]));
      setProgress(i + 1);
    }
    await new Promise((r) => setTimeout(r, 200));
    let result = structureReport({ text, moduleHint, modules, attachmentIds: attachments.map((a) => a.id) });
    if (!result.length) result = [blankDraftBug(attachments.map((a) => a.id), text)];
    setBugs(result);
    setActiveKey(result[0].key);
    setErrors({});
    setDirty(false);
    setSavedAt(null);
    setStage("review");
    topRef.current?.scrollIntoView({ block: "start" });
  };

  const active = bugs.find((b) => b.key === activeKey) ?? bugs[0];
  const activeIndex = Math.max(0, bugs.findIndex((b) => b.key === active?.key));

  const patchBug = (key: string, p: Partial<FieldValues>) => {
    setBugs((cur) =>
      cur.map((b) => {
        if (b.key !== key) return b;
        const flags = { ...b.flags };
        (Object.keys(p) as FieldKey[]).forEach((k) => delete flags[k]);
        return { ...b, ...p, flags } as DraftBug;
      }),
    );
    setErrors((e) => {
      if (!e[key]) return e;
      const next = { ...e[key] };
      (Object.keys(p) as FieldKey[]).forEach((k) => delete next[k]);
      return { ...e, [key]: next };
    });
    setDirty(true);
  };

  const buildDraft = (): Draft => ({ id: draftId, original: text, attachments, moduleHint, bugs, reporterId: me?.id ?? "", createdAt, updatedAt: new Date().toISOString() });

  const onSaveDraft = async () => {
    const res = await saveDraft(buildDraft());
    if (!res.ok) return;
    setDirty(false);
    setSavedAt(new Date().toISOString());
    toast("Draft saved", { action: { label: "All drafts", href: "/report#drafts" } });
  };

  const onConfirm = async () => {
    if (submitting) return;
    const all: Record<string, Errors> = {};
    bugs.forEach((b) => {
      const e = validate(b);
      if (Object.keys(e).length) all[b.key] = e;
    });
    setErrors(all);
    const firstBad = bugs.find((b) => all[b.key]);
    if (firstBad) {
      setActiveKey(firstBad.key);
      const n = Object.keys(all[firstBad.key]).length;
      toast(`${bugs.length > 1 ? `Bug ${bugs.indexOf(firstBad) + 1}: ` : ""}${plural(n, "field")} still need${n === 1 ? "s" : ""} your attention`, { tone: "error" });
      requestAnimationFrame(() => document.querySelector<HTMLElement>('[role="alert"]')?.scrollIntoView({ block: "center", behavior: "smooth" }));
      return;
    }
    setSubmitting(true);
    const created = await createBugs(
      bugs.map((b) => ({
        title: b.title.trim(),
        description: b.description.trim(),
        steps: b.steps.map((s) => s.trim()).filter(Boolean),
        expected: b.expected.trim(),
        actual: b.actual.trim(),
        severity: b.severity as Exclude<DraftBug["severity"], "">,
        priority: b.priority as Exclude<DraftBug["priority"], "">,
        category: b.category as Exclude<DraftBug["category"], "">,
        moduleId: b.moduleId,
        environment: b.environment.trim(),
        attachments: attachments.filter((a) => b.attachmentIds.includes(a.id)),
        originalReport: text.trim(),
        assigneeId: b.assigneeId || undefined,
      })),
    );
    setSubmitting(false);
    if (!created) return;
    await deleteDraft(draftId);
    setDirty(false);
    toast(created.length === 1 ? `${created[0]} added to the bug sheet` : `${created.length} bugs added to the bug sheet`, { action: created.length === 1 ? { label: "View bug", href: `/bugs/${created[0]}` } : undefined });
    router.push("/bugs");
  };

  const hasContent = text.trim().length >= 10;

  /* ------------------------------ compose ------------------------------ */
  if (stage !== "review") {
    return (
      <PageBody className="max-w-[860px]">
        <div ref={topRef} />
        <PageHeader title="Report a Bug" description="Write it the way you'd note it down. We'll structure it into a bug sheet entry that you can review and edit." />

        {stage === "processing" ? (
          <div className="mt-8 rounded-xl border border-line bg-white px-8 py-14 text-center">
            <Loader2 className="mx-auto size-6 animate-spin text-olive-600" />
            <p className="mt-4 text-[15px] font-medium text-ink">Structuring your report…</p>
            <ul className="mx-auto mt-5 w-fit space-y-2 text-left text-[13px]">
              {["Reading your report", "Looking for separate issues", "Extracting fields from your text"].map((s, i) => (
                <li key={s} className={cn("flex items-center gap-2.5 transition-colors", progress > i ? "text-ink" : "text-faint")}>
                  {progress > i ? <CircleCheck className="size-4 text-olive-600" /> : <span className="size-4 rounded-full border border-line-strong" />}
                  {s}
                </li>
              ))}
            </ul>
          </div>
        ) : (
          <>
            <div className="mt-8 space-y-6">
              <div>
                <div className="mb-1.5 flex items-center justify-between">
                  <Label htmlFor="report-text" className="mb-0">Bug report</Label>
                  <button type="button" onClick={() => setText(EXAMPLE_REPORT)} className="text-[13px] font-medium text-olive-700 hover:underline">Use an example</button>
                </div>
                <div className="rounded-xl border border-line-strong bg-white transition-colors focus-within:border-olive-500 focus-within:ring-2 focus-within:ring-olive-500/20">
                  <Textarea
                    id="report-text"
                    autoFocus
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    placeholder={"Describe what you saw, what you were doing, and what you expected.\n\nIf you're reporting more than one problem, add “Bug 1:”, “Bug 2:” and so on, or separate them with a line of ---, and each becomes its own entry."}
                    className="min-h-[300px] resize-y border-0 px-5 py-4 text-[15px] leading-[1.7] shadow-none focus:ring-0 hover:border-0 focus:border-0"
                  />
                </div>
                <p className="mt-1.5 text-xs text-muted">Your original wording is always kept with the bug.</p>
              </div>

              <div className="grid gap-6 md:grid-cols-[1fr_260px]">
                <div>
                  <Label>Screenshots and recordings</Label>
                  <Dropzone userId={me?.id ?? ""} onAdd={addAttachments} />
                </div>
                <div>
                  <Label htmlFor="hint-module">Product area <span className="font-normal text-faint">(optional)</span></Label>
                  <Select id="hint-module" value={moduleHint} onChange={(e) => setModuleHint(e.target.value)}>
                    <option value="">Detect from the report</option>
                    {modules.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
                  </Select>
                  <p className="mt-1.5 text-xs text-muted">If you pick one, it overrides detection.</p>
                </div>
              </div>

              {attachments.length ? <AttachmentGrid items={attachments} onRemove={removeAttachment} columns="grid-cols-2 sm:grid-cols-3 md:grid-cols-4" /> : null}
            </div>

            <div className="mt-8 flex flex-wrap items-center justify-between gap-4 border-t border-line pt-5">
              <p className="flex max-w-md items-start gap-2 text-xs text-muted">
                <Info className="mt-px size-3.5 shrink-0" />
                Prototype: reports are structured by a local, rule-based extractor. No AI service is connected, and anything it can&apos;t find is left blank for you.
              </p>
              <Button variant="primary" size="lg" disabled={!hasContent} onClick={structure}>
                Structure Bug Report <ArrowRight className="size-4" />
              </Button>
            </div>

            {drafts.length ? (
              <section id="drafts" className="mt-14 scroll-mt-6">
                <h2 className="text-sm font-semibold text-ink">Drafts</h2>
                <ul className="mt-3 divide-y divide-line rounded-lg border border-line">
                  {drafts.map((d) => (
                    <li key={d.id} className="flex items-center gap-3 px-4 py-3">
                      <FileText className="size-4 shrink-0 text-muted" />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[13.5px] font-medium text-ink">{d.bugs[0]?.title || d.original.slice(0, 80) || "Untitled draft"}</p>
                        <p className="text-xs text-muted">{plural(d.bugs.length, "bug")} · saved {timeAgo(d.updatedAt)}</p>
                      </div>
                      <Link href={`/report?draft=${d.id}`} className="rounded-md px-2.5 py-1 text-[13px] font-medium text-olive-700 hover:bg-olive-50">Continue</Link>
                      <button onClick={async () => { if ((await deleteDraft(d.id)).ok) { d.attachments.forEach((a) => void deleteAttachment(a)); toast("Draft deleted", { tone: "info" }); } }} className="rounded-md p-1.5 text-faint hover:bg-wash hover:text-st-reopened" aria-label="Delete draft"><Trash2 className="size-4" /></button>
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}
          </>
        )}
      </PageBody>
    );
  }

  /* ------------------------------ review ------------------------------ */
  const previewId = bugIdFromSeq(nextSeq + activeIndex);
  const multiple = bugs.length > 1;
  const included = (a: Attachment) => active?.attachmentIds.includes(a.id);
  const needsReview = active ? Object.values(active.flags).filter((f) => f === "suggested" || f === "missing").length : 0;

  return (
    <div className="flex min-h-full flex-col">
      <div className="mx-auto w-full max-w-[1240px] flex-1 px-4 pb-10 pt-6 sm:px-6 sm:pt-8 lg:px-10" ref={topRef}>
        <button onClick={() => (dirty ? setConfirmBack(true) : setStage("compose"))} className="mb-4 inline-flex items-center gap-1.5 text-[13px] text-muted hover:text-ink">
          <ArrowLeft className="size-3.5" /> Edit original report
        </button>
        <PageHeader title="Review structured report" description="Check each field, edit anything that's off, then add it to the bug sheet." />

        <div className="mt-4 flex items-start gap-2.5 rounded-lg bg-wash px-4 py-3 text-[13px] text-ink-2">
          <Info className="mt-0.5 size-4 shrink-0 text-muted" />
          <p>
            Structured locally with a rule-based mock extractor, not an AI service. Fields marked <span className="font-medium text-sev-medium">Suggested</span> are best guesses, and <span className="font-medium">Needs review</span> means your text didn&apos;t cover it. Nothing has been made up.
          </p>
        </div>

        {multiple ? (
          <div className="mt-4 rounded-lg border border-olive-200 bg-olive-50 px-4 py-3 text-[13px] text-olive-800">
            Your report describes <b>{bugs.length} separate issues</b>. Each will be added as its own bug. Use the tabs below to review them one by one.
          </div>
        ) : null}

        <div className="mt-8 grid gap-8 lg:grid-cols-[minmax(0,320px)_minmax(0,1fr)]">
          {/* left rail */}
          <aside className="space-y-6 lg:sticky lg:top-6 lg:self-start">
            <section>
              <h2 className="mb-2 text-[13px] font-semibold text-ink">Original report</h2>
              <div className="max-h-[300px] overflow-y-auto whitespace-pre-wrap rounded-lg bg-wash px-4 py-3 text-[13px] leading-relaxed text-ink-2">{text.trim()}</div>
              <p className="mt-1.5 text-xs text-muted">Kept unchanged and saved with every bug created from it.</p>
              {multiple && active ? (
                <div className="mt-3">
                  <p className="mb-1 text-xs font-medium text-muted">Passage for Bug {activeIndex + 1}</p>
                  <p className="line-clamp-6 rounded-lg border border-line px-3 py-2 text-xs leading-relaxed text-muted">{active.excerpt}</p>
                </div>
              ) : null}
            </section>

            <section>
              <h2 className="mb-2 text-[13px] font-semibold text-ink">Attachments</h2>
              {attachments.length ? (
                <AttachmentGrid
                  items={attachments}
                  columns="grid-cols-2"
                  onRemove={removeAttachment}
                  renderOverlay={
                    multiple && active
                      ? (a) => (
                          <label className="absolute left-1.5 top-1.5 flex cursor-pointer items-center gap-1.5 rounded-md bg-white/95 px-1.5 py-1 text-[11px] text-ink shadow-[0_0_0_1px_var(--color-line)]">
                            <Checkbox checked={!!included(a)} onChange={(v) => setBugs((cur) => cur.map((b) => (b.key === active.key ? { ...b, attachmentIds: v ? [...b.attachmentIds, a.id] : b.attachmentIds.filter((id) => id !== a.id) } : b)))} label={`Attach ${a.name} to this bug`} />
                            Bug {activeIndex + 1}
                          </label>
                        )
                      : undefined
                  }
                />
              ) : (
                <p className="mb-3 text-[13px] text-muted">No attachments yet.</p>
              )}
              <div className="mt-3"><Dropzone userId={me?.id ?? ""} onAdd={addAttachments} compact pasteTarget /></div>
            </section>
          </aside>

          {/* structured fields */}
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-1.5 border-b border-line pb-3" role="tablist" aria-label="Bugs in this report">
              {bugs.map((b, i) => (
                <button key={b.key} role="tab" aria-selected={b.key === active?.key} onClick={() => setActiveKey(b.key)} className={cn("inline-flex max-w-[240px] items-center gap-2 rounded-md px-2.5 py-1.5 text-[13px] transition-colors", b.key === active?.key ? "bg-wash-2 font-medium text-ink" : "text-muted hover:bg-wash hover:text-ink")}>
                  <span className="tnum whitespace-nowrap text-xs text-muted">{bugIdFromSeq(nextSeq + i)}</span>
                  <span className="truncate">{b.title || `Untitled bug ${i + 1}`}</span>
                  {errors[b.key] && Object.keys(errors[b.key]).length ? <span className="size-1.5 shrink-0 rounded-full bg-st-reopened" /> : null}
                </button>
              ))}
              <button onClick={() => { const nb = blankDraftBug(attachments.map((a) => a.id), ""); setBugs((c) => [...c, nb]); setActiveKey(nb.key); setDirty(true); }} className="inline-flex items-center gap-1 rounded-md px-2 py-1.5 text-[13px] text-olive-700 hover:bg-olive-50">
                <Plus className="size-3.5" /> Add another bug
              </button>
            </div>

            {active ? (
              <div className="pt-6" key={active.key}>
                <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5">
                    <span className="tnum rounded-md bg-wash px-2 py-1 text-[13px] font-medium text-ink">{previewId}</span>
                    <span className="text-xs text-muted">Assigned automatically</span>
                    {needsReview ? <span className="text-xs text-sev-medium">· {plural(needsReview, "field")} to check</span> : null}
                  </div>
                  {multiple ? (
                    <Button variant="ghost" size="sm" onClick={() => { const rest = bugs.filter((b) => b.key !== active.key); setBugs(rest); setActiveKey(rest[0].key); setDirty(true); }} className="text-muted hover:text-st-reopened">
                      <Trash2 className="size-3.5" /> Remove from this report
                    </Button>
                  ) : null}
                </div>

                <BugFields
                  idPrefix={active.key}
                  values={active}
                  flags={active.flags}
                  errors={errors[active.key]}
                  onChange={(p) => patchBug(active.key, p)}
                />

                <div className="mt-8 max-w-sm">
                  <Label htmlFor={`${active.key}-assignee`}>Assign to <span className="font-normal text-faint">(optional)</span></Label>
                  <Select id={`${active.key}-assignee`} value={active.assigneeId ?? ""} onChange={(e) => { const v = e.target.value; setBugs((cur) => cur.map((b) => (b.key === active.key ? { ...b, assigneeId: v || undefined } : b))); setDirty(true); }}>
                    <option value="">Unassigned</option>
                    {team.map((u) => <option key={u.id} value={u.id}>{u.name}{u.id === me?.id ? " (you)" : ""}</option>)}
                  </Select>
                </div>

                <dl className="mt-6 grid grid-cols-2 gap-4 rounded-lg bg-wash px-4 py-3 text-[13px] sm:grid-cols-3">
                  <div><dt className="text-xs text-muted">Reporter</dt><dd className="mt-0.5 text-ink">{me?.name}</dd></div>
                  <div><dt className="text-xs text-muted">Date reported</dt><dd className="mt-0.5 text-ink">{formatDate(new Date().toISOString())} <span className="text-muted">· set on confirm</span></dd></div>
                  <div className="col-span-2 sm:col-span-1"><dt className="text-xs text-muted">Attachments</dt><dd className="mt-0.5 text-ink">{plural(attachments.filter(included).length, "file")}</dd></div>
                </dl>
              </div>
            ) : null}
          </div>
        </div>
      </div>

      <div className="sticky bottom-0 z-20 border-t border-line bg-white">
        <div className="mx-auto flex w-full max-w-[1240px] flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6 lg:px-10">
          <p className="text-xs text-muted">{dirty ? "Unsaved changes" : savedAt ? `Draft saved ${timeAgo(savedAt)}` : "Not saved yet"}</p>
          <div className="flex items-center gap-2">
            <Button onClick={() => void onSaveDraft()} disabled={submitting}>Save as Draft</Button>
            <Button variant="primary" onClick={() => void onConfirm()} disabled={submitting}>
              <Check className="size-4" /> {multiple ? `Confirm and Add ${bugs.length} to Bug Sheet` : "Confirm and Add to Bug Sheet"}
            </Button>
          </div>
        </div>
      </div>

      <Modal
        open={confirmBack}
        onOpenChange={setConfirmBack}
        title="Go back to your original report?"
        description="Structuring again will replace the edits you've made to the fields. Save as a draft first if you want to keep them."
        footer={
          <>
            <Button onClick={() => setConfirmBack(false)}>Stay here</Button>
            <Button variant="primary" onClick={() => { setConfirmBack(false); setStage("compose"); }}>Go back</Button>
          </>
        }
      />
    </div>
  );
}
