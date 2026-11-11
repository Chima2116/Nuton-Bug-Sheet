import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function PageHeader({ title, description, actions, className }: { title: ReactNode; description?: ReactNode; actions?: ReactNode; className?: string }) {
  return (
    <div className={cn("flex flex-wrap items-end justify-between gap-x-6 gap-y-3", className)}>
      <div className="min-w-0">
        <h1 className="font-display text-[24px] leading-[1.2] text-ink sm:text-[28px]">{title}</h1>
        {description ? <p className="mt-1.5 max-w-xl text-sm text-muted">{description}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  );
}

export function PageBody({ children, className, wide }: { children: ReactNode; className?: string; wide?: boolean }) {
  return <div className={cn("mx-auto w-full px-4 pb-16 pt-6 sm:px-6 sm:pt-7 lg:px-8", wide ? "max-w-none" : "max-w-[1240px]", className)}>{children}</div>;
}

export function Skeleton() {
  return (
    <div className="mx-auto w-full max-w-[1240px] animate-pulse px-6 pt-10 lg:px-10">
      <div className="h-9 w-56 rounded-xl bg-wash" />
      <div className="mt-8 grid grid-cols-2 gap-3 md:grid-cols-5">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="h-24 rounded-2xl bg-wash" />
        ))}
      </div>
      <div className="mt-6 h-72 rounded-2xl bg-wash" />
    </div>
  );
}
