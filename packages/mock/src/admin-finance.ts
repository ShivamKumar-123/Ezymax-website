/**
 * Back Office — Finance module mock data.
 * Import via `@ezymex/mock/admin-finance`. All exports are FIN_-prefixed.
 * Everything is derived from the seeded PRNG so server & client renders match.
 * "Now" is 2026-09-24 14:32 server time (GMT+3).
 */
import { seeded } from "./rng";
import type { Person } from "./people";
import { PEOPLE } from "./people";

type R = ReturnType<typeof seeded>;

/* ------------------------------------------------------------------ */
/* Helpers                                                              */
/* ------------------------------------------------------------------ */

/** 2026-09-24 14:32 GMT+3 expressed as a UTC epoch. */
export const FIN_NOW = Date.UTC(2026, 8, 24, 11, 32, 0);
const MIN = 60_000;
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const p2 = (n: number) => String(n).padStart(2, "0");

/** Deterministic GMT+3 formatting (no Intl → no hydration drift). */
export function finTime(minutesAgo: number, mode: "time" | "date" | "full" | "day" = "full") {
  const d = new Date(FIN_NOW - minutesAgo * MIN + 3 * 3600_000);
  const time = `${p2(d.getUTCHours())}:${p2(d.getUTCMinutes())}`;
  const date = `${p2(d.getUTCDate())} ${MONTHS[d.getUTCMonth()]}`;
  if (mode === "time") return time;
  if (mode === "date") return date;
  if (mode === "day") return `${date} ${d.getUTCFullYear()}`;
  return `${date}, ${time}`;
}

export function finAgo(minutesAgo: number) {
  if (minutesAgo < 1) return "just now";
  if (minutesAgo < 60) return `${Math.round(minutesAgo)}m ago`;
  if (minutesAgo < 60 * 24) return `${Math.floor(minutesAgo / 60)}h ${Math.round(minutesAgo % 60)}m ago`;
  return `${Math.floor(minutesAgo / 1440)}d ago`;
}

const HEX = "0123456789abcdef";
const B58 = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
export function finHex(r: R, n = 64) {
  let s = "";
  for (let i = 0; i < n; i++) s += HEX[r.int(0, 15)];
  return s;
}
export function finTronAddr(r: R) {
  let s = "T";
  for (let i = 0; i < 33; i++) s += B58[r.int(0, B58.length - 1)];
  return s;
}
function ethAddr(r: R) {
  return `0x${finHex(r, 40)}`;
}
function btcAddr(r: R) {
  let s = "bc1q";
  const set = "023456789acdefghjklmnpqrstuvwxyz";
  for (let i = 0; i < 38; i++) s += set[r.int(0, set.length - 1)];
  return s;
}
function login(r: R) {
  return String(r.pick([804, 805, 806, 807])) + String(r.int(10000, 99999));
}
const round2 = (v: number) => Math.round(v * 100) / 100;
/** Realistic deposit/withdraw sizes (lots of round-ish numbers, long tail). */
function amount(r: R, lo = 50, hi = 25000) {
  const v = Math.exp(r.range(Math.log(lo), Math.log(hi)));
  if (r.bool(0.35)) return Math.round(v / 50) * 50 || 100;
  return round2(v);
}

export interface FinClient {
  person: Person;
  login: string;
  kycLevel: 0 | 1 | 2 | 3;
  group: string;
}
export const FIN_CLIENTS: FinClient[] = PEOPLE.map((p, i) => {
  const r = seeded(9100 + i);
  return { person: p, login: login(r), kycLevel: (i % 7 === 3 ? 1 : i % 5 === 0 ? 3 : 2) as 0 | 1 | 2 | 3, group: r.pick(["Standard", "Pro · Hedging", "Raw ECN", "Cent", "VIP"]) };
});

/* ------------------------------------------------------------------ */
/* Networks & confirmations                                             */
/* ------------------------------------------------------------------ */

export type FinNetwork = "TRC20" | "ERC20" | "BEP20" | "BTC" | "SOL";
export interface FinChainConfig {
  network: FinNetwork;
  coin: string;
  label: string;
  required: number;
  blockTime: number; // seconds
  avgCreditSec: number;
  minDeposit: number;
  enabled: boolean;
  share: number; // % of 30d volume
}
export const FIN_CHAINS: FinChainConfig[] = [
  { network: "TRC20", coin: "usdt", label: "USDT · Tron", required: 20, blockTime: 3, avgCreditSec: 64, minDeposit: 10, enabled: true, share: 86.4 },
  { network: "ERC20", coin: "eth", label: "USDT · Ethereum", required: 12, blockTime: 12, avgCreditSec: 162, minDeposit: 50, enabled: true, share: 6.1 },
  { network: "BEP20", coin: "bnb", label: "USDT · BNB Chain", required: 15, blockTime: 3, avgCreditSec: 51, minDeposit: 10, enabled: true, share: 4.2 },
  { network: "BTC", coin: "btc", label: "Bitcoin", required: 3, blockTime: 600, avgCreditSec: 1910, minDeposit: 0.0005, enabled: true, share: 2.9 },
  { network: "SOL", coin: "sol", label: "USDC · Solana", required: 32, blockTime: 0.4, avgCreditSec: 19, minDeposit: 10, enabled: false, share: 0.4 },
];
export const FIN_CHAIN: Record<FinNetwork, FinChainConfig> = Object.fromEntries(FIN_CHAINS.map((c) => [c.network, c])) as Record<FinNetwork, FinChainConfig>;

