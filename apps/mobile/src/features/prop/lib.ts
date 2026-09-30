// Pure prop logic (no React Native, no i18n): the live rule maths the gauges run on the UI thread, the daily reset
// clock and how a purchase answer is read. Kept import-free so `node --test` covers it
// (apps/mobile/scripts/prop-lib.test.mts); rules.ts, format.ts and api.ts re-export it.

/* ------------------------------------------------------------------ */
/* Live maths (worklets: they run on the UI thread from shared values)  */
/* Same definitions as services/prop/src/rules.rs.                      */
/* ------------------------------------------------------------------ */

/** Everything the gauges need besides live equity and balance (from the evaluator's last look). */
export type LiveParams = {
  initial: number;
  dailyRef: number;
  dailyLimit: number;
  ddLimit: number;
  hwm: number;
  trailing: boolean;
  lock: boolean;
  target: number;
};

/** Daily loss used: reference at the reset minus equity (never negative). */
export function dailyUsedOf(p: LiveParams, equity: number): number {
  "worklet";
  return Math.max(0, p.dailyRef - equity);
}

/** Max-drawdown floor for the high-water mark seen so far (static: initial − limit). */
export function ddFloorOf(p: LiveParams, equity: number, balance: number): number {
  "worklet";
  if (!p.trailing) return p.initial - p.ddLimit;
  const hwm = Math.max(p.hwm, equity, balance);
  const f = hwm - p.ddLimit;
  return p.lock ? Math.min(f, p.initial) : f;
}

export function ddUsedOf(p: LiveParams, equity: number, balance: number): number {
  "worklet";
  return Math.max(0, ddFloorOf(p, equity, balance) + p.ddLimit - equity);
}

/** 0–1 shares for the gauges. */
export function dailyShare(p: LiveParams, equity: number): number {
  "worklet";
  return p.dailyLimit > 0 ? Math.min(1, dailyUsedOf(p, equity) / p.dailyLimit) : 0;
}

export function ddShare(p: LiveParams, equity: number, balance: number): number {
  "worklet";
  return p.ddLimit > 0 ? Math.min(1, ddUsedOf(p, equity, balance) / p.ddLimit) : 0;
}

/** Profit-target progress on closed profit (balance), like the rule: the target counts closed trades. */
export function targetShare(p: LiveParams, balance: number): number {
  "worklet";
  return p.target > 0 ? Math.min(1, Math.max(0, balance - p.initial) / p.target) : 0;
}

export const clamp01 = (v: number) => (Number.isFinite(v) ? Math.min(1, Math.max(0, v)) : 0);

/* ------------------------------------------------------------------ */
/* The trading day's clock                                             */
/* ------------------------------------------------------------------ */

/** "05:12:33" (countdowns; digits stay left-to-right in every language). */
export function hms(ms: number | null): string {
  if (ms === null || !Number.isFinite(ms)) return "--:--:--";
  const s = Math.max(0, Math.floor(ms / 1000));
  return [Math.floor(s / 3600), Math.floor((s % 3600) / 60), s % 60].map((n) => String(n).padStart(2, "0")).join(":");
}

/** US daylight time at `t` (ms): from 02:00 local on the second Sunday of March to 02:00 on the first Sunday of November. */
function usDaylight(t: number): boolean {
  const y = new Date(t).getUTCFullYear();
  const nthSunday = (month: number, n: number) => {
    const first = new Date(Date.UTC(y, month, 1)).getUTCDay();
    return 1 + ((7 - first) % 7) + (n - 1) * 7;
  };
  return t >= Date.UTC(y, 2, nthSunday(2, 2), 7) && t < Date.UTC(y, 10, nthSunday(10, 1), 6);
}

/**
 * Next 17:00 New York, the prop trading day's reset (21:00 UTC during US daylight time, 22:00 UTC otherwise). Each
 * candidate day is judged on its own, so the day after a daylight-time switch gets its own hour.
 */
export function nextNyClose(now = new Date()): Date {
  const closeOn = (dayMs: number) => {
    const at21 = dayMs + 21 * 3_600_000;
    return usDaylight(at21) ? at21 : dayMs + 22 * 3_600_000;
  };
  const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  const at = closeOn(today);
  return new Date(at > now.getTime() ? at : closeOn(today + 86_400_000));
}

/* ------------------------------------------------------------------ */
/* Purchase and payout answers                                         */
/* ------------------------------------------------------------------ */

/** Soft outcomes: the request may still complete on its own (show as information, not failure). */
export const isSoftError = (code: string | undefined) => code === "provisioning" || code === "payment_pending" || code === "wallet_pending";

/**
 * A final refusal (4xx): nothing is pending on the server, so the next attempt is a new purchase with a new
 * idempotency key. Reusing the key would replay the refused purchase (the service keeps the payment_failed or
 * refunded challenge under it), so a retry after a deposit could never succeed. Unknown outcomes (network, time-out,
 * 5xx: payment_pending, provisioning, engine) keep the key: the retry must reach the same purchase.
 */
export const isFinalRefusal = (e: { code: string; status?: number }) => e.status !== undefined && e.status >= 400 && e.status < 500 && !isSoftError(e.code);

/**
 * A purchase answer that carries a challenge which already ended (a replayed key: payment failed, or the account
 * couldn't be opened and the fee was refunded): shown as that error, never as a new challenge. null = a live purchase.
 */
export function endedPurchase(status: string | undefined): "account_unavailable" | "payment_failed" | null {
  if (status === "closed") return "account_unavailable";
  if (status === "payment_failed" || status === "failed") return "payment_failed";
  return null;
}
