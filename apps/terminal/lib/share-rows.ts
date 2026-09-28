// Snapshot rows (shared with the server-side share BFF, which rebuilds them from the trading engine).
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

