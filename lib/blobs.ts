"use client";
import { useEffect, useState } from "react";
import { BUCKET, supabase } from "./supabase";
import type { Attachment } from "./types";

export const MAX_FILE_BYTES = 50 * 1024 * 1024; // matches the bucket limit in the migration

export function kindFromMime(mime: string): Attachment["kind"] {
  if (mime.startsWith("image/")) return "image";
  if (mime.startsWith("video/")) return "video";
  return "file";
}

/** id → URL. Freshly uploaded files show instantly from a local object URL; others from signed URLs. */
const urlCache = new Map<string, { url: string; expires: number }>();
const FOREVER = Number.MAX_SAFE_INTEGER;

async function signedUrl(att: Attachment): Promise<string | null> {
  const hit = urlCache.get(att.id);
  if (hit && hit.expires > Date.now() + 60_000) return hit.url;
  if (!supabase) return null;
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(att.path, 3600);
  if (error || !data) return null;
  urlCache.set(att.id, { url: data.signedUrl, expires: Date.now() + 3600_000 });
  return data.signedUrl;
}

export function useAttachmentUrl(att: Attachment | undefined) {
  const [url, setUrl] = useState<string | null>(att ? urlCache.get(att.id)?.url ?? null : null);
  useEffect(() => {
    let alive = true;
    if (!att) return setUrl(null);
    signedUrl(att).then((u) => alive && setUrl(u));
    return () => {
      alive = false;
    };
  }, [att?.id, att?.path]); // eslint-disable-line react-hooks/exhaustive-deps
  return url;
}

function safeName(name: string) {
  return name.replace(/[^\w.\-]+/g, "_").slice(-80) || "file";
}

/** Uploads the original files to Supabase Storage and records them. Nothing is resized or re-encoded. */
export async function ingestFiles(files: File[], userId: string): Promise<{ attachments: Attachment[]; rejected: string[] }> {
  const attachments: Attachment[] = [];
  const rejected: string[] = [];
  if (!supabase) return { attachments, rejected: files.map((f) => `${f.name} (not connected)`) };
  for (const file of files) {
    const kind = kindFromMime(file.type);
    if (kind === "file") {
      rejected.push(`${file.name} (only images and videos are supported)`);
      continue;
    }
    if (file.size > MAX_FILE_BYTES) {
      rejected.push(`${file.name} (over 50 MB)`);
      continue;
    }
    const id = crypto.randomUUID();
    const name = file.name || (kind === "image" ? "pasted-image.png" : "recording");
    const path = `${userId}/${id}-${safeName(name)}`;
    const up = await supabase.storage.from(BUCKET).upload(path, file, { contentType: file.type, upsert: false });
    if (up.error) {
      rejected.push(`${name} (${up.error.message})`);
      continue;
    }
    const row = { id, name, kind, mime: file.type, size: file.size, path, uploaded_by: userId };
    const ins = await supabase.from("attachments").insert(row);
    if (ins.error) {
      await supabase.storage.from(BUCKET).remove([path]);
      rejected.push(`${name} (${ins.error.message})`);
      continue;
    }
    urlCache.set(id, { url: URL.createObjectURL(file), expires: FOREVER });
    attachments.push({ id, name, kind, mime: file.type, size: file.size, path, addedAt: new Date().toISOString(), addedById: userId });
  }
  return { attachments, rejected };
}

/** Removes a file that was uploaded but never attached to a bug (e.g. removed from a draft). */
export async function deleteAttachment(att: Attachment) {
  if (!supabase) return;
  await supabase.from("attachments").delete().eq("id", att.id);
  await supabase.storage.from(BUCKET).remove([att.path]);
  urlCache.delete(att.id);
}
