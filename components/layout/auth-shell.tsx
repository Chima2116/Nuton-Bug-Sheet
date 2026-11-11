"use client";
import type { ReactNode } from "react";

/** Centered layout for sign-in and setup screens. */
export function AuthShell({ title, subtitle, children, wide }: { title: string; subtitle?: ReactNode; children: ReactNode; wide?: boolean }) {
  return (
    <div className="flex min-h-dvh flex-col bg-white">
      <header className="flex items-center gap-2.5 px-6 py-5 sm:px-10">
        <span className="font-display flex size-6 items-center justify-center rounded-md bg-olive-600 text-[16px] leading-none text-white">N</span>
        <span className="text-sm font-semibold tracking-tight text-ink">Nuton</span>
        <span className="text-sm text-faint">Bug sheet</span>
      </header>
      <main className="flex flex-1 items-start justify-center px-6 pb-16 pt-[10vh]">
        <div className={wide ? "w-full max-w-[620px]" : "w-full max-w-[380px]"}>
          <h1 className="font-display text-[34px] leading-[1.15] text-ink">{title}</h1>
          {subtitle ? <p className="mt-2 text-sm text-muted">{subtitle}</p> : null}
          <div className="mt-8">{children}</div>
        </div>
      </main>
    </div>
  );
}
