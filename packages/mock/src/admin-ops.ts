/**
 * Back Office — Command Center, risk, queues, alerts, system health mocks.
 */
import { seeded, hashString } from "./rng";
import { getInstrument } from "./symbols";
import { ADMIN_NOW, CLIENTS, KYC_QUEUE, getClient, STAFF_MEMBERS, IB_PARTNERS, type AdminClient } from "./admin-clients";

const MIN = 60_000;
const HOUR = 3_600_000;
const DAY = 86_400_000;
const iso = (t: number) => new Date(t).toISOString();

/* ------------------------------------------------------------------ */
/* KPIs                                                                */
/* ------------------------------------------------------------------ */

export const OPS_KPIS = {
  depositsToday: 124220.0,
  depositsCount: 186,
  depositsDelta: 12.4,
  withdrawalsToday: 82480.0,
  withdrawalsPending: 7,
  netDeposits: 41740.0,
  netDelta: 8.1,
  ftds: 38,
  ftdsDelta: 9,
  activeTraders: 1942,
  online: 612,
  bookPnlToday: 19904.55,
  bBookShare: 94,
};

/* ------------------------------------------------------------------ */
/* Exposure                                                            */
/* ------------------------------------------------------------------ */

export interface ExposureRow {
  symbol: string;
  buyLots: number;
  sellLots: number;
  avgBuy: number;
  avgSell: number;
  limitUsd: number; // max net notional
  clients: number;
}

/** Aggregated client flow on the B-book, per symbol. */
export const EXPOSURE: ExposureRow[] = [
  { symbol: "XAUUSD", buyLots: 328.7, sellLots: 88.2, avgBuy: 2653.4, avgSell: 2652.9, limitUsd: 74_000_000, clients: 412 },
  { symbol: "EURUSD", buyLots: 186.4, sellLots: 298.6, avgBuy: 1.08478, avgSell: 1.08421, limitUsd: 30_000_000, clients: 356 },
  { symbol: "BTCUSD", buyLots: 42.6, sellLots: 11.3, avgBuy: 63310, avgSell: 63390, limitUsd: 4_000_000, clients: 228 },
  { symbol: "NAS100", buyLots: 1840, sellLots: 610, avgBuy: 20109.5, avgSell: 20121, limitUsd: 40_000_000, clients: 174 },
  { symbol: "GBPUSD", buyLots: 94.2, sellLots: 141.8, avgBuy: 1.27851, avgSell: 1.27902, limitUsd: 12_000_000, clients: 149 },
  { symbol: "USOIL", buyLots: 38.4, sellLots: 97.1, avgBuy: 72.0, avgSell: 71.98, limitUsd: 8_000_000, clients: 97 },
  { symbol: "USDJPY", buyLots: 121.0, sellLots: 64.5, avgBuy: 149.29, avgSell: 149.45, limitUsd: 12_000_000, clients: 132 },
  { symbol: "ETHUSD", buyLots: 380, sellLots: 162, avgBuy: 2610, avgSell: 2631.0, limitUsd: 1_500_000, clients: 118 },
];

/** Net notional in USD for a lot quantity at a price. */
export function notionalUsd(symbol: string, lots: number, price: number) {
  const inst = getInstrument(symbol);
  if (symbol.startsWith("USD") && inst.assetClass === "forex") return lots * inst.contractSize; // USD base
  return lots * inst.contractSize * price;
}

/** Client-side floating P&L for aggregated exposure (broker B-book P&L is the negative). */
export function exposureClientPnl(row: ExposureRow, bid: number, ask: number) {
  const inst = getInstrument(row.symbol);
  let pnl = row.buyLots * (bid - row.avgBuy) * inst.contractSize + row.sellLots * (row.avgSell - ask) * inst.contractSize;
  if (row.symbol.endsWith("JPY")) pnl /= bid;
  return pnl;
}

export const RISK_INDEX = { value: 62, label: "Elevated", marginUsed: 410_000, floatingPnl: -40820.0 };

