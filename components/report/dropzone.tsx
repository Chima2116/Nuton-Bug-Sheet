"use client";
import { ImagePlus } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useToast } from "@/components/ui/toast";
import { ingestFiles } from "@/lib/blobs";
import type { Attachment } from "@/lib/types";
import { cn } from "@/lib/utils";

export function Dropzone({ userId, onAdd, compact, pasteTarget = true }: { userId: string; onAdd: (a: Attachment[]) => void; compact?: boolean; pasteTarget?: boolean }) {
  const input = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);
  const [busy, setBusy] = useState(false);
  const { toast } = useToast();

  const handle = useCallback(
    async (files: File[]) => {
      if (!files.length) return;
      setBusy(true);
      const { attachments, rejected } = await ingestFiles(files, userId);
      setBusy(false);
      if (attachments.length) onAdd(attachments);
      if (rejected.length) toast(`Skipped: ${rejected.join(", ")}`, { tone: "error" });
    },
    [onAdd, toast, userId],
  );

  useEffect(() => {
    if (!pasteTarget) return;
    const onPaste = (e: ClipboardEvent) => {
      const files = Array.from(e.clipboardData?.files ?? []).filter((f) => f.type.startsWith("image/") || f.type.startsWith("video/"));
      if (files.length) {
        e.preventDefault();
        handle(files);
      }
    };
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  }, [handle, pasteTarget]);

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setOver(false);
        handle(Array.from(e.dataTransfer.files));
      }}
      className={cn("rounded-lg border border-dashed transition-colors", over ? "border-olive-500 bg-olive-50" : "border-line-strong bg-wash/60 hover:bg-wash", compact ? "px-4 py-3" : "px-4 py-6")}
    >
      <input ref={input} type="file" accept="image/*,video/*" multiple className="sr-only" onChange={(e) => { handle(Array.from(e.target.files ?? [])); e.target.value = ""; }} />
      <div className={cn("flex items-center gap-3", compact ? "flex-row" : "flex-col text-center")}>
        <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-white text-muted ring-1 ring-line"><ImagePlus className="size-4" /></span>
        <div className="min-w-0">
          <p className="text-[13px] text-ink">
            <button type="button" onClick={() => input.current?.click()} className="font-medium text-olive-700 underline-offset-2 hover:underline">
              {busy ? "Adding…" : "Choose files"}
            </button>{" "}
            or drop them here
          </p>
          <p className="mt-0.5 text-xs text-muted">Screenshots and screen recordings. You can also paste images from your clipboard.</p>
        </div>
      </div>
    </div>
  );
}
