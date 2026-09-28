/**
 * Back Office · Organization · Desks & teams + staff KPIs / commissions.
 * Import via `@kalks/mock/admin-desks`. Exports are prefixed DSK_ / KPI_.
 */
import { PEOPLE, type Person } from "./people";
import { seeded } from "./rng";

export type DskKey = "sales-en" | "sales-hi" | "retention" | "dealing" | "compliance" | "finance" | "support";

export interface DskMember {
  person: Person;
  title: string;
  clients: number;
  online: boolean;
  shift: string;
}

export interface DskKpi {
  label: string;
  value: string;
  delta?: number; // vs last period, %
  good?: "up" | "down"; // which direction is good
}

export interface DskDesk {
  key: DskKey;
  name: string;
  blurb: string;
  icon: string; // Icon3D
  tone: "ember" | "gold" | "up" | "info" | "warn";
  head: Person;
  members: DskMember[];
  clients: number;
  languages: string[];
  flag: string;
  hours: string;
  capacity: number; // max clients
  kpis: DskKpi[];
  sla: { label: string; pct: number };
  trend: number[];
}

const M = (pi: number, title: string, clients: number, online: boolean, shift = "09:00 – 18:00"): DskMember => ({ person: PEOPLE[pi]!, title, clients, online, shift });
const tr = (seed: number, base: number) => {
  const r = seeded(seed);
  return Array.from({ length: 14 }, (_, i) => Math.round(base * (0.8 + i * 0.018 + r.range(-0.12, 0.12))));
};

