"use client";

// Trading actions against the engine (live builds). The engine is the source of truth: nothing here edits
// positions or orders locally; the account stream (or a state reload when the stream is down) brings the
// result in. Each action writes MT5-style journal lines and a toast; rejections carry the engine's reason.
import { toast } from "@/lib/notify";
import { priceFeed } from "@kalks/mock";
import { PENDING_LABEL, accCcy, accMoney, fmtPrice, fmtVol, pointSize, roundPrice, type PendingOrder, type TPosition } from "../trading";
import type { JournalLine, OrderRequest } from "../store";
import { engineApi, type OrderBody, type Result } from "./client";
import { rejectReason, type EngineErr, type EngineTradingAccount } from "./map";

export interface EngineDeps {
  login: () => string;
  account: () => EngineTradingAccount | undefined;
  positions: () => TPosition[];
  pendings: () => PendingOrder[];
  log: (src: JournalLine["src"], text: string, level?: JournalLine["level"]) => void;
  sound: (kind: "fill" | "close" | "alert" | "error") => void;
  /** the stream isn't delivering: reload the account state after a write */
  refreshIfStale: () => void;
  expired: (login: string) => void;
}

export type PlaceResult = { ok: boolean; ticket?: string };

const cid = () => (typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`);

export function engineActions(d: EngineDeps) {
  const money = (v: number) => {
    const a = d.account();
    return a ? `${accMoney(a, v, { signed: true })} ${accCcy(a)}` : v.toFixed(2);
  };

  /** Journal + toast + sound for a rejected request. */
  const fail = (login: string, desc: string, e: EngineErr, quiet = false) => {
    const reason = rejectReason(e);
    const extra = e.code === "requote" && e.bid !== undefined ? ` (bid ${e.bid}, ask ${e.ask})` : "";
    d.log("Trade", `'${login}': ${desc} failed [${reason}]${extra}`, "error");
    if (e.code === "session_expired") return d.expired(login);
    if (quiet) return;
    // the engine's own sentence adds the detail ("Stop loss must be below 83235.95")
    const detail = e.message && e.message !== reason && !/^HTTP \d+$/.test(e.message) ? e.message : "";
    toast.error(reason, { description: [desc, detail].filter(Boolean).join(" · ") + extra });
    d.sound("error");
  };

  async function run<T>(login: string, desc: string, p: Promise<Result<T>>, quiet = false): Promise<T | null> {
    const r = await p;
    if (!r.ok) {
      fail(login, desc, r.err, quiet);
      return null;
    }
    d.refreshIfStale();
    return r.data;
  }

  const orderDesc = (o: OrderRequest) =>
    o.type === "market"
      ? `market ${o.side} ${fmtVol(o.volume)} ${o.symbol}${o.sl ? ` sl: ${fmtPrice(o.symbol, o.sl)}` : ""}${o.tp ? ` tp: ${fmtPrice(o.symbol, o.tp)}` : ""}`
      : `${PENDING_LABEL({ side: o.side, type: o.type as PendingOrder["type"] })} ${fmtVol(o.volume)} ${o.symbol} at ${fmtPrice(o.symbol, o.price ?? 0)}${o.sl ? ` sl: ${fmtPrice(o.symbol, o.sl)}` : ""}${o.tp ? ` tp: ${fmtPrice(o.symbol, o.tp)}` : ""}`;

  const toBody = (o: OrderRequest, extra: Partial<OrderBody> = {}): OrderBody => {
    const pending = o.type !== "market";
    const r = (v: number | undefined) => (v === undefined || !Number.isFinite(v) ? undefined : roundPrice(o.symbol, v));
    const b: OrderBody = {
      symbol: o.symbol,
      side: o.side,
      type: o.type === "stop-limit" ? "stop_limit" : o.type,
      volume: +o.volume.toFixed(2),
      sl: r(o.sl),
      tp: r(o.tp),
      trailingPoints: o.trailing ? Math.max(1, Math.round(o.trailing / pointSize(o.symbol))) : undefined,
      comment: o.comment?.slice(0, 31),
      source: o.source === "ai" ? "ai" : "manual",
      clientOrderId: cid(),
      ...extra,
    };
    if (pending) {
      b.price = r(o.price);
      if (o.type === "stop-limit") b.stopLimit = r(o.stopLimit ?? o.price);
      b.expiry = o.expiry === "Date" && o.expiryDate ? o.expiryDate : (o.expiry ?? "GTC");
    }
    return b;
  };

  async function placeOrder(o: OrderRequest): Promise<PlaceResult> {
    const login = d.login();
    const vol = +o.volume.toFixed(2);
    const desc = orderDesc({ ...o, volume: vol });
    if (!(vol >= 0.01)) {
      fail(login, desc, { status: 422, code: "invalid_volume", message: "" });
      return { ok: false };
    }
    if (o.type !== "market" && !(o.price && o.price > 0)) {
      fail(login, desc, { status: 422, code: "invalid_price", message: "Enter a price for the pending order." });
      return { ok: false };
    }
    d.log("Trade", `'${login}': ${desc}${o.source === "ai" ? " [AI Trader]" : ""}`);
    const res = await run(login, desc, engineApi.placeOrder(login, toBody({ ...o, volume: vol })));
    if (!res) return { ok: false };
    if (res.status === "filled") {
      const deal = res.deals?.[0];
      d.log("Trade", `'${login}': ${deal ? `deal #${deal} ` : ""}${o.side} ${fmtVol(vol)} ${o.symbol} at ${fmtPrice(o.symbol, res.price)} done (based on order #${res.orderTicket})${res.delayMs ? `, execution ${res.delayMs} ms` : ""}`);
      toast.success(`${o.source === "ai" ? "AI Trader · " : ""}${o.side === "buy" ? "Buy" : "Sell"} ${fmtVol(vol)} ${o.symbol} filled`, { description: `#${res.positionTicket} at ${fmtPrice(o.symbol, res.price)} · ${d.account()?.mode ?? ""}` });
      d.sound("fill");
      return { ok: true, ticket: String(res.positionTicket) };
    }
    if (res.status === "duplicate") return { ok: true, ticket: String(res.ticket) };
    // pending order placed
    const label = PENDING_LABEL({ side: o.side, type: o.type as PendingOrder["type"] });
    d.log("Trade", `'${login}': accepted ${label} ${fmtVol(vol)} ${o.symbol} at ${fmtPrice(o.symbol, res.price)} #${res.ticket}`);
    let twin = "";
    if (o.ocoPrice !== undefined && o.type !== "market") {
      const twinSide = o.side === "buy" ? "sell" : "buy";
      const t: OrderRequest = { ...o, side: twinSide, price: o.ocoPrice, sl: undefined, tp: undefined, stopLimit: undefined, trailing: undefined, ocoPrice: undefined };
      const tdesc = `OCO ${orderDesc({ ...t, volume: vol })}`;
      const tr = await run(login, tdesc, engineApi.placeOrder(login, toBody({ ...t, volume: vol }, { ocoWith: Number(res.ticket) })));
      if (tr && tr.status === "placed") {
        d.log("Trade", `'${login}': accepted ${PENDING_LABEL({ side: twinSide, type: o.type as PendingOrder["type"] })} ${fmtVol(vol)} ${o.symbol} at ${fmtPrice(o.symbol, tr.price)} #${tr.ticket} [OCO with #${res.ticket}]`);
        twin = ` + OCO ${twinSide} at ${fmtPrice(o.symbol, tr.price)}`;
      }
    }
    if (o.source !== "ai") toast.success(`${label.replace(/^\w/, (x) => x.toUpperCase())} placed`, { description: `#${res.ticket} · ${fmtVol(vol)} ${o.symbol} at ${fmtPrice(o.symbol, res.price)}${twin} · ${o.expiry === "Date" ? o.expiryDate : (o.expiry ?? "GTC")}` });
    d.sound("fill");
    return { ok: true, ticket: String(res.ticket) };
  }

  async function closePosition(ticket: string, volume?: number, reason = "manual", quiet = false): Promise<boolean> {
    const login = d.login();
    const p = d.positions().find((x) => x.ticket === ticket);
    const vol = volume !== undefined && p ? Math.min(p.volume, +volume.toFixed(2)) : undefined;
    const partial = p && vol !== undefined && vol < p.volume - 1e-9;
    const desc = p ? `close #${ticket} ${p.side} ${fmtVol(vol ?? p.volume)} ${p.symbol}${partial ? ` (partial of ${fmtVol(p.volume)})` : ""}` : `close #${ticket}`;
    const res = await run(login, desc, engineApi.closePosition(login, ticket, partial ? { volume: vol } : {}), quiet);
    if (!res) return false;
    const q = p ? priceFeed().snapshot(p.symbol) : undefined;
    d.log("Trade", `'${login}': ${reason !== "manual" ? `${reason}: ` : ""}deal #${res.dealId} ${p ? `${p.side === "buy" ? "sell" : "buy"} ${fmtVol(vol ?? p.volume)} ${p.symbol} ` : ""}done (close #${ticket}${partial ? `, partial ${fmtVol(vol!)} of ${fmtVol(p!.volume)}` : ""}), profit ${money(d.account()?.cent ? res.profit / 100 : res.profit)}`);
    if (!quiet) {
      const profit = d.account()?.cent ? res.profit / 100 : res.profit;
      (profit >= 0 ? toast.success : toast.error)(`Closed #${ticket}${partial ? ` (partial ${fmtVol(vol!)})` : ""}`, {
        description: p ? `${p.side.toUpperCase()} ${fmtVol(vol ?? p.volume)} ${p.symbol}${q ? ` at ~${fmtPrice(p.symbol, p.side === "buy" ? q.bid : q.ask)}` : ""} · ${money(profit)}` : money(profit),
      });
      d.sound("close");
    }
    return true;
  }

  async function modifyPosition(ticket: string, patch: { sl?: number | null; tp?: number | null; trailing?: number | null }): Promise<boolean> {
    const login = d.login();
    const p = d.positions().find((x) => x.ticket === ticket);
    if (!p) return false;
    const r = (v: number | null | undefined) => (v === undefined ? undefined : v === null ? null : roundPrice(p.symbol, v));
    const body: { sl?: number | null; tp?: number | null; trailingPoints?: number | null } = {};
    if (patch.sl !== undefined) body.sl = r(patch.sl);
    if (patch.tp !== undefined) body.tp = r(patch.tp);
    if (patch.trailing !== undefined) body.trailingPoints = patch.trailing === null || patch.trailing <= 0 ? null : Math.max(1, Math.round(patch.trailing / pointSize(p.symbol)));
    const sl = body.sl === undefined ? p.sl : (body.sl ?? undefined);
    const tp = body.tp === undefined ? p.tp : (body.tp ?? undefined);
    const desc = `modify #${ticket} ${p.side} ${fmtVol(p.volume)} ${p.symbol} sl: ${sl ? fmtPrice(p.symbol, sl) : "0"}, tp: ${tp ? fmtPrice(p.symbol, tp) : "0"}${body.trailingPoints ? `, trailing ${body.trailingPoints} pts` : ""}`;
    const res = await run(login, desc, engineApi.modifyPosition(login, ticket, body));
    if (!res) return false;
    d.log("Trade", `'${login}': ${desc} done`);
    toast.success(`Position #${ticket} modified`, { description: `S/L ${sl ? fmtPrice(p.symbol, sl) : "—"} · T/P ${tp ? fmtPrice(p.symbol, tp) : "—"}${body.trailingPoints ? ` · trailing ${body.trailingPoints} pts` : ""}` });
    return true;
  }

  async function closeBy(a: string, b: string) {
    const login = d.login();
    const pa = d.positions().find((x) => x.ticket === a);
    const pb = d.positions().find((x) => x.ticket === b);
    const desc = pa && pb ? `close position #${a} ${pa.side} ${fmtVol(pa.volume)} ${pa.symbol} by position #${b} ${pb.side} ${fmtVol(pb.volume)} ${pb.symbol}` : `close #${a} by #${b}`;
    const res = await run(login, desc, engineApi.closeBy(login, a, b));
    if (!res) return;
    d.log("Trade", `'${login}': ${desc} done (deals ${res.deals.map((x) => `#${x}`).join(", ")})`);
    toast.success(`Closed #${a} by #${b}`, { description: pa ? `${fmtVol(Math.min(pa.volume, pb?.volume ?? pa.volume))} ${pa.symbol} · spread saved` : undefined });
    d.sound("close");
  }

  async function cancelPending(ticket: string, quiet = false): Promise<boolean> {
    const login = d.login();
    const o = d.pendings().find((x) => x.ticket === ticket);
    const desc = o ? `cancel order #${ticket} ${PENDING_LABEL(o)} ${fmtVol(o.volume)} ${o.symbol} at ${fmtPrice(o.symbol, o.price)}` : `cancel order #${ticket}`;
    const res = await run(login, desc, engineApi.cancelOrder(login, ticket), quiet);
    if (!res) return false;
    d.log("Trade", `'${login}': ${desc} done`);
    if (!quiet) toast(`Order #${ticket} cancelled`, { description: o ? `${PENDING_LABEL(o)} ${fmtVol(o.volume)} ${o.symbol}` : undefined });
    return true;
  }

  async function modifyPending(ticket: string, patch: { price?: number; sl?: number | null; tp?: number | null }): Promise<boolean> {
    const login = d.login();
    const o = d.pendings().find((x) => x.ticket === ticket);
    if (!o) return false;
    const r = (v: number | null | undefined) => (v === undefined ? undefined : v === null ? null : roundPrice(o.symbol, v));
    const body: Record<string, unknown> = {};
    if (patch.price !== undefined && Number.isFinite(patch.price)) body.price = r(patch.price);
    if (patch.sl !== undefined) body.sl = r(patch.sl);
    if (patch.tp !== undefined) body.tp = r(patch.tp);
    const price = (body.price as number | undefined) ?? o.price;
    const desc = `modify order #${ticket} ${PENDING_LABEL(o)} ${fmtVol(o.volume)} ${o.symbol} at ${fmtPrice(o.symbol, price)}`;
    const res = await run(login, desc, engineApi.modifyOrder(login, ticket, body));
    if (!res) return false;
    d.log("Trade", `'${login}': ${desc} done`);
    toast.success(`Order #${ticket} modified`, { description: `${PENDING_LABEL(o)} at ${fmtPrice(o.symbol, price)}` });
    return true;
  }

  async function bulkClose(kind: "all" | "profit" | "loss" | "symbol" | "buys" | "sells", symbol?: string) {
    const login = d.login();
    const filter = kind === "profit" ? "profitable" : kind === "loss" ? "losing" : kind === "symbol" ? "all" : kind;
    const scope = `${kind}${symbol ? ` ${symbol}` : ""}`;
    const n = d.positions().filter((p) => (kind !== "symbol" || p.symbol === symbol) && (kind !== "buys" || p.side === "buy") && (kind !== "sells" || p.side === "sell")).length;
    if (!n) return void toast("Nothing to close", { description: "No positions match that filter." });
    const res = await run(login, `bulk close (${scope})`, engineApi.bulkClose(login, filter, kind === "symbol" ? symbol : undefined));
    if (!res) return;
    const profit = d.account()?.cent ? res.profit / 100 : res.profit;
    const reasons = res.failed.map((f) => (typeof f.error === "string" ? f.error : rejectReason({ status: 422, code: f.error.code, message: f.error.message })));
    d.log("Trade", `'${login}': bulk close (${scope}): ${res.done.length} positions closed, profit ${money(profit)}${res.failed.length ? `, ${res.failed.length} failed` : ""}`);
    res.failed.forEach((f, i) => d.log("Trade", `'${login}': close #${f.ticket} failed [${reasons[i]}]`, "error"));
    if (!res.done.length && res.failed.length) {
      toast.error(reasons[0] ?? "Close failed", { description: `${res.failed.length} position${res.failed.length > 1 ? "s" : ""} could not be closed` });
      return void d.sound("error");
    }
    if (!res.done.length) return void toast("Nothing to close", { description: "No positions match that filter." });
    (profit >= 0 ? toast.success : toast.error)(`Closed ${res.done.length} position${res.done.length > 1 ? "s" : ""}`, {
      description: `Realised ${money(profit)}${res.failed.length ? ` · ${res.failed.length} not closed (${[...new Set(reasons)].join(", ")})` : ""}`,
    });
    d.sound("close");
  }

  async function cancelAllPendings() {
    const login = d.login();
    const n = d.pendings().length;
    if (!n) return void toast("No pending orders");
    const res = await run(login, "cancel all pending orders", engineApi.bulkClose(login, "pending"));
    if (!res) return;
    d.log("Trade", `'${login}': ${res.done.length} pending orders cancelled${res.failed.length ? `, ${res.failed.length} failed` : ""}`);
    toast(`Cancelled ${res.done.length} pending order${res.done.length === 1 ? "" : "s"}`);
  }

  async function refillDemo() {
    const login = d.login();
    const res = await run(login, "demo balance refill", engineApi.demoRefill(login));
    if (!res) return;
    const a = d.account();
    const bal = a?.cent ? res.balance / 100 : res.balance;
    d.log("Account", `'${login}': demo balance refilled to ${a ? `${accMoney(a, bal)} ${accCcy(a)}` : bal}`);
    toast.success("Demo balance refilled", { description: a ? `${accMoney(a, bal)} ${accCcy(a)}` : undefined });
  }

  return { placeOrder, closePosition, modifyPosition, closeBy, cancelPending, modifyPending, bulkClose, cancelAllPendings, refillDemo, fail };
}

export type EngineActions = ReturnType<typeof engineActions>;
