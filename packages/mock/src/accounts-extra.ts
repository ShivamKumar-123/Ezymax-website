/**
 * Extra mock data for the Accounts module: per-account trade history,
 * ledger, charges, archived accounts and demo rules.
 */
import { seeded, hashString } from "./rng";
import { getInstrument } from "./symbols";
import { ACCOUNTS, HISTORY, POSITIONS, type ClosedTrade, type TradingAccount } from "./client";

export const DEMO_RULES = { refillsPerDay: 3, expiryDays: 10, startBalances: [1000, 10000, 50000, 100000] };

export const ARCHIVED_ACCOUNTS: TradingAccount[] = [
  { login: "80409914", type: "live", group: "ECN", mode: "netting", cent: false, server: "Kalks-Live01", leverage: 100, currency: "USD", balance: 0, equity: 0, credit: 0, margin: 0, nickname: "Old ECN scalper", createdAt: "2024-03-02", swapFree: false },
  { login: "90018420", type: "demo", group: "Standard", mode: "hedging", cent: false, server: "Kalks-Demo", leverage: 200, currency: "USD", balance: 8412.5, equity: 8412.5, credit: 0, margin: 0, createdAt: "2026-08-01", expiresAt: "2026-08-11", swapFree: false },
];

export function findAccount(login: string): TradingAccount | undefined {
  return ACCOUNTS.find((a) => a.login === login) ?? ARCHIVED_ACCOUNTS.find((a) => a.login === login);
}

export function isArchived(login: string) {
  return ARCHIVED_ACCOUNTS.some((a) => a.login === login);
}

export function accountPositions(login: string) {
  return POSITIONS.filter((p) => p.login === login);
}

const tradeCache = new Map<string, ClosedTrade[]>();

/** Closed trades for an account. Live accounts use HISTORY; demo accounts get a seeded synthetic history. */
export function accountTrades(login: string): ClosedTrade[] {
  if (tradeCache.has(login)) return tradeCache.get(login)!;
  let out = HISTORY.filter((t) => t.login === login);
  if (out.length === 0) {
    const r = seeded(hashString(login));
    const syms = ["XAUUSD", "EURUSD", "GBPUSD", "NAS100", "BTCUSD", "USDJPY", "US30", "ETHUSD"];
    let t = Date.parse("2026-09-24T15:20:00Z");
    const start = Date.parse(ACCOUNTS.find((a) => a.login === login)?.createdAt ?? "2026-09-01");
    out = [];
    let i = 0;
    while (t > start && i < 60) {
      const symbol = r.pick(syms);
      const inst = getInstrument(symbol);
      const side = r.bool(0.55) ? "buy" : "sell";
      const volume = r.pick([0.1, 0.2, 0.5, 1, 2]);
      const openPrice = inst.price * (1 + r.normal() * 0.006);
      const win = r.bool(0.58);
      const move = Math.abs(r.normal()) * inst.price * (inst.assetClass === "forex" ? 0.002 : 0.005);
      const closePrice = side === "buy" ? openPrice + (win ? move : -move * 0.8) : openPrice - (win ? move : -move * 0.8);
      let profit = (side === "buy" ? closePrice - openPrice : openPrice - closePrice) * volume * inst.contractSize;
      if (symbol.endsWith("JPY")) profit /= closePrice;
      const swap = -+(r.range(0, 3) * volume).toFixed(2);
      const commission = 0;
      out.push({
        ticket: String(51200000 + (hashString(login + i) % 900000)),
        login,
        symbol,
        side,
        volume,
        openPrice: +openPrice.toFixed(inst.digits),
        closePrice: +closePrice.toFixed(inst.digits),
        swap,
        commission,
        openTime: new Date(t - r.int(5, 600) * 60000).toISOString(),
        closeTime: new Date(t).toISOString(),
        profit: +(profit + swap).toFixed(2),
        source: "manual",
      });
      t -= r.int(1, 9) * 3600 * 1000;
      i++;
    }
  }
  tradeCache.set(login, out);
  return out;
}

