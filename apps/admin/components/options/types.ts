/**
 * Shapes of the FX Options APIs the Back Office reads (services/options/README.md "Back Office" and the trading
 * engine's option book). Vols, rates and spreads are decimals (0.085 = 8.5 %) exactly as the service sends them;
 * the UI converts to percent / vol points only for display and input.
 */

export type Model = "gk" | "bs" | "black76";
export type ExpiryKind = "daily" | "weekly" | "monthly";

export type Spot = { bid: number; ask: number; mid: number; t: number; recv?: number };

export type Realized = { symbol?: string; estimator: string; tf?: string; windowBars: number; value: number; bars?: number; computedAt: string };

export type Underlying = {
  symbol: string;
  name: string;
  assetClass: string;
  model: Model;
  baseCcy: string;
  quoteCcy: string;
  calendars: string[];
  calendarCodes?: string[];
  contractSize: number;
  contractUnit: string;
  digits: number;
  pipSize: number;
  strikeStep: number;
  strikesEachSide: number;
  extendThreshold: number;
  expiryKinds: ExpiryKind[];
  dailyCount: number;
  weeklyCount: number;
  monthlyCount: number;
  cutTime: string;
  cutZone: string;
  twapMinutes: number;
  noOpenMinutes: number;
  closeOnlyMinutes: number;
  deltaConvention: string;
  weekendVolWeight: number;
  holidayVolWeight: number;
  priceScan: number;
  volScan: number;
  extremeMultiple: number;
  extremeCover: number;
  minContracts: number;
  maxContracts: number;
  contractStep: number;
  /* order book (docs/OPTIONS-EXCHANGE.md §2, §6, §8, §5); optional until every options service sends them */
  /** price tick in the quote currency per unit (EURUSD 0.00001 = $0.10 per contract) */
  premiumTick?: number;
  /** market orders become IOC limits at mark × (1 ± this %) (or bandMinTicks, whichever is wider) */
  marketBandPct?: number;
  /** resting limits must be within mark × (1 ± this %) + bandMinTicks */
  limitBandPct?: number;
  bandMinTicks?: number;
  /** liquidation: reduce-only IOC at mark × (1 ∓ this %) */
  liqBandPct?: number;
  /** liquidation backstop: the MM takes the rest at mark ∓ max(this % · mark, 1 tick) */
  liqFeePct?: number;
  /** combo RFQ: how long an MM quote stays firm */
  rfqQuoteTtlSecs?: number;
  /** mark = model clamped inside the book only when both sides have at least this many contracts… */
  markMinQty?: number;
  /** …and the book spread is at most this multiple of the model spread */
  markMaxSpreadMult?: number;
  barriersEnabled: boolean;
  enabled: boolean;
  sort: number;
  notes: string;
  updatedAt: string;
  updatedBy: string;
  spot?: Spot | null;
  surfaceVersion?: number | null;
  realizedVol?: Realized | null;
};

export type TenantSettings = { tenant: string; enabledDemo: boolean; enabledLive: boolean; publicChain: boolean; underlyings: string[] | null; updatedAt: string; updatedBy: string };

export type Overview = {
  version: number;
  tenant: TenantSettings;
  underlyings: number;
  expiries: number;
  series: number;
  awaitingFixing: number;
  controls: number;
  feedConnected: boolean;
  jobs: Record<string, string>;
};

export type Rate = { ccy: string; rate: number; kind: string; source: string; asOf: string; updatedAt: string; updatedBy: string };
export type RateHistory = { rate: number; prevRate: number | null; asOf: string; reason: string; changedBy: string; changedAt: string };

export type Holiday = { calendar: string; day: string; name: string; source: string; active: boolean; updatedAt: string; updatedBy: string };

export type Pillar = { tenor: string; days: number; atm: number; rr25: number; bf25: number; rr10?: number | null; bf10?: number | null };
export type Surface = { symbol: string; version: number; blendWeight: number; pillars: Pillar[]; reason: string; publishedBy: string; publishedAt: string };
export type SurfaceResp = {
  symbol: string;
  current: Surface | null;
  versions: { version: number; blendWeight: number; reason: string; publishedBy: string; publishedAt: string }[];
  realized: Realized[];
  realizedUsed: Realized | null;
};