/* ------------------------------------------------------------------ */
/* Book P&L intraday (5-minute points from 00:00 server time)          */
/* ------------------------------------------------------------------ */

export interface IntradayPoint {
  t: number; // ms epoch
  pnl: number; // cumulative book P&L (USD)
  realized: number;
  volume: number; // lots traded in the bucket
}

export const BOOK_PNL_INTRADAY: IntradayPoint[] = (() => {
  const r = seeded(2409);
  const start = Date.parse("2026-09-23T21:00:00Z"); // 00:00 GMT+3
  const n = Math.floor((ADMIN_NOW - start) / (5 * MIN)) + 1;
  const out: IntradayPoint[] = [];
  let v = 0;
  let real = 0;
  for (let i = 0; i < n; i++) {
    const hour = (i * 5) / 60;
    // quiet Asia, busier London, spike around NY open (15:30–17:00 GMT+3)
    const act = hour < 9 ? 0.5 : hour < 15 ? 1 : hour < 17.5 ? 2.2 : 1.4;
    const drift = hour > 15.4 && hour < 16.2 ? -420 : hour > 16.2 && hour < 17.2 ? 520 : 58;
    v += drift + r.normal() * 520 * act;
    real += Math.max(0, r.normal() * 90 + 70) * act;
    out.push({ t: start + i * 5 * MIN, pnl: v, realized: real, volume: Math.round((40 + r.next() * 120) * act) });
  }
  const k = OPS_KPIS.bookPnlToday / out[out.length - 1]!.pnl;
  return out.map((p) => ({ ...p, pnl: +(p.pnl * k).toFixed(2), realized: +(p.realized * (11_240 / real)).toFixed(2) }));
})();

export const REVENUE_STREAMS = [
  { label: "Spread markup", value: 8408.1, share: 42 },
  { label: "Commission (ECN)", value: 4812.4, share: 24 },
  { label: "Swaps", value: 1920.66, share: 10 },
  { label: "B-book trading P&L", value: 4763.39, share: 24 },
];

export const AB_SPLIT = { a: 6, b: 94, aLots: 412.6, bLots: 6_472.3 };

/* ------------------------------------------------------------------ */
/* Withdrawals                                                         */
/* ------------------------------------------------------------------ */

export interface RiskCheck {
  key: "kyc" | "bonus" | "ip" | "wallet" | "aml" | "margin";
  label: string;
  ok: boolean;
  detail: string;
}

export interface WithdrawalRequest {
  id: string;
  clientId: string;
  amount: number;
  asset: "USDT";
  network: "TRC20";
  address: string;
  requested: string;
  slaMins: number;
  checks: RiskCheck[];
  firstWithdrawal: boolean;
  source: "wallet" | "account";
  login?: string;
}

export const WITHDRAWAL_QUEUE: WithdrawalRequest[] = (() => {
  const r = seeded(611);
  const ids = [1, 2, 13, 7, 27, 44, 58, 31, 66];
  const amounts = [4800, 2120, 48000, 960, 12500, 3380, 715.5, 25400, 1840];
  return ids.map((ci, i) => {
    const c = CLIENTS[ci]!;
    const ipOk = i !== 0 && i !== 4;
    const walletOk = i !== 2;
    const bonusOk = i !== 5;
    return {
      id: `WD-${771240 + i * 13}`,
      clientId: c.id,
      amount: amounts[i]!,
      asset: "USDT",
      network: "TRC20",
      address: i === 2 ? "TN4bXq8LmYv2P9sKdRw3cH6fJ1aZt8u8Qa" : c.wallet,
      requested: iso(ADMIN_NOW - [14, 28, 41, 55, 70, 96, 120, 150, 190][i]! * MIN),
      slaMins: [106, 92, 19, 65, -4, 24, 0, -30, -70][i]!,
      firstWithdrawal: i === 2 || i === 6,
      source: r.bool(0.7) ? "wallet" : "account",
      login: c.logins[0],
      checks: [
        { key: "kyc", label: "KYC", ok: c.kyc === "verified" || i < 2, detail: "Level 2 verified" },
        { key: "bonus", label: "Bonus", ok: bonusOk, detail: bonusOk ? "No active bonus" : "Bonus $100 active · 3.1/5 lots" },
        { key: "ip", label: "IP", ok: ipOk, detail: ipOk ? "Matches login country" : "IP country ≠ KYC country (DE vs AE)" },
        { key: "wallet", label: "Wallet", ok: walletOk, detail: walletOk ? "Address used for deposits" : "New address · shared with #100561" },
        { key: "aml", label: "AML", ok: i !== 2, detail: i === 2 ? "Rule R-101 rapid in/out" : "No rule hits" },
        { key: "margin", label: "Margin", ok: true, detail: "Free margin sufficient" },
      ],
    };
  });
})();

