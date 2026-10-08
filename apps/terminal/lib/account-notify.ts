"use client";

import * as React from "react";
import { toast as sonner } from "sonner";

/**
 * Account notifications for the title-bar bell: the client's inbox in the support service (deposits,
 * withdrawals, prop challenges and payouts, partner commissions, KYC, trading alerts, support replies), the
 * same one the Client Area bell shows. Read through /api/notifications as the owner of the acting login;
 * refreshed every 30 s while the tab is visible and at once when it becomes visible again.
 */

export type Severity = "info" | "success" | "warning" | "critical";
export interface AccountNote {
  id: number;
  type: string;
  category: string;
  severity: Severity;
  title: string;
  body: string;
  link: string | null;
  read: boolean;
  createdAt: string;
}

export type InboxStatus = "off" | "loading" | "ready" | "investor" | "error";
export interface Inbox {
  status: InboxStatus;
  items: AccountNote[];
  unread: number;
  next: string | null;
  more: boolean;
}

const POLL_MS = 30_000;
const PAGE = 30;
const OFF: Inbox = { status: "off", items: [], unread: 0, next: null, more: false };

let state: Inbox = OFF;
let login: string | null = null;
let gen = 0;
let seenMax = 0;
const listeners = new Set<() => void>();

function set(next: Partial<Inbox>) {
  state = { ...state, ...next };
  listeners.forEach((l) => l());
}

type Page = { items?: AccountNote[]; unread?: number; next?: string | number | null; error?: { code?: string; status?: number } };

async function call(method: "GET" | "POST", path: string, body?: unknown): Promise<Page | null> {
  if (!login) return null;
  const headers: Record<string, string> = { "x-ezymex-errors": "body", "x-ezymex-login": login };
  if (body !== undefined) headers["content-type"] = "application/json";
  try {
    const res = await fetch(path, { method, headers, body: body !== undefined ? JSON.stringify(body) : undefined, cache: "no-store", credentials: "same-origin", signal: AbortSignal.timeout(12_000) });
    return (await res.json().catch(() => ({ error: { code: "unavailable" } }))) as Page;
  } catch {
    return { error: { code: "unavailable" } };
  }
}

const clean = (list: unknown): AccountNote[] => (Array.isArray(list) ? list.filter((n): n is AccountNote => !!n && typeof n.id === "number" && typeof n.title === "string") : []);

/** Fresh unread items since the last look pop up once as a toast (not added to the terminal log). */
function announce(items: AccountNote[], first: boolean) {
  const max = items.reduce((m, n) => Math.max(m, n.id), 0);
  if (!first) {
    const fresh = items.filter((n) => n.id > seenMax && !n.read).slice(0, 3);
    for (const n of fresh.reverse()) {
      const show = n.severity === "success" ? sonner.success : n.severity === "warning" || n.severity === "critical" ? sonner.warning : sonner.info;
      show(n.title, { description: n.body || undefined, id: `acct:${n.id}` });
    }
  }
  seenMax = Math.max(seenMax, max);
}

async function refresh() {
  const my = gen;
  if (!login) return;
  const first = state.status !== "ready";
  const r = await call("GET", `/api/notifications?limit=${PAGE}`);
  if (my !== gen || !r) return;
  if (r.error) {
    if (r.error.code === "investor") set({ ...OFF, status: "investor" });
    else if (r.error.code === "no_session" || r.error.code === "session_expired") set({ ...OFF, status: "off" });
    else if (first) set({ status: "error" });
    return;
  }
  const items = clean(r.items);
  announce(items, first);
  // keep older pages the user already loaded
  const older = state.status === "ready" ? state.items.filter((n) => !items.some((x) => x.id === n.id) && n.id < (items[items.length - 1]?.id ?? 0)) : [];
  set({ status: "ready", items: [...items, ...older], unread: r.unread ?? 0, next: older.length ? state.next : r.next != null ? String(r.next) : null, more: older.length ? state.more : r.next != null });
}

export const accountInbox = {
  subscribe(l: () => void) {
    listeners.add(l);
    return () => void listeners.delete(l);
  },
  get: () => state,
  /** Point the inbox at the acting login (null = guest / demo build: nothing to show). */
  target(next: string | null) {
    if (next === login) return;
    login = next;
    gen++;
    seenMax = 0;
    set(next ? { ...OFF, status: "loading" } : OFF);
    if (next) void refresh();
  },
  refresh,
  async loadMore() {
    if (!state.more || !state.next) return;
    const my = gen;
    const r = await call("GET", `/api/notifications?limit=${PAGE}&before=${encodeURIComponent(state.next)}`);
    if (my !== gen || !r || r.error) return;
    const items = clean(r.items).filter((n) => !state.items.some((x) => x.id === n.id));
    set({ items: [...state.items, ...items], next: r.next != null ? String(r.next) : null, more: r.next != null });
  },
  async markRead(id: number) {
    const n = state.items.find((x) => x.id === id);
    if (!n || n.read) return;
    set({ items: state.items.map((x) => (x.id === id ? { ...x, read: true } : x)), unread: Math.max(0, state.unread - 1) });
    const r = await call("POST", "/api/notifications/read", { ids: [id] });
    if (r && !r.error && typeof r.unread === "number") set({ unread: r.unread });
  },
  async markAllRead() {
    if (!state.unread) return;
    set({ items: state.items.map((x) => (x.read ? x : { ...x, read: true })), unread: 0 });
    const r = await call("POST", "/api/notifications/read", { all: true });
    if (r && !r.error && typeof r.unread === "number") set({ unread: r.unread });
  },
};

export function useAccountInbox() {
  return React.useSyncExternalStore(accountInbox.subscribe, accountInbox.get, () => OFF);
}

// one poller however many bells are mounted (title bar + mobile shell)
let mounted = 0;
let timer: ReturnType<typeof setInterval> | null = null;
function onVisible() {
  if (document.visibilityState === "visible") void refresh();
}

/** Keeps the inbox in sync with the acting login while a bell is mounted. */
export function useAccountInboxSync(acting: string | null) {
  React.useEffect(() => {
    accountInbox.target(acting);
  }, [acting]);
  React.useEffect(() => {
    if (mounted++ === 0) {
      timer = setInterval(() => {
        if (document.visibilityState === "visible") void refresh();
      }, POLL_MS);
      document.addEventListener("visibilitychange", onVisible);
    }
    return () => {
      if (--mounted === 0) {
        if (timer) clearInterval(timer);
        timer = null;
        document.removeEventListener("visibilitychange", onVisible);
      }
    };
  }, []);
}