/* ------------------------------------------------------------------ */
/* Deposits (blockchain monitor)                                        */
/* ------------------------------------------------------------------ */

export type FinDepositStatus = "credited" | "confirming" | "unmatched";
export interface FinDeposit {
  id: string;
  client: FinClient | null;
  network: FinNetwork;
  asset: "USDT" | "BTC" | "ETH" | "USDC";
  amount: number;
  usd: number;
  hash: string;
  from: string;
  to: string;
  confirmations: number;
  required: number;
  status: FinDepositStatus;
  minutesAgo: number;
  creditSec?: number;
  unmatchedReason?: string;
  block: number;
}

const UNMATCHED_REASONS = ["Address not assigned to any client", "Deposit to closed account address", "Below chain minimum (10 USDT)", "Token contract not supported", "Sender flagged by chain analytics"];

export const FIN_DEPOSITS: FinDeposit[] = (() => {
  const r = seeded(4401);
  const out: FinDeposit[] = [];
  let m = 0.4;
  for (let i = 0; i < 42; i++) {
    const network: FinNetwork = i < 5 ? "TRC20" : r.pick(["TRC20", "TRC20", "TRC20", "TRC20", "TRC20", "TRC20", "ERC20", "BEP20", "BTC"] as const);
    const cfg = FIN_CHAIN[network];
    const status: FinDepositStatus = i < 6 ? "confirming" : [9, 17, 23, 31, 38].includes(i) ? "unmatched" : "credited";
    const conf = status === "confirming" ? Math.min(cfg.required - 1, [3, 7, 11, 14, 17, 19][i] ?? r.int(1, cfg.required - 1)) : cfg.required + r.int(0, 400);
    const isBtc = network === "BTC";
    const amt = isBtc ? round2(r.range(0.004, 0.42) * 10000) / 10000 : amount(r, 20, 18000);
    const usd = isBtc ? round2(amt * 63412) : amt;
    out.push({
      id: `D-${58210 - i}`,
      client: status === "unmatched" ? null : FIN_CLIENTS[r.int(0, FIN_CLIENTS.length - 1)]!,
      network,
      asset: isBtc ? "BTC" : "USDT",
      amount: amt,
      usd,
      hash: finHex(r),
      from: network === "TRC20" ? finTronAddr(r) : isBtc ? btcAddr(r) : ethAddr(r),
      to: network === "TRC20" ? finTronAddr(r) : isBtc ? btcAddr(r) : ethAddr(r),
      confirmations: conf,
      required: cfg.required,
      status,
      minutesAgo: round2(m),
      creditSec: status === "credited" ? Math.round(cfg.avgCreditSec * r.range(0.8, 1.35)) : undefined,
      unmatchedReason: status === "unmatched" ? UNMATCHED_REASONS[[9, 17, 23, 31, 38].indexOf(i) % UNMATCHED_REASONS.length] : undefined,
      block: 66_412_880 - Math.round(m * 20),
    });
    m += status === "confirming" ? r.range(0.1, 0.4) : r.range(3, 38);
  }
  return out;
})();

export const FIN_DEPOSIT_KPIS = {
  todayUsd: 486_214.4,
  todayCount: 312,
  todayChangePct: 12.6,
  pendingCount: FIN_DEPOSITS.filter((d) => d.status === "confirming").length,
  pendingUsd: FIN_DEPOSITS.filter((d) => d.status === "confirming").reduce((s, d) => s + d.usd, 0),
  unmatchedCount: FIN_DEPOSITS.filter((d) => d.status === "unmatched").length,
  unmatchedUsd: FIN_DEPOSITS.filter((d) => d.status === "unmatched").reduce((s, d) => s + d.usd, 0),
  autoCreditRate: 98.4,
  avgCreditSec: 71,
};

/** 30 days of deposits: auto-credited vs manually resolved (USD). */
export const FIN_DEPOSITS_30D: { label: string; values: number[] }[] = (() => {
  const r = seeded(512);
  return Array.from({ length: 30 }, (_, i) => {
    const daysAgo = 29 - i;
    const d = new Date(FIN_NOW - daysAgo * 86400_000 + 3 * 3600_000);
    const weekend = d.getUTCDay() === 0 || d.getUTCDay() === 6;
    const base = (weekend ? 240_000 : 380_000) * (1 + i * 0.012) * r.range(0.82, 1.18);
    const manual = base * r.range(0.008, 0.03);
    return { label: `${p2(d.getUTCDate())} ${MONTHS[d.getUTCMonth()]}`, values: [Math.round(base - manual), Math.round(manual)] };
  });
})();

