// Contract shapes of the MAM routes (services/trading README "MAM (multi-account manager)"), fetched through
// the social BFF (`/api/social/mam/…`, lib/mam-bff.ts) with socialApi / useSocial.

import { tr } from "@kalks/i18n/react";
import type { EngineOrder, EnginePosition } from "@/components/trading/api";
import type { FeePeriod, FeeView } from "./api";

export type MamMethod = "equity" | "balance" | "multiplier" | "percent";
export type ManagerStatus = "active" | "frozen" | "closed";
export type LinkStatus = "active" | "revoked" | "stopped";

export interface ManagerView {
  id: number;
  masterId: number;
  nickname: string | null;
  name: string;
  description: string;
  method: MamMethod;
  perfFeePct: number;
  mgmtFeePct: number;
  feePeriod: FeePeriod;
  minEquity: number;
  status: ManagerStatus;
  freezeReason: string | null;
  createdAt: string;
  accounts: number;
  aum: number;
  login?: number;
  track?: { return1m: number; return1y: number; returnAll: number; maxDd: number; riskScore: number; since: string | null } | null;
}

export interface LinkView {
  id: number;
  managerId: number;
  manager: { id: number; name: string; nickname: string; method: MamMethod; status: ManagerStatus } | null;
  /** Full login for the client; masked ("••1234") in the manager's view. */
  login: number | string;
  status: LinkStatus;
  stopReason: string | null;
  allocValue: number;
  maxLot: number | null;
  equityStop: number | null;
  perfFeePct: number;
  mgmtFeePct: number;
  feePeriod: FeePeriod;
  hwm: number;
  feesPaid: number;
  feesPending: number;
  startEquity: number;
  equity: number;
  balance: number;
  mamResult: number;
  mamRealized: number;
  mamFloating: number;
  mamPositions: number;
  mamOrders: number;
  mamVolume: number;
  createdAt: string;
  endedAt: string | null;
  endedBy: string | null;
  lastFeeAt: string | null;
  nextFeeAt: string | null;
  consentAt: string;
}

export interface Candidate {
  login: number;
  group: string;
  equity: number;
  balance: number;
  positions: number;
  eligible: boolean;
  reason: string | null;
}

export interface ManagerDetail {
  manager: ManagerView;
  terms: { text: string; hash: string };
  accounts: Candidate[];
  own: boolean;
}

export interface MamDeal {
  id: number;
  positionTicket: number;
  symbol: string;
  side: "buy" | "sell";
  entry: "in" | "out" | "out_by";
  volume: number;
  price: number;
  profit: number;
  swap: number;
  commission: number;
  reason: string;
  time: string;
}

export interface MamLogEntry {
  at: string;
  action: string;
  masterTicket: number | null;
  ticket: number | null;
  volume: number | null;
  status: "done" | "skipped" | "failed";
  message: string;
}

export interface LinkDetail {
  link: LinkView;
  positions: EnginePosition[];
  orders: EngineOrder[];
  deals: MamDeal[];
  log: MamLogEntry[];
  fees: MamFee[];
  terms: string | null;
}

export type MamFee = FeeView & { linkId?: number | null; perfAmount?: number | null; mgmtAmount?: number | null; login: number | string };

export interface AllocationRow {
  linkId: number;
  login: number | string | null;
  equity: number;
  balance: number;
  value: number | null;
  maxLot: number | null;
  basis: number;
  raw: number;
  volume: number | null;
  reason: string | null;
  status: "done" | "skipped" | "failed";
  ticket: number | null;
  message: string;
}

export interface Allocation {
  id: number;
  managerId: number;
  masterTicket: number | null;
  action: "open" | "add" | "order";
  symbol: string;
  side: "buy" | "sell";
  block: number;
  method: MamMethod;
  allocated: number;
  accounts: number;
  details: AllocationRow[];
  at: string;
}

export interface Preview {
  symbol: string;
  block: number;
  method: MamMethod;
  lotStep: number;
  lotMin: number;
  allocated: number;
  unallocated: number;
  rows: { linkId: number; account: string; equity: number; balance: number; value: number; maxLot: number | null; basis: number; raw: number; volume: number | null; reason: string | null }[];
}

export interface ManagerMe {
  master: { id: number; nickname: string; status: string; frozen: boolean } | null;
  settings: { feeMinPct: number; feeMaxPct: number; mgmtMaxPct: number; platformCutPct: number };
  manager: ManagerView | null;
  totals?: { accounts: number; equity: number; mamResult: number; feesPending: number; feesPaid: number };
  links?: LinkView[];
  allocations?: Allocation[];
  fees?: MamFee[];
  terms?: { text: string; hash: string };
}

export const METHOD_LABEL: Record<MamMethod, string> = {
  get equity() {
    return tr("social.mam.method.equity");
  },
  get balance() {
    return tr("social.mam.method.balance");
  },
  get multiplier() {
    return tr("social.mam.method.multiplier");
  },
  get percent() {
    return tr("social.mam.method.percent");
  },
};

export const METHOD_HINT: Record<MamMethod, string> = {
  get equity() {
    return tr("social.mam.methodHint.equity");
  },
  get balance() {
    return tr("social.mam.methodHint.balance");
  },
  get multiplier() {
    return tr("social.mam.methodHint.multiplier");
  },
  get percent() {
    return tr("social.mam.methodHint.percent");
  },
};

export const STOP_REASON: Record<string, string> = {
  get client() {
    return tr("social.mam.stopReason.client");
  },
  get equity_stop() {
    return tr("social.mam.stopReason.equityStop");
  },
  get admin() {
    return tr("social.mam.stopReason.admin");
  },
};

/** "1.5×" / "50%" / "—" for the proportional methods. */
export function valueText(method: MamMethod | undefined, v: number | null | undefined) {
  if (v === null || v === undefined) return "—";
  if (method === "multiplier") return `${v}×`;
  if (method === "percent") return `${v}%`;
  return "—";
}

export const reasonText = (r: string | null | undefined) =>
  !r ? "" : r === "below_min_lot" ? tr("social.mam.reason.belowMinLot") : r === "no_equity" ? tr("social.mam.reason.noEquity") : r === "max_lot" ? tr("social.mam.reason.maxLot") : r === "symbol_max_lot" ? tr("social.mam.reason.symbolMaxLot") : r.replace(/_/g, " ");

export const lots = (v: number | null | undefined) => (typeof v === "number" && Number.isFinite(v) ? v.toFixed(2) : "—");
