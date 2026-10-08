/**
 * Back Office · Marketing · Promo codes.
 * Import via `@ezymex/mock/admin-promo-codes`. Exports are prefixed PROMO_.
 */
import { PEOPLE, type Person } from "./people";
import { seeded } from "./rng";

export type PromoType = "deposit-bonus" | "fee-waiver" | "prop-retry";
export type PromoStatus = "active" | "paused" | "scheduled" | "expired" | "exhausted";

export const PROMO_TYPE_META: Record<PromoType, { label: string; short: string; icon: string; tone: "ember" | "gold" | "up" }> = {
  "deposit-bonus": { label: "Deposit bonus %", short: "Deposit bonus", icon: "money_bag", tone: "ember" },
  "fee-waiver": { label: "Fee waiver", short: "Fee waiver", icon: "receipt", tone: "gold" },
  "prop-retry": { label: "Free prop retry", short: "Prop retry", icon: "trophy", tone: "up" },
};

export const PROMO_SEGMENTS = [
  "All clients",
  "New sign-ups (no FTD)",
  "First-time depositors",
  "Dormant 30d+",
  "VIP (NDA > $25k)",
  "Crypto depositors",
  "Prop challengers",
  "Failed prop phase 1",
  "IB referrals",
  "MENA · Islamic",
  "LatAm",
  "South-East Asia",
] as const;
export type PromoSegment = (typeof PROMO_SEGMENTS)[number];

export interface PromoCode {
  id: string;
  code: string;
  type: PromoType;
  /** % for deposit bonus / fee waiver, count for prop retries */
  value: number;
  /** cap in USD for deposit bonus, days for fee waiver, max plan size for prop */
  cap: string;
  uses: number;
  limit: number;
  perClient: number;
  minDeposit: number;
  starts: string;
  expires: string;
  segment: PromoSegment;
  status: PromoStatus;
  createdBy: Person;
  deposits: number; // attributed deposits USD
  cost: number; // bonus credit / waived fees / retry cost USD
  daily: number[]; // last 14 days redemptions
}

type Raw = [string, PromoType, number, string, number, number, number, number, string, string, PromoSegment, PromoStatus, number, number];

const RAW: Raw[] = [
  ["WELCOME30", "deposit-bonus", 30, "up to $3,000", 4812, 10000, 1, 100, "2026-01-05", "2026-12-31", "New sign-ups (no FTD)", "active", 9, 1_842_000],
  ["USDT100", "deposit-bonus", 100, "up to $5,000", 1396, 2500, 1, 500, "2026-08-15", "2026-10-31", "Crypto depositors", "active", 4, 986_400],
  ["GOLDZERO", "fee-waiver", 100, "14 days · XAUUSD", 2140, 5000, 1, 250, "2026-09-01", "2026-10-15", "All clients", "active", 12, 1_214_600],
  ["RETRY-ON-US", "prop-retry", 1, "plans ≤ $50K", 684, 1500, 1, 0, "2026-07-20", "2026-12-31", "Failed prop phase 1", "active", 1, 142_800],
  ["VIP-ZERO", "fee-waiver", 50, "30 days · all symbols", 212, 300, 1, 25000, "2026-06-01", "2027-03-31", "VIP (NDA > $25k)", "active", 5, 2_418_000],
  ["COMEBACK25", "deposit-bonus", 25, "up to $500", 1644, 5000, 1, 100, "2026-05-18", "2026-12-31", "Dormant 30d+", "active", 9, 496_800],
  ["RAMADAN50", "deposit-bonus", 50, "up to $2,000", 3000, 3000, 1, 200, "2026-02-18", "2026-03-20", "MENA · Islamic", "exhausted", 1, 1_104_200],
  ["PROP2FOR1", "prop-retry", 2, "plans ≤ $100K", 318, 1000, 1, 0, "2026-09-10", "2026-11-30", "Prop challengers", "active", 6, 88_400],
  ["LATAM20", "deposit-bonus", 20, "up to $1,000", 902, 2000, 1, 100, "2026-04-01", "2026-09-15", "LatAm", "expired", 2, 318_700],
  ["SEA-NOFEE", "fee-waiver", 100, "7 days · FX majors", 207, 1000, 1, 100, "2026-09-10", "2026-11-15", "South-East Asia", "active", 8, 58_200],
  ["IBBOOST15", "deposit-bonus", 15, "up to $750", 1128, 4000, 1, 250, "2026-03-12", "2026-12-31", "IB referrals", "paused", 7, 402_100],
  ["FTD-RETRY", "prop-retry", 1, "plans ≤ $25K", 0, 800, 1, 0, "2026-10-01", "2026-12-31", "First-time depositors", "scheduled", 12, 0],
  ["NAS100Q4", "fee-waiver", 100, "21 days · indices", 0, 500, 1, 500, "2026-10-05", "2026-12-18", "All clients", "scheduled", 9, 0],
  ["DOUBLEUP", "deposit-bonus", 100, "up to $10,000", 96, 100, 1, 5000, "2026-08-01", "2026-12-31", "VIP (NDA > $25k)", "active", 5, 1_380_000],
];