/* ------------------------------------------------------------------ */
/* Withdrawals                                                          */
/* ------------------------------------------------------------------ */

export type FinCheck = "ok" | "warn" | "fail";
export type FinWithdrawalStatus = "pending" | "approved" | "sent" | "rejected";
export interface FinWithdrawal {
  id: string;
  client: FinClient;
  amount: number;
  fee: number;
  network: FinNetwork;
  address: string;
  status: FinWithdrawalStatus;
  minutesAgo: number;
  checks: { kyc: FinCheck; bonus: FinCheck; recentDeposit: FinCheck; ipMatch: FinCheck; pnl: FinCheck };
  risk: number;
  lifetimeDeposits: number;
  lifetimeWithdrawals: number;
  pnl: number;
  addressReuse: number; // other accounts using same address
  addressHistory: { address: string; uses: number; lastMinutesAgo: number; whitelisted: boolean }[];
  lastDepositHoursAgo: number;
  ip: string;
  device: string;
  hash?: string;
  rejectReason?: string;
  approvedBy?: string;
  source: string;
}

export const FIN_WITHDRAWALS: FinWithdrawal[] = (() => {
  const r = seeded(7703);
  const out: FinWithdrawal[] = [];
  const statuses: FinWithdrawalStatus[] = [
    ...Array<FinWithdrawalStatus>(14).fill("pending"),
    ...Array<FinWithdrawalStatus>(5).fill("approved"),
    ...Array<FinWithdrawalStatus>(16).fill("sent"),
    ...Array<FinWithdrawalStatus>(6).fill("rejected"),
  ];
  statuses.forEach((status, i) => {
    const client = FIN_CLIENTS[(i * 7 + 3) % FIN_CLIENTS.length]!;
    const risky = [2, 6, 11].includes(i) || (status === "rejected" && i % 2 === 0);
    const kyc: FinCheck = client.kycLevel < 2 ? "fail" : "ok";
    const bonus: FinCheck = risky && r.bool(0.6) ? "warn" : r.bool(0.1) ? "warn" : "ok";
    const lastDepositHoursAgo = risky ? r.range(1, 20) : r.range(30, 900);
    const recentDeposit: FinCheck = lastDepositHoursAgo < 24 ? "warn" : "ok";
    const ipMatch: FinCheck = risky && r.bool(0.5) ? "fail" : r.bool(0.08) ? "warn" : "ok";
    const pnlVal = risky ? r.range(-400, 22000) : r.range(-3000, 6000);
    const pnl: FinCheck = pnlVal > 15000 ? "warn" : "ok";
    const addressReuse = risky && r.bool(0.7) ? r.int(1, 3) : 0;
    const address = finTronAddr(r);
    const score = Math.min(96, Math.round(8 + (kyc === "fail" ? 30 : 0) + (bonus === "warn" ? 14 : 0) + (recentDeposit === "warn" ? 16 : 0) + (ipMatch === "fail" ? 22 : ipMatch === "warn" ? 8 : 0) + (pnl === "warn" ? 10 : 0) + addressReuse * 9 + r.range(0, 8)));
    const amt = amount(r, 80, 24000);
    const deps = round2(amt * r.range(1.4, 9));
    out.push({
      id: `W-${20931 - i}`,
      client,
      amount: amt,
      fee: 1,
      network: "TRC20",
      address,
      status,
      minutesAgo: status === "pending" ? round2(4 + i * r.range(6, 22)) : round2(180 + i * r.range(20, 80)),
      checks: { kyc, bonus, recentDeposit, ipMatch, pnl },
      risk: score,
      lifetimeDeposits: deps,
      lifetimeWithdrawals: round2(deps * r.range(0.1, 0.7)),
      pnl: round2(pnlVal),
      addressReuse,
      addressHistory: [
        { address, uses: r.int(1, 9), lastMinutesAgo: r.range(2000, 40000), whitelisted: addressReuse === 0 },
        ...(r.bool(0.6) ? [{ address: finTronAddr(r), uses: r.int(1, 4), lastMinutesAgo: r.range(40000, 160000), whitelisted: true }] : []),
      ],
      lastDepositHoursAgo: round2(lastDepositHoursAgo),
      ip: `${r.int(31, 213)}.${r.int(1, 254)}.${r.int(1, 254)}.${r.int(1, 254)}`,
      device: r.pick(["iPhone 15 · iOS 19", "Chrome 131 · Windows", "Safari · macOS", "Pixel 9 · Android 16", "MT5 Desktop · Windows"]),
      hash: status === "sent" ? finHex(r) : undefined,
      rejectReason: status === "rejected" ? r.pick(["Bonus turnover not met", "Third-party address", "KYC incomplete", "Suspected arbitrage abuse"]) : undefined,
      approvedBy: status === "approved" || status === "sent" ? r.pick(["Priya Nair", "James Carter", "Elena Petrova"]) : undefined,
      source: r.pick(["Wallet", "Wallet", "Account 80412337", "IB balance"]),
    });
  });
  return out;
})();

