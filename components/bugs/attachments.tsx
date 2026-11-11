"use client";
import * as Dialog from "@radix-ui/react-dialog";
import { ChevronLeft, ChevronRight, Download, FileIcon, Info, Play, X } from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { originalOf, useAttachmentUrl, visibleAttachments } from "@/lib/blobs";
import type { Attachment } from "@/lib/types";
import { cn, formatBytes, formatDateTime } from "@/lib/utils";

export function AttachmentThumb({
  att,
  onOpen,
  onRemove,
  overlay,
  className,
  chip,
  caption,
}: {
  att: Attachment;
  onOpen?: () => void;
  onRemove?: () => void;
  overlay?: ReactNode;
  className?: string;
  chip?: string;
  caption?: string;
}) {
  const url = useAttachmentUrl(att);
  return (
    <div className={cn("group relative overflow-hidden rounded-lg border border-line bg-wash", className)}>
      <button type="button" onClick={onOpen} className="block aspect-[4/3] w-full" aria-label={`View ${att.name}`}>
        {att.kind === "image" && url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={url} alt={att.name} className="size-full object-cover" />
        ) : att.kind === "video" && url ? (
          <>
            <video src={url + "#t=0.1"} preload="metadata" muted className="size-full object-cover" />
            <span className="absolute inset-0 flex items-center justify-center">
              <span className="flex size-9 items-center justify-center rounded-full bg-ink/70 text-white"><Play className="ml-0.5 size-4 fill-current" /></span>
            </span>
          </>
        ) : (
          <span className="flex size-full flex-col items-center justify-center gap-1 text-faint">
            <FileIcon className="size-5" />
            {!url && att.kind !== "file" ? <span className="text-[11px]">Preview unavailable</span> : null}
          </span>
        )}
      </button>
      <div className="flex items-center gap-2 border-t border-line bg-white px-2.5 py-1.5">
        <span className="min-w-0 flex-1">
          <span className="block truncate text-xs text-ink" title={att.name}>{att.meta?.title || att.name}</span>
          <span className="block truncate text-[11px] text-muted">{caption ?? `${att.kind === "video" ? "Video" : "Image"} · ${formatBytes(att.size)}`}</span>
        </span>
      </div>
      {chip ? <span className={cn("pointer-events-none absolute left-2 top-2 rounded-md px-1.5 py-0.5 text-[11px] font-medium shadow-[0_0_0_1px_rgba(0,0,0,0.08)]", chip === "Annotated" ? "bg-olive-600 text-white shadow-none" : "bg-white/95 text-ink")}>{chip}</span> : null}
      {overlay}
      {onRemove ? (
        <button type="button" onClick={onRemove} aria-label={`Remove ${att.name}`} className="absolute right-1.5 top-1.5 flex size-6 items-center justify-center rounded-full bg-ink/70 text-white opacity-100 transition-opacity hover:bg-ink sm:opacity-0 sm:group-hover:opacity-100 sm:focus-visible:opacity-100">
          <X className="size-3.5" />
        </button>
      ) : null}
    </div>
  );
}

