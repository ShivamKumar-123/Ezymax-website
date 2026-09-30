// Trading actions on the active account. The engine is the source of truth: nothing is changed locally; the
// account stream brings the result (or a state reload when the stream is down). Every rejection comes back with
// a readable reason in the reader's language (order.reject.<code>), a plain-language hint for the common ones
// (mobileTrade.reject.<code>) and the engine's own detail.
//
// Orders are idempotent: the ticket sends the same clientOrderId again when the reader retries after an answer
// that never arrived (network, timeout), so the engine can't open the same trade twice ("duplicate" = it already
// has that order).
import { getRandomBytes } from "expo-crypto";
import { i18n } from "@/i18n";
import { haptic } from "@/lib/haptics";
import { fmtLots, fmtMoney, fmtPrice } from "@/lib/format";
import { toast } from "@/ui/Toast";
import { instrument } from "@/market/instruments";
import { refreshState, streamIsOpen, tradeStore } from "./live";
import { tradeApi } from "./session";
import type { EngineError } from "./types";

export type OrderInput = {
  symbol: string;
  side: "buy" | "sell";
  type: "market" | "limit" | "stop";
  volume: number;
  price?: number;
  sl?: number | null;
  tp?: number | null;
  /** market: the price the client saw (requote beyond the deviation) */
  requestedPrice?: number;
  deviationPoints?: number;
  /** idempotency key; the same key again returns the order the engine already has (newClientOrderId()) */
  clientOrderId?: string;
};

export type ActionResult =
  | { ok: true; data: Record<string, unknown> }
  /** `reason` = title · detail in one line (toasts); `title` / `body` for a banner (body = hint + engine detail) */
  | { ok: false; error: EngineError; reason: string; title: string; body: string; uncertain: boolean };

export const newClientOrderId = () => Array.from(getRandomBytes(12), (b) => b.toString(16).padStart(2, "0")).join("");

/** No answer from the server: the request may or may not have been carried out. */
export const isUncertain = (e: EngineError) => e.code === "network" || e.code === "aborted" || e.code === "unavailable" || e.status === 0 || e.status === 502 || e.status === 504;

/** A rejection in words: the localized title for the engine code, a plain-language hint and the engine's detail. */
export function rejectText(e: EngineError): { title: string; detail: string; hint: string } {
  const t = i18n.t;
  if (isUncertain(e)) return { title: t("mobileTrade.reject.uncertain.title"), detail: "", hint: t("mobileTrade.reject.uncertain") };
  const title = e.code === "requote" ? t("mobileTrade.reject.requote.title") : t.dyn(`order.reject.${e.code}`, e.message || e.code.replace(/_/g, " "));
  const detail = e.message && e.message !== title && !/^HTTP \d+$/.test(e.message) ? e.message : "";
  const hint = t.dyn(`mobileTrade.reject.${e.code}`, "");
  return { title, detail, hint };
}

async function run(path: string, init: { method: "POST" | "PATCH" | "DELETE"; body?: unknown }): Promise<ActionResult> {
  const login = tradeStore.get().login;
  if (login === null) {
    const title = i18n.t("order.reject.unauthorized");
    return { ok: false, error: { code: "unauthorized", message: "" }, reason: title, title, body: "", uncertain: false };
  }
  const r = await tradeApi<Record<string, unknown>>(login, path, init);
  if (!r.ok) {
    const e: EngineError = { ...r.error, status: r.status };
    const { title, detail, hint } = rejectText(e);
    haptic.error();
    const uncertain = isUncertain(e);
    // after no answer, the stream may be the only one to know what happened: reload the account state
    if (uncertain) void refreshState();
    return { ok: false, error: e, reason: detail ? `${title} · ${detail}` : title, title, body: [hint, detail].filter(Boolean).join("\n"), uncertain };
  }
  if (!streamIsOpen()) void refreshState();
  return { ok: true, data: r.data };
}