export const FIN_WITHDRAW_REASONS = {
  approve: ["All checks passed", "Manual review – source of funds verified", "Risk accepted – known client", "VIP fast-track"],
  reject: ["Bonus turnover not met", "Third-party / unverified address", "KYC incomplete", "Suspected arbitrage / latency abuse", "Address shared with other accounts", "Client request – cancel"],
};

/* ------------------------------------------------------------------ */
/* Wallets                                                              */
/* ------------------------------------------------------------------ */

export const FIN_HOT_WALLET = {
  label: "Hot wallet · TRON",
  address: "TKs9vN3pQ7hR2xYb8LmWc4Fz6JdT1aEuGo",
  usdt: 412_880.52,
  usdtCap: 600_000,
  trx: 1_842.6,
  trxMin: 5_000,
  trxTarget: 25_000,
  energy: 186_400,
  bandwidth: 5_120,
  trxPrice: 0.1586,
  lastTopUpMinutesAgo: 3160,
  pendingOutflow: 0,
};

export const FIN_COLD_WALLETS = [
  { id: "cold-1", label: "Cold vault A · TRON", address: "TGb4Rz7uX2kP9wQm3Nc8Hy5LdV6sJfE1oA", asset: "USDT", balance: 8_214_602.18, scheme: "2 of 3 multisig", signers: ["Priya Nair", "James Carter", "Hardware HSM"], lastMoveMinutesAgo: 4320 * 2, lastMove: -250_000, location: "Frankfurt HSM · Thales Luna 7" },
  { id: "cold-2", label: "Cold vault B · Bitcoin", address: "bc1q9x7m4c2vzr8u3kqh6wn0d5lf2ygsa8tpe4c7jd", asset: "BTC", balance: 18.4127, scheme: "2 of 3 multisig", signers: ["Priya Nair", "Elena Petrova", "Hardware HSM"], lastMoveMinutesAgo: 30240, lastMove: 2.5, location: "Zurich HSM · Thales Luna 7" },
];

export interface FinSweepItem {
  id: string;
  address: string;
  index: number;
  client: FinClient;
  usdt: number;
  trxNeeded: number;
  ageMinutes: number;
}
export const FIN_SWEEP_QUEUE: FinSweepItem[] = (() => {
  const r = seeded(3301);
  return Array.from({ length: 14 }, (_, i) => ({
    id: `SW-Q${i + 1}`,
    address: finTronAddr(r),
    index: 18_442 - i * r.int(3, 40),
    client: FIN_CLIENTS[(i * 5 + 1) % FIN_CLIENTS.length]!,
    usdt: amount(r, 60, 16000),
    trxNeeded: round2(r.range(13.2, 27.8)),
    ageMinutes: round2(r.range(8, 700)),
  })).sort((a, b) => b.usdt - a.usdt);
})();

export const FIN_SWEEP_HISTORY = (() => {
  const r = seeded(3302);
  return Array.from({ length: 10 }, (_, i) => {
    const count = r.int(18, 140);
    return { id: `SWP-${7712 - i}`, minutesAgo: 90 + i * 360 + r.int(0, 60), addresses: count, usdt: round2(count * r.range(420, 1900)), trxFee: round2(count * r.range(13.4, 27)), hash: finHex(r), status: (i === 3 ? "partial" : "completed") as "completed" | "partial", to: i % 4 === 0 ? "Cold vault A" : "Hot wallet" };
  });
})();

export const FIN_HD = {
  path: "m/44'/195'/0'/0/n",
  xpub: "xpub6CUGRUonZSQ4TWtTMmzXdrXDtypWKiKrhko4egpiMZbpiaQL2jkwSB1icqYh2cfDfVxdx4df189oLKnC5fSwqPfgyP3hooxujYzAu3fDVmz",
  addresses: 18_442,
  activeAddresses: 11_806,
  nextIndex: 18_443,
  hsm: "Thales Luna 7 · FIPS 140-3 L3",
  keyCeremony: "12 Mar 2026",
  tenant: "Ezymex Markets",
  tenantId: "tn_ezymex_01",
};

/* ------------------------------------------------------------------ */
/* Reconciliation                                                        */
/* ------------------------------------------------------------------ */