/* ------------------------------------------------------------------ */
/* Alerts                                                              */
/* ------------------------------------------------------------------ */

export type AlertSeverity = "critical" | "high" | "medium" | "low";
export type AlertType = "feed" | "exposure" | "finance" | "aml" | "wallet" | "system";

export interface OpsAlert {
  id: string;
  severity: AlertSeverity;
  type: AlertType;
  title: string;
  detail: string;
  time: string;
  status: "new" | "acknowledged" | "assigned" | "resolved";
  assigneeId?: string;
  source: string;
  href?: string;
}

export const ALERTS: OpsAlert[] = [
  { id: "ALR-5521", severity: "critical", type: "feed", title: "USOIL feed stale 4.2s — trading auto-paused", detail: "No ticks from Infoways primary for 4.2s (threshold 3s). Symbol set to close-only until feed recovers.", time: iso(ADMIN_NOW - 58 * 1000), status: "new", source: "market-data", href: "/command/system" },
  { id: "ALR-5520", severity: "high", type: "exposure", title: "XAUUSD net exposure at 86% of limit", detail: "Net long 240.5 lots ($63.8M) vs limit $74M. Consider hedging 50% via A-book.", time: iso(ADMIN_NOW - 2 * MIN), status: "new", source: "risk-engine", href: "/trading/exposure" },
  { id: "ALR-5519", severity: "high", type: "finance", title: "Large withdrawal 48,000 USDT flagged", detail: "First withdrawal, new address shared with another client; AML rule R-101 hit.", time: iso(ADMIN_NOW - 6 * MIN), status: "acknowledged", assigneeId: "ST-110", source: "wallet", href: "/command/queues" },
  { id: "ALR-5518", severity: "medium", type: "wallet", title: "Hot wallet TRX gas low (1,240 TRX)", detail: "Estimated ~410 withdrawals left. Top up from cold wallet or enable energy rental.", time: iso(ADMIN_NOW - 9 * MIN), status: "new", source: "wallet", href: "/finance/wallets" },
  { id: "ALR-5517", severity: "high", type: "aml", title: "Structuring pattern — 3 deposits of $9,8xx", detail: "Rule R-102 on client #100499 within 5 days.", time: iso(ADMIN_NOW - 14 * MIN), status: "assigned", assigneeId: "ST-108", source: "aml-engine", href: "/clients/aml" },
  { id: "ALR-5516", severity: "medium", type: "exposure", title: "ETHUSD net exposure at 71% of limit", detail: "Net long 218 lots after BTC rally follow-through.", time: iso(ADMIN_NOW - 22 * MIN), status: "acknowledged", source: "risk-engine", href: "/trading/exposure" },
  { id: "ALR-5515", severity: "low", type: "system", title: "fix-gateway p99 latency 182ms (SLO 150ms)", detail: "Elevated for 6 minutes; LP not connected so no client impact.", time: iso(ADMIN_NOW - 31 * MIN), status: "new", source: "observability", href: "/command/system" },
  { id: "ALR-5514", severity: "medium", type: "feed", title: "GER40 spread widened to 4.8 (avg 1.4)", detail: "Pre-open auction; spread filter applied.", time: iso(ADMIN_NOW - 44 * MIN), status: "resolved", source: "market-data" },
  { id: "ALR-5513", severity: "high", type: "aml", title: "Sanctions re-screen hit — 1 PEP match", detail: "Nightly re-screen matched Hassan Karimi (UBO, Meridian Capital) to PEP list Tier 2.", time: iso(ADMIN_NOW - 70 * MIN), status: "assigned", assigneeId: "ST-107", source: "screening", href: "/clients/kyc" },
  { id: "ALR-5512", severity: "low", type: "finance", title: "Daily reconciliation matched", detail: "Ledger vs on-chain balances matched at 06:00 (Δ 0.00 USDT).", time: iso(ADMIN_NOW - 12 * HOUR), status: "resolved", source: "ledger" },
  { id: "ALR-5511", severity: "medium", type: "system", title: "Redis memory 78% on cache-02", detail: "Eviction policy allkeys-lru; no errors.", time: iso(ADMIN_NOW - 3 * HOUR), status: "acknowledged", source: "observability" },
  { id: "ALR-5510", severity: "critical", type: "wallet", title: "Withdrawal signer timeout (2 txs)", detail: "HSM signer did not respond in 10s; txs re-queued automatically.", time: iso(ADMIN_NOW - 5 * HOUR), status: "resolved", source: "wallet" },
];