export type Smile = {
  underlying: string;
  expiry: string;
  atmVol: number;
  points: { strike: number; vol: number }[];
  pillars: { callDelta: number; vol: number; strike: number }[];
  termStructure: Pillar[];
  inputs?: { spot: number; forward: number; tCal: number; tVol: number; atmVol: number; surfaceAtm: number | null; realized: number | null; blendWeight: number; manualVol: number | null; surfaceVersion: number | null };
};

export type GroupSettings = {
  tenant: string;
  groupCode: string;
  symbol: string;
  volSpread: number;
  minSpreadUsd: number;
  commissionPerContract: number;
  commissionCapPct: number;
  maxContractsPerClient: number;
  weekendMarginPct: number;
  /** order book (§7): USD per contract; negative = a rebate to the maker. Capped at commissionCapPct of premium. */
  makerFeePerContract?: number;
  /** order book (§7): USD per contract, ≥ 0. min(taker) over the broker's rows must cover max(|maker rebate|). */
  takerFeePerContract?: number;
  enabled: boolean;
  updatedAt: string;
  updatedBy: string;
};

export type ControlScope = "all" | "underlying" | "expiry" | "series";
export type ControlMode = "halt" | "close_only" | "freeze" | "manual_vol";
export type Control = {
  id: number;
  tenant: string;
  scope: ControlScope;
  target: string;
  mode: ControlMode;
  manualVol: number | null;
  frozenSpot: number | null;
  reason: string;
  active: boolean;
  expiresAt: string | null;
  createdBy: string;
  createdAt: string;
  clearedBy?: string | null;
  clearedAt?: string | null;
  clearReason?: string | null;
};

export type ClientLimit = { tenant: string; userId: number; maxContracts: number | null; maxShortContracts: number | null; closeOnly: boolean; blocked: boolean; reason: string; updatedAt: string; updatedBy: string };

export type ExpiryStatus = "listed" | "fixing" | "fixed" | "expired" | string;
export type AdminExpiry = {
  id: number;
  symbol: string;
  date: string;
  kinds: ExpiryKind[];
  cutAt: string;
  twapStart: string;
  status: ExpiryStatus;
  fixing: number | null;
  source: string | null;
  run: number;
  samples: number | null;
  expected: number | null;
  coverage: number | null;
  maxGapMs: number | null;
  fixedAt: string | null;
  error: string | null;
  series: number;
  samplesSoFar: number;
};

export type ChainSide = {
  code: string;
  bid: number | null;
  ask: number | null;
  mark: number | null;
  bidUsd: number | null;
  askUsd: number | null;
  markUsd: number | null;
  iv: number | null;
  delta: number | null;
  gamma: number | null;
  vega: number | null;
  theta: number | null;
  probItm: number | null;
  breakeven: number | null;
  state: "open" | "close_only" | "halted" | "closed" | string;
};
export type Chain = {
  underlying: string;
  expiry: string;
  cutAt: string;
  status: string;
  state: string;
  contractSize: number;
  contractUnit: string;
  digits: number;
  spot: { bid: number; ask: number; mid: number } | null;
  atmStrike: number | null;
  version: number;
  error?: { code: string; message?: string };
  rows: { strike: number; strikeLabel: string; call: ChainSide | null; put: ChainSide | null }[];
};

export type AuditEntry = { id: number; tenant: string; actor: string; action: string; target: string; before: unknown; after: unknown; reason: string; at: string };

/* ---------------- trading engine: option book ---------------- */

/**
 * House side (minus the clients) per underlying, as the engine sends it (services/trading api/options.rs `book`):
 * `netDelta` in delta-weighted contracts, `netDeltaUnits` in units of the underlying, `gamma` = change of the
 * contract delta for a 1 % spot move, `vega` USD per vol point, `theta` USD per calendar day. The risk desk turns
 * delta and gamma into USD with the spot and contract size from the options service.
 */
