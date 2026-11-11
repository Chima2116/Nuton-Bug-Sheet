"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import type { CaptureMeta } from "./types";

/**
 * Handoff with the capture module running inside Nuton (see docs/nuton-capture-protocol.md).
 *
 * - The Bug Sheet opens Nuton in its own window and stays open with the draft.
 * - A random one-time session code pairs the two windows. It is NOT a login and is passed in the
 *   URL fragment (never sent to a server), and Nuton removes it from the address bar immediately.
 * - Every message is sent to one exact origin (never "*") and every incoming message must come from
 *   that origin, from the window we opened, with the matching session code.
 * - No credentials or tokens cross between the apps. Screenshots arrive as image blobs and are
 *   uploaded here with the signed-in user's own Supabase session.
 */
export const NUTON_ORIGIN = (process.env.NEXT_PUBLIC_NUTON_ORIGIN ?? "https://nuton.app").replace(/\/$/, "");
const START_URL = `${NUTON_ORIGIN}/new`;
const MAX_BYTES = 25 * 1024 * 1024;
const READY_TIMEOUT_MS = 25_000;
const WINDOW_NAME = "nuton-capture";

export interface IncomingShot {
  id: string;
  original: Blob;
  annotated: Blob | null;
  meta: CaptureMeta;
}

export type CaptureState = "idle" | "opening" | "connected";

const str = (v: unknown, max = 300) => (typeof v === "string" ? v.slice(0, max) : "");

/** Validates the untrusted payload from the other window. Returns null if anything is off. */
export function parseShot(raw: unknown): IncomingShot | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const okBlob = (b: unknown): b is Blob => b instanceof Blob && b.type === "image/png" && b.size > 0 && b.size <= MAX_BYTES;
  if (!okBlob(r.original)) return null;
  if (r.annotated != null && !okBlob(r.annotated)) return null;
  const m = (r.meta ?? {}) as Record<string, unknown>;
  const meta: CaptureMeta = {
    path: str(m.path).replace(/[?#].*$/, ""),
    title: str(m.title),
    capturedAt: str(m.capturedAt, 40) || new Date().toISOString(),
    browser: str(m.browser, 60),
    os: str(m.os, 60),
    screen: str(m.screen, 60),
    viewport: str(m.viewport, 40),
    approximate: m.approximate === true ? true : undefined,
  };
  return { id: str(r.id, 64) || crypto.randomUUID(), original: r.original, annotated: (r.annotated as Blob | null) ?? null, meta };
}

function newSession() {
  const a = new Uint8Array(16);
  crypto.getRandomValues(a);
  return Array.from(a, (b) => b.toString(16).padStart(2, "0")).join("");
}

export function useNutonCapture({ onShot, onProblem, count }: { onShot: (shot: IncomingShot) => Promise<void> | void; onProblem: (message: string) => void; count: number }) {
  const [state, setState] = useState<CaptureState>("idle");
  const win = useRef<Window | null>(null);
  const session = useRef("");
  const timers = useRef<{ ready?: ReturnType<typeof setTimeout>; poll?: ReturnType<typeof setInterval> }>({});
  const cb = useRef({ onShot, onProblem });
  cb.current = { onShot, onProblem };
  const countRef = useRef(count);
  countRef.current = count;

  const reset = useCallback(() => {
    clearTimeout(timers.current.ready);
    clearInterval(timers.current.poll);
    win.current = null;
    session.current = "";
    setState("idle");
  }, []);

  useEffect(() => {
    const send = (msg: Record<string, unknown>) => win.current?.postMessage({ source: "bug-sheet", v: 1, session: session.current, ...msg }, NUTON_ORIGIN);
    const onMessage = (e: MessageEvent) => {
      if (e.origin !== NUTON_ORIGIN || !win.current || e.source !== win.current) return;
      const d = e.data as Record<string, unknown> | null;
      if (!d || d.source !== "nuton-capture" || d.v !== 1 || d.session !== session.current || !session.current) return;
      if (d.type === "ready") {
        clearTimeout(timers.current.ready);
        setState("connected");
        send({ type: "ack", count: countRef.current });
      } else if (d.type === "shot") {
        const shot = parseShot(d.shot);
        if (!shot) return cb.current.onProblem("Nuton sent a screenshot that couldn't be read. Try capturing again.");
        Promise.resolve(cb.current.onShot(shot)).then(
          () => send({ type: "shot-received", id: shot.id, count: countRef.current }),
          () => send({ type: "shot-failed", id: shot.id }),
        );
      } else if (d.type === "refused") {
        cb.current.onProblem("Capture isn't enabled for the Nuton account you're signed in to. Ask to be added to the capture allow-list, then try again.");
        reset();
      } else if (d.type === "closed") {
        reset();
      }
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [reset]);

  useEffect(() => () => {
    clearTimeout(timers.current.ready);
    clearInterval(timers.current.poll);
  }, []);

  /** Tell an open capture window how many screenshots are on the draft. */
  useEffect(() => {
    if (state === "connected" && win.current && session.current)
      win.current.postMessage({ source: "bug-sheet", v: 1, session: session.current, type: "count", count }, NUTON_ORIGIN);
  }, [count, state]);

  /**
   * Must be called straight from a click. The window is opened right away (browsers such as Safari only
   * allow a pop-up in the same instant as the click) and sent on to Nuton after `before` finishes, e.g. saving the draft.
   */
  const open = useCallback((before?: () => Promise<unknown>) => {
    if (win.current && !win.current.closed) {
      win.current.focus();
      return true;
    }
    reset();
    session.current = newSession();
    const hash = `#nuton-capture=${session.current}&origin=${encodeURIComponent(window.location.origin)}&v=1`;
    const w = window.open("about:blank", WINDOW_NAME, "popup=yes,width=1440,height=900");
    if (!w) {
      session.current = "";
      cb.current.onProblem("Your browser blocked the capture window. Allow pop-ups for this site (look for an icon in the address bar), then try again.");
      return false;
    }
    try {
      w.document.title = "Opening Nuton…";
      w.document.body.style.cssText = "margin:0;display:grid;place-items:center;height:100vh;font:14px system-ui;color:#6b6b64";
      w.document.body.textContent = "Opening Nuton…";
    } catch {}
    win.current = w;
    setState("opening");
    const go = () => {
      if (w.closed || win.current !== w) return;
      try {
        w.location.href = START_URL + hash;
      } catch {
        cb.current.onProblem("Couldn't open Nuton in the capture window. Close it and try again.");
      }
    };
    Promise.resolve(before?.()).then(go, go);
    timers.current.ready = setTimeout(() => {
      cb.current.onProblem("Nuton didn't respond. Make sure you're signed in to Nuton and that capture is enabled there, then try again.");
      setState((s) => (s === "opening" ? "opening" : s));
    }, READY_TIMEOUT_MS);
    timers.current.poll = setInterval(() => {
      if (win.current?.closed) reset();
    }, 700);
    return true;
  }, [reset]);

  const focus = useCallback(() => win.current?.focus(), []);
  const cancel = useCallback(() => {
    try {
      win.current?.close();
    } catch {}
    reset();
  }, [reset]);

  return { state, open, focus, cancel };
}