export const ALERT_RULES = [
  { id: "AR-1", type: "feed" as AlertType, name: "Stale feed", condition: "No tick for > 3s on any enabled symbol", action: "Auto-pause symbol (close-only) + page dealer", severity: "critical" as AlertSeverity, enabled: true, channels: ["In-app", "Telegram", "SMS"] },
  { id: "AR-2", type: "exposure" as AlertType, name: "Exposure limit", condition: "Net notional ≥ 70% (warn) / 85% (high) of symbol limit", action: "Notify dealing desk; suggest A-book hedge", severity: "high" as AlertSeverity, enabled: true, channels: ["In-app", "Telegram"] },
  { id: "AR-3", type: "finance" as AlertType, name: "Large withdrawal", condition: "Single withdrawal ≥ 10,000 USDT or first withdrawal ≥ 5,000", action: "Hold for manual approval (2 approvers)", severity: "high" as AlertSeverity, enabled: true, channels: ["In-app", "Email"] },
  { id: "AR-4", type: "wallet" as AlertType, name: "TRX gas low", condition: "Hot wallet TRX < 2,000", action: "Notify finance; auto top-up from cold if enabled", severity: "medium" as AlertSeverity, enabled: true, channels: ["In-app", "Email"] },
  { id: "AR-5", type: "aml" as AlertType, name: "AML rule hit", condition: "Any enabled AML rule triggers", action: "Open case, hold withdrawals", severity: "high" as AlertSeverity, enabled: true, channels: ["In-app"] },
  { id: "AR-6", type: "system" as AlertType, name: "Service latency SLO", condition: "p99 > SLO for 5 min", action: "Page on-call engineer", severity: "medium" as AlertSeverity, enabled: true, channels: ["PagerDuty", "In-app"] },
  { id: "AR-7", type: "exposure" as AlertType, name: "Book drawdown", condition: "Book P&L today ≤ -$150,000", action: "Page head of dealing; freeze new VIP groups", severity: "critical" as AlertSeverity, enabled: true, channels: ["In-app", "SMS", "Telegram"] },
  { id: "AR-8", type: "wallet" as AlertType, name: "Hot wallet above cap", condition: "Hot wallet > 300,000 USDT", action: "Sweep excess to cold wallet", severity: "low" as AlertSeverity, enabled: false, channels: ["In-app"] },
];

/* ------------------------------------------------------------------ */
/* Toxic flow                                                          */
/* ------------------------------------------------------------------ */

export interface ToxicFlowRow {
  clientId: string;
  login: string;
  score: number; // 1..10
  pattern: "Latency arbitrage" | "Scalping" | "News straddle" | "Swap arbitrage" | "Hedging across brokers";
  winRate: number;
  avgHoldSec: number;
  lots: number;
  pnl: number;
  trades: number;
  route: "A" | "B";
}