export const DSK_DESKS: DskDesk[] = [
  {
    key: "sales-en",
    name: "Sales EN",
    blurb: "Converts English-speaking leads (UK, Africa, LatAm EN) to first deposit.",
    icon: "handshake",
    tone: "ember",
    head: PEOPLE[9]!,
    members: [M(9, "Head of Sales · EN", 180, true), M(23, "Senior Account Manager", 412, true), M(16, "Account Manager", 368, true), M(2, "Account Manager · LatAm", 344, false, "14:00 – 23:00"), M(11, "Junior Account Manager", 226, true)],
    clients: 1530,
    languages: ["EN", "PT", "ES"],
    flag: "gb",
    hours: "09:00 – 23:00",
    capacity: 2000,
    kpis: [
      { label: "Calls today", value: "412", delta: 8.4, good: "up" },
      { label: "FTDs MTD", value: "186", delta: 12.1, good: "up" },
      { label: "Conversion", value: "14.2%", delta: 1.3, good: "up" },
      { label: "Net deposits", value: "$1.24M", delta: 9.6, good: "up" },
    ],
    sla: { label: "Lead called < 15 min", pct: 91.4 },
    trend: tr(31, 120),
  },
  {
    key: "sales-hi",
    name: "Sales HI",
    blurb: "Hindi-speaking desk for India, Nepal and the Gulf diaspora.",
    icon: "globe_with_meridians",
    tone: "gold",
    head: PEOPLE[13]!,
    members: [M(13, "Head of Sales · HI", 150, true), M(21, "Senior Account Manager", 486, true), M(0, "Account Manager", 402, true), M(18, "Account Manager · UR/HI", 318, false, "12:00 – 21:00")],
    clients: 1356,
    languages: ["HI", "EN", "UR"],
    flag: "in",
    hours: "08:00 – 21:00",
    capacity: 1600,
    kpis: [
      { label: "Calls today", value: "538", delta: 14.2, good: "up" },
      { label: "FTDs MTD", value: "224", delta: 18.6, good: "up" },
      { label: "Conversion", value: "16.8%", delta: 2.1, good: "up" },
      { label: "Net deposits", value: "$942K", delta: 6.2, good: "up" },
    ],
    sla: { label: "Lead called < 15 min", pct: 94.8 },
    trend: tr(32, 140),
  },
  {
    key: "retention",
    name: "Retention",
    blurb: "Reactivates dormant traders and grows funded clients' wallets.",
    icon: "gem_stone",
    tone: "up",
    head: PEOPLE[1]!,
    members: [M(1, "Head of Retention", 220, true), M(20, "Retention Manager · AR", 640, true, "10:00 – 19:00"), M(10, "Retention Manager · MY/ID", 588, true, "06:00 – 15:00")],
    clients: 1448,
    languages: ["EN", "AR", "MS"],
    flag: "ae",
    hours: "06:00 – 19:00",
    capacity: 1800,
    kpis: [
      { label: "Reactivated", value: "142", delta: 6.8, good: "up" },
      { label: "Retention 90d", value: "71.4%", delta: 1.9, good: "up" },
      { label: "Redeposit rate", value: "38.2%", delta: -1.4, good: "up" },
      { label: "Net deposits", value: "$2.18M", delta: 11.2, good: "up" },
    ],
    sla: { label: "Dormant contacted < 48 h", pct: 88.6 },
    trend: tr(33, 90),
  },
  {
    key: "dealing",
    name: "Dealing",
    blurb: "B-book risk, manual fills, requotes and LP routing, 24/5.",
    icon: "chart_increasing",
    tone: "info",
    head: PEOPLE[19]!,
    members: [M(19, "Head of Dealing", 0, true, "24/5 · A shift"), M(15, "Senior Dealer", 0, true, "24/5 · B shift"), M(14, "Dealer · Asia", 0, false, "24/5 · C shift")],
    clients: 0,
    languages: ["EN", "TR", "JA"],
    flag: "cy",
    hours: "24/5",
    capacity: 0,
    kpis: [
      { label: "Manual fills", value: "1,284", delta: -4.2, good: "down" },
      { label: "Avg slippage", value: "0.12 pips", delta: -8.1, good: "down" },
      { label: "Requote rate", value: "0.31%", delta: -0.4, good: "down" },
      { label: "B-book P&L MTD", value: "$684K", delta: 5.4, good: "up" },
    ],
    sla: { label: "Fill < 150 ms", pct: 99.2 },
    trend: tr(34, 60),
  },
  {
    key: "compliance",
    name: "KYC / Compliance",
    blurb: "KYC review, AML screening, source-of-funds and regulatory reports.",
    icon: "identification_card",
    tone: "warn",
    head: PEOPLE[6]!,
    members: [M(6, "MLRO · Head of Compliance", 0, true), M(22, "KYC Analyst", 0, true, "12:00 – 21:00"), M(17, "AML Analyst", 0, true)],
    clients: 0,
    languages: ["EN", "IT", "TL"],
    flag: "it",
    hours: "08:00 – 22:00",
    capacity: 0,
    kpis: [
      { label: "Files reviewed", value: "2,410", delta: 9.8, good: "up" },
      { label: "Avg decision", value: "38 min", delta: -12.4, good: "down" },
      { label: "Approval rate", value: "82.6%", delta: 0.8, good: "up" },
      { label: "AML alerts open", value: "7", delta: -30, good: "down" },
    ],
    sla: { label: "KYC decision < 2 h", pct: 93.1 },
    trend: tr(35, 80),
  },
  {
    key: "finance",
    name: "Finance",
    blurb: "Withdrawal approvals, PSP reconciliation and IB payouts.",
    icon: "bank",
    tone: "gold",
    head: PEOPLE[12]!,
    members: [M(12, "Finance Lead", 0, true), M(3, "Payments Officer · APAC", 0, false, "04:00 – 13:00")],
    clients: 0,
    languages: ["EN", "EL", "VI"],
    flag: "cy",
    hours: "04:00 – 20:00",
    capacity: 0,
    kpis: [
      { label: "Payouts MTD", value: "4,812", delta: 7.2, good: "up" },
      { label: "Avg payout time", value: "2h 14m", delta: -9.6, good: "down" },
      { label: "Recon breaks", value: "3", delta: -40, good: "down" },
      { label: "Volume paid", value: "$8.42M", delta: 4.1, good: "up" },
    ],
    sla: { label: "Payout < 4 h", pct: 95.2 },
    trend: tr(36, 100),
  },
  {
    key: "support",
    name: "Support",
    blurb: "24/7 live chat, tickets and phone in EN, AR, ZH and FR.",
    icon: "speech_balloon",
    tone: "ember",
    head: PEOPLE[8]!,
    members: [M(8, "Support Lead", 0, true, "24/7 · A shift"), M(7, "Support Agent · EN/FR", 0, true, "24/7 · A shift"), M(5, "Support Agent · AR", 0, true, "24/7 · B shift"), M(4, "Support Agent · HI", 0, false, "24/7 · C shift")],
    clients: 0,
    languages: ["EN", "AR", "ZH", "FR", "HI"],
    flag: "sg",
    hours: "24/7",
    capacity: 0,
    kpis: [
      { label: "Tickets MTD", value: "6,284", delta: 3.2, good: "down" },
      { label: "First reply", value: "1m 48s", delta: -14.2, good: "down" },
      { label: "CSAT", value: "4.72", delta: 1.1, good: "up" },
      { label: "AI deflection", value: "46%", delta: 5.8, good: "up" },
    ],
    sla: { label: "First reply < 5 min", pct: 97.4 },
    trend: tr(37, 70),
  },
];

/* ------------------------------------------------------------------ */
/* Staff KPIs & commissions                                            */
/* ------------------------------------------------------------------ */

