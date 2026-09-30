// What a shared P&L card shows for one closed trade, and nothing more: the symbol, the side, the result as the
// price move in the trade's direction (%) and as money (net of swap and commission), and the close date. Never a
// balance, equity, account number or volume.
import type { EngDeal } from "../../trading/types";

export type ShareTrade = {
  symbol: string;
  side: "buy" | "sell";
  /** % move in the trade's direction, null when the open price isn't known */
  pct: number | null;
  /** net result in the account currency */
  net: number;
  currency: string;
  open: number | null;
  close: number;
  digits: number;
  /** ISO time of the close */
  time: string;
};

/** The side of the position a closing deal belongs to (a closing deal itself is the opposite side). */
export const positionSide = (d: Pick<EngDeal, "side" | "positionSide">): "buy" | "sell" => d.positionSide ?? (d.side === "buy" ? "sell" : "buy");

/** Net result of a closing deal: profit + swap − commission (commission is a charge whatever its sign). */
export const netOf = (d: Pick<EngDeal, "profit" | "swap" | "commission">) => d.profit + (d.swap ?? 0) - Math.abs(d.commission ?? 0);

/** The price move of a trade in its own direction, in % of the open price (+ = in the trade's favour). */
export function movePct(side: "buy" | "sell", open: number | null | undefined, close: number): number | null {
  if (!open || !Number.isFinite(open) || open <= 0 || !Number.isFinite(close)) return null;
  const v = ((close - open) / open) * 100 * (side === "buy" ? 1 : -1);
  return Number.isFinite(v) ? v : null;
}

export function shareTrade(d: EngDeal, currency: string, digits: number): ShareTrade {
  const side = positionSide(d);
  const open = d.openPrice && d.openPrice > 0 ? d.openPrice : null;
  return { symbol: d.symbol, side, pct: movePct(side, open, d.price), net: netOf(d), currency, open, close: d.price, digits, time: d.time };
}

/** "kalks-eurusd-2026-09-30.png" */
export function shareFileName(t: Pick<ShareTrade, "symbol" | "time">): string {
  const day = /^\d{4}-\d{2}-\d{2}/.exec(t.time)?.[0] ?? "trade";
  return `kalks-${t.symbol.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${day}.png`;
}

/** The referral link a card may carry: `<Client Area>/r/<code>`, only for a well-formed code on an https (or local)
 *  origin. */
export function referralLink(linkBase: string | undefined, code: string | undefined): string | null {
  if (!linkBase || !code || !/^[A-Za-z0-9_-]{3,32}$/.test(code)) return null;
  if (!/^https:\/\/[^/\s]+$|^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(linkBase.replace(/\/+$/, ""))) return null;
  return `${linkBase.replace(/\/+$/, "")}/r/${code}`;
}