export const TOXIC_FLOW: ToxicFlowRow[] = (() => {
  const idx = [9, 15, 21, 33, 48, 62, 79];
  const specs: [number, ToxicFlowRow["pattern"], number, number, number, number, number][] = [
    [9.2, "Latency arbitrage", 91.4, 38, 1240.5, 14208.5, 812],
    [8.7, "Scalping", 84.2, 84, 840.2, 8122.1, 1204],
    [8.1, "News straddle", 72.9, 212, 402.0, 6410.8, 96],
    [7.4, "Scalping", 68.5, 96, 611.3, 3208.4, 744],
    [6.8, "Hedging across brokers", 58.1, 5400, 322.0, 2106.9, 188],
    [6.2, "Swap arbitrage", 88.0, 86400 * 2, 150.4, 1880.2, 41],
    [5.9, "Scalping", 61.2, 140, 280.9, 940.6, 402],
  ];
  return specs.map(([score, pattern, winRate, avgHoldSec, lots, pnl, trades], i) => {
    const c = CLIENTS[idx[i]!]!;
    return { clientId: c.id, login: c.logins[0] ?? "80412551", score, pattern, winRate, avgHoldSec, lots, pnl, trades, route: i === 0 ? "A" : "B" };
  });
})();

/* ------------------------------------------------------------------ */
/* Wallets                                                             */
/* ------------------------------------------------------------------ */

export const WALLETS = {
  hot: { usdt: 214_800.0, cap: 300_000, trx: 1240, trxMin: 2000, address: "TKa7hQ3mN9xWb2LpR6vE4sY8cJ1fD5uG2Zt", lastSweep: iso(ADMIN_NOW - 12 * MIN) },
  cold: { usdt: 4_820_000.0, address: "TCo1dV4uLt8Kq2Xn7pF9wR3sM6bH5jE8aYd", signers: "2 of 3 multisig" },
  deposit: { addresses: 18_412, pendingSweeps: 23 },
  reconciliation: { status: "matched" as const, last: iso(Date.parse("2026-09-24T03:00:00Z")), delta: 0 },
  flows24h: [12, 18, 9, 22, 31, 26, 40, 34, 28, 45, 52, 38, 44, 61, 58, 49, 66, 71, 54, 48, 57, 63, 69, 74],
};

/* ------------------------------------------------------------------ */
/* Live risk                                                           */
/* ------------------------------------------------------------------ */

export const RISK_GROUPS = ["Standard", "Pro", "ECN", "Cent", "VIP", "Prop"] as const;

/** Net USD exposure per symbol × group (positive = clients net long). */
export const EXPOSURE_GRID: { symbol: string; cells: number[] }[] = (() => {
  const r = seeded(8812);
  return EXPOSURE.map((e) => {
    const inst = getInstrument(e.symbol);
    const net = notionalUsd(e.symbol, e.buyLots - e.sellLots, inst.price);
    const w = RISK_GROUPS.map(() => r.range(0.2, 1));
    const sw = w.reduce((a, b) => a + b, 0);
    return { symbol: e.symbol, cells: w.map((x, k) => Math.round((net * x) / sw + (k === 4 ? -net * 0.15 : 0) * r.range(0, 1))) };
  });
})();

export interface ClientPnlRow {
  clientId: string;
  login: string;
  pnlToday: number;
  equity: number;
  topSymbol: string;
  trades: number;
}

export const TOP_CLIENTS: { winners: ClientPnlRow[]; losers: ClientPnlRow[] } = (() => {
  const r = seeded(3108);
  const pool = CLIENTS.filter((c) => c.funded && c.equity > 2000);
  const mk = (c: AdminClient, sign: 1 | -1): ClientPnlRow => ({
    clientId: c.id,
    login: c.logins[0] ?? "—",
    pnlToday: +(sign * r.range(1800, 24000)).toFixed(2),
    equity: c.equity,
    topSymbol: r.pick(["XAUUSD", "NAS100", "BTCUSD", "EURUSD", "GBPJPY", "US30"]),
    trades: r.int(4, 140),
  });
  const winners = pool.slice(0, 8).map((c) => mk(c, 1)).sort((a, b) => b.pnlToday - a.pnlToday);
  const losers = pool.slice(8, 16).map((c) => mk(c, -1)).sort((a, b) => a.pnlToday - b.pnlToday);
  return { winners, losers };
})();

