// Pure helpers for the rewards screens (no React Native, no app state, so node tests run them), with the same rules
// as apps/crm/components/growth/api.ts: points, contest scores in the contest's unit, prize bands, what a reward
// gives, the server's enums in words, and the growth service's sentences in the reader's language.
import type { T } from "@kalks/i18n/core";
import { fmtMoney, fmtPct } from "@/lib/format";
import type { CatalogueItem, Contest, Prize, Standing } from "./types";

/** 12480 -> "12,480", -2500 -> "−2,500" (whole points, tabular, a true minus like money). */
export const pts = (v: number) => {
  const n = Math.round(v);
  return `${n < 0 ? "−" : ""}${String(Math.abs(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ",")}`;
};

export const lots = (v: number) => v.toFixed(2);

export const isRunning = (c: Pick<Contest, "status">) => c.status === "running";
export const isUpcoming = (c: Pick<Contest, "status">) => c.status === "scheduled";
export const isPast = (c: Pick<Contest, "status">) => ["ended", "finalized", "paid", "cancelled"].includes(c.status);
export const isFull = (c: Pick<Contest, "maxEntrants" | "entrants">) => c.maxEntrants !== null && c.entrants >= c.maxEntrants;
export const canJoin = (c: Pick<Contest, "status" | "maxEntrants" | "entrants">) => (isRunning(c) || isUpcoming(c)) && !isFull(c);

/** A standing's score in the contest's unit: "+12.34%", "+$123.45", "12.50 lots". */
export function scoreText(t: T, c: Pick<Contest, "scoring">, s: Pick<Standing, "returnPct" | "profit" | "lots">): string {
  if (c.scoring === "profit") return fmtMoney(s.profit, { currency: "USD", signed: true });
  if (c.scoring === "lots") return t("mobileRewards.value.lots", { lots: lots(s.lots) });
  return fmtPct(s.returnPct, 2, true);
}

/** Green / red for money scores (return, profit); lots stay neutral. */
export function scoreTone(c: Pick<Contest, "scoring">, s: Pick<Standing, "returnPct" | "profit">): "up" | "down" | null {
  if (c.scoring === "lots") return null;
  const v = c.scoring === "profit" ? s.profit : s.returnPct;
  return v > 0 ? "up" : v < 0 ? "down" : null;
}

export const scoringLabel = (t: T, s: string) => t.dyn(`mobileRewards.scoring.${s}`, s.replace(/_/g, " "));
export const statusLabel = (t: T, s: string) => t.dyn(`mobileRewards.status.${s}`, s.replace(/_/g, " "));

/** "#1", "#2–5" for a prize band. */
export const bandLabel = (p: Pick<Prize, "rankFrom" | "rankTo">) => (p.rankFrom === p.rankTo ? `#${p.rankFrom}` : `#${p.rankFrom}–${p.rankTo}`);

/** Prize for a rank from the contest's bands (null outside the prize zone). */
export function prizeFor(c: Pick<Contest, "prizes">, rank: number | null): number | null {
  if (!rank) return null;
  return c.prizes.find((p) => rank >= p.rankFrom && rank <= p.rankTo)?.amount ?? null;
}

/** Last rank that wins a prize. */
export const prizeZone = (c: Pick<Contest, "prizes">) => c.prizes.reduce((m, p) => Math.max(m, p.rankTo), 0);

/** "Needs 2 more trades to rank" while an entry is under the contest's minimum. */
export function tradesHint(t: T, c: Pick<Contest, "minTrades">, s: Pick<Standing, "trades" | "qualified">): string | null {
  if (s.qualified || c.minTrades <= 0) return null;
  const n = Math.max(0, c.minTrades - s.trades);
  return n > 0 ? t("mobileRewards.contest.needsTrades", { count: n }) : t("mobileRewards.contest.qualifiesNext");
}

/** What a catalogue item gives: "$10 to your wallet", "$100 trading bonus", "20% off". */
export function itemValue(t: T, it: Pick<CatalogueItem, "kind" | "value">): string {
  const amount = fmtMoney(it.value, { currency: "USD", decimals: it.value % 1 ? 2 : 0 });
  if (it.kind === "fee_discount") return t("mobileRewards.item.feeDiscount", { pct: it.value });
  if (it.kind === "bonus_credit") return t("mobileRewards.item.tradingBonus", { amount });
  return t("mobileRewards.item.toWallet", { amount });
}

export const tierRank = (tiers: { key: string; rank: number }[], key: string | null) => tiers.find((x) => x.key === key)?.rank ?? 0;
export const tierName = (tiers: { key: string; name: string }[], key: string | null) => tiers.find((x) => x.key === key)?.name ?? key ?? "";

/** Title-cased server words ("awaiting_deposit" -> "Awaiting deposit") for values without a catalog entry. */
export const titleCase = (s: string) => s.replace(/_/g, " ").replace(/^\w/, (c) => c.toUpperCase());

/** The growth service's sentences (services/growth) in the reader's language; anything else keeps its wording. */
export const MESSAGES: Record<string, string> = {
  "Registration for this contest is closed.": "registrationClosed",
  "This contest is full.": "contestFull",
  "Verify your identity to join this contest.": "kycContest",
  "You have already joined this contest.": "already_joined",
  "You have already joined this contest (or that account is entered).": "alreadyEntered",
  "Account not found.": "accountNotFound",
  "Bonuses apply to live accounts only.": "liveOnly",
  "This offer isn't available for that account type.": "accountType",
  "Choose the live account to compete with.": "chooseContestAccount",
  "Choose one of your live accounts.": "chooseLive",
  "This contest isn't open to that account type.": "contestAccountType",
  "This offer is not active.": "offerInactive",
  "This offer has not started yet.": "offerNotStarted",
  "This offer has ended.": "offerEnded",
  "This offer has been fully claimed.": "fullyClaimed",
  "You have already used this offer.": "alreadyUsed",
  "This offer isn't available in your country.": "country",
  "Verify your identity to use this offer.": "kycOffer",
  "Choose the live account for the bonus.": "chooseBonusAccount",
  "This reward is no longer available.": "rewardGone",
  "This reward is out of stock.": "out_of_stock",
  "That account already has an active bonus.": "activeBonus",
  "Too many attempts. Please try again in a few minutes.": "tooMany",
  "Enter a valid promo code.": "enterCode",
  "This code isn't valid.": "invalidCode",
  "This code has no bonus attached.": "noBonus",
  "No closed trades in that period.": "noTrades",
};

/** A server sentence (an error, an offer's "why not", a refused code's reason) in the reader's language. */
export function rewardsTextWith(t: T, message: string | null | undefined): string {
  if (!message) return "";
  const key = MESSAGES[message];
  if (key) return t.dyn(`mobileRewards.error.${key}`, message);
  const tier = /^This reward needs the (.+) tier\.$/.exec(message);
  if (tier) return t("mobileRewards.error.needsTier", { tier: tier[1]! });
  const need = /^You need (\d+) more points\.$/.exec(message);
  if (need) return t("mobileRewards.error.needPoints", { points: pts(Number(need[1])) });
  return message;
}

