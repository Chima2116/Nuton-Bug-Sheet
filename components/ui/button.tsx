"use client";
import Link from "next/link";
import { forwardRef, type ButtonHTMLAttributes, type ComponentProps } from "react";
import { cn } from "@/lib/utils";

type Variant = "primary" | "secondary" | "ghost" | "danger" | "subtle" | "dark";
type Size = "sm" | "md" | "lg" | "icon" | "icon-sm";

const base =
  "inline-flex shrink-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-[10px] font-medium transition-[background-color,box-shadow,color,transform] duration-150 select-none active:scale-[0.985] disabled:pointer-events-none disabled:opacity-45";

const variants: Record<Variant, string> = {
  primary: "bg-olive-600 text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.14),0_1px_2px_rgba(60,66,20,0.35)] hover:bg-olive-700 active:bg-olive-800",
  dark: "bg-ink text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.12)] hover:bg-ink-2",
  secondary: "bg-white text-ink shadow-[var(--shadow-card)] hover:bg-wash active:bg-wash-2",
  subtle: "bg-wash-2/70 text-ink hover:bg-wash-2 active:bg-line",
  ghost: "text-muted hover:bg-wash-2/70 hover:text-ink active:bg-wash-2",
  danger: "bg-white text-st-reopened shadow-[var(--shadow-card)] hover:bg-st-reopened/5",
};

const sizes: Record<Size, string> = {
  sm: "h-8 px-3 text-[13px]",
  md: "h-9 px-3.5 text-[13px]",
  lg: "h-10 px-5 text-sm",
  icon: "h-9 w-9",
  "icon-sm": "h-8 w-8",
};

export function buttonClass(variant: Variant = "secondary", size: Size = "md", className?: string) {
  return cn(base, variants[variant], sizes[size], className);
}

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
}

export const Button = forwardRef<HTMLButtonElement, Props>(function Button(
  { variant = "secondary", size = "md", className, type = "button", ...rest },
  ref,
) {
  return <button ref={ref} type={type} className={buttonClass(variant, size, className)} {...rest} />;
});

export function ButtonLink({
  variant = "secondary",
  size = "md",
  className,
  ...rest
}: ComponentProps<typeof Link> & { variant?: Variant; size?: Size }) {
  return <Link className={buttonClass(variant, size, className)} {...rest} />;
}
