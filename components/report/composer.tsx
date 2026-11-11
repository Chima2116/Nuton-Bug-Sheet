"use client";
import * as Dialog from "@radix-ui/react-dialog";
import { ChevronDown, FileText, Loader2, Paperclip, Sparkles, UserRound, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Kbd } from "@/components/ui/controls";
import { Input, Textarea } from "@/components/ui/field";
import { Menu, MenuContent, MenuItem, MenuLabel, MenuSeparator, MenuTrigger } from "@/components/ui/overlay";
import { useToast } from "@/components/ui/toast";
import { deleteAttachment, imageForAnalysis, ingestFiles, useAttachmentUrl } from "@/lib/blobs";
import { SEVERITY_META, SEVERITY_TO_PRIORITY } from "@/lib/constants";
import { useAssignable, useDefinitions, useDrafts, useMe, useModules } from "@/lib/hooks";
import { createBugs, deleteDraft, saveDraft } from "@/lib/store";
import { PRIORITIES, SEVERITIES, type Attachment, type Draft, type Priority, type Severity } from "@/lib/types";
import { understand, understandBasic, type Understanding, type UnderstoodBug } from "@/lib/understand";
import { cn, timeAgo, uid } from "@/lib/utils";

const MIN_CHARS_TO_ANALYSE = 24;
const ANALYSE_DELAY = 1100;

type Edits = Partial<UnderstoodBug>;

const MIN_WITH_IMAGE = 8;
const keyOf = (t: string, list: Attachment[]) => `${t}\u0001${list.filter((a) => a.kind === "image").slice(0, 3).map((a) => a.id).join(",")}`;
const canAnalyse = (t: string, list: Attachment[]) => t.length >= MIN_CHARS_TO_ANALYSE || (t.length >= MIN_WITH_IMAGE && list.some((a) => a.kind === "image"));

const stepsToText = (steps: string[]) => steps.join("\n");
const textToSteps = (t: string) => t.split("\n").map((l) => l.replace(/^\s*(?:\d+[.)]|[-*•])\s*/, "").trim()).filter(Boolean);

function Thumb({ att, onRemove }: { att: Attachment; onRemove: () => void }) {
  const url = useAttachmentUrl(att);
  return (
    <div className="group relative size-16 shrink-0 overflow-hidden rounded-xl bg-wash-2 shadow-[var(--shadow-card)]">
      {url ? att.kind === "image" ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={url} alt={att.name} className="size-full object-cover" />
      ) : (
        <video src={url} className="size-full object-cover" muted />
      ) : null}
      <button onClick={onRemove} aria-label={`Remove ${att.name}`} className="absolute right-1 top-1 flex size-5 items-center justify-center rounded-full bg-ink/70 text-white opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100">
        <X className="size-3" />
      </button>
    </div>
  );
}

/** A pill-shaped attribute picker, like the chips in the reference. */
function Chip({ label, value, tone, inferred, uncertain, icon, children, active }: { label: string; value?: string; tone?: string; inferred?: boolean; uncertain?: boolean; icon?: React.ReactNode; children: React.ReactNode; active?: boolean }) {
  return (
    <Menu>
      <MenuTrigger asChild>
        <button
          className={cn(
            "inline-flex h-8 items-center gap-1.5 whitespace-nowrap rounded-full px-3 text-[13px] transition-colors data-[state=open]:bg-wash-2",
            value || active ? "bg-white text-ink shadow-[var(--shadow-card)]" : "text-muted shadow-[inset_0_0_0_1px_var(--color-line-strong)] hover:bg-wash",
          )}
        >
          {tone ? <span className={cn("size-1.5 rounded-full", tone)} /> : icon}
          <span>{value || label}</span>
          {inferred && value ? <Sparkles className="size-3 text-olive-600" aria-label="Filled in from your note" /> : null}
          {uncertain && value ? <span className="size-1.5 rounded-full bg-sev-medium" title="Inferred from limited detail. Worth a look." /> : null}
          <ChevronDown className="size-3 text-faint" />
        </button>
      </MenuTrigger>
      <MenuContent align="start" className="w-[220px]">
        {children}
      </MenuContent>
    </Menu>
  );
}

