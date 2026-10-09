/**
 * Mock data for Staking (Earn) in demo builds: plans, the client's portfolio and history, shaped like the staking
 * service's client API (services/staking/README.md). Months are counted back from today in server time so the demo
 * always looks current; rates are only shown for months already settled, as in live builds.
 */

const DAY = 86_400_000;
const now = Date.now();

/** "YYYY-MM" of the server-time month `back` months before the current one. */
function period(back: number): string {
  const d = new Date(now + 3 * 3_600_000);
  const m = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() - back, 1));
  return `${m.getUTCFullYear()}-${String(m.getUTCMonth() + 1).padStart(2, "0")}`;
}

/** 00:00 server time (GMT+3) on the 1st of the month after `p`. */
function monthEnd(p: string): string {
  const [y, m] = p.split("-").map(Number) as [number, number];
  return new Date(Date.UTC(y, m, 1) - 3 * 3_600_000).toISOString();
}

const iso = (msAgo: number) => new Date(now - msAgo).toISOString();
const plusMonths = (isoDate: string, months: number) => {
  const d = new Date(isoDate);
  d.setUTCMonth(d.getUTCMonth() + months);
  return d.toISOString();
};

const RISK =
  "Returns are set by the broker for each month after it starts and can be zero. Nothing is guaranteed. Your amount is locked until the plan matures: there is no early withdrawal. Only invest what you can leave untouched for the whole term.";

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
      invested: 2_500,
      maxNow: 50_000,
      description: "A short term for idle wallet funds. Monthly returns are paid to your wallet after each month is settled.",
      riskText: RISK,
      version: 3,
      recentRates: [
        { period: period(1), ratePct: 0.95 },
        { period: period(2), ratePct: 1.1 },
        { period: period(3), ratePct: 0.8 },
      ],
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
      invested: 10_000,
      maxNow: 100_000,
      description: "A longer lock for a steadier monthly return. The rate of each month is set once the month is under way.",
      riskText: RISK,
      version: 2,
      recentRates: [
        { period: period(1), ratePct: 1.2 },
        { period: period(2), ratePct: 1.25 },
        { period: period(3), ratePct: 1.15 },
        { period: period(4), ratePct: 1.05 },
      ],
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
      recentRates: [
        { period: period(1), ratePct: 1.4 },
        { period: period(2), ratePct: 1.45 },
      ],
    },
  ],
  currencies: ["USDT"],
  currentPeriod: period(0),
  nextPayoutAfter: monthEnd(period(0)),
  serverTime: iso(0),
};

const started6 = iso(118 * DAY);
const started3 = iso(41 * DAY);
const startedOld = iso(160 * DAY);

const position = <P extends { id: number; planId: number; startedAt: string }>(p: P) => ({
  userId: 3021,
  userName: "Ana Lima",
  planVersion: 1,
  currency: "USDT",
  failureReason: null,
  maturedAt: null,
  redeem: null,
  createdAt: p.startedAt,
  updatedAt: p.startedAt,
  termsAcceptedAt: p.startedAt,
  riskAcknowledgedAt: p.startedAt,
  ...p,
});

export const STAKING_POSITIONS = [
  position({
    id: 1048,
    planId: 2,
    planName: "Earn 6 months",
    termMonths: 6,
    principal: 10_000,
    status: "active",
    startedAt: started6,
    maturesAt: plusMonths(started6, 6),
    returnsPaid: 362.5,
    daysTotal: 183,
    daysElapsed: 118,
    lastReturn: { period: period(1), ratePct: 1.2, amount: 120 },
  }),
  position({
    id: 1187,
    planId: 1,
    planName: "Earn 3 months",
    termMonths: 3,
    principal: 2_500,
    status: "active",
    startedAt: started3,
    maturesAt: plusMonths(started3, 3),
    returnsPaid: 12.67,
    daysTotal: 92,
    daysElapsed: 41,
    lastReturn: { period: period(1), ratePct: 0.95, amount: 12.67 },
  }),
  position({
    id: 912,
    planId: 1,
    planName: "Earn 3 months",
    termMonths: 3,
    principal: 4_000,
    status: "matured",
    startedAt: startedOld,
    maturesAt: plusMonths(startedOld, 3),
    maturedAt: plusMonths(startedOld, 3),
    returnsPaid: 128.4,
    daysTotal: 92,
    daysElapsed: 92,
    lastReturn: { period: period(2), ratePct: 1.1, amount: 23.47 },
  }),
];