export interface FinReconRun {
  id: string;
  daysAgo: number;
  date: string;
  blockchain: number;
  ledger: number;
  trading: number;
  pending: number;
  delta: number;
  mismatches: number;
  status: "matched" | "mismatch" | "resolved";
  durationSec: number;
  trigger: "Scheduled" | "Manual";
}
export const FIN_RECON_RUNS: FinReconRun[] = (() => {
  const r = seeded(6060);
  let chain = 8_401_000;
  const runs: FinReconRun[] = [];
  for (let i = 29; i >= 0; i--) {
    chain += r.range(-60_000, 110_000);
    const mis = i === 0 ? 6 : [3, 8, 13, 21, 26].includes(i) ? r.int(1, 4) : 0;
    const delta = mis ? round2(r.range(12, 4800) * (r.bool(0.3) ? -1 : 1)) : 0;
    const pending = round2(r.range(8_000, 42_000));
    const blockchain = round2(chain);
    const ledger = round2(blockchain - pending - delta);
    const trading = round2(ledger * r.range(0.71, 0.76));
    runs.push({
      id: `RC-${260924 - i}`,
      daysAgo: i,
      date: finTime(i * 1440 + (14 * 60 + 32 - 6 * 60), "day"),
      blockchain,
      ledger,
      trading,
      pending,
      delta: i === 0 ? 5_112.57 : delta,
      mismatches: mis,
      status: mis === 0 ? "matched" : i === 0 ? "mismatch" : "resolved",
      durationSec: r.int(38, 140),
      trigger: i === 11 ? "Manual" : "Scheduled",
    });
  }
  return runs.reverse();
})();

export type FinMismatchType = "Deposit on-chain, not credited" | "Ledger entry without tx" | "Withdrawal sent, ledger pending" | "Rounding difference" | "Trading ↔ wallet transfer drift" | "Duplicate credit";
export interface FinMismatch {
  id: string;
  type: FinMismatchType;
  amount: number;
  client: FinClient | null;
  hash?: string;
  ref: string;
  side: "chain" | "ledger" | "trading";
  detail: string;
  status: "open" | "resolved";
}
export const FIN_MISMATCHES: FinMismatch[] = (() => {
  const r = seeded(6161);
  const c = (i: number) => FIN_CLIENTS[i]!;
  return [
    { id: "MM-1", type: "Deposit on-chain, not credited", amount: 2_500, client: c(3), hash: finHex(r), ref: "D-58191", side: "chain", detail: "TRC20 transfer confirmed (block 66,398,112) but no ledger credit — deposit address re-assigned after KYC merge.", status: "open" },
    { id: "MM-2", type: "Ledger entry without tx", amount: 1_200, client: c(8), ref: "L-904412", side: "ledger", detail: "Manual credit posted by support without a linked adjustment ticket.", status: "open" },
    { id: "MM-3", type: "Withdrawal sent, ledger pending", amount: 1_405.5, client: c(12), hash: finHex(r), ref: "W-20902", side: "ledger", detail: "Hot wallet broadcast succeeded; ledger status still 'approved' due to webhook timeout.", status: "open" },
    { id: "MM-4", type: "Trading ↔ wallet transfer drift", amount: -12.4, client: c(17), ref: "T-331207", side: "trading", detail: "MT5 balance operation #88120331 rounded to 2 dp vs wallet 6 dp.", status: "open" },
    { id: "MM-5", type: "Rounding difference", amount: 0.03, client: null, ref: "BATCH-0924", side: "ledger", detail: "Aggregate rounding across 1,284 conversion entries (BTC→USD).", status: "open" },
    { id: "MM-6", type: "Duplicate credit", amount: 19.44, client: c(21), hash: finHex(r), ref: "D-58140", side: "ledger", detail: "Webhook retried after 504 — credit applied twice, second one should be reversed.", status: "open" },
  ];
})();
export const FIN_RECON_REASONS = ["Credited manually to client", "Reversed duplicate entry", "Ledger status corrected", "Accepted rounding (<$1)", "Linked to adjustment ticket", "Escalated to Finance lead"];

/* ------------------------------------------------------------------ */
/* Transactions (all)                                                   */
/* ------------------------------------------------------------------ */

