"use client";

import * as React from "react";
import { tradePips } from "./share-stats";
import { type PendingOrder, type TClosed, type TPosition, type TradeSource } from "./trading";

/* ------------------------------------------------------------------ */
/* Snapshot rows (same shape the gateway validates)                    */
/* ------------------------------------------------------------------ */

export type ShareStatus = "open" | "closed" | "pending" | "cancelled";

export interface ShareTrade {
  ticket: string;
  order?: string;
  symbol: string;
  side: "buy" | "sell";
  volume: number;
  openPrice: number;
  openTime: string;
  sl?: number;
  tp?: number;
  closePrice?: number;
  closeTime?: string;
  profit?: number;
  pips?: number;
  status: ShareStatus;
  source: TradeSource;
  orderType?: "market" | "limit" | "stop" | "stop-limit";
  reason?: string;
}

/** Public payload of GET /v1/public/shares/:code. */
export interface PublicShare {
  code: string;
  title: string;
  alias: string;
  account: string | null;
  broker: string;
  show_amounts: boolean;
  views: number;
  created_at: string;
  updated_at: string;
  expires_at: string | null;
  trades: ShareTrade[];
}

export const MAX_SHARE_TRADES = 100;

const pipsOf = tradePips;

const r2 = (v: number) => Math.round(v * 100) / 100;
const iso = (s: string) => new Date(s).toISOString();

export function closedRow(h: TClosed): ShareTrade {
  return {
    ticket: h.ticket,
    symbol: h.symbol,
    side: h.side,
    volume: h.volume,
    openPrice: h.openPrice,
    openTime: iso(h.openTime),
    sl: h.sl,
    tp: h.tp,
    closePrice: h.closePrice,
    closeTime: iso(h.closeTime),
    profit: r2(h.profit),
    pips: r2(pipsOf(h, h.closePrice)),
    status: "closed",
    source: h.source,
    reason: h.reason && /^[\w -]{1,20}$/.test(h.reason) ? h.reason : undefined,
  };
}

/** Open rows carry no P&L: viewers compute it live from the feed, so the snapshot only changes on real events. */
export function openRow(p: TPosition, order?: string): ShareTrade {
  return { ticket: p.ticket, order, symbol: p.symbol, side: p.side, volume: p.volume, openPrice: p.openPrice, openTime: iso(p.openTime), sl: p.sl, tp: p.tp, status: "open", source: p.source, orderType: "market" };
}

export function pendingRow(o: PendingOrder): ShareTrade {
  return { ticket: o.ticket, symbol: o.symbol, side: o.side, volume: o.volume, openPrice: o.price, openTime: iso(o.placed), sl: o.sl, tp: o.tp, status: "pending", source: o.source, orderType: o.type };
}

export interface TradeBook {
  positions: TPosition[];
  pendings: PendingOrder[];
  history: TClosed[];
}