/** Estimated spread cost in USD for a closed trade (half-spread each side × volume × contract). */
export function spreadCost(t: ClosedTrade) {
  const inst = getInstrument(t.symbol);
  let c = inst.spread * t.volume * inst.contractSize;
  if (t.symbol.endsWith("JPY")) c /= t.closePrice;
  return +c.toFixed(2);
}

export interface LedgerEntry {
  id: string;
  time: string;
  kind: "deposit" | "withdrawal" | "transfer-in" | "transfer-out" | "trade" | "swap" | "commission" | "credit" | "refill";
  description: string;
  amount: number;
  balance: number;
}

/** Balance ledger with a running balance, ending at the account's current balance. */
export function accountLedger(a: TradingAccount): LedgerEntry[] {
  const mult = a.cent ? 100 : 1;
  const trades = accountTrades(a.login);
  const r = seeded(hashString("ledger" + a.login));
  const raw: Omit<LedgerEntry, "balance">[] = [];
  // group trades by day → one realised P&L entry per day, plus swaps
  const byDay = new Map<string, ClosedTrade[]>();
  for (const t of trades) {
    const d = t.closeTime.slice(0, 10);
    if (!byDay.has(d)) byDay.set(d, []);
    byDay.get(d)!.push(t);
  }
  for (const [d, list] of byDay) {
    const pnl = list.reduce((s, t) => s + (t.profit - t.swap + t.commission), 0);
    const swap = list.reduce((s, t) => s + t.swap, 0);
    const comm = list.reduce((s, t) => s + t.commission, 0);
    const last = list.reduce((m, t) => (t.closeTime > m ? t.closeTime : m), list[0]!.closeTime);
    const at = (sec: number) => new Date(Date.parse(last) + sec * 1000).toISOString();
    raw.push({ id: `L${d}T`, time: at(2), kind: "trade", description: `Realised P&L · ${list.length} trade${list.length > 1 ? "s" : ""}`, amount: +(pnl * mult).toFixed(2) });
    if (swap !== 0) raw.push({ id: `L${d}S`, time: at(1), kind: "swap", description: "Overnight swap", amount: +(swap * mult).toFixed(2) });
    if (comm !== 0) raw.push({ id: `L${d}C`, time: at(0), kind: "commission", description: "Commission", amount: +(-comm * mult).toFixed(2) });
  }
  // funding events
  const days = [...byDay.keys()].sort();
  const pickDay = () => days[r.int(0, Math.max(0, days.length - 1))] ?? "2026-09-10";
  if (a.type === "live") {
    for (let i = 0; i < 5; i++) {
      const inbound = r.bool(0.7);
      const amt = +(r.range(300, 4000) * mult).toFixed(2);
      raw.push({
        id: `LF${i}`,
        time: `${pickDay()}T0${r.int(6, 9)}:1${i}:00Z`,
        kind: inbound ? "transfer-in" : "transfer-out",
        description: inbound ? "Transfer from wallet (USDT)" : "Transfer to wallet (USDT)",
        amount: inbound ? amt : -amt,
      });
    }
    if (a.credit > 0) raw.push({ id: "LCR", time: `${pickDay()}T10:00:00Z`, kind: "credit", description: "Deposit bonus credit", amount: a.credit });
  }
  raw.sort((x, y) => (x.time < y.time ? 1 : -1)); // newest first
  let bal = a.balance;
  const out: LedgerEntry[] = [];
  for (const e of raw) {
    if (e.kind === "credit") {
      out.push({ ...e, balance: bal });
      continue;
    }
    out.push({ ...e, balance: +bal.toFixed(2) });
    bal -= e.amount;
  }
  out.push({
    id: "L0",
    time: `${a.createdAt}T08:00:00Z`,
    kind: a.type === "demo" ? "refill" : "deposit",
    description: a.type === "demo" ? "Demo starting balance" : "First transfer from wallet (USDT)",
    amount: +bal.toFixed(2),
    balance: +bal.toFixed(2),
  });
  return out;
}
