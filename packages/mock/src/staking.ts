/**
 * Mock data for Staking (Earn) in demo builds: plans, the client's portfolio and history, shaped like the staking
 * service's client API (services/staking/README.md). Positions start a fixed number of days before today, and every
 * figure is derived from them with the service's own rules (services/staking/src/period.rs): a month earns
 * principal × rate % × days active ÷ days in month, the start day counts and the maturity day doesn't, months are in
 * server time (GMT+3 here) and a month is paid once it is settled, early in the next month. So the demo always looks
 * current and its numbers add up whatever today is.
 */

const DAY = 86_400_000;
const HOUR = 3_600_000;
const SERVER = 3 * HOUR;
const now = Date.now();

/** "YYYY-MM" of the server-time month `back` months before the current one. */
function period(back: number): string {
  const d = new Date(now + SERVER);
  const m = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() - back, 1));
  return `${m.getUTCFullYear()}-${String(m.getUTCMonth() + 1).padStart(2, "0")}`;
}

/** Server-time calendar day number (days since 1970-01-01) of an instant. */
const serverDay = (ms: number) => Math.floor((ms + SERVER) / DAY);
/** The instant of `hours` past 00:00 server time on day number `day`. */
const atServer = (day: number, hours = 0) => day * DAY - SERVER + hours * HOUR;
/** Day number of the 1st of month `p` and of the 1st of the month after it. */
function monthDays(p: string): [number, number] {
  const [y, m] = p.split("-").map(Number) as [number, number];
  return [Date.UTC(y, m - 1, 1) / DAY, Date.UTC(y, m, 1) / DAY];
}

/** 00:00 server time (GMT+3) on the 1st of the month after `p`. */
function monthEnd(p: string): string {
  return new Date(atServer(monthDays(p)[1])).toISOString();
}

const iso = (msAgo: number) => new Date(now - msAgo).toISOString();
const cents = (v: number) => Math.round(v * 100) / 100;

const RISK =
  "Returns are set by the broker for each month after it starts and can be zero. Nothing is guaranteed. Your amount is locked until the plan matures: there is no early withdrawal. Only invest what you can leave untouched for the whole term.";

/** Settled monthly rates per plan, newest first: index 0 is last month. */
const RATES: Record<number, number[]> = {
  1: [0.95, 1.1, 0.8, 1.05, 1.15, 0.9, 1.0, 0.85],
  2: [1.2, 1.25, 1.15, 1.05, 1.1, 1.0, 1.05, 0.95],
  3: [1.4, 1.45],
};
const recentRates = (planId: number, count: number) => (RATES[planId] ?? []).slice(0, count).map((ratePct, i) => ({ period: period(i + 1), ratePct }));

/** The client's subscriptions: two running, one matured. */
const SPECS = [
  { id: 1048, planId: 2, planName: "Earn 6 months", termMonths: 6, principal: 10_000, startedDaysAgo: 118 },
  { id: 1187, planId: 1, planName: "Earn 3 months", termMonths: 3, principal: 2_500, startedDaysAgo: 41 },
  { id: 912, planId: 1, planName: "Earn 3 months", termMonths: 3, principal: 4_000, startedDaysAgo: 160 },
];

type MonthReturn = { period: string; ratePct: number; daysActive: number; daysInMonth: number; amount: number; status: string; paidAt: string };

/** A month is settled and paid on the 3rd of the next month, 13:41 server time. */
const paidAtMs = (p: string) => atServer(monthDays(p)[1] + 2, 13 + 41 / 60);

const MODEL = SPECS.map((spec) => {
  const startDay = serverDay(now) - spec.startedDaysAgo;
  const startedMs = atServer(startDay, 10.25);
  const start = new Date(startDay * DAY);
  const matureDay = Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + spec.termMonths, start.getUTCDate()) / DAY;
  const maturesMs = atServer(matureDay);
  const returns: MonthReturn[] = [];
  for (let back = 1; back <= 8; back++) {
    const p = period(back);
    const [first, next] = monthDays(p);
    const daysActive = Math.max(0, Math.min(matureDay, next) - Math.max(startDay, first));
    const ratePct = RATES[spec.planId]?.[back - 1];
    if (!daysActive || ratePct === undefined || paidAtMs(p) > now) continue;
    const amount = cents((spec.principal * ratePct * daysActive) / (100 * (next - first)));
    returns.push({ period: p, ratePct, daysActive, daysInMonth: next - first, amount, status: "paid", paidAt: new Date(paidAtMs(p)).toISOString() });
  }
  const matured = maturesMs <= now;
  const termDays = matureDay - startDay;
  return { spec, startedMs, maturesMs, matured, termDays, daysElapsed: Math.min(termDays, Math.max(0, serverDay(now) - startDay)), returns };
});

const active = MODEL.filter((m) => !m.matured);
const investedIn = (planId: number) => active.filter((m) => m.spec.planId === planId).reduce((s, m) => s + m.spec.principal, 0);
const allReturns = MODEL.flatMap((m) => m.returns);
/** Last month is the next payout until its settlement is paid, then the current month. */
const nextPayout = (() => {
  const p = paidAtMs(period(1)) > now && active.length ? period(1) : period(0);
  return { period: p, after: monthEnd(p) };
})();