export const STAKING_PORTFOLIO = {
  summary: {
    currency: "USDT",
    invested: 12_500,
    pending: 0,
    returnsPaid: 503.57,
    returnsThisYear: 503.57,
    activePositions: 2,
    nextPayout: { period: period(0), after: monthEnd(period(0)) },
    nextMaturity: { positionId: 1187, planName: "Earn 3 months", date: plusMonths(started3, 3), principal: 2_500 },
  },
  positions: STAKING_POSITIONS,
  monthly: [
    { period: period(5), amount: 18.4 },
    { period: period(4), amount: 87.53 },
    { period: period(3), amount: 147.2 },
    { period: period(2), amount: 168.1 },
    { period: period(1), amount: 132.67 },
  ],
  serverTime: iso(0),
};

export const STAKING_RETURNS: Record<number, { period: string; ratePct: number; daysActive: number; daysInMonth: number; amount: number; status: string; paidAt: string }[]> = {
  1048: [
    { period: period(1), ratePct: 1.2, daysActive: 30, daysInMonth: 30, amount: 120, status: "paid", paidAt: iso(6 * DAY) },
    { period: period(2), ratePct: 1.25, daysActive: 31, daysInMonth: 31, amount: 125, status: "paid", paidAt: iso(37 * DAY) },
    { period: period(3), ratePct: 1.15, daysActive: 31, daysInMonth: 31, amount: 115, status: "paid", paidAt: iso(67 * DAY) },
    { period: period(4), ratePct: 1.05, daysActive: 1, daysInMonth: 31, amount: 2.5, status: "paid", paidAt: iso(98 * DAY) },
  ],
  1187: [{ period: period(1), ratePct: 0.95, daysActive: 16, daysInMonth: 30, amount: 12.67, status: "paid", paidAt: iso(6 * DAY) }],
  912: [
    { period: period(2), ratePct: 1.1, daysActive: 16, daysInMonth: 31, amount: 23.47, status: "paid", paidAt: iso(37 * DAY) },
    { period: period(3), ratePct: 0.8, daysActive: 31, daysInMonth: 31, amount: 32, status: "paid", paidAt: iso(67 * DAY) },
    { period: period(4), ratePct: 1.05, daysActive: 31, daysInMonth: 31, amount: 42, status: "paid", paidAt: iso(98 * DAY) },
    { period: period(5), ratePct: 1.15, daysActive: 14, daysInMonth: 30, amount: 30.93, status: "paid", paidAt: iso(128 * DAY) },
  ],
};

export const STAKING_HISTORY = {
  items: [
    { kind: "reward", at: iso(6 * DAY), positionId: 1048, planName: "Earn 6 months", amount: 120, currency: "USDT", period: period(1), ratePct: 1.2, days: 30 },
    { kind: "reward", at: iso(6 * DAY), positionId: 1187, planName: "Earn 3 months", amount: 12.67, currency: "USDT", period: period(1), ratePct: 0.95, days: 16 },
    { kind: "principal", at: plusMonths(startedOld, 3), positionId: 912, planName: "Earn 3 months", amount: 4_000, currency: "USDT", period: null, ratePct: null, days: null },
    { kind: "subscribe", at: started3, positionId: 1187, planName: "Earn 3 months", amount: 2_500, currency: "USDT", period: null, ratePct: null, days: null },
    { kind: "reward", at: iso(37 * DAY), positionId: 1048, planName: "Earn 6 months", amount: 125, currency: "USDT", period: period(2), ratePct: 1.25, days: 31 },
    { kind: "reward", at: iso(37 * DAY), positionId: 912, planName: "Earn 3 months", amount: 23.47, currency: "USDT", period: period(2), ratePct: 1.1, days: 16 },
    { kind: "subscribe", at: started6, positionId: 1048, planName: "Earn 6 months", amount: 10_000, currency: "USDT", period: null, ratePct: null, days: null },
    { kind: "subscribe", at: startedOld, positionId: 912, planName: "Earn 3 months", amount: 4_000, currency: "USDT", period: null, ratePct: null, days: null },
  ],
  total: 8,
  page: 1,
  limit: 25,
};
