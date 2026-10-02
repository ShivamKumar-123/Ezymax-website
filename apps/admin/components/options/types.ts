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
