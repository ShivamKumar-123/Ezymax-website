// Trading actions on the active account. The engine is the source of truth: nothing is changed locally; the
// account stream brings the result (or a state reload when the stream is down). Every rejection comes back with
// a readable reason in the reader's language (order.reject.<code>) plus the engine's own detail.
import { getRandomBytes } from "expo-crypto";
import { i18n } from "@/i18n";
import { haptic } from "@/lib/haptics";
import { fmtMoney, fmtPrice } from "@/lib/format";
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
};

export type ActionResult = { ok: true; data: Record<string, unknown> } | { ok: false; error: EngineError; reason: string };

const cid = () => Array.from(getRandomBytes(12), (b) => b.toString(16).padStart(2, "0")).join("");

/** A rejection in words: the localized title for the engine code + the engine's detail sentence. */
export function rejectText(e: EngineError): { title: string; detail: string } {
  const t = i18n.t;
  const title = t.dyn(`order.reject.${e.code}`, e.message || e.code.replace(/_/g, " "));
  const detail = e.message && e.message !== title && !/^HTTP \d+$/.test(e.message) ? e.message : "";
  return { title, detail };
}

async function run(path: string, init: { method: "POST" | "PATCH" | "DELETE"; body?: unknown }): Promise<ActionResult> {
  const login = tradeStore.get().login;
  if (login === null) return { ok: false, error: { code: "unauthorized", message: "" }, reason: i18n.t("order.reject.unauthorized") };
  const r = await tradeApi<Record<string, unknown>>(login, path, init);
  if (!r.ok) {
    const e: EngineError = { ...r.error, status: r.status };
    const { title, detail } = rejectText(e);
    haptic.error();
    return { ok: false, error: e, reason: detail ? `${title} · ${detail}` : title };
  }
  if (!streamIsOpen()) void refreshState();
  return { ok: true, data: r.data };
}

export async function placeOrder(o: OrderInput): Promise<ActionResult> {
  const digits = instrument(o.symbol).digits;
  const round = (v: number | null | undefined) => (v === null || v === undefined || !Number.isFinite(v) ? undefined : +v.toFixed(digits));
  const body: Record<string, unknown> = { symbol: o.symbol, side: o.side, type: o.type, volume: +o.volume.toFixed(2), clientOrderId: cid() };
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
    const d = r.data as { status?: string; price?: number };
    haptic.success();
    if (d.status === "filled")
      toast.show({ title: t("mobileTrade.toast.filled", { side: t(o.side === "buy" ? "common.buy" : "common.sell"), volume: o.volume.toFixed(2), symbol: o.symbol }), body: t("mobileTrade.toast.at", { price: fmtPrice(Number(d.price), digits) }), tone: "success" });
    else toast.show({ title: t("mobileTrade.toast.placed", { symbol: o.symbol }), body: t("mobileTrade.toast.at", { price: fmtPrice(Number(o.price), digits) }), tone: "success" });
  }
  return r;
}

/** Full close (no volume) or partial close. */
export async function closePosition(ticket: number, volume?: number): Promise<ActionResult> {
  const r = await run(`positions/${ticket}/close`, { method: "POST", body: volume ? { volume: +volume.toFixed(2) } : {} });
  if (r.ok) {
    const profit = Number((r.data as { profit?: number }).profit ?? 0);
    haptic.success();
    const title = volume ? i18n.t("mobileTrade.toast.partial", { ticket, volume: volume.toFixed(2) }) : i18n.t("mobileTrade.toast.closed", { ticket });
    toast.show({ title, body: fmtMoney(profit, { signed: true }), tone: profit >= 0 ? "success" : "error" });
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