export type FinTxType = "deposit" | "withdrawal" | "transfer" | "adjustment" | "ib-payout" | "copy-fee" | "prop-payout" | "conversion";
export type FinTxStatus = "completed" | "pending" | "processing" | "rejected" | "failed";
export interface FinTx {
  id: string;
  type: FinTxType;
  client: FinClient;
  asset: "USDT" | "BTC" | "ETH" | "TRX" | "USD";
  amount: number;
  usd: number;
  fee: number;
  status: FinTxStatus;
  minutesAgo: number;
  network?: FinNetwork;
  hash?: string;
  address?: string;
  account: string;
  note: string;
}
export const FIN_TX_TYPE_LABEL: Record<FinTxType, string> = {
  deposit: "Deposit",
  withdrawal: "Withdrawal",
  transfer: "Internal transfer",
  adjustment: "Adjustment",
  "ib-payout": "IB payout",
  "copy-fee": "Copy / PAMM fee",
  "prop-payout": "Prop payout",
  conversion: "Conversion",
};
export const FIN_TXS: FinTx[] = (() => {
  const r = seeded(1212);
  const out: FinTx[] = [];
  let m = 2;
  for (let i = 0; i < 124; i++) {
    const type = r.pick<FinTxType>(["deposit", "deposit", "deposit", "deposit", "withdrawal", "withdrawal", "withdrawal", "transfer", "transfer", "adjustment", "ib-payout", "copy-fee", "prop-payout", "conversion"]);
    const client = FIN_CLIENTS[r.int(0, FIN_CLIENTS.length - 1)]!;
    const asset = type === "conversion" ? r.pick(["BTC", "ETH", "TRX"] as const) : type === "deposit" && r.bool(0.08) ? "BTC" : type === "transfer" || type === "adjustment" ? "USD" : "USDT";
    const px = asset === "BTC" ? 63412 : asset === "ETH" ? 2468.2 : asset === "TRX" ? 0.1586 : 1;
    const usd = amount(r, 25, 20000);
    const amt = asset === "BTC" || asset === "ETH" ? Math.round((usd / px) * 1e6) / 1e6 : asset === "TRX" ? Math.round(usd / px) : usd;
    const sign = type === "withdrawal" || (type === "adjustment" && r.bool(0.3)) ? -1 : 1;
    const status: FinTxStatus = i < 6 && (type === "deposit" || type === "withdrawal") ? "pending" : r.bool(0.05) ? "rejected" : r.bool(0.03) ? "failed" : r.bool(0.05) ? "processing" : "completed";
    const onchain = type === "deposit" || type === "withdrawal";
    out.push({
      id: `TX-${9_812_400 - i * 7}`,
      type,
      client,
      asset,
      amount: amt * sign,
      usd: usd * sign,
      fee: type === "withdrawal" ? 1 : type === "conversion" ? round2(usd * 0.004) : 0,
      status,
      minutesAgo: round2(m),
      network: onchain ? (asset === "BTC" ? "BTC" : "TRC20") : undefined,
      hash: onchain && status !== "rejected" ? finHex(r) : undefined,
      address: onchain ? (asset === "BTC" ? btcAddr(r) : finTronAddr(r)) : undefined,
      account: type === "transfer" ? `Wallet → ${client.login}` : type === "adjustment" ? client.login : "Wallet",
      note:
        type === "ib-payout"
          ? "IB commission · Sep W3"
          : type === "copy-fee"
            ? "Performance fee · Aurora Alpha"
            : type === "prop-payout"
              ? "Funded 100K · profit split 80%"
              : type === "conversion"
                ? `${asset} → USD @ market + markup`
                : type === "adjustment"
                  ? r.pick(["Compensation – platform outage", "Negative balance protection", "Correction"])
                  : "",
    });
    m += i < 20 ? r.range(4, 40) : r.range(60, 700);
  }
  return out;
})();

/* ------------------------------------------------------------------ */
/* Manual adjustments                                                    */
/* ------------------------------------------------------------------ */

export const FIN_ADJ_REASONS = ["Compensation – platform outage", "Bonus credit", "Chargeback", "Negative balance protection", "Correction", "Swap refund", "Trading error – requote", "IB clawback"];
export const FIN_ADJ_THRESHOLD = 5000;
export type FinAdjStatus = "pending" | "approved" | "rejected";
export interface FinAdjustment {
  id: string;
  client: FinClient;
  account: string;
  kind: "balance" | "credit";
  direction: "add" | "deduct";
  amount: number;
  reason: string;
  maker: Person;
  checker?: Person;
  status: FinAdjStatus;
  minutesAgo: number;
  note: string;
  attachment?: string;
  ticket: string;
}
const ADJ_NOTES: Record<string, string> = {
  "Compensation – platform outage": "Server outage 21 Sep 09:14–09:31 affected SL execution",
  "Bonus credit": "Q3 loyalty campaign · 20% deposit bonus",
  Chargeback: "Card chargeback received from acquirer",
  "Negative balance protection": "Negative equity after gap on XAUUSD open",
  Correction: "Reversal of duplicate deposit credit",
  "Swap refund": "Islamic account charged swap in error",
  "Trading error – requote": "Requote during NFP · dealer confirmed price error",
  "IB clawback": "Commission on trades later voided for abuse",
};
export const FIN_STAFF: Person[] = [PEOPLE[4]!, PEOPLE[9]!, PEOPLE[12]!, PEOPLE[21]!, PEOPLE[6]!];
export const FIN_ADJUSTMENTS: FinAdjustment[] = (() => {
  const r = seeded(8808);
  return Array.from({ length: 26 }, (_, i) => {
    const client = FIN_CLIENTS[(i * 11 + 2) % FIN_CLIENTS.length]!;
    const status: FinAdjStatus = i < 4 ? "pending" : i % 9 === 5 ? "rejected" : "approved";
    const reason = r.pick(FIN_ADJ_REASONS);
    const direction = reason === "Chargeback" || reason === "IB clawback" || reason === "Correction" ? (r.bool(0.7) ? "deduct" : "add") : "add";
    const amt = i < 4 ? [7_500, 12_000, 5_400, 6_250][i]! : amount(r, 20, 9000);
    const maker = FIN_STAFF[i % FIN_STAFF.length]!;
    return {
      id: `ADJ-${4410 - i}`,
      client,
      account: client.login,
      kind: reason === "Bonus credit" ? "credit" : "balance",
      direction,
      amount: amt,
      reason,
      maker,
      checker: status === "pending" ? undefined : FIN_STAFF[(i + 2) % FIN_STAFF.length],
      status,
      minutesAgo: round2(i < 4 ? 12 + i * 47 : 300 + i * r.range(200, 700)),
      note: ADJ_NOTES[reason] ?? "Ticket escalated by support tier 2",
      attachment: r.bool(0.6) ? r.pick(["outage-report-0921.pdf", "acquirer-notice.pdf", "ticket-88213.png", "mt5-journal.log"]) : undefined,
      ticket: `SUP-${r.int(40000, 49999)}`,
    } satisfies FinAdjustment;
  });
})();