/** Current rows for a set of shared tickets (open remainder + closed parts + pending orders). */
export function buildSnapshot(tickets: string[], book: TradeBook, prev: ShareTrade[] = [], fills: Record<string, string> = {}): { rows: ShareTrade[]; fills: Record<string, string> } {
  const want = new Set(tickets);
  const nextFills = { ...fills };
  const claimed = new Set(Object.values(nextFills));
  const rows: ShareTrade[] = [];
  const orderOf = (ticket: string) => Object.keys(nextFills).find((o) => nextFills[o] === ticket);

  // a shared pending order that disappeared: find the position it filled into, else it was cancelled
  for (const t of tickets) {
    const was = prev.find((r) => r.ticket === t && r.status === "pending");
    if (!was || nextFills[t] || book.pendings.some((o) => o.ticket === t)) continue;
    const fill = book.positions.find(
      (p) => !claimed.has(p.ticket) && !want.has(p.ticket) && p.symbol === was.symbol && p.side === was.side && Math.abs(p.volume - was.volume) < 1e-9 && Date.parse(p.openTime) >= Date.parse(was.openTime),
    );
    if (fill) {
      nextFills[t] = fill.ticket;
      claimed.add(fill.ticket);
    }
  }
  const live = new Set([...want, ...Object.values(nextFills)]);

  for (const p of book.positions) if (live.has(p.ticket)) rows.push(openRow(p, orderOf(p.ticket)));
  for (const o of book.pendings) if (want.has(o.ticket)) rows.push(pendingRow(o));
  for (const h of book.history) if (live.has(h.ticket)) rows.push({ ...closedRow(h), order: orderOf(h.ticket) });

  // rows we can no longer see locally keep their last known state (a vanished pending order = cancelled)
  for (const r of prev) {
    const present = rows.some((x) => x.ticket === r.ticket || (r.status === "pending" && nextFills[r.ticket]));
    if (present) continue;
    if (r.status === "pending") rows.push({ ...r, status: "cancelled", closeTime: new Date().toISOString() });
    else rows.push(r);
  }
  for (const r of rows) {
    if (r.order === undefined) delete r.order;
    for (const k of ["sl", "tp", "closePrice", "closeTime", "profit", "pips", "reason", "orderType"] as const) if (r[k] === undefined) delete r[k];
  }
  // newest first, capped
  rows.sort((a, b) => Date.parse(b.closeTime ?? b.openTime) - Date.parse(a.closeTime ?? a.openTime));
  return { rows: rows.slice(0, MAX_SHARE_TRADES), fills: nextFills };
}

export const snapshotSig = (rows: ShareTrade[]) => JSON.stringify(rows);

/* ------------------------------------------------------------------ */
/* Locally held links (code + manage key) per account                  */
/* ------------------------------------------------------------------ */

export interface ShareLink {
  code: string;
  key: string;
  login: string;
  title: string;
  createdAt: string;
  expiresAt: string | null;
  showAmounts: boolean;
  tickets: string[];
  fills: Record<string, string>;
  last: ShareTrade[];
  sig: string;
  views?: number;
  status?: "active" | "revoked" | "expired";
}

const LINKS_KEY = "kalks.terminal.shares";
let links: ShareLink[] | null = null;
const listeners = new Set<() => void>();

function load(): ShareLink[] {
  if (links) return links;
  try {
    const raw = localStorage.getItem(LINKS_KEY);
    links = raw ? (JSON.parse(raw) as ShareLink[]).filter((l) => l && typeof l.code === "string" && typeof l.key === "string") : [];
  } catch {
    links = [];
  }
  return links;
}

function save(next: ShareLink[]) {
  links = next;
  try {
    localStorage.setItem(LINKS_KEY, JSON.stringify(next));
  } catch {
    /* storage blocked: links live for this session only */
  }
  listeners.forEach((l) => l());
}

export const shareLinks = {
  all: () => load(),
  add: (l: ShareLink) => save([l, ...load().filter((x) => x.code !== l.code)]),
  patch: (code: string, p: Partial<ShareLink>) => save(load().map((l) => (l.code === code ? { ...l, ...p } : l))),
  remove: (code: string) => save(load().filter((l) => l.code !== code)),
  subscribe: (fn: () => void) => {
    listeners.add(fn);
    return () => void listeners.delete(fn);
  },
};

const EMPTY: ShareLink[] = [];
export function useShareLinks(login: string): ShareLink[] {
  const all = React.useSyncExternalStore(shareLinks.subscribe, () => load(), () => EMPTY);
  return React.useMemo(() => all.filter((l) => l.login === login), [all, login]);
}

export const shareUrl = (code: string) => `${typeof window !== "undefined" ? window.location.origin : ""}/share/${code}`;

/* ------------------------------------------------------------------ */
/* Selection + dialog state shared by the Trade and History tabs       */
/* ------------------------------------------------------------------ */