export type BookUnderlying = {
  symbol: string;
  netDelta: number;
  netDeltaUnits?: number;
  clientDelta?: number;
  gamma: number;
  vega: number;
  theta: number;
  longContracts: number;
  shortContracts: number;
  clients: number;
  hedgeContracts: number;
  hedgeUnits?: number;
  deltaAfterHedgeUnits?: number;
};
export type BookClient = { userId: number; login: number | string; pnl: number; contracts: number; todayPnl: number };
/** One settlement run (`option_settlement_runs`): kind settle | rerun, status running | done | failed. */
export type BookSettlement = {
  id?: number;
  /** `SYMBOL:YYYY-MM-DD`, the key the re-run route takes */
  expiry: string;
  symbol: string;
  date: string;
  run: number;
  fixing?: number;
  source?: string | null;
  status: string;
  kind?: string;
  positions?: number;
  accounts?: number;
  payoutUsd?: number;
  failures?: number;
  reason?: string;
  createdBy?: string;
  startedAt?: string;
  finishedAt?: string | null;
};
export type Book = {
  kind?: string;
  underlyings: BookUnderlying[];
  topClients: BookClient[];
  settlements: BookSettlement[];
  snapshot?: { version: number | null; stale: boolean; lastOkAt: string | null };
  hedgeAccount?: number | null;
};

/* ---------------- order book exchange (docs/OPTIONS-EXCHANGE.md, decision O49) ---------------- */

export type AccountKind = "live" | "demo";

/** Market-maker quoting parameters (options service `mm_settings`, §4). Spreads are decimal vols (0.004 = 0.40 vol
 *  points each side of the smile vol) per tenor bucket; limits are where a side is withdrawn. */
export type MmSettings = {
  /** `*` = every broker */
  tenant: string;
  /** live | demo | `*` */
  kind: string;
  /** `*` = every underlying */
  underlying: string;
  enabled: boolean;
  spreadVol0dte: number;
  spreadVol7d: number;
  spreadVol30d: number;
  spreadVolLong: number;
  minSpreadTicks: number;
  skewVol: number;
  skewTicksPerContract: number;
  baseSize: number;
  maxNetDelta: number;
  maxGamma: number;
  maxVega: number;
  maxContractsPerSeries: number;
  updatedAt: string;
  updatedBy: string;
};

export type MmStatus = "quoting" | "paused" | "degraded" | "stopped" | string;
export type MmPause = { id?: number | string; scope: "all" | "underlying" | "expiry" | string; target: string; reason: string; by: string; at: string };
export type MmLimits = { maxNetDelta: number; maxGamma: number; maxVega: number; maxContractsPerSeries: number };
export type MmUnderlying = {
  symbol: string;
  status: string;
  coveragePct: number;
  seriesQuoted: number;
  seriesTotal: number;
  inventoryContracts: number;
  netDelta: number;
  gamma: number;
  vega: number;
  theta: number;
  limits?: MmLimits | null;
  /** count of withdrawn quote sides, or the list of `SERIES:bid|ask` */
  withdrawnSides?: number | string[] | null;
  lastRequoteAt?: string | null;
};
/** GET /api/trading/admin/options/mm?kind= */
export type MmState = {
  kind: string;
  status: MmStatus;
  startedAt?: string | null;
  uptimeSecs?: number | null;
  uptimePct?: number | null;
  latency?: { p50Us: number; p99Us: number } | null;
  coveragePct?: number | null;
  quotesLive?: number | null;
  lastQuoteAt?: string | null;
  account?: { login: number | string; equity: number; cash: number; margin: number } | null;
  greeks?: { delta: number; gamma: number; vega: number; theta: number } | null;
  pauses?: MmPause[] | null;
  underlyings?: MmUnderlying[] | null;
};

export type BookState = "open" | "cancel_only" | "halted" | "closed" | string;
export type BookRow = {
  underlying: string;
  state: BookState;
  seq: number;
  restingOrders: number;
  restingContracts: number;
  clientOrders: number;
  mmCoveragePct: number;
  seriesQuoted: number;
  seriesTotal: number;
  avgSpreadTicks: number | null;
  oi: number;
  volume: number;
  volumeUsd?: number | null;
  outbox?: { pending: number; failed: number; oldestMs: number | null } | null;
  clearingUsd: number;
  lastTradeAt?: string | null;
};
export type HaltScope = "all" | "underlying" | "expiry" | "series";
export type BookHalt = { id: number; scope: HaltScope | string; target: string; mode: "halt" | "cancel_only" | string; reason: string; by: string; at: string; kind?: string };
/** GET /api/trading/admin/options/books?kind= */
export type BooksMonitor = {
  kind: string;
  enabled: boolean;
  enabledAt?: string | null;
  replay?: { ok: boolean; at: string | null; mismatches: number } | null;
  books?: BookRow[] | null;
  halts?: BookHalt[] | null;
};