export const STAKING_PLANS = {
  plans: [
    {
      id: 1,
      name: "Earn 3 months",
      currency: "USDT",
      status: "active",
      termMonths: 3,
      minAmount: 100,
      maxAmount: 50_000,
      perUserMax: 100_000,
      capacityLeft: 1_240_500,
      full: false,
      invested: investedIn(1),
      maxNow: 50_000,
      description: "A short term for idle wallet funds. Monthly returns are paid to your wallet after each month is settled.",
      riskText: RISK,
      version: 3,
      recentRates: recentRates(1, 3),
    },
    {
      id: 2,
      name: "Earn 6 months",
      currency: "USDT",
      status: "active",
      termMonths: 6,
      minAmount: 500,
      maxAmount: 100_000,
      perUserMax: 250_000,
      capacityLeft: 860_000,
      full: false,
      invested: investedIn(2),
      maxNow: 100_000,
      description: "A longer lock for a steadier monthly return. The rate of each month is set once the month is under way.",
      riskText: RISK,
      version: 2,
      recentRates: recentRates(2, 4),
    },
    {
      id: 3,
      name: "Earn 12 months",
      currency: "USDT",
      status: "paused",
      termMonths: 12,
      minAmount: 1_000,
      maxAmount: null,
      perUserMax: 500_000,
      capacityLeft: 0,
      full: true,
      invested: 0,
      maxNow: 0,
      description: "Our longest term. New subscriptions reopen when capacity is added.",
      riskText: RISK,
      version: 1,
      recentRates: recentRates(3, 2),
    },
  ],
  currencies: ["USDT"],
  currentPeriod: period(0),
  nextPayoutAfter: nextPayout.after,
  serverTime: iso(0),
};

const position = <P extends { id: number; planId: number; startedAt: string }>(p: P) => ({
  userId: 3021,
  userName: "Arjun Mehta",
  planVersion: 1,
  currency: "USDT",
  failureReason: null,
  redeem: null,
  createdAt: p.startedAt,
  updatedAt: p.startedAt,
  termsAcceptedAt: p.startedAt,
  riskAcknowledgedAt: p.startedAt,
  ...p,
});

export const STAKING_POSITIONS = MODEL.map((m) => {
  const last = m.returns[0];
  return position({
    id: m.spec.id,
    planId: m.spec.planId,
    planName: m.spec.planName,
    termMonths: m.spec.termMonths,
    principal: m.spec.principal,
    status: m.matured ? "matured" : "active",
    startedAt: new Date(m.startedMs).toISOString(),
    maturesAt: new Date(m.maturesMs).toISOString(),
    maturedAt: m.matured ? new Date(m.maturesMs).toISOString() : null,
    returnsPaid: cents(m.returns.reduce((s, r) => s + r.amount, 0)),
    daysTotal: m.termDays,
    daysElapsed: m.daysElapsed,
    lastReturn: last ? { period: last.period, ratePct: last.ratePct, amount: last.amount } : null,
  });
});

const thisYear = String(new Date(now + SERVER).getUTCFullYear());
const nextMaturity = [...active].sort((a, b) => a.maturesMs - b.maturesMs)[0];
const monthly = new Map<string, number>();
for (const r of allReturns) monthly.set(r.period, cents((monthly.get(r.period) ?? 0) + r.amount));

export const STAKING_PORTFOLIO = {
  summary: {
    currency: "USDT",
    invested: active.reduce((s, m) => s + m.spec.principal, 0),
    pending: 0,
    returnsPaid: cents(allReturns.reduce((s, r) => s + r.amount, 0)),
    returnsThisYear: cents(allReturns.filter((r) => new Date(Date.parse(r.paidAt) + SERVER).getUTCFullYear() === Number(thisYear)).reduce((s, r) => s + r.amount, 0)),
    activePositions: active.length,
    nextPayout,
    nextMaturity: nextMaturity
      ? { positionId: nextMaturity.spec.id, planName: nextMaturity.spec.planName, date: new Date(nextMaturity.maturesMs).toISOString(), principal: nextMaturity.spec.principal }
      : null,
  },
  positions: STAKING_POSITIONS,
  monthly: [...monthly].sort(([a], [b]) => a.localeCompare(b)).slice(-12).map(([p, amount]) => ({ period: p, amount })),
  serverTime: iso(0),
};

export const STAKING_RETURNS: Record<number, MonthReturn[]> = Object.fromEntries(MODEL.map((m) => [m.spec.id, m.returns]));

const historyItems = MODEL.flatMap((m) => [
  { kind: "subscribe", at: new Date(m.startedMs).toISOString(), positionId: m.spec.id, planName: m.spec.planName, amount: m.spec.principal, currency: "USDT", period: null as string | null, ratePct: null as number | null, days: null as number | null },
  ...m.returns.map((r) => ({ kind: "reward", at: r.paidAt, positionId: m.spec.id, planName: m.spec.planName, amount: r.amount, currency: "USDT", period: r.period as string | null, ratePct: r.ratePct as number | null, days: r.daysActive as number | null })),
  ...(m.matured ? [{ kind: "principal", at: new Date(m.maturesMs).toISOString(), positionId: m.spec.id, planName: m.spec.planName, amount: m.spec.principal, currency: "USDT", period: null, ratePct: null, days: null }] : []),
]);

export const STAKING_HISTORY = {
  items: historyItems,
  total: historyItems.length,
  page: 1,
  limit: 25,
};