interface ShareUi {
  selecting: boolean;
  selected: string[];
  dialog: null | "create" | "links";
}
let ui: ShareUi = { selecting: false, selected: [], dialog: null };
const uiListeners = new Set<() => void>();
export const shareUi = {
  get: () => ui,
  set: (p: Partial<ShareUi>) => {
    ui = { ...ui, ...p };
    uiListeners.forEach((l) => l());
  },
  toggle: (ticket: string) => shareUi.set({ selected: ui.selected.includes(ticket) ? ui.selected.filter((t) => t !== ticket) : [...ui.selected, ticket] }),
  shareOne: (ticket: string) => shareUi.set({ selected: [ticket], dialog: "create" }),
  subscribe: (fn: () => void) => {
    uiListeners.add(fn);
    return () => void uiListeners.delete(fn);
  },
};
const UI0 = ui;
export function useShareUi() {
  return React.useSyncExternalStore(shareUi.subscribe, shareUi.get, () => UI0);
}

/* ------------------------------------------------------------------ */
/* API (same-origin route handlers -> gateway)                          */
/* ------------------------------------------------------------------ */

type ApiErr = { error?: { code?: string; message?: string; field?: string } };

async function call<T>(path: string, init: RequestInit & { key?: string } = {}): Promise<{ ok: boolean; status: number; data: T & ApiErr }> {
  const headers: Record<string, string> = { "content-type": "application/json" };
  if (init.key) headers["x-share-key"] = init.key;
  try {
    const res = await fetch(path, { ...init, headers, cache: "no-store" });
    const data = (await res.json().catch(() => ({}))) as T & ApiErr;
    return { ok: res.ok, status: res.status, data };
  } catch {
    return { ok: false, status: 0, data: { error: { message: "Network error. Check your connection." } } as T & ApiErr };
  }
}

export const shareApi = {
  create: (body: { login: string; title: string; accountLabel?: string; showAmounts: boolean; expiresInHours: number | null; trades: ShareTrade[] }) =>
    call<{ code: string; key: string; created_at: string; expires_at: string | null }>("/api/shares", { method: "POST", body: JSON.stringify(body) }),
  update: (code: string, key: string, trades: ShareTrade[]) => call<{ status: string }>(`/api/shares/${code}/trades`, { method: "PATCH", key, body: JSON.stringify({ trades }) }),
  revoke: (code: string, key: string) => call<{ status: string }>(`/api/shares/${code}/revoke`, { method: "POST", key }),
  lookup: (items: { code: string; key: string }[]) =>
    call<{ items: { code: string; title: string; views: number; revoked: boolean; expired: boolean; trades: number; expires_at: string | null }[] }>("/api/shares/lookup", {
      method: "POST",
      body: JSON.stringify({ items }),
    }),
};

/* ------------------------------------------------------------------ */
/* Sync: keep live links in step with the terminal                      */
/* ------------------------------------------------------------------ */

/**
 * When a shared trade changes (SL/TP moved, partially or fully closed, pending filled or cancelled) the snapshot is
 * PATCHed so viewers see it. Debounced; only links whose rows really changed are sent.
 */
export function useShareSync(login: string, book: TradeBook) {
  const mine = useShareLinks(login);
  const bookRef = React.useRef(book);
  bookRef.current = book;
  const inflight = React.useRef(new Set<string>());
  React.useEffect(() => {
    const active = mine.filter((l) => (l.status ?? "active") === "active" && (!l.expiresAt || Date.parse(l.expiresAt) > Date.now()));
    if (!active.length) return;
    const t = setTimeout(() => {
      for (const l of active) {
        const { rows, fills } = buildSnapshot(l.tickets, bookRef.current, l.last, l.fills);
        const sig = snapshotSig(rows);
        if (sig === l.sig || !rows.length || inflight.current.has(l.code)) continue;
        inflight.current.add(l.code);
        void shareApi.update(l.code, l.key, rows).then((r) => {
          inflight.current.delete(l.code);
          if (r.ok) shareLinks.patch(l.code, { last: rows, sig, fills });
          else if (r.status === 404) shareLinks.patch(l.code, { status: "revoked" });
        });
      }
    }, 700);
    return () => clearTimeout(t);
  }, [mine, book.positions, book.pendings, book.history]);
}
