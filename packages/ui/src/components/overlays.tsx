"use client";

import * as React from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import * as Dropdown from "@radix-ui/react-dropdown-menu";
import * as TooltipPrimitive from "@radix-ui/react-tooltip";
import * as PopoverPrimitive from "@radix-ui/react-popover";
import { X } from "lucide-react";
import { cn } from "../lib/cn";

/* ------------------------------------------------------------------ */
/* Dialog (centered modal) and Sheet (right drawer)                    */
/* ------------------------------------------------------------------ */

export function Dialog({
  open,
  onOpenChange,
  trigger,
  title,
  description,
  children,
  footer,
  width = 520,
  side,
}: {
  open?: boolean;
  onOpenChange?: (o: boolean) => void;
  trigger?: React.ReactNode;
  title: React.ReactNode;
  description?: React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode;
  width?: number;
  side?: "right";
}) {
  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      {trigger && <DialogPrimitive.Trigger asChild>{trigger}</DialogPrimitive.Trigger>}
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm data-[state=open]:animate-in data-[state=open]:fade-in" />
        <DialogPrimitive.Content
          className={cn(
            "k-card fixed z-50 flex flex-col overflow-hidden bg-surface outline-none",
            side === "right"
              ? "inset-y-3 right-3 w-[min(560px,calc(100vw-24px))] rounded-[24px]"
              : "left-1/2 top-1/2 max-h-[92vh] w-[calc(100vw-24px)] -translate-x-1/2 -translate-y-1/2 rounded-[24px]",
          )}
          style={side === "right" ? undefined : { maxWidth: width }}
        >
          <div className="flex items-start justify-between gap-4 border-b border-line px-6 py-5">
            <div>
              <DialogPrimitive.Title className="text-lg font-medium tracking-tight">{title}</DialogPrimitive.Title>
              {description && <DialogPrimitive.Description className="mt-1 text-[13px] text-fg-3">{description}</DialogPrimitive.Description>}
            </div>
            <DialogPrimitive.Close className="grid size-8 place-items-center rounded-full border border-line text-fg-2 hover:bg-surface-3 hover:text-fg">
              <X className="size-4" />
            </DialogPrimitive.Close>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">{children}</div>
          {footer && <div className="flex items-center justify-end gap-2 border-t border-line px-6 py-4">{footer}</div>}
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}

export const DialogClose = DialogPrimitive.Close;

/* ------------------------------------------------------------------ */
/* Dropdown menu                                                       */
/* ------------------------------------------------------------------ */

export function Menu({
  trigger,
  items,
  align = "end",
  width = 220,
  header,
}: {
  trigger: React.ReactNode;
  items: ({ label: React.ReactNode; icon?: React.ReactNode; onSelect?: () => void; danger?: boolean; hint?: React.ReactNode; href?: string } | "sep")[];
  align?: "start" | "end" | "center";
  width?: number;
  header?: React.ReactNode;
}) {
  return (
    <Dropdown.Root>
      <Dropdown.Trigger asChild>{trigger}</Dropdown.Trigger>
      <Dropdown.Portal>
        <Dropdown.Content
          align={align}
          sideOffset={8}
          collisionPadding={12}
          className="k-card z-50 overflow-y-auto overscroll-contain rounded-2xl bg-surface p-1.5 shadow-[0_24px_60px_-20px_rgba(0,0,0,0.7)]"
          // stay inside the viewport: flip/shift is automatic; cap size to the space Radix reports
          style={{ width, maxWidth: "calc(100vw - 24px)", maxHeight: "var(--radix-dropdown-menu-content-available-height)" }}
        >
          {header && <div className="border-b border-line px-3 pb-3 pt-2">{header}</div>}
          {items.map((it, i) =>
            it === "sep" ? (
              <Dropdown.Separator key={i} className="my-1 h-px bg-line" />
            ) : (
              <Dropdown.Item
                key={i}
                onSelect={it.onSelect}
                asChild={!!it.href}
                className={cn(
                  "flex cursor-pointer items-center gap-2.5 rounded-xl px-3 py-2 text-[13.5px] outline-none data-[highlighted]:bg-surface-3 [&_svg]:size-4",
                  it.danger ? "text-down" : "text-fg-2 data-[highlighted]:text-fg",
                )}
              >
                {it.href ? (
                  <a href={it.href}>
                    {it.icon}
                    <span className="flex-1">{it.label}</span>
                    {it.hint && <span className="text-xs text-fg-3">{it.hint}</span>}
                  </a>
                ) : (
                  <>
                    {it.icon}
                    <span className="flex-1">{it.label}</span>
                    {it.hint && <span className="text-xs text-fg-3">{it.hint}</span>}
                  </>
                )}
              </Dropdown.Item>
            ),
          )}
        </Dropdown.Content>
      </Dropdown.Portal>
    </Dropdown.Root>
  );
}

/* ------------------------------------------------------------------ */
/* Tooltip & popover                                                   */
/* ------------------------------------------------------------------ */

export const TooltipProvider = TooltipPrimitive.Provider;

export function Tooltip({ content, children, side = "top" }: { content: React.ReactNode; children: React.ReactNode; side?: "top" | "right" | "bottom" | "left" }) {
  return (
    <TooltipPrimitive.Root delayDuration={120}>
      <TooltipPrimitive.Trigger asChild>{children}</TooltipPrimitive.Trigger>
      <TooltipPrimitive.Portal>
        <TooltipPrimitive.Content side={side} sideOffset={10} className="z-50 rounded-lg border border-line bg-surface-3 px-2.5 py-1.5 text-xs font-medium text-fg shadow-xl">
          {content}
        </TooltipPrimitive.Content>
      </TooltipPrimitive.Portal>
    </TooltipPrimitive.Root>
  );
}

export function Popover({ trigger, children, align = "end", width = 360 }: { trigger: React.ReactNode; children: React.ReactNode; align?: "start" | "end" | "center"; width?: number }) {
  return (
    <PopoverPrimitive.Root>
      <PopoverPrimitive.Trigger asChild>{trigger}</PopoverPrimitive.Trigger>
      <PopoverPrimitive.Portal>
        <PopoverPrimitive.Content
          align={align}
          sideOffset={10}
          collisionPadding={12}
          className="k-card z-50 overflow-y-auto overscroll-contain rounded-2xl bg-surface shadow-[0_24px_60px_-20px_rgba(0,0,0,0.7)] outline-none"
          style={{ width, maxWidth: "calc(100vw - 24px)", maxHeight: "var(--radix-popover-content-available-height)" }}
        >
          {children}
        </PopoverPrimitive.Content>
      </PopoverPrimitive.Portal>
    </PopoverPrimitive.Root>
  );
}