export type KpiPeriod = "today" | "week" | "mtd" | "qtd";
export const KPI_PERIOD_FACTOR: Record<KpiPeriod, number> = { today: 1 / 17, week: 5 / 17, mtd: 1, qtd: 2.6 };
export const KPI_PERIOD_LABEL: Record<KpiPeriod, string> = { today: "Today", week: "This week", mtd: "September MTD", qtd: "Q3 to date" };

export interface KpiPlan {
  id: string;
  name: string;
  desk: string;
  rules: string[];
  cap: string;
  tone: "ember" | "gold" | "up" | "info";
}

export const KPI_PLANS: KpiPlan[] = [
  { id: "plan_sales", name: "Sales · FTD + NDA", desk: "Sales", rules: ["$40 per FTD ≥ $250", "1.5% of net deposits above $50k", "+20% accelerator above 110% of target"], cap: "$9,000 / month", tone: "ember" },
  { id: "plan_sales_jr", name: "Sales · Junior", desk: "Sales", rules: ["$30 per FTD ≥ $250", "1% of net deposits above $25k"], cap: "$4,000 / month", tone: "gold" },
  { id: "plan_ret", name: "Retention · Reactivation", desk: "Retention", rules: ["$60 per reactivated trader", "2% of redeposits from dormant book", "Clawback if withdrawn < 30 days"], cap: "$7,500 / month", tone: "up" },
  { id: "plan_sup", name: "Support · CSAT", desk: "Support", rules: ["$300 flat at CSAT ≥ 4.6", "$1 per ticket above 400"], cap: "$900 / month", tone: "info" },
];

export interface KpiAgent {
  id: string;
  person: Person;
  desk: DskKey;
  deskName: string;
  planId: string;
  calls: number;
  ftds: number;
  conversion: number; // %
  netDeposits: number; // USD, MTD
  retention: number; // %
  csat: number;
  target: number; // % of target MTD
  commission: number; // earned MTD
  trend: number[];
}

const AG: [number, DskKey, string][] = [
  [21, "sales-hi", "plan_sales"],
  [23, "sales-en", "plan_sales"],
  [0, "sales-hi", "plan_sales"],
  [20, "retention", "plan_ret"],
  [16, "sales-en", "plan_sales"],
  [10, "retention", "plan_ret"],
  [2, "sales-en", "plan_sales"],
  [18, "sales-hi", "plan_sales_jr"],
  [11, "sales-en", "plan_sales_jr"],
  [1, "retention", "plan_ret"],
  [7, "support", "plan_sup"],
  [5, "support", "plan_sup"],
  [4, "support", "plan_sup"],
];

export const KPI_AGENTS: KpiAgent[] = AG.map(([pi, desk, planId], i) => {
  const r = seeded(5600 + i);
  const isSales = desk.startsWith("sales");
  const isRet = desk === "retention";
  const calls = isSales ? r.int(820, 1480) : isRet ? r.int(540, 920) : r.int(60, 140);
  const ftds = isSales ? Math.round(calls * r.range(0.045, 0.085)) : isRet ? r.int(8, 24) : 0;
  const conversion = isSales ? +r.range(11.5, 19.8).toFixed(1) : isRet ? +r.range(22, 34).toFixed(1) : +r.range(2, 6).toFixed(1);
  const netDeposits = Math.round(isSales ? ftds * r.range(2400, 5200) : isRet ? r.range(380_000, 820_000) : r.range(8_000, 30_000));
  const retention = +(isRet ? r.range(68, 79) : isSales ? r.range(52, 66) : r.range(60, 72)).toFixed(1);
  const csat = +r.range(4.31, 4.94).toFixed(2);
  const capMonthly: Record<string, number> = { plan_sales: 9000, plan_sales_jr: 4000, plan_ret: 7500, plan_sup: 900 };
  const rawCommission = +(planId === "plan_sales" ? ftds * 40 + Math.max(0, netDeposits - 50_000) * 0.015 : planId === "plan_sales_jr" ? ftds * 30 + Math.max(0, netDeposits - 25_000) * 0.01 : planId === "plan_ret" ? ftds * 60 + netDeposits * 0.006 : r.range(420, 880)).toFixed(2);
  const commission = Math.min(rawCommission, capMonthly[planId]!);
  return {
    id: `agt_${3100 + i}`,
    person: PEOPLE[pi]!,
    desk,
    deskName: DSK_DESKS.find((d) => d.key === desk)!.name,
    planId,
    calls,
    ftds,
    conversion,
    netDeposits,
    retention,
    csat,
    target: Math.round(r.range(66, 132)),
    commission,
    trend: Array.from({ length: 14 }, (_, j) => Math.round(30 + j * 3 + r.range(-8, 10))),
  };
}).sort((a, b) => b.netDeposits - a.netDeposits);
