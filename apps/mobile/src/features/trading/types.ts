// Trading-engine shapes as the mobile BFF returns them (services/trading/README.md, dealing fields removed).

export interface EngAccount {
  login: number;
  type: "live" | "demo";
  group: string;
  groupName: string;
  /** market-data spread group (the quotes this account trades at) */
  spreadGroup?: string;
  mode: "hedging" | "netting";
  cent: boolean;
  currency: "USD" | "USC";
  leverage: number;
  leverages?: number[];
  status: string;
  name?: string;
  marginCall?: boolean;
  marginCallLevel?: number;
  stopOutLevel?: number;
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
  positions?: number;
  orders?: number;
  demo?: { initialBalance: number; refillsPerDay: number; refillsUsedToday: number; expiryDays: number } | null;
  createdAt?: string;
}

export interface EngPosition {
  ticket: number;
  login: number;
  symbol: string;
  side: "buy" | "sell";
  volume: number;
  openPrice: number;
  openTime: string;
  sl: number | null;
  tp: number | null;
  trailingPoints: number | null;
  swap: number;
  commission: number;
  currentPrice?: number;
  profit?: number;
  source?: string;
  platform?: string;
  comment?: string;
}

export interface EngOrder {
  ticket: number;
  login: number;
  symbol: string;
  side: "buy" | "sell";
  type: "limit" | "stop" | "stop_limit";
  volume: number;
  price: number;
  stopLimit: number | null;
  triggered?: boolean;
  sl: number | null;
  tp: number | null;
  trailingPoints?: number | null;
  expiry: string;
  expiryAt: string | null;
  source?: string;
  platform?: string;
  comment?: string;
  placedAt: string;
}

export interface EngDeal {
  id: number;
  login: number;
  positionTicket: number;
  orderTicket: number | null;
  symbol: string;
  side: "buy" | "sell";
  positionSide?: "buy" | "sell";
  entry: "in" | "out" | "out_by";
  volume: number;
  price: number;
  profit: number;
  swap: number;
  commission: number;
  reason: string;
  time: string;
  openPrice?: number;
  openTime?: string;
  source?: string;
  comment?: string;
}

export interface EngEquity {
  login: number;
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
  positions: { ticket: number; price: number; profit: number; swap: number }[];
}

export type StreamFrame =
  | { type: "snapshot"; readOnly: boolean; account: EngAccount; positions: EngPosition[]; orders: EngOrder[] }
  | { type: "position"; op: "upsert"; position: EngPosition }
  | { type: "position"; op: "remove"; ticket: number }
  | { type: "order"; op: "upsert"; order: EngOrder }
  | { type: "order"; op: "remove"; ticket: number; status: string; reason?: string }
  | { type: "deal"; deal: EngDeal }
  | { type: "ledger"; txn: { id: number; kind: string; amount: number; at: string } }
  | { type: "account"; account: EngAccount }
  | { type: "notification"; kind: string; message: string; data?: Record<string, unknown> }
  | ({ type: "equity" } & EngEquity)
  | { type: "hb"; t: number }
  | { type: "resync"; skipped?: number };

/** Engine contract specification (GET /api/mobile/trade/symbols). */
export interface SymbolSpec {
  symbol: string;
  assetClass: string;
  digits: number;
  point: number;
  pipSize: number;
  contractSize: number;
  profitCurrency: string;
  lotMin: number;
  lotMax: number;
  lotStep: number;
  marginPct: number;
  maxLeverage: number;
  swapLong: number;
  swapShort: number;
  session: "fx" | "24x7" | "us_equity";
  open: boolean;
  stopsLevelPoints: number;
}

export type EngineError = { code: string; message: string; status?: number; bid?: number; ask?: number };