export function Lightbox({ items, index, onIndex, onClose, all }: { items: Attachment[]; index: number | null; onIndex: (i: number) => void; onClose: () => void; all?: Attachment[] }) {
  const open = index !== null && items[index] !== undefined;
  const base = open ? items[index!] : undefined;
  const original = base ? originalOf(base, all ?? items) : undefined;
  const [showOriginal, setShowOriginal] = useState(false);
  const [showInfo, setShowInfo] = useState(false);
  useEffect(() => setShowOriginal(false), [index]);
  const att = showOriginal && original ? original : base;
  const url = useAttachmentUrl(att);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") onIndex(Math.min(items.length - 1, index! + 1));
      if (e.key === "ArrowLeft") onIndex(Math.max(0, index! - 1));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, index, items.length, onIndex]);

  return (
    <Dialog.Root open={open} onOpenChange={(o) => !o && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-[70] animate-fade-in bg-[#0f0f0e]/92" />
        <Dialog.Content ref={ref} aria-describedby={undefined} className="fixed inset-0 z-[70] flex flex-col focus:outline-none">
          <Dialog.Title className="sr-only">{att?.name ?? "Attachment"}</Dialog.Title>
          <div className="flex items-center gap-3 px-4 py-3 text-white sm:px-6">
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{att?.name}</p>
              <p className="text-xs text-white/60">{index !== null ? index + 1 : 0} of {items.length}{att ? ` · ${formatBytes(att.size)}` : ""}</p>
            </div>
            {original ? (
              <div className="flex gap-0.5 rounded-lg bg-white/10 p-0.5 text-[13px]" role="tablist" aria-label="Version">
                {[["Annotated", false], ["Original", true]].map(([label, orig]) => (
                  <button key={String(label)} role="tab" aria-selected={showOriginal === orig} onClick={() => setShowOriginal(orig as boolean)} className={cn("h-7 rounded-md px-2.5", showOriginal === orig ? "bg-white text-ink" : "text-white/75 hover:text-white")}>{label as string}</button>
                ))}
              </div>
            ) : null}
            {base?.meta ? (
              <button onClick={() => setShowInfo((v) => !v)} aria-pressed={showInfo} className={cn("flex h-8 items-center gap-1.5 rounded-md px-2.5 text-[13px] hover:bg-white/10", showInfo ? "bg-white/10 text-white" : "text-white/80")}>
                <Info className="size-4" /> Details
              </button>
            ) : null}
            {url ? (
              <a href={url} download={att?.name} className="flex h-8 items-center gap-1.5 rounded-md px-2.5 text-[13px] text-white/80 hover:bg-white/10 hover:text-white">
                <Download className="size-4" /> Download
              </a>
            ) : null}
            <Dialog.Close className="flex size-8 items-center justify-center rounded-md text-white/80 hover:bg-white/10 hover:text-white" aria-label="Close"><X className="size-5" /></Dialog.Close>
          </div>
          <div className="relative flex min-h-0 flex-1 items-center justify-center px-4 pb-6 sm:px-16" onClick={(e) => e.target === e.currentTarget && onClose()}>
            {att?.kind === "video" && url ? (
              <video key={att.id} src={url} controls autoPlay className="max-h-full max-w-full rounded-md bg-black" />
            ) : url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img key={att?.id} src={url} alt={att?.name} className="max-h-full max-w-full rounded-md bg-white object-contain" />
            ) : (
              <p className="text-sm text-white/60">This file isn&apos;t available in this browser.</p>
            )}
            {showInfo && base?.meta ? (
              <dl className="absolute bottom-4 left-1/2 grid w-[min(520px,calc(100%-32px))] -translate-x-1/2 grid-cols-[88px_minmax(0,1fr)] gap-x-3 gap-y-1.5 rounded-xl bg-[#171715]/95 p-4 text-[12.5px] text-white shadow-[0_0_0_1px_rgba(255,255,255,0.1)]">
                {([["Page", base.meta.path], ["Title", base.meta.title], ["Captured", formatDateTime(base.meta.capturedAt)], ["Browser", base.meta.browser], ["System", base.meta.os], ["Screen", base.meta.screen], ["Viewport", base.meta.viewport]] as const).filter(([, v]) => v).map(([k, v]) => (
                  <div key={k} className="contents"><dt className="text-white/55">{k}</dt><dd className="break-words">{v}</dd></div>
                ))}
                {base.meta.approximate ? <p className="col-span-2 mt-1 text-white/60">Approximate capture: some effects may differ from what was on screen.</p> : null}
              </dl>
            ) : null}
            {items.length > 1 && index !== null ? (
              <>
                <button disabled={index === 0} onClick={() => onIndex(index - 1)} className="absolute left-3 top-1/2 flex size-10 -translate-y-1/2 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20 disabled:opacity-30" aria-label="Previous attachment"><ChevronLeft className="size-5" /></button>
                <button disabled={index === items.length - 1} onClick={() => onIndex(index + 1)} className="absolute right-3 top-1/2 flex size-10 -translate-y-1/2 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20 disabled:opacity-30" aria-label="Next attachment"><ChevronRight className="size-5" /></button>
              </>
            ) : null}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

export function AttachmentGrid({ items, onRemove, renderOverlay, columns = "grid-cols-2 sm:grid-cols-3" }: { items: Attachment[]; onRemove?: (a: Attachment) => void; renderOverlay?: (a: Attachment) => ReactNode; columns?: string }) {
  const [index, setIndex] = useState<number | null>(null);
  const shown = visibleAttachments(items);
  return (
    <>
      <div className={cn("grid gap-3", columns)}>
        {shown.map((a, i) => (
          <AttachmentThumb
            key={a.id}
            att={a}
            chip={a.variant === "annotated" ? "Annotated" : a.variant === "capture" ? "Capture" : undefined}
            caption={a.meta ? `${a.meta.path}${a.meta.viewport ? " · " + a.meta.viewport : ""}` : undefined}
            onOpen={() => setIndex(i)}
            onRemove={onRemove ? () => onRemove(a) : undefined}
            overlay={renderOverlay?.(a)}
          />
        ))}
      </div>
      <Lightbox items={shown} all={items} index={index} onIndex={setIndex} onClose={() => setIndex(null)} />
    </>
  );
}
