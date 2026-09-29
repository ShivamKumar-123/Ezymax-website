// Trading-account shapes as the Client Area BFF returns them (/api/mobile/trading/*, the client-safe subset of
// services/trading/README.md "Client Area API"). The same contract as the web Client Area (components/trading/api.ts).

export type AccountKind = "live" | "demo";
export type AccountStatus = "active" | "close_only" | "read_only" | "disabled" | "expired";

export interface DemoInfo {
  /** starting balance in the account currency (already × 100 on cent accounts) */
  initialBalance: number;
  refillsPerDay: number;
  refillsUsedToday: number;
  expiryDays: number;
}

export interface Account {
  login: number;
  type: AccountKind;
  group: string;
  groupName: string;
  mode: "hedging" | "netting";
  cent: boolean;
  /** "USD", or "USC" on cent accounts (every amount is USD × 100) */
  currency: string;
  baseCurrency?: string;
  leverage: number;
  leverages: number[];
  status: AccountStatus;
  name: string;
  marginCall: boolean;
  marginCallLevel: number;
  stopOutLevel: number;
  positions: number;
  orders: number;
  controls?: { tradingDisabled: boolean; closeOnly: boolean; maxLot: number | null };
  balance: number;
  credit: number;
  bonus: number;
  profit: number;
  swap: number;
  equity: number;
  margin: number;
  freeMargin: number;
  marginLevel: number | null;
  withdrawable?: number;
  demo?: DemoInfo | null;
  createdAt: string;
}

export interface Group {
  code: string;
  name: string;
  mode: "hedging" | "netting";
  cent: boolean;
  accountTypes: "live" | "demo" | "both";
  leverages: number[];
  defaultLeverage: number;
  marginCallPct: number;
  stopOutPct: number;
  hedgedMarginPct?: number;
  minDeposit: number;
  swapFree: boolean;
  commissionPerLot: number;
  spreadGroup?: string;
  maxAccountsPerUser: number;
  demoInitialBalance: number;
  demoRefillsPerDay: number;
  demoExpiryDays: number;
  enabled: boolean;
}

export interface Position {
  ticket: number;
  symbol: string;
  side: "buy" | "sell";
  volume: number;
  openPrice: number;
  openTime: string;
  sl: number | null;
  tp: number | null;
  swap: number;
  commission: number;
  currentPrice: number | null;
  profit: number;
}

export interface Order {
  ticket: number;
  symbol: string;
  side: "buy" | "sell";
  type: "market" | "limit" | "stop" | "stop_limit";
  volume: number;
  price: number | null;
  placedAt: string;
}

export interface AccountDetail {
  account: Account;
  positions: Position[];
  orders: Order[];
}

export interface Credentials {
  login: number;
  password?: string;
  investorPassword?: string;
}

export interface OpenResult {
  account: Account;
  /** returned exactly once by the server; never stored by the app */
  credentials: Credentials;
}

export type OpenRequest = {
  type: AccountKind;
  group: string;
  leverage: number;
  name?: string;
  password?: string;
  initialBalance?: number;
};

export type PasswordKind = "trading" | "investor";
