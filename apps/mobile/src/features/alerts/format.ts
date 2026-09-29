// Words and numbers for price alerts: the condition in a row, the distance to the trigger, expiry choices.
import type { T } from "@/i18n";
import { fmtPct, fmtPrice } from "@/lib/format";
import type { AlertCondition, PriceAlert } from "./api";

export const CONDITIONS: AlertCondition[] = ["above", "below", "change_up", "change_down"];
export const isLevel = (c: AlertCondition) => c === "above" || c === "below";
export const rising = (c: AlertCondition) => c === "above" || c === "change_up";

/** A percentage without trailing zeros ("1.5", "2"). */
export function pctText(v: number): string {
  return String(+v.toFixed(2));
}

/** "Above 2700.50", "Up 2% · at 2703.00". */
export function conditionText(t: T, a: Pick<PriceAlert, "condition" | "value" | "target">, digits: number): string {
  const price = fmtPrice(a.target, digits);
  switch (a.condition) {
    case "above":
      return t("mobileDepth.alerts.row.above", { price });
    case "below":
      return t("mobileDepth.alerts.row.below", { price });
    case "change_up":
      return t("mobileDepth.alerts.row.change_up", { pct: pctText(a.value), price });
    case "change_down":
      return t("mobileDepth.alerts.row.change_down", { pct: pctText(a.value), price });
  }
}

/** How far the price still has to go to the target, in % of the price (unsigned), or null without a price. */
export function distancePct(price: number | undefined, target: number): number | null {
  if (!price || !(price > 0)) return null;
  return (Math.abs(target - price) / price) * 100;
}

export function distanceText(price: number | undefined, target: number): string | null {
  const d = distancePct(price, target);
  return d === null ? null : fmtPct(d, 2, false);
}

/** The trigger price of a level or a move from `ref`, on the symbol's digits (the server's rule). */
export function targetOf(c: AlertCondition, value: number, ref: number, digits: number): number {
  const v = isLevel(c) ? value : c === "change_up" ? ref * (1 + value / 100) : ref * (1 - value / 100);
  return +v.toFixed(digits);
}

export type ExpiryChoice = "never" | "day" | "week" | "month" | "quarter" | "keep";
export const EXPIRY_CHOICES: Exclude<ExpiryChoice, "keep">[] = ["never", "day", "week", "month", "quarter"];
const DAYS: Record<Exclude<ExpiryChoice, "never" | "keep">, number> = { day: 1, week: 7, month: 30, quarter: 90 };

/** The expiry to send: an ISO instant, null for never, undefined to keep the current one. */
export function expiryValue(c: ExpiryChoice, now = Date.now()): string | null | undefined {
  if (c === "keep") return undefined;
  if (c === "never") return null;
  return new Date(now + DAYS[c] * 86_400_000).toISOString();
}