export const PROMO_CODES: PromoCode[] = RAW.map(([code, type, value, cap, uses, limit, perClient, minDeposit, starts, expires, segment, status, pi, deposits], i) => {
  const r = seeded(2400 + i);
  const cost =
    type === "deposit-bonus" ? Math.round(deposits * (value / 100) * r.range(0.18, 0.32)) : type === "fee-waiver" ? Math.round(deposits * r.range(0.004, 0.012)) : Math.round(uses * r.range(62, 118));
  const base = status === "active" ? Math.max(2, uses / 60) : 0;
  return {
    id: `prm_${String(i + 1).padStart(3, "0")}`,
    code,
    type,
    value,
    cap,
    uses,
    limit,
    perClient,
    minDeposit,
    starts: `${starts}T00:00:00+03:00`,
    expires: `${expires}T23:59:00+03:00`,
    segment,
    status,
    createdBy: PEOPLE[pi]!,
    deposits,
    cost,
    daily: Array.from({ length: 14 }, (_, d) => Math.max(0, Math.round(base * (0.7 + d * 0.03 + r.range(-0.3, 0.35))))),
  };
});

/** Redemptions per day, last 30 days, split by type. */
export const PROMO_DAILY = (() => {
  const r = seeded(2499);
  return Array.from({ length: 30 }, (_, i) => {
    const d = new Date(Date.UTC(2026, 7, 26 + i));
    const wk = d.getUTCDay() === 0 || d.getUTCDay() === 6 ? 0.62 : 1;
    const bonus = Math.round((180 + i * 3.2 + r.range(-30, 40)) * wk);
    const fee = Math.round((82 + i * 2.1 + r.range(-18, 22)) * wk);
    const prop = Math.round((24 + i * 0.6 + r.range(-6, 8)) * wk);
    return { label: `${String(d.getUTCDate()).padStart(2, "0")} ${["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][d.getUTCMonth()]}`, bonus, fee, prop };
  });
})();

export interface PromoRedemption {
  id: string;
  code: string;
  person: Person;
  login: string;
  at: string;
  deposit: number;
  benefit: string;
  status: "applied" | "pending" | "blocked";
  reason?: string;
}

export const PROMO_REDEMPTIONS: PromoRedemption[] = (() => {
  const r = seeded(2512);
  const active = PROMO_CODES.filter((c) => c.status === "active");
  return Array.from({ length: 16 }, (_, i) => {
    const c = active[i % active.length]!;
    const p = PEOPLE[(i * 5 + 3) % PEOPLE.length]!;
    const dep = c.type === "prop-retry" ? 0 : Math.round(r.range(Math.max(c.minDeposit, 100), Math.max(c.minDeposit, 100) * 6) / 10) * 10;
    const benefit = c.type === "deposit-bonus" ? `$${Math.round((dep * c.value) / 100).toLocaleString("en-US")} credit` : c.type === "fee-waiver" ? `${c.value}% fees · ${c.cap.split(" · ")[0]}` : `${c.value} free retry`;
    const blocked = i === 4 || i === 11;
    const m = 8 + i * 37;
    const at = new Date(Date.UTC(2026, 8, 24, 11, 30) - m * 60_000).toISOString();
    return {
      id: `rdm_${88120 - i}`,
      code: c.code,
      person: p,
      login: String(80412337 + i * 7919),
      at,
      deposit: dep,
      benefit,
      status: blocked ? "blocked" : i === 2 || i === 7 ? "pending" : "applied",
      reason: blocked ? (i === 4 ? "Same device as 2 prior redemptions" : "Segment mismatch: already funded") : undefined,
    };
  });
})();

export const PROMO_KPIS = {
  active: PROMO_CODES.filter((c) => c.status === "active").length,
  redemptions30d: PROMO_DAILY.reduce((s, d) => s + d.bonus + d.fee + d.prop, 0),
  attributedDeposits: PROMO_CODES.reduce((s, c) => s + c.deposits, 0),
  cost: PROMO_CODES.reduce((s, c) => s + c.cost, 0),
  abuseBlocked: 214,
  redemptionToFtd: 41.8,
};
