"use client";

import * as React from "react";
import { AlertTriangle, CheckCheck, Sparkles, Timer, UserRound } from "lucide-react";
import { Chip, cn } from "@ezymex/ui";

/* Types of the support service's Back Office API (services/support, via /api/support). */

export type ConvStatus = "bot" | "waiting" | "assigned" | "resolved";
export type Conversation = {
  id: number;
  userId: number;
  userName: string;
  userEmail: string;
  subject: string;
  status: ConvStatus;
  priority: "normal" | "high";
  tags: string[];
  assigneeId: string | null;
  assigneeName: string | null;
  handoverReason: string | null;
  handedOverAt: string | null;
  firstResponseAt: string | null;
  slaDueAt: string | null;
  slaBreached: boolean;
  preview: string;
  staffUnread: number;
  botReplies: number;
  csat: { rating: number; comment: string | null; at: string } | null;
  resolvedAt: string | null;
  createdAt: string;
  lastMessageAt: string;
};
export type Attachment = { id: number; name: string; mime: string; size: number };
export type Message = {
  id: number;
  conversationId: number;
  author: "client" | "bot" | "agent" | "system" | "note";
  authorId: string | null;
  authorName: string | null;
  body: string;
  attachment: Attachment | null;
  meta: { kind?: string; reason?: string; cites?: { slug: string; title: string }[]; confidence?: number; engine?: string; agentName?: string; rating?: number; comment?: string };
  createdAt: string;
};
export type Perms = { id: string; name: string; perms: string[] };

export async function sapi<T>(path: string, init?: { method?: "GET" | "POST" | "PUT" | "DELETE"; body?: unknown }): Promise<{ ok: boolean; status: number; data: T }> {
  try {
    const r = await fetch(`/api/support/${path}`, {
      method: init?.method ?? (init?.body !== undefined ? "POST" : "GET"),
      headers: init?.body !== undefined ? { "content-type": "application/json" } : undefined,
      body: init?.body !== undefined ? JSON.stringify(init.body) : undefined,
      cache: "no-store",
    });
    return { ok: r.ok, status: r.status, data: (await r.json().catch(() => ({}))) as T };
  } catch {
    return { ok: false, status: 0, data: {} as T };
  }
}

export function errMsg(d: unknown, fallback = "Something went wrong. Please try again.") {
  return (d as { error?: { message?: string } })?.error?.message || fallback;
}

export function usePerms() {
  const [p, setP] = React.useState<Perms | null>(null);
  React.useEffect(() => {
    void sapi<Perms>("me").then((r) => r.ok && setP(r.data));
  }, []);
  return { me: p, can: (perm: string) => !!p?.perms.includes(perm), loaded: p !== null };
}

export function hhmm(iso: string) {
  return new Date(iso).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
}

export function ago(iso: string, now = Date.now()) {
  const s = Math.max(0, Math.round((now - new Date(iso).getTime()) / 1000));
  if (s < 45) return "now";
  if (s < 3600) return `${Math.round(s / 60)}m`;
  if (s < 86400) return `${Math.floor(s / 3600)}h`;
  return `${Math.floor(s / 86400)}d`;
}

export function dur(secs: number | null | undefined) {
  if (secs === null || secs === undefined || !Number.isFinite(secs)) return "–";
  const s = Math.round(secs);
  if (s < 60) return `${s}s`;
  if (s < 3600) return `${Math.floor(s / 60)}m ${String(s % 60).padStart(2, "0")}s`;
  return `${Math.floor(s / 3600)}h ${String(Math.floor((s % 3600) / 60)).padStart(2, "0")}m`;
}

export function ConvStatusChip({ status, size = "sm" }: { status: ConvStatus; size?: "sm" | "md" }) {
  if (status === "bot")
    return (
      <Chip tone="gold" size={size}>
        <Sparkles className="size-3" /> AI handling
      </Chip>
    );
  if (status === "waiting")
    return (
      <Chip tone="warn" size={size}>
        <AlertTriangle className="size-3" /> Needs agent
      </Chip>
    );
  if (status === "assigned")
    return (
      <Chip tone="info" size={size}>
        <UserRound className="size-3" /> Agent
      </Chip>
    );
  return (
    <Chip tone="up" size={size}>
      <CheckCheck className="size-3" /> Resolved
    </Chip>
  );
}

/** SLA countdown to `due` (mono). Red once breached, amber in the last 2 minutes. Ticks every second. */
export function SlaCountdown({ due, className }: { due: string; className?: string }) {
  const [now, setNow] = React.useState(() => Date.now());
  React.useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  const left = Math.round((new Date(due).getTime() - now) / 1000);
  const breached = left < 0;
  const a = Math.abs(left);
  const text = a >= 3600 ? `${breached ? "-" : ""}${Math.floor(a / 3600)}h${String(Math.floor((a % 3600) / 60)).padStart(2, "0")}` : `${breached ? "-" : ""}${String(Math.floor(a / 60)).padStart(2, "0")}:${String(a % 60).padStart(2, "0")}`;
  return (
    <span
      title="SLA: time left to reply"
      className={cn(
        "k-num inline-flex items-center gap-1 rounded-full border px-1.5 py-px font-mono text-[10.5px]",
        breached ? "border-down/35 bg-down-soft text-down" : left < 120 ? "border-warn/30 bg-warn-soft text-warn" : "border-line bg-surface-2 text-fg-2",
        className,
      )}
    >
      <Timer className="size-3" />
      {text}
    </span>
  );
}

/** Minimal safe markdown for bot answers: **bold**, "- " bullets, paragraphs. */
export function Rich({ text }: { text: string }) {
  return (
    <>
      {text.split(/\n{2,}/).map((b, bi) => {
        const lines = b.split("\n").filter((l) => l.trim());
        const inline = (s: string, k: string) => s.split("**").map((p, i) => (i % 2 ? <strong key={`${k}${i}`} className="font-semibold">{p}</strong> : <React.Fragment key={`${k}${i}`}>{p}</React.Fragment>));
        if (lines.length && lines.every((l) => /^\s*[-•]\s+/.test(l)))
          return (
            <ul key={bi} className={cn("list-disc space-y-0.5 pl-4", bi > 0 && "mt-2")}>
              {lines.map((l, li) => (
                <li key={li}>{inline(l.replace(/^\s*[-•]\s+/, ""), `${bi}-${li}-`)}</li>
              ))}
            </ul>
          );
        return (
          <p key={bi} className={cn("whitespace-pre-line", bi > 0 && "mt-2")}>
            {inline(b, `${bi}-`)}
          </p>
        );
      })}
    </>
  );
}

export function fillVars(text: string, vars: Record<string, string>) {
  return text.replace(/\{\{\s*(\w+)\s*\}\}/g, (m, k: string) => vars[k] ?? m);
}