export interface MarginCallRow {
  clientId: string;
  login: string;
  group: string;
  equity: number;
  margin: number;
  /** ML sensitivity to the main symbol: ML changes by `beta` % per 1% move */
  symbol: string;
  side: "buy" | "sell";
  lots: number;
  stopOut: number; // %
}

export const MARGIN_CALLS: MarginCallRow[] = (() => {
  const r = seeded(4410);
  const pool = CLIENTS.filter((c) => c.funded).slice(20, 32);
  return pool.map((c, i) => {
    const margin = +r.range(800, 14000).toFixed(2);
    const ml = [96, 88, 81, 74, 67, 61, 58, 54, 52, 91, 99, 72][i]!;
    return {
      clientId: c.id,
      login: c.logins[0] ?? "80400000",
      group: c.group,
      equity: +((margin * ml) / 100).toFixed(2),
      margin,
      symbol: r.pick(["XAUUSD", "NAS100", "BTCUSD", "EURUSD", "USOIL", "GBPUSD"]),
      side: r.bool() ? "buy" : "sell",
      lots: +r.range(0.5, 12).toFixed(2),
      stopOut: 50,
    };
  });
})();

export const STOPOUT_LOG = (() => {
  const r = seeded(9910);
  const pool = CLIENTS.filter((c) => c.funded).slice(40, 60);
  return pool.slice(0, 12).map((c, i) => {
    const symbol = r.pick(["XAUUSD", "NAS100", "BTCUSD", "EURUSD", "USOIL", "GBPJPY"]);
    return {
      id: `SO-${88120 + i * 3}`,
      time: iso(ADMIN_NOW - r.int(3, 600) * MIN),
      clientId: c.id,
      login: c.logins[0] ?? "80400000",
      symbol,
      positions: r.int(1, 6),
      lots: +r.range(0.3, 9).toFixed(2),
      ml: +r.range(46, 50).toFixed(1),
      loss: -+r.range(180, 9200).toFixed(2),
      slippage: +r.range(0, 1.8).toFixed(1),
    };
  }).sort((a, b) => Date.parse(b.time) - Date.parse(a.time));
})();

/* ------------------------------------------------------------------ */
/* Queues                                                              */
/* ------------------------------------------------------------------ */

export interface QueueItem {
  id: string;
  clientId: string;
  title: string;
  amount?: number;
  meta: string;
  submitted: string;
  slaMins: number; // remaining
  slaTotal: number;
  priority: "urgent" | "high" | "normal";
}

export const QUEUE_KYC: QueueItem[] = KYC_QUEUE.map((k) => ({
  id: k.id,
  clientId: k.clientId,
  title: `${k.docType}${k.poa ? ` + ${k.poa}` : ""}`,
  meta: `Level ${k.level} · score ${k.providerScore}`,
  submitted: k.submitted,
  slaMins: k.slaMins,
  slaTotal: 240,
  priority: k.slaMins < 30 ? "urgent" : k.providerScore < 60 ? "high" : "normal",
}));

export const QUEUE_WITHDRAWALS: QueueItem[] = WITHDRAWAL_QUEUE.map((w) => ({
  id: w.id,
  clientId: w.clientId,
  title: "USDT · TRC20",
  amount: w.amount,
  meta: w.checks.filter((c) => !c.ok).map((c) => c.label).join(", ") || "All checks passed",
  submitted: w.requested,
  slaMins: w.slaMins,
  slaTotal: 120,
  priority: w.amount >= 10000 || w.slaMins < 20 ? "urgent" : w.checks.some((c) => !c.ok) ? "high" : "normal",
}));

