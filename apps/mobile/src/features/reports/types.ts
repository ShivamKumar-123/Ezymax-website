// Shapes of the reports service's client routes (services/reports/README.md, "Client routes"), reached through the
// Client Area BFF: /api/mobile/reports/* is the cookie route /api/reports/* with the bearer session.
// Analytics amounts are USD (cent accounts converted); days and hours are server time (GMT+2 / GMT+3).

export type TradeRef = { deal: number; ticket: number; login: number; symbol: string; side: string; volume: number; net: number; closeTime: string } | null;

export type Stats = {
  trades: number;
  wins: number;
  losses: number;
  winRate: number;
  grossProfit: number;
  grossLoss: number;
  net: number;
  avgWin: number;
  avgLoss: number;
  /** null = no losing trade (infinite) */
  profitFactor: number | null;
  expectancy: number;
  rewardRisk: number | null;
  avgHoldSecs: number;
  avgHoldWinSecs: number;
  avgHoldLossSecs: number;
  lots: number;
  commission: number;
  swap: number;
  profit: number;
  maxConsecWins: number;
  maxConsecLosses: number;
  best: TradeRef;
  worst: TradeRef;
};

/** A grouping (symbol, weekday "0".."6" = Mon..Sun, server day "YYYY-MM-DD"). */
export type Group = { key: string; trades: number; wins: number; winRate: number; net: number; lots: number };

export type Insight = { id: string; tone: "up" | "down" | "warn" | "info"; title: string; stat: string; text: string; tip: string };

export type CurvePoint = { day: string; balance: number; equity: number; flow: number; index: number; drawdown: number };

export type Behaviour = {
  overtradingDays: number;
  normalDayMedianTrades: number;
  overtradingNet: number;
  revengeTrades: number;
  revengeNet: number;
  revengeWinRate: number;
  avgRiskPct: number;
  maxRiskPct: number;
  tradesOver2pct: number;
  stopOuts: number;
  closedBySl: number;
  closedByTp: number;
  insights: Insight[];
};

export type AnalyticsAccount = { login: number; type: "live" | "demo"; group: string; groupName: string; currency: string; cent: boolean; equity: number; balance: number };

export type Analytics = {
  scope: "account" | "live";
  from: string;
  to: string;
  accounts: AnalyticsAccount[];
  curve: { points: CurvePoint[]; maxDrawdown: number; currentDrawdown: number; returnPct: number; sharpe: number | null; sortino: number | null; volatility: number | null };
  stats: Stats;
  long: Stats;
  short: Stats;
  bySymbol: Group[];
  byWeekday: Group[];
  /** P&L calendar (reports service with byDay); older servers leave it out */
  byDay?: Group[];
  bySession: { session: string; hours: string; trades: number; net: number; winRate: number }[];
  /** [weekday 0 = Mon][server hour] net P&L of the closes */
  hourHeatmap: number[][];
  hourTrades?: number[][];
  moneyFlow: { deposits: number; withdrawals: number; tradingPnl: number; commission: number; performanceFees: number; bonus: number; adjustments: number; earnings: number; equityNow: number };
  charges: { commission: number; swapPaid: number; swapEarned: number; performanceFees: number; walletFees: number; spreadEstimate: number };
  behaviour: Behaviour;
};

export type MonthRow = { month: string; from: string; to: string; net: number; deposits: number; withdrawals: number; trades: number };
export type Months = { login: number; currency: string; months: MonthRow[] };

/** The client's trading accounts (trading/accounts, the app-wide cache entry); only the fields reports use. */
export type ReportAccount = {
  login: number;
  type: "live" | "demo";
  group: string;
  groupName: string;
  name?: string;
  mode?: "hedging" | "netting";
  cent: boolean;
  currency: string;
  balance: number;
  equity: number;
  status?: string;
  createdAt?: string;
};

export type Period = "7D" | "30D" | "90D" | "1Y" | "ALL";
/** "all" = every live account (the service's login=all). */
export type Scope = number | "all";

export type StPeriod = "day" | "month" | "year" | "custom";
export type StFormat = "pdf" | "xlsx" | "csv";
export type StOptions = { open: boolean; charges: boolean; deals: boolean };