export async function placeOrder(o: OrderInput): Promise<ActionResult> {
  const digits = instrument(o.symbol).digits;
  const round = (v: number | null | undefined) => (v === null || v === undefined || !Number.isFinite(v) ? undefined : +v.toFixed(digits));
  const body: Record<string, unknown> = { symbol: o.symbol, side: o.side, type: o.type, volume: +o.volume.toFixed(2), clientOrderId: o.clientOrderId ?? newClientOrderId() };
  const sl = round(o.sl);
  const tp = round(o.tp);
  if (sl !== undefined) body.sl = sl;
  if (tp !== undefined) body.tp = tp;
  if (o.type !== "market") {
    body.price = round(o.price);
    body.expiry = "GTC";
  } else if (o.requestedPrice && o.deviationPoints) {
    body.requestedPrice = round(o.requestedPrice);
    body.deviationPoints = o.deviationPoints;
  }
  const r = await run("orders", { method: "POST", body });
  if (r.ok) {
    const t = i18n.t;
    const d = r.data as { status?: string; price?: number; ticket?: number };
    haptic.success();
    if (d.status === "filled")
      toast.show({ title: t("mobileTrade.toast.filled", { side: t(o.side === "buy" ? "common.buy" : "common.sell"), volume: o.volume.toFixed(2), symbol: o.symbol }), body: t("mobileTrade.toast.at", { price: fmtPrice(Number(d.price), digits) }), tone: "success" });
    else if (d.status === "duplicate") toast.show({ title: t("mobileTrade.toast.duplicate", { ticket: d.ticket ?? "" }), body: t("mobileTrade.toast.duplicateBody"), tone: "success" });
    else toast.show({ title: t("mobileTrade.toast.placed", { symbol: o.symbol }), body: t("mobileTrade.toast.at", { price: fmtPrice(Number(d.price ?? o.price), digits) }), tone: "success" });
  }
  return r;
}

/** Full close (no volume) or partial close. A close that went through is a success whatever its result (the toast's
 *  "done" accent); the result itself is the body. */
export async function closePosition(ticket: number, volume?: number): Promise<ActionResult> {
  const r = await run(`positions/${ticket}/close`, { method: "POST", body: volume ? { volume: +volume.toFixed(2) } : {} });
  if (r.ok) {
    const profit = Number((r.data as { profit?: number }).profit ?? 0);
    haptic.success();
    const title = volume ? i18n.t("mobileTrade.toast.partial", { ticket, volume: volume.toFixed(2) }) : i18n.t("mobileTrade.toast.closed", { ticket });
    toast.show({ title, body: fmtMoney(profit, { signed: true, currency: tradeStore.get().account?.currency }), tone: "success" });
  }
  return r;
}

/**
 * Close By (hedging accounts): closes `ticket` against the opposite position `by` on the same symbol. The engine
 * closes the overlapping volume of both at the open price of `by`, so no spread is paid on it.
 */
export async function closeBy(ticket: number, by: number): Promise<ActionResult> {
  const s = tradeStore.get();
  const a = s.positions.find((p) => p.ticket === ticket);
  const b = s.positions.find((p) => p.ticket === by);
  const r = await run("positions/close-by", { method: "POST", body: { ticket, by } });
  if (r.ok) {
    haptic.success();
    const t = i18n.t;
    const body = a ? t("order.toast.closedByDesc", { volume: fmtLots(Math.min(a.volume, b?.volume ?? a.volume)), symbol: a.symbol }) : undefined;
    toast.show({ title: t("order.toast.closedBy", { a: ticket, b: by }), body, tone: "success" });
  }
  return r;
}

export async function modifyPosition(ticket: number, sl: number | null, tp: number | null): Promise<ActionResult> {
  const r = await run(`positions/${ticket}`, { method: "PATCH", body: { sl, tp } });
  if (r.ok) {
    haptic.success();
    toast.show({ title: i18n.t("mobileTrade.toast.modified", { ticket }), tone: "success" });
  }
  return r;
}

export async function modifyOrder(ticket: number, change: { price?: number; sl?: number | null; tp?: number | null }): Promise<ActionResult> {
  const r = await run(`orders/${ticket}`, { method: "PATCH", body: change });
  if (r.ok) {
    haptic.success();
    toast.show({ title: i18n.t("mobileTrade.toast.modified", { ticket }), tone: "success" });
  }
  return r;
}

export async function cancelOrder(ticket: number): Promise<ActionResult> {
  const r = await run(`orders/${ticket}`, { method: "DELETE" });
  if (r.ok) {
    haptic.success();
    toast.show({ title: i18n.t("mobileTrade.toast.cancelled", { ticket }) });
  }
  return r;
}