export const QUEUE_PAYOUTS: QueueItem[] = IB_PARTNERS.concat(IB_PARTNERS.slice(0, 1)).map((p, i) => {
  const c = CLIENTS.find((x) => x.name === p.name) ?? CLIENTS[i + 5]!;
  return {
    id: `PAY-${40210 + i * 7}`,
    clientId: c.id,
    title: `IB commission · ${p.id}`,
    amount: [3420.5, 1288.1, 6120.0, 944.8, 2210.4, 512.0][i]!,
    meta: `Period 16–22 Sep · ${[418, 162, 811, 96, 280, 61][i]} lots`,
    submitted: iso(ADMIN_NOW - (i + 1) * 3 * HOUR),
    slaMins: [410, 300, 120, 40, -10, 600][i]!,
    slaTotal: 1440,
    priority: i === 4 ? "urgent" : "normal",
  };
});

export const QUEUE_MASTERS: QueueItem[] = [12, 19, 26, 37].map((ci, i) => {
  const c = CLIENTS[ci]!;
  return {
    id: `MST-${1180 + i * 3}`,
    clientId: c.id,
    title: ["Copy master", "PAMM manager", "Copy master", "Signal provider"][i]!,
    meta: [`Track record 14 mo · +84.2% · DD 11.8%`, `AUM $412k · 9 investors`, `Track record 7 mo · +38.1% · DD 22.4%`, `Track record 22 mo · +126% · DD 18.0%`][i]!,
    submitted: iso(ADMIN_NOW - (i + 1) * 9 * HOUR),
    slaMins: [900, 400, 60, 1500][i]!,
    slaTotal: 2880,
    priority: i === 2 ? "high" : "normal",
  };
});

export const QUEUE_PROP: QueueItem[] = [8, 17, 29].map((ci, i) => {
  const c = CLIENTS[ci]!;
  return {
    id: `PROP-${7720 + i * 5}`,
    clientId: c.id,
    title: ["$100k Funded · 80% split", "$50k Funded · 80% split", "$200k Funded · 90% split"][i]!,
    amount: [6840.0, 2210.0, 14820.0][i]!,
    meta: ["Cycle 3 · no violations", "Cycle 1 · consistency 38%", "Cycle 5 · news-trading check"][i]!,
    submitted: iso(ADMIN_NOW - (i + 2) * 5 * HOUR),
    slaMins: [620, 180, 30][i]!,
    slaTotal: 1440,
    priority: i === 2 ? "urgent" : "normal",
  };
});

/* ------------------------------------------------------------------ */
/* System health                                                       */
/* ------------------------------------------------------------------ */

export interface ServiceHealth {
  name: string;
  kind: "service" | "datastore";
  status: "healthy" | "degraded" | "down";
  p99: number; // ms
  slo: number;
  rps: number;
  uptime: number; // %
  version: string;
  instances: string;
  series: number[];
}

export const SERVICES: ServiceHealth[] = (() => {
  const defs: [string, ServiceHealth["kind"], number, number, number, string, string][] = [
    ["gateway", "service", 18, 50, 4210, "v2.14.3", "6/6"],
    ["market-data", "service", 6, 20, 18_940, "v1.9.0", "4/4"],
    ["trading-engine", "service", 3.8, 10, 1480, "v3.2.1", "3/3"],
    ["ledger", "service", 11, 40, 620, "v1.22.0", "3/3"],
    ["wallet", "service", 44, 120, 38, "v1.7.4", "2/2"],
    ["social", "service", 26, 80, 212, "v0.18.2", "2/2"],
    ["ib", "service", 31, 80, 96, "v1.4.0", "2/2"],
    ["algo", "service", 22, 60, 144, "v0.9.6", "2/2"],
    ["fix-gateway", "service", 182, 150, 0, "v1.1.0", "1/1"],
    ["notify", "service", 64, 200, 58, "v1.3.2", "2/2"],
    ["Postgres", "datastore", 4.2, 15, 3120, "16.4 · primary + 2", "3/3"],
    ["Timescale", "datastore", 7.8, 25, 21_400, "2.17", "2/2"],
    ["Redis", "datastore", 0.9, 3, 48_200, "7.4 · cluster", "6/6"],
    ["NATS", "datastore", 1.6, 5, 62_800, "2.11 · JetStream", "3/3"],
  ];
  return defs.map(([name, kind, p99, slo, rps, version, instances]) => {
    const r = seeded(hashString(name));
    const degraded = p99 > slo;
    return {
      name,
      kind,
      status: degraded ? "degraded" : "healthy",
      p99,
      slo,
      rps,
      uptime: degraded ? 99.82 : +(99.95 + r.next() * 0.049).toFixed(3),
      version,
      instances,
      series: Array.from({ length: 30 }, (_, i) => Math.max(0.2, p99 * (0.75 + r.next() * 0.4) * (degraded && i > 22 ? 1.4 : 1))),
    };
  });
})();