export function Composer({ open, draftId, onOpenChange, onPickDraft }: { open: boolean; draftId?: string; onOpenChange: (o: boolean) => void; onPickDraft: (id: string) => void }) {
  const router = useRouter();
  const { toast } = useToast();
  const me = useMe();
  const modules = useModules();
  const people = useAssignable();
  const definitions = useDefinitions();
  const drafts = useDrafts();

  const [id, setId] = useState(() => uid("draft"));
  const [text, setText] = useState("");
  const [files, setFiles] = useState<Attachment[]>([]);
  const [assigneeId, setAssigneeId] = useState("");
  const [result, setResult] = useState<Understanding | null>(null);
  const [edits, setEdits] = useState<Edits[]>([]);
  const [active, setActive] = useState(0);
  const [analysing, setAnalysing] = useState(false);
  const [creating, setCreating] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [over, setOver] = useState(false);

  const textRef = useRef<HTMLTextAreaElement>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const analysed = useRef("");
  const abort = useRef<AbortController | null>(null);
  const latest = useRef({ text, files, assigneeId, id });
  latest.current = { text, files, assigneeId, id };
  const created = useRef(false);

  /* ---------- reset / resume whenever the modal opens ---------- */
  useEffect(() => {
    if (!open) return;
    created.current = false;
    const d = draftId ? drafts.find((x) => x.id === draftId) : undefined;
    setId(d?.id ?? uid("draft"));
    setText(d?.note ?? (d?.form ? [d.form.title, d.form.description].filter(Boolean).join("\n\n") : (d?.original ?? "")));
    setFiles(d?.attachments ?? []);
    setAssigneeId(d?.assigneeId ?? "");
    setResult(null);
    setEdits([]);
    setActive(0);
    analysed.current = "";
    requestAnimationFrame(() => textRef.current?.focus());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, draftId]);

  /* ---------- understanding ---------- */
  const analyse = useCallback(
    async (t: string, list: Attachment[]): Promise<Understanding | null> => {
      abort.current?.abort();
      const ctl = new AbortController();
      abort.current = ctl;
      setAnalysing(true);
      try {
        const images = (await Promise.all(list.filter((a) => a.kind === "image").slice(0, 3).map(imageForAnalysis))).filter((i): i is NonNullable<typeof i> => !!i);
        if (ctl.signal.aborted) return null;
        const r = await understand(t, { modules, definitions, images, signal: ctl.signal });
        if (ctl.signal.aborted) return null;
        analysed.current = keyOf(t, list);
        setResult(r);
        setEdits((prev) => (prev.length === r.bugs.length ? prev : r.bugs.map(() => ({}))));
        setActive((a) => Math.min(a, Math.max(0, r.bugs.length - 1)));
        return r;
      } catch {
        return null;
      } finally {
        if (abort.current === ctl) setAnalysing(false);
      }
    },
    [modules, definitions],
  );

  useEffect(() => {
    if (!open) return;
    const t = text.trim();
    if (!canAnalyse(t, files)) {
      abort.current?.abort();
      setAnalysing(false);
      if (result) setResult(null);
      analysed.current = "";
      return;
    }
    if (keyOf(t, files) === analysed.current) return;
    const timer = setTimeout(() => void analyse(t, files), ANALYSE_DELAY);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text, files, open, analyse]);

  useEffect(() => () => abort.current?.abort(), []);

  /* ---------- draft autosave ---------- */
  const persist = useCallback(
    (quiet = true) => {
      const s = latest.current;
      if (created.current || !me || (!s.text.trim() && !s.files.length)) return;
      const now = new Date().toISOString();
      const draft: Draft = { id: s.id, kind: "note", note: s.text, assigneeId: s.assigneeId || undefined, original: s.text, attachments: s.files, moduleHint: "", bugs: [], reporterId: me.id, createdAt: now, updatedAt: now };
      void saveDraft(draft, { quiet });
    },
    [me],
  );
  useEffect(() => {
    if (!open) return;
    const t = setTimeout(() => persist(), 900);
    return () => clearTimeout(t);
  }, [text, files, assigneeId, open, persist]);

  const close = (o: boolean) => {
    if (!o) persist();
    onOpenChange(o);
  };

  /* ---------- attachments ---------- */
  const addFiles = useCallback(
    async (list: File[]) => {
      if (!list.length || !me) return;
      setUploading(true);
      const { attachments, rejected } = await ingestFiles(list, me.id);
      setUploading(false);
      if (attachments.length) setFiles((f) => [...f, ...attachments]);
      if (rejected.length) toast(`Skipped: ${rejected.join(", ")}`, { tone: "error" });
    },
    [me, toast],
  );
  const removeFile = (a: Attachment) => {
    setFiles((f) => f.filter((x) => x.id !== a.id));
    void deleteAttachment(a);
  };

  /* ---------- the structured bugs the user will get ---------- */
  const bugs = result?.bugs ?? [];
  const edit = (i: number, patch: Edits) => setEdits((e) => bugs.map((_, k) => (k === i ? { ...(e[k] ?? {}), ...patch } : (e[k] ?? {}))));
  const cur: UnderstoodBug | null = bugs[active] ? { ...bugs[active], ...(edits[active] ?? {}) } : null;
  const touched = (k: keyof UnderstoodBug) => k in (edits[active] ?? {});
  const flagged = (k: string) => !touched(k as keyof UnderstoodBug) && !!cur?.uncertain.includes(k);

  const submit = async () => {
    const t = text.trim();
    if (!t || creating || !me) return;
    setCreating(true);
    let final: { bugs: UnderstoodBug[] } | null = result && analysed.current === keyOf(t, files) ? result : null;
    if (!final) final = await analyse(t, files);
    if (!final) final = { bugs: understandBasic(t, modules) };
    const byName = new Map(modules.map((m) => [m.name.toLowerCase(), m.id]));
    const inputs = final.bugs.map((b, i) => {
      const e = final === result ? (edits[i] ?? {}) : {};
      const v: UnderstoodBug = { ...b, ...e };
      const severity: Severity = v.severity || "Medium";
      const priority: Priority = v.priority || SEVERITY_TO_PRIORITY[severity];
      return {
        title: v.title.trim() || t.split(/\n/)[0].slice(0, 90),
        description: v.description.trim() || t,
        steps: v.steps,
        expected: v.expected,
        actual: v.actual,
        requiredFix: v.requiredFix,
        severity,
        priority,
        category: v.category || ("Functional" as const),
        moduleId: byName.get(v.module.toLowerCase()) ?? "",
        environment: v.environment,
        attachments: i === 0 ? files : [],
        originalReport: t,
        assigneeId: assigneeId || undefined,
      };
    });
    created.current = true;
    const ids = await createBugs(inputs);
    setCreating(false);
    if (!ids) {
      created.current = false;
      return;
    }
    void deleteDraft(id);
    onOpenChange(false);
    toast(ids.length === 1 ? `${ids[0]} created.` : `${ids.length} bugs created from your note.`, { action: { label: "View", href: ids.length === 1 ? `/bugs/${ids[0]}` : "/bugs" } });
    if (ids.length === 1) router.prefetch(`/bugs/${ids[0]}`);
  };

  const noteDrafts = useMemo(() => drafts.filter((d) => d.id !== id && (d.kind === "note" || d.kind === "form" || d.original)), [drafts, id]);
  const showPanel = canAnalyse(text.trim(), files);
  const sev = cur?.severity || "";
  const pri = cur?.priority || "";
  const modName = cur?.module || "";

  return (
    <Dialog.Root open={open} onOpenChange={close}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 animate-fade-in bg-ink/35 backdrop-blur-[2px]" />
        <Dialog.Content
          aria-describedby={undefined}
          onKeyDown={(e) => {
            if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
              e.preventDefault();
              void submit();
            }
          }}
          onDragOver={(e) => {
            e.preventDefault();
            setOver(true);
          }}
          onDragLeave={(e) => {
            if (e.currentTarget === e.target) setOver(false);
          }}
          onDrop={(e) => {
            e.preventDefault();
            setOver(false);
            void addFiles(Array.from(e.dataTransfer.files));
          }}
          className="fixed left-1/2 top-1/2 z-50 flex max-h-[92dvh] w-[calc(100vw-24px)] max-w-[740px] -translate-x-1/2 -translate-y-1/2 animate-pop-in flex-col rounded-[24px] bg-white shadow-[var(--shadow-modal)] focus:outline-none"
        >
          <div className="flex items-center justify-between gap-3 px-6 pt-5">
            <div className="flex items-center gap-2">
              <span className="inline-flex h-7 items-center gap-1.5 rounded-full bg-olive-50 px-3 text-xs font-medium text-olive-800">
                <span className="size-1.5 rounded-full bg-olive-600" /> New bug
              </span>
              {noteDrafts.length ? (
                <Menu>
                  <MenuTrigger asChild>
                    <button className="inline-flex h-7 items-center gap-1.5 rounded-full px-2.5 text-xs text-muted hover:bg-wash-2/70 hover:text-ink">
                      <FileText className="size-3.5" /> Drafts <span className="tnum">{noteDrafts.length}</span>
                    </button>
                  </MenuTrigger>
                  <MenuContent align="start" className="w-[320px]">
                    <MenuLabel>Resume a draft</MenuLabel>
                    {noteDrafts.slice(0, 8).map((d) => (
                      <MenuItem key={d.id} onSelect={() => { persist(); onPickDraft(d.id); }}>
                        <span className="flex flex-col">
                          <span className="truncate">{(d.note ?? d.form?.title ?? d.original ?? "").trim().split("\n")[0] || "Untitled draft"}</span>
                          <span className="text-xs text-muted">{timeAgo(d.updatedAt)}</span>
                        </span>
                      </MenuItem>
                    ))}
                  </MenuContent>
                </Menu>
              ) : null}
            </div>
            <Dialog.Close className="rounded-full p-2 text-muted hover:bg-wash-2/70 hover:text-ink" aria-label="Close">
              <X className="size-4" />
            </Dialog.Close>
          </div>
          <Dialog.Title className="sr-only">New bug</Dialog.Title>

          <div className="relative min-h-0 flex-1 overflow-y-auto px-6 pb-2 pt-3">
            {over ? (
              <div className="pointer-events-none absolute inset-2 z-10 flex items-center justify-center rounded-2xl border-2 border-dashed border-olive-500 bg-olive-50/90 text-sm font-medium text-olive-800">Drop screenshots or recordings to attach</div>
            ) : null}
            <textarea
              ref={textRef}
              value={text}
              onChange={(e) => setText(e.target.value)}
              onPaste={(e) => {
                const list = Array.from(e.clipboardData.files).filter((f) => f.type.startsWith("image/") || f.type.startsWith("video/"));
                if (list.length) {
                  e.preventDefault();
                  void addFiles(list);
                }
              }}
              placeholder="What went wrong? Write it the way you'd tell a teammate. What you did, what you expected, what happened instead. Paste screenshots straight in."
              aria-label="Describe the bug"
              rows={6}
              className="block min-h-[168px] w-full resize-none bg-transparent text-[17px] leading-[1.6] tracking-[-0.005em] text-ink placeholder:text-faint focus:outline-none"
            />

            {files.length || uploading ? (
              <div className="mt-2 flex flex-wrap items-center gap-2">
                {files.map((a) => (
                  <Thumb key={a.id} att={a} onRemove={() => removeFile(a)} />
                ))}
                {uploading ? (
                  <div className="flex size-16 items-center justify-center rounded-xl bg-wash-2/70 text-muted">
                    <Loader2 className="size-4 animate-spin" />
                  </div>
                ) : null}
              </div>
            ) : null}

            {showPanel ? (
              <section aria-label="How this will be filed" className="mt-5 rounded-2xl bg-wash p-4 sm:p-5">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="flex size-6 items-center justify-center rounded-full bg-olive-600 text-white">
                    {analysing ? <Loader2 className="size-3.5 animate-spin" /> : <Sparkles className="size-3.5" />}
                  </span>
                  <p className="text-[13px] font-medium text-ink">{analysing && !cur ? "Reading your note…" : "How this will be filed"}</p>
                  {result ? (
                    <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-medium", result.source === "ai" ? "bg-olive-100 text-olive-800" : "bg-wash-2 text-muted")} title={result.source === "ai" ? `Structured by ${result.provider === "gemini" ? "Gemini" : "Claude"}` : "Structured with built-in rules. No AI key is connected yet."}>
                      {result.source === "ai" ? (result.provider === "gemini" ? "Gemini" : "Claude") : "Basic"}
                    </span>
                  ) : null}
                  {analysing && cur ? <span className="text-xs text-muted">Updating…</span> : null}
                </div>

                {bugs.length > 1 ? (
                  <div className="mt-3 flex flex-wrap gap-1.5" role="tablist" aria-label="Bugs found in your note">
                    {bugs.map((b, i) => (
                      <button key={i} role="tab" aria-selected={i === active} onClick={() => setActive(i)} className={cn("max-w-[220px] truncate rounded-full px-3 py-1 text-xs", i === active ? "bg-white font-medium text-ink shadow-[var(--shadow-card)]" : "text-muted hover:bg-white/60")}>
                        {i + 1}. {(edits[i]?.title ?? b.title) || "Untitled"}
                      </button>
                    ))}
                  </div>
                ) : null}
                {bugs.length > 1 ? <p className="mt-2 text-xs text-muted">Your note describes {bugs.length} separate problems, so each will be filed as its own bug.</p> : null}

                {cur ? (
                  <div className="mt-4 space-y-4">
                    <div>
                      <p className="mb-1.5 text-xs font-medium text-muted">Title</p>
                      <Input value={cur.title} onChange={(e) => edit(active, { title: e.target.value })} className="h-10 bg-white font-medium" aria-label="Title" />
                    </div>
                    <div>
                      <p className="mb-1.5 text-xs font-medium text-muted">Summary for the developer</p>
                      <Textarea autoGrow value={cur.description} onChange={(e) => edit(active, { description: e.target.value })} className="min-h-[44px] bg-white" aria-label="Summary" />
                    </div>
                    {cur.steps.length || touched("steps") ? (
                      <div>
                        <p className="mb-1.5 text-xs font-medium text-muted">Steps to reproduce</p>
                        <Textarea autoGrow key={`steps-${active}-${result?.source}`} defaultValue={stepsToText(cur.steps)} onChange={(e) => edit(active, { steps: textToSteps(e.target.value) })} className="bg-white" aria-label="Steps to reproduce" placeholder="One step per line" />
                      </div>
                    ) : null}
                    {cur.expected || cur.actual ? (
                      <div className="grid gap-4 sm:grid-cols-2">
                        <div>
                          <p className="mb-1.5 text-xs font-medium text-muted">Expected</p>
                          <Textarea autoGrow value={cur.expected} onChange={(e) => edit(active, { expected: e.target.value })} className="min-h-[44px] bg-white" aria-label="Expected result" />
                        </div>
                        <div>
                          <p className="mb-1.5 text-xs font-medium text-muted">Actual</p>
                          <Textarea autoGrow value={cur.actual} onChange={(e) => edit(active, { actual: e.target.value })} className="min-h-[44px] bg-white" aria-label="Actual result" />
                        </div>
                      </div>
                    ) : null}
                    {cur.requiredFix.length || touched("requiredFix") ? (
                      <div>
                        <p className="mb-1.5 text-xs font-medium text-muted">Required correction</p>
                        <Textarea autoGrow key={`fix-${active}-${result?.source}`} defaultValue={stepsToText(cur.requiredFix)} onChange={(e) => edit(active, { requiredFix: textToSteps(e.target.value) })} className="bg-white" aria-label="Required correction" placeholder="One point per line" />
                      </div>
                    ) : null}
                    {cur.environment ? <p className="text-xs text-muted">Environment: <span className="text-ink-2">{cur.environment}</span></p> : null}
                    {result?.source === "basic" ? <p className="text-xs text-muted">Using basic structuring. No AI key is connected yet, so wording is kept close to what you wrote.</p> : null}
                  </div>
                ) : null}
              </section>
            ) : null}
          </div>

          <div className="flex flex-wrap items-center gap-2 px-6 pb-3 pt-3">
            <Chip label="Severity" value={sev} tone={sev ? SEVERITY_META[sev as Severity].dot : undefined} inferred={!!sev && !touched("severity")} uncertain={flagged("severity")}>
              <MenuLabel>Severity</MenuLabel>
              {SEVERITIES.map((s) => (
                <MenuItem key={s} selected={sev === s} onSelect={() => cur ? edit(active, { severity: s, ...(touched("priority") ? {} : { priority: SEVERITY_TO_PRIORITY[s] }) }) : undefined}>
                  <span className="flex flex-col"><span className="flex items-center gap-2"><span className={cn("size-1.5 rounded-full", SEVERITY_META[s].dot)} />{s}</span><span className="text-xs text-muted">{definitions.severity[s]}</span></span>
                </MenuItem>
              ))}
            </Chip>
            <Chip label="Priority" value={pri} inferred={!!pri && !touched("priority")} uncertain={flagged("priority")}>
              <MenuLabel>Priority</MenuLabel>
              {PRIORITIES.map((p) => (
                <MenuItem key={p} selected={pri === p} onSelect={() => cur ? edit(active, { priority: p }) : undefined}>
                  <span className="flex flex-col"><span>{p}</span><span className="text-xs text-muted">{definitions.priority[p]}</span></span>
                </MenuItem>
              ))}
            </Chip>
            <Chip label="Module" value={modName} inferred={!!modName && !touched("module")} uncertain={flagged("module")}>
              <MenuLabel>Module</MenuLabel>
              {modules.map((m) => (
                <MenuItem key={m.id} selected={modName === m.name} onSelect={() => cur ? edit(active, { module: m.name }) : undefined}>{m.name}</MenuItem>
              ))}
              {modName ? <><MenuSeparator /><MenuItem onSelect={() => edit(active, { module: "" })}>No module</MenuItem></> : null}
            </Chip>
            <Chip label="Assign" value={people.find((p) => p.id === assigneeId)?.name} icon={<UserRound className="size-3.5" />}>
              <MenuLabel>Assign to</MenuLabel>
              {people.map((p) => (
                <MenuItem key={p.id} selected={assigneeId === p.id} onSelect={() => setAssigneeId(p.id)}>
                  <span className="flex items-center gap-2"><Avatar name={p.name} id={p.id} size={18} />{p.name}</span>
                </MenuItem>
              ))}
              {assigneeId ? <><MenuSeparator /><MenuItem onSelect={() => setAssigneeId("")}>Unassigned</MenuItem></> : null}
            </Chip>
            {!cur && text.trim().length ? <span className="text-xs text-muted">Severity, priority and module are filled in from your note.</span> : null}
          </div>

          <div className="flex items-center justify-between gap-3 border-t border-line px-6 py-3.5">
            <div className="flex items-center gap-2">
              <input ref={fileInput} type="file" accept="image/*,video/*" multiple className="sr-only" onChange={(e) => { void addFiles(Array.from(e.target.files ?? [])); e.target.value = ""; }} />
              <Button variant="ghost" size="icon" onClick={() => fileInput.current?.click()} aria-label="Attach screenshots or recordings" title="Attach screenshots or recordings">
                <Paperclip className="size-[18px]" />
              </Button>
              <span className="hidden items-center gap-1 text-xs text-muted sm:flex">
                <Kbd>⌘</Kbd><Kbd>↵</Kbd> to create
              </span>
            </div>
            <Button variant="primary" size="lg" className="rounded-full px-6" disabled={!text.trim() || creating || uploading} onClick={() => void submit()}>
              {creating ? <><Loader2 className="size-4 animate-spin" /> Creating</> : "Create bug"}
            </Button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
