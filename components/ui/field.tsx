"use client";
import { ChevronDown } from "lucide-react";
import { forwardRef, useEffect, useRef, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

const control =
  "w-full rounded-[10px] border border-line-strong bg-white px-3.5 text-sm text-ink placeholder:text-faint transition-[border-color,box-shadow] hover:border-faint focus:border-olive-500 focus:outline-none focus:ring-4 focus:ring-olive-500/12 disabled:bg-wash disabled:text-muted";

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(function Input({ className, ...rest }, ref) {
  return <input ref={ref} className={cn(control, "h-10", className)} {...rest} />;
});

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement> & { autoGrow?: boolean }>(function Textarea(
  { className, autoGrow, value, onChange, ...rest },
  ref,
) {
  const inner = useRef<HTMLTextAreaElement | null>(null);
  useEffect(() => {
    const el = inner.current;
    if (autoGrow && el) {
      el.style.height = "auto";
      el.style.height = `${el.scrollHeight + 2}px`;
    }
  }, [value, autoGrow]);
  return (
    <textarea
      ref={(el) => {
        inner.current = el;
        if (typeof ref === "function") ref(el);
        else if (ref) ref.current = el;
      }}
      value={value}
      onChange={onChange}
      className={cn(control, "py-2 leading-relaxed", autoGrow && "resize-none overflow-hidden", className)}
      {...rest}
    />
  );
});

export function Select({ className, children, ...rest }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <div className="relative">
      <select className={cn(control, "h-10 appearance-none pr-9", className)} {...rest}>
        {children}
      </select>
      <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 size-4 -translate-y-1/2 text-faint" />
    </div>
  );
}

export function Label({ children, htmlFor, className }: { children: ReactNode; htmlFor?: string; className?: string }) {
  return (
    <label htmlFor={htmlFor} className={cn("mb-1.5 block text-[13px] font-medium text-ink", className)}>
      {children}
    </label>
  );
}

export function Hint({ children, className }: { children: ReactNode; className?: string }) {
  return <p className={cn("mt-1.5 text-xs text-muted", className)}>{children}</p>;
}