export const FEED_SYMBOLS = ["EURUSD", "GBPUSD", "USDJPY", "AUDUSD", "USDCAD", "XAUUSD", "XAGUSD", "US30", "NAS100", "SPX500", "GER40", "UK100", "JP225", "USOIL", "UKOIL", "BTCUSD", "ETHUSD", "SOLUSD", "AAPL", "TSLA", "NVDA"];

/** Base tick age (ms) per symbol; stale > 3000ms. */
export const FEED_STATUS = FEED_SYMBOLS.map((symbol, i) => {
  const r = seeded(hashString("feed" + symbol));
  const stale = symbol === "USOIL";
  return {
    symbol,
    provider: i % 5 === 4 ? "Infoways · backup" : "Infoways · primary",
    baseAge: stale ? 4200 : Math.round(r.range(40, symbol === "JP225" || symbol === "GER40" ? 1400 : 700)),
    ticksPerMin: stale ? 0 : r.int(40, 900),
    spread: getInstrument(symbol).spread,
    stale,
  };
});

export const QUEUE_DEPTHS = [
  { name: "orders.inbound", depth: 3, max: 1000, consumers: 6 },
  { name: "executions.out", depth: 1, max: 1000, consumers: 6 },
  { name: "ledger.postings", depth: 42, max: 5000, consumers: 3 },
  { name: "wallet.withdrawals", depth: 7, max: 200, consumers: 2 },
  { name: "wallet.sweeps", depth: 23, max: 500, consumers: 1 },
  { name: "notify.email", depth: 318, max: 10_000, consumers: 2 },
  { name: "notify.push", depth: 96, max: 10_000, consumers: 2 },
  { name: "ib.commissions", depth: 1204, max: 20_000, consumers: 1 },
];

export const ERROR_RATE = (() => {
  const r = seeded(551);
  const start = ADMIN_NOW - 6 * HOUR;
  return Array.from({ length: 72 }, (_, i) => ({
    t: start + i * 5 * MIN,
    rate5xx: Math.max(0, +(0.04 + r.normal() * 0.02 + (i > 58 && i < 64 ? 0.22 : 0)).toFixed(3)),
    rate4xx: Math.max(0, +(0.8 + r.normal() * 0.18).toFixed(3)),
  }));
})();

export const INCIDENTS = [
  { id: "INC-214", title: "USOIL primary feed gap", status: "investigating", started: iso(ADMIN_NOW - 1 * MIN), severity: "critical" as AlertSeverity },
  { id: "INC-213", title: "fix-gateway latency above SLO", status: "monitoring", started: iso(ADMIN_NOW - 31 * MIN), severity: "low" as AlertSeverity },
  { id: "INC-212", title: "HSM signer timeouts", status: "resolved", started: iso(ADMIN_NOW - 5 * HOUR), severity: "high" as AlertSeverity },
];

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

export function clientOf(id: string) {
  return getClient(id);
}

export const OPS_STAFF = STAFF_MEMBERS;

export function slaLabel(mins: number) {
  if (mins < 0) return `-${Math.floor(-mins / 60) ? `${Math.floor(-mins / 60)}h ` : ""}${Math.abs(mins) % 60}m`;
  const h = Math.floor(mins / 60);
  return h ? `${h}h ${String(mins % 60).padStart(2, "0")}m` : `${mins}m`;
}

export { ADMIN_NOW };
export const DAY_MS = DAY;