/* ------------------------------------------------------------------ */
/* Payout batches                                                       */
/* ------------------------------------------------------------------ */

export type FinPayoutKind = "ib" | "copy" | "prop";
export type FinBatchStatus = "draft" | "pending" | "approved" | "paid";
export interface FinPayoutLine {
  id: string;
  person: Person;
  ref: string; // partner id / strategy / funded account
  detail: string;
  amount: number;
  wallet: string;
  flags: string[];
  excluded?: boolean;
}
export interface FinPayoutBatch {
  id: string;
  kind: FinPayoutKind;
  title: string;
  period: string;
  status: FinBatchStatus;
  lines: FinPayoutLine[];
  createdMinutesAgo: number;
  scheduled: string;
  approvedBy?: string;
}
export const FIN_PAYOUT_KIND_LABEL: Record<FinPayoutKind, string> = { ib: "IB commissions", copy: "Copy / PAMM fees", prop: "Prop payouts" };

function payoutLines(seed: number, kind: FinPayoutKind, n: number): FinPayoutLine[] {
  const r = seeded(seed);
  return Array.from({ length: n }, (_, i) => {
    const person = PEOPLE[(i * 5 + seed) % PEOPLE.length]!;
    const flagPool = kind === "ib" ? ["Self-referral pattern", "Commission > 3x avg", "Sub-IB overlap"] : kind === "copy" ? ["High-water mark reset", "Follower complaint open"] : ["Consistency rule 42%", "News-trading flagged", "Same IP as another funded acct"];
    const flags = r.bool(0.16) ? [r.pick(flagPool)] : [];
    const amt = kind === "prop" ? round2(r.range(900, 14_000)) : kind === "copy" ? round2(r.range(120, 6_400)) : round2(Math.exp(r.range(Math.log(40), Math.log(9000))));
    return {
      id: `${seed}-${i}`,
      person,
      ref: kind === "ib" ? `IB-${r.int(10200, 19999)}` : kind === "copy" ? r.pick(["Aurora Alpha", "Gold Scalper Pro", "Atlas Swing", "Nebula FX", "Steady Carry"]) : `FND-${r.int(300100, 309999)}`,
      detail: kind === "ib" ? `${r.int(40, 2200).toLocaleString("en-US")} lots · ${r.int(3, 120)} clients` : kind === "copy" ? `${r.int(12, 640)} followers · HWM +${r.range(2, 24).toFixed(1)}%` : `${r.pick(["25K", "50K", "100K", "200K"])} funded · split ${r.pick([80, 85, 90])}%`,
      amount: amt,
      wallet: finTronAddr(r),
      flags,
    };
  });
}
export const FIN_PAYOUT_BATCHES: FinPayoutBatch[] = [
  { id: "PB-0931", kind: "ib", title: "IB commissions · weekly", period: "15 – 21 Sep 2026", status: "pending", lines: payoutLines(11, "ib", 38), createdMinutesAgo: 190, scheduled: "24 Sep, 18:00" },
  { id: "PB-0930", kind: "copy", title: "Copy trading performance fees", period: "Sep 2026 · H1", status: "pending", lines: payoutLines(12, "copy", 14), createdMinutesAgo: 320, scheduled: "24 Sep, 18:00" },
  { id: "PB-0929", kind: "prop", title: "Prop firm payouts · cycle 38", period: "10 – 23 Sep 2026", status: "pending", lines: payoutLines(13, "prop", 22), createdMinutesAgo: 75, scheduled: "25 Sep, 12:00" },
  { id: "PB-0928", kind: "copy", title: "PAMM performance fees", period: "Aug 2026", status: "draft", lines: payoutLines(14, "copy", 9), createdMinutesAgo: 40, scheduled: "Not scheduled" },
  { id: "PB-0927", kind: "ib", title: "IB commissions · weekly", period: "08 – 14 Sep 2026", status: "paid", lines: payoutLines(15, "ib", 36), createdMinutesAgo: 10_300, scheduled: "17 Sep, 18:00", approvedBy: "Priya Nair" },
  { id: "PB-0926", kind: "prop", title: "Prop firm payouts · cycle 37", period: "27 Aug – 09 Sep 2026", status: "paid", lines: payoutLines(16, "prop", 19), createdMinutesAgo: 20_400, scheduled: "11 Sep, 12:00", approvedBy: "James Carter" },
  { id: "PB-0925", kind: "ib", title: "IB commissions · weekly", period: "01 – 07 Sep 2026", status: "paid", lines: payoutLines(17, "ib", 34), createdMinutesAgo: 20_500, scheduled: "10 Sep, 18:00", approvedBy: "Priya Nair" },
  { id: "PB-0924", kind: "copy", title: "Copy trading performance fees", period: "Aug 2026 · H2", status: "approved", lines: payoutLines(18, "copy", 12), createdMinutesAgo: 1_500, scheduled: "24 Sep, 18:00", approvedBy: "Elena Petrova" },
];
export const FIN_PAYOUT_REASONS = ["Batch reviewed – all lines verified", "Flags reviewed and accepted", "Finance lead sign-off", "Scheduled cycle approval"];