export type DepthOrder = { id: number | string; login: number | string; userId?: number | null; name?: string | null; qty: number; left: number; at: string; flags?: string[] | null; mm: boolean };
export type DepthLevel = { price: number; qty: number; orders?: DepthOrder[] | null };
export type FillKind = "book" | "rfq" | "liquidation" | "backstop" | "novation" | string;
export type BookTrade = {
  /** engine fill id `{UNDERLYING}.{L|D}{seq}.{n}` */
  fillId: string;
  price: number;
  qty: number;
  takerSide: "buy" | "sell" | string;
  kind: FillKind;
  at: string;
  maker: { login: number | string; mm: boolean; userId?: number | null };
  taker: { login: number | string; mm: boolean; userId?: number | null };
  busted?: boolean;
  series?: string;
};
/** GET /api/trading/admin/options/books/{series}?kind= (the engine logs who looked) */
export type SeriesDepth = {
  series: string;
  kind: string;
  seq: number;
  state: BookState;
  mark: number | null;
  theo: number | null;
  premiumTick: number | null;
  usdPerUnit?: number | null;
  bids?: DepthLevel[] | null;
  asks?: DepthLevel[] | null;
  trades?: BookTrade[] | null;
  audited?: boolean;
};

/** GET /api/trading/admin/options/liquidations — one step of a liquidation run (§8). */
export type Liquidation = {
  id: number | string;
  at: string;
  login: number | string;
  userId?: number | null;
  step: number;
  unit: "option" | "combo" | "cfd" | string;
  series?: string | null;
  qty: number;
  price?: number | null;
  route: "book" | "rfq" | "backstop" | "cfd" | string;
  marginLevelBefore: number | null;
  marginLevelAfter: number | null;
  freedMarginUsd: number;
  status: "done" | "partial" | "failed" | string;
  note?: string | null;
  kind?: string;
};

/** GET /api/trading/admin/options/clearing — `house:options_clearing.{U}.{YYYYMMDD}:USD`; must be 0 once the outbox is empty. */
export type ClearingRow = {
  account: string;
  underlying: string;
  expiry: string;
  balanceUsd: number;
  pendingOutbox: number;
  fills: number;
  lastFillAt?: string | null;
  swept?: { amountUsd: number; at: string } | null;
};

export type ApprovalAction = "fill_bust" | "book_enable" | string;
/** GET /api/trading/admin/options/approvals?status=pending (optional route) */
export type Approval = { id: number | string; action: ApprovalAction; target: string; kind?: string | null; reason: string; requestedBy: string; requestedAt: string };

/** Four-eyes answers of POST fills/{id}/bust and POST book/enable. */
export type FourEyesPending = { status: "pending_approval"; approval: { id: number | string; requestedBy: string; requestedAt: string } };
export type BustDone = { status: "busted"; fill?: Partial<BookTrade> | null; reversed?: { login: number | string; amountUsd: number }[] | null; approvedBy?: string | null };
export type EnableDone = { status: "enabled"; enabledAt: string; report?: unknown };

/** GET /api/trading/admin/options/book/enable/plan?kind= (dry run of §11) */
export type EnablePlan = {
  kind: string;
  enabled: boolean;
  enabledAt?: string | null;
  mmCoverage?: { pct: number; required: number } | null;
  steps?: { key: string; label: string; detail?: string | null; count?: number | null }[] | null;
  legacyPendingOrders?: number | null;
  novation?: { positions: number; clients: number; contracts: number; premiumUsd: number } | null;
  barriersStayHouse?: number | null;
  warnings?: string[] | null;
  blockers?: string[] | null;
  pending?: { id: number | string; requestedBy: string; requestedAt: string; reason: string } | null;
};
