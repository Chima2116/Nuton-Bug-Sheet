"use client";
import * as Dialog from "@radix-ui/react-dialog";
import * as Dropdown from "@radix-ui/react-dropdown-menu";
import * as Pop from "@radix-ui/react-popover";
import { Check, X } from "lucide-react";
import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/utils";

/* ---------------- Modal ---------------- */
export function Modal({
  open,
  onOpenChange,
  title,
  description,
  children,
  footer,
  width = "max-w-[480px]",
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  title: string;
  description?: string;
  children?: ReactNode;
  footer?: ReactNode;
  width?: string;
}) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 animate-fade-in bg-ink/30" />
        <Dialog.Content
          className={cn(
            "fixed left-1/2 top-1/2 z-50 flex max-h-[88dvh] w-[calc(100vw-32px)] -translate-x-1/2 -translate-y-1/2 animate-pop-in flex-col rounded-xl border border-line bg-white shadow-[var(--shadow-pop)] focus:outline-none",
            width,
          )}
        >
          <div className="flex items-start justify-between gap-4 px-6 pt-5">
            <div className="min-w-0">
              <Dialog.Title className="text-[15px] font-semibold text-ink">{title}</Dialog.Title>
              {description ? <Dialog.Description className="mt-1 text-[13px] text-muted">{description}</Dialog.Description> : <Dialog.Description className="sr-only">{title}</Dialog.Description>}
            </div>
            <Dialog.Close className="-mr-2 -mt-1 rounded-md p-1.5 text-muted hover:bg-wash hover:text-ink" aria-label="Close">
              <X className="size-4" />
            </Dialog.Close>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto px-6 py-4">{children}</div>
          {footer ? <div className="flex items-center justify-end gap-2 border-t border-line px-6 py-3.5">{footer}</div> : null}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

/* ---------------- Sheet (right drawer) ---------------- */
export function Sheet({
  open,
  onOpenChange,
  title,
  description,
  children,
  footer,
  width = "sm:w-[560px]",
  side = "right",
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  title: string;
  description?: string;
  children?: ReactNode;
  footer?: ReactNode;
  width?: string;
  side?: "right" | "left";
}) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 animate-fade-in bg-ink/30" />
        <Dialog.Content
          className={cn(
            "fixed inset-y-0 z-50 flex w-full flex-col bg-white shadow-[var(--shadow-sheet)] focus:outline-none",
            side === "right" ? "right-0 animate-slide-in-right border-l border-line" : "left-0 animate-slide-in-left border-r border-line",
            width,
          )}
        >
          <div className="flex items-start justify-between gap-4 border-b border-line px-6 py-4">
            <div className="min-w-0">
              <Dialog.Title className="text-[15px] font-semibold text-ink">{title}</Dialog.Title>
              {description ? <Dialog.Description className="mt-0.5 text-[13px] text-muted">{description}</Dialog.Description> : <Dialog.Description className="sr-only">{title}</Dialog.Description>}
            </div>
            <Dialog.Close className="-mr-2 rounded-md p-1.5 text-muted hover:bg-wash hover:text-ink" aria-label="Close">
              <X className="size-4" />
            </Dialog.Close>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">{children}</div>
          {footer ? <div className="flex items-center justify-end gap-2 border-t border-line px-6 py-3.5">{footer}</div> : null}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

/* ---------------- Dropdown menu ---------------- */
export const Menu = Dropdown.Root;
export const MenuTrigger = Dropdown.Trigger;

export function MenuContent({ className, align = "end", ...rest }: ComponentProps<typeof Dropdown.Content>) {
  return (
    <Dropdown.Portal>
      <Dropdown.Content
        align={align}
        sideOffset={6}
        collisionPadding={12}
        className={cn("z-[60] min-w-[200px] animate-pop-in rounded-lg bg-white p-1 shadow-[var(--shadow-pop)]", className)}
        {...rest}
      />
    </Dropdown.Portal>
  );
}

const menuItemBase =
  "flex cursor-pointer select-none items-center gap-2.5 rounded-md px-2.5 py-1.5 text-[13px] outline-none data-[disabled]:pointer-events-none data-[disabled]:opacity-40 data-[highlighted]:bg-wash";

export function MenuItem({ className, danger, selected, icon, children, asChild, ...rest }: ComponentProps<typeof Dropdown.Item> & { danger?: boolean; selected?: boolean; icon?: ReactNode }) {
  const cls = cn(menuItemBase, danger ? "text-st-reopened" : "text-ink", className);
  // With asChild the consumer supplies one element (e.g. a Link) and its own icon.
  if (asChild)
    return (
      <Dropdown.Item asChild className={cls} {...rest}>
        {children}
      </Dropdown.Item>
    );
  return (
    <Dropdown.Item className={cls} {...rest}>
      {icon ? <span className="flex size-4 shrink-0 items-center justify-center text-muted">{icon}</span> : null}
      <span className="min-w-0 flex-1 truncate">{children}</span>
      {selected ? <Check className="size-3.5 text-olive-600" /> : null}
    </Dropdown.Item>
  );
}
export function MenuLabel({ children }: { children: ReactNode }) {
  return <Dropdown.Label className="px-2.5 pb-1 pt-2 text-[11px] font-medium uppercase tracking-wide text-faint">{children}</Dropdown.Label>;
}
export function MenuSeparator() {
  return <Dropdown.Separator className="my-1 h-px bg-line" />;
}

/* ---------------- Popover ---------------- */
export const Popover = Pop.Root;
export const PopoverTrigger = Pop.Trigger;
export function PopoverContent({ className, align = "start", ...rest }: ComponentProps<typeof Pop.Content>) {
  return (
    <Pop.Portal>
      <Pop.Content
        align={align}
        sideOffset={6}
        collisionPadding={12}
        className={cn("z-[60] animate-pop-in rounded-lg bg-white shadow-[var(--shadow-pop)] focus:outline-none", className)}
        {...rest}
      />
    </Pop.Portal>
  );
}
