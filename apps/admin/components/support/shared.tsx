"use client";

import * as React from "react";
import { Globe, Mail, MessageCircle, Smartphone, Sparkles, Timer, UserRound, AlertTriangle, CheckCheck } from "lucide-react";
import { Chip, cn } from "@kalks/ui";
import type { SupChannel, SupConvStatus } from "@kalks/mock/admin-growth-support";

export const CHANNEL_META: Record<SupChannel, { label: string; icon: React.ComponentType<{ className?: string }> }> = {
  web: { label: "Web chat", icon: Globe },
  app: { label: "Mobile app", icon: Smartphone },
  whatsapp: { label: "WhatsApp", icon: MessageCircle },
  email: { label: "Email", icon: Mail },
};

export function ChannelBadge({ channel, withLabel, className }: { channel: SupChannel; withLabel?: boolean; className?: string }) {
  const M = CHANNEL_META[channel];
  return (
    <span className={cn("inline-flex items-center gap-1 text-[11px] text-fg-3", className)} title={M.label}>
      <M.icon className={cn("size-3.5", channel === "whatsapp" && "text-up")} />
      {withLabel && M.label}
    </span>
  );
}

/** Ember→gold gradient sparkle used for everything the AI bot does. */
export function AiSpark({ size = 18, className }: { size?: number; className?: string }) {
  return (
    <span
      className={cn("grid shrink-0 place-items-center rounded-full bg-gradient-to-br from-[#ff8a3d] via-ember to-gold text-white shadow-[0_0_14px_-2px_rgba(255,90,31,0.7)]", className)}
      style={{ width: size, height: size }}
    >
      <Sparkles style={{ width: size * 0.58, height: size * 0.58 }} strokeWidth={2.2} />
    </span>
  );
}

export function ConvStatusChip({ status, size = "sm" }: { status: SupConvStatus; size?: "sm" | "md" }) {
  if (status === "ai")
    return (
      <Chip tone="gold" size={size} className="border-gold/30 bg-gradient-to-r from-ember-soft to-gold-soft">
        <Sparkles className="size-3 text-ember" />
        AI handling
      </Chip>
    );
  if (status === "needs_agent")
    return (
      <Chip tone="warn" size={size}>
        <AlertTriangle className="size-3" />
        Needs agent
      </Chip>
    );
  if (status === "agent")
    return (
      <Chip tone="info" size={size}>
        <UserRound className="size-3" />
        Agent
      </Chip>
    );
  return (
    <Chip tone="up" size={size}>
      <CheckCheck className="size-3" />
      Resolved
    </Chip>
  );
}

/** Live SLA countdown (mono). Red once breached, amber in the last 2 minutes. */
export function SlaCountdown({ seconds, className }: { seconds: number; className?: string }) {
  const [elapsed, setElapsed] = React.useState(0);
  React.useEffect(() => {
    const start = Date.now();
    const t = setInterval(() => setElapsed(Math.floor((Date.now() - start) / 1000)), 1000);
    return () => clearInterval(t);
  }, [seconds]);
  const left = seconds - elapsed;
  const breached = left < 0;
  const a = Math.abs(left);
  const text = `${breached ? "-" : ""}${String(Math.floor(a / 60)).padStart(2, "0")}:${String(a % 60).padStart(2, "0")}`;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-1.5 py-px font-mono text-[10.5px] k-num",
        breached ? "border-down/35 bg-down-soft text-down" : left < 120 ? "border-warn/30 bg-warn-soft text-warn" : "border-line bg-surface-2 text-fg-2",
        className,
      )}
    >
      <Timer className={cn("size-3", breached && "animate-pulse")} />
      {text}
    </span>
  );
}

/** Replace {{var}} tokens with values when known. */
export function fillVars(text: string, vars: Record<string, string>) {
  return text.replace(/\{\{\s*(\w+)\s*\}\}/g, (m, k: string) => vars[k] ?? m);
}

/** Render text with {{var}} tokens as inline chips. */
export function VarText({ text, className }: { text: string; className?: string }) {
  const parts = text.split(/(\{\{\s*\w+\s*\}\})/g);
  return (
    <span className={className}>
      {parts.map((p, i) =>
        /^\{\{/.test(p) ? (
          <span key={i} className="mx-0.5 inline-flex items-center rounded-md border border-ember/25 bg-ember-soft px-1.5 font-mono text-[11px] leading-[18px] text-ember">
            {p.replace(/[{}\s]/g, "")}
          </span>
        ) : (
          <React.Fragment key={i}>{p}</React.Fragment>
        ),
      )}
    </span>
  );
}

/** Close the currently open Radix popover/menu (they listen for Escape on document). */
export function closeFloating() {
  document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
}