/* ------------------------------------------------------------------ */
/* Conversion                                                           */
/* ------------------------------------------------------------------ */

export interface FinRate {
  coin: string;
  symbol: string;
  name: string;
  network: string;
  rate: number;
  change24h: number;
  markup: number;
  fixed?: boolean;
  volume24h: number;
  enabled: boolean;
  min: number;
  max: number;
  source: "Median (Binance · Kraken · CoinGecko)" | "Binance" | "Kraken" | "CoinGecko";
  staleSec: number;
  updatedSec: number;
  spark: number[];
}
function spark(seed: number, drift: number) {
  const r = seeded(seed);
  let v = 100;
  return Array.from({ length: 32 }, () => (v *= 1 + drift / 32 + r.normal() * 0.004));
}
export const FIN_RATES: FinRate[] = [
  { coin: "usdt", symbol: "USDT", name: "Tether", network: "TRC20 · ERC20 · BEP20", rate: 1, change24h: 0, markup: 0, fixed: true, volume24h: 1_284_512, enabled: true, min: 10, max: 250_000, source: "Median (Binance · Kraken · CoinGecko)", staleSec: 0, updatedSec: 0, spark: Array.from({ length: 32 }, () => 100) },
  { coin: "btc", symbol: "BTC", name: "Bitcoin", network: "Bitcoin", rate: 63_412.0, change24h: 1.84, markup: 0.6, volume24h: 214_880, enabled: true, min: 50, max: 150_000, source: "Median (Binance · Kraken · CoinGecko)", staleSec: 30, updatedSec: 2, spark: spark(71, 0.018) },
  { coin: "eth", symbol: "ETH", name: "Ethereum", network: "ERC20", rate: 2_468.2, change24h: -0.92, markup: 0.75, volume24h: 88_412, enabled: true, min: 50, max: 100_000, source: "Median (Binance · Kraken · CoinGecko)", staleSec: 30, updatedSec: 3, spark: spark(72, -0.009) },
  { coin: "trx", symbol: "TRX", name: "Tron", network: "TRC20", rate: 0.1586, change24h: 0.41, markup: 1.0, volume24h: 31_906, enabled: true, min: 20, max: 25_000, source: "Binance", staleSec: 20, updatedSec: 1, spark: spark(73, 0.004) },
  { coin: "bnb", symbol: "BNB", name: "BNB", network: "BEP20", rate: 584.3, change24h: 2.36, markup: 0.8, volume24h: 22_140, enabled: true, min: 50, max: 50_000, source: "Binance", staleSec: 30, updatedSec: 4, spark: spark(74, 0.023) },
  { coin: "sol", symbol: "SOL", name: "Solana", network: "Solana", rate: 146.82, change24h: -2.18, markup: 1.2, volume24h: 9_870, enabled: true, min: 50, max: 40_000, source: "Median (Binance · Kraken · CoinGecko)", staleSec: 30, updatedSec: 2, spark: spark(75, -0.022) },
  { coin: "xrp", symbol: "XRP", name: "XRP", network: "XRP Ledger", rate: 0.5842, change24h: 0.12, markup: 1.5, volume24h: 0, enabled: false, min: 50, max: 20_000, source: "Kraken", staleSec: 45, updatedSec: 5, spark: spark(76, 0.001) },
  { coin: "ltc", symbol: "LTC", name: "Litecoin", network: "Litecoin", rate: 68.41, change24h: -0.64, markup: 1.5, volume24h: 1_204, enabled: true, min: 50, max: 20_000, source: "CoinGecko", staleSec: 60, updatedSec: 41, spark: spark(77, -0.006) },
];
