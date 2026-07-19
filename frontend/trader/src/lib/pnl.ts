/**
 * Net P&L — THE user-facing figure across web and the mobile app.
 *
 * net = gross profit − commission + swap
 *
 * The server sends GROSS profit in `profit` (and `pnl` for closed trades);
 * `swap` is stored negative for charges, so it is ADDED here. Any UI that
 * shows a position's/trade's P&L must go through this helper — hand-rolling
 * the arithmetic is how the web and APK drift apart.
 */
export interface PnlParts {
  profit?: number | null;
  commission?: number | null;
  swap?: number | null;
}

export function netPnl(p: PnlParts): number {
  // Number(...) on each term: bit-identical for the numeric JSON the server
  // sends, and defends against a string field turning `+ swap` into
  // concatenation if a payload ever regresses.
  return Number(p.profit || 0) - Number(p.commission || 0) + Number(p.swap || 0);
}

/** Sum of net P&L over a set of positions/trades. */
export function sumNetPnl(list: PnlParts[]): number {
  return list.reduce((s, p) => s + netPnl(p), 0);
}
