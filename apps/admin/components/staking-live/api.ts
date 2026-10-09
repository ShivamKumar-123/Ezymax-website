/**
 * Staking (services/staking) — types and fetch wrappers for the live Back Office pages.
 * Browser → /api/staking/<path> (BFF, app/api/staking/[...path]) → staking service /v1/staking/admin/<path>.
 * Shapes follow services/staking/src/api/admin.rs, plans.rs, rates.rs, settlements.rs and positions.rs
 * (camelCase JSON, amounts and rates as JSON numbers).
 */
import type { ApiErr } from "@/components/live/kit";

export const S = (path: string) => `/api/staking/${path}`;

/* ------------------------------------------------------------------ */
/* Permissions                                                          */
/* ------------------------------------------------------------------ */

/** GET /api/staking/me. `actorId` is "staff:<id>", the form the service stores in `createdById`. */
export type Perms = { read: boolean; write: boolean; approve: boolean; export: boolean; actorId: string | null };

/* ------------------------------------------------------------------ */
/* Plans                                                                */
/* ------------------------------------------------------------------ */

export type PlanStatus = "draft" | "active" | "paused" | "closed";

export type PlanStats = { activePrincipal: number; pendingPrincipal: number; activePositions: number; investors: number; maturedPositions: number };

export type Plan = {
  id: number;
  name: string;
  currency: string;
  status: PlanStatus;
  minAmount: number;
  maxAmount: number | null;
  perUserMax: number | null;
  capacity: number | null;
  capacityLeft: number | null;
  termMonths: number;
  maxMonthlyRatePct: number;
  description: string;
  riskText: string;
  sort: number;
  version: number;
  createdBy: string;
  createdAt: string;
  updatedBy: string;
  updatedAt: string;
  stats: PlanStats;
};

export type PlansDoc = { plans: Plan[]; currencies: string[] };

/* ------------------------------------------------------------------ */
/* Overview                                                             */
/* ------------------------------------------------------------------ */

export type Totals = { lines: number; investors: number; principal: number; amount: number; zeroLines: number };
export type Ref = { id: number; status: SettlementStatus };

export type Overview = {
  liability: number;
  pendingPayment: number;
  activePositions: number;
  maturedPositions: number;
  investors: number;
  returnsPaid: number;
  maturing30d: { count: number; principal: number };
  attention: { pendingApproval: number; failedLines: number; pendingLines: number; overdueMaturities: number; redeemWaiting: number };
  plans: Plan[];
  lastPeriod: { period: string; existing: Ref | null; ratesMissing: { planId: number; name: string }[]; totals: Totals; canCreate: boolean };
  currentPeriod: string;
  monthly: { period: string; status: SettlementStatus; amount: number }[];
  currencies: string[];
  workers: { enabled: boolean; lastRun: string | null };
  serverTime: string;
};

/* ------------------------------------------------------------------ */
/* Monthly rates                                                        */
/* ------------------------------------------------------------------ */

export type RateSet = { ratePct: number; setBy: string; setAt: string; note: string | null };

export type RateItem = {
  plan: { id: number; name: string; status: PlanStatus; currency: string; maxMonthlyRatePct: number; termMonths: number };
  rate: RateSet | null;
  previous: RateSet | null;
  previousReturns: number | null;
  positions: number;
  principal: number;
  /** what the plan's positions earn this month per 1 % (a typed rate previews as basePerPct × rate) */
  basePerPct: number;
  estimate: number | null;
};

export type RatesMonth = {
  period: string;
  previousPeriod: string;
  currentPeriod: string;
  closed: boolean;
  closesAt: string;
  editable: boolean;
  future: boolean;
  settlement: Ref | null;
  items: RateItem[];
};

/* ------------------------------------------------------------------ */
/* Settlements                                                          */
/* ------------------------------------------------------------------ */

export type SettlementStatus = "pending_approval" | "approved" | "paid" | "partially_paid" | "rejected";
export type LineStatus = "pending_approval" | "transfer_pending" | "paid" | "failed" | "rejected";

export type Settlement = {
  id: number;
  period: string;
  status: SettlementStatus;
  total: number;
  lines: number;
  investors: number;
  principal: number;
  rates: Record<string, { name: string; ratePct: number }>;
  createdById: string;
  createdBy: string;
  createReason: string;
  createdAt: string;
  decidedById: string | null;
  decidedBy: string | null;
  decidedAt: string | null;
  decisionReason: string | null;
  completedAt: string | null;
  transfers: { paid: number; pending: number; failed: number } | null;
};

export type SettlementsDoc = { items: Settlement[]; total: number; page: number; limit: number };

export type PlanSum = { planId: number; name: string; ratePct: number | null; lines: number; principal: number; amount: number };

export type PreviewLine = {
  positionId: number;
  userId: number;
  userName: string;
  planId: number;
  planName: string;
  currency: string;
  principal: number;
  ratePct: number;
  daysActive: number;
  daysInMonth: number;
  amount: number;
};

export type Preview = {
  period: string;
  closed: boolean;
  closesAt: string;
  daysInMonth: number;
  existing: Ref | null;
  ratesMissing: { planId: number; name: string }[];
  totals: Totals;
  plans: PlanSum[];
  lines: PreviewLine[];
  truncated: boolean;
  blockers: { code: string; message: string }[];
  canCreate: boolean;
};

export type SettlementLine = PreviewLine & {
  id: number;
  status: LineStatus;
  attempts: number;
  lastError: string | null;
  nextAttemptAt: string | null;
  walletTxn: string | null;
  paidAt: string | null;
};

export type SettlementDetail = { settlement: Settlement; plans: PlanSum[]; lines: SettlementLine[] };

/* ------------------------------------------------------------------ */
/* Positions                                                            */
/* ------------------------------------------------------------------ */

export type PositionStatus = "pending_payment" | "payment_failed" | "active" | "matured";

export type Position = {
  id: number;
  userId: number;
  userName: string;
  planId: number;
  planName: string;
  planVersion: number;
  currency: string;
  termMonths: number;
  principal: number;
  status: PositionStatus;
  startedAt: string | null;
  maturesAt: string | null;
  maturedAt: string | null;
  returnsPaid: number;
  daysTotal: number;
  daysElapsed: number;
  failureReason: string | null;
  lastReturn: { period: string; ratePct: number; amount: number } | null;
  redeem: { attempts: number; error: string | null; nextAttemptAt: string | null } | null;
  termsAcceptedAt: string;
  riskAcknowledgedAt: string;
  createdAt: string;
  updatedAt: string;
};

export type PositionsDoc = { items: Position[]; total: number; principal: number; page: number; limit: number };

/** The plan as the client accepted it (stored on the position). */
export type Terms = {
  id: number;
  name: string;
  version: number;
  currency: string;
  termMonths: number;
  minAmount: number;
  maxAmount: number | null;
  perUserMax: number | null;
  description: string;
  riskText: string;
};

export type PositionReturn = { period: string; ratePct: number; daysActive: number; daysInMonth: number; amount: number; status: "paid" | "pending" | "processing"; paidAt: string | null };

export type PositionDetail = { position: Position; terms: Partial<Terms> | null; returns: PositionReturn[] };

/* ------------------------------------------------------------------ */
/* Audit                                                                */
/* ------------------------------------------------------------------ */

export type AuditEntry = { id: number; at: string; actor: string; actorName: string | null; action: string; target: string | null; before: unknown; after: unknown; reason: string | null };
export type AuditDoc = { items: AuditEntry[]; total: number; page: number; limit: number };

/* ------------------------------------------------------------------ */
/* Writes                                                               */
/* ------------------------------------------------------------------ */

export type WriteResult<T> = { ok: true; data: T } | { ok: false; error: ApiErr };

function expired() {
  const next = window.location.pathname + window.location.search;
  window.location.assign(`/api/auth/expired?next=${encodeURIComponent(next)}`);
}

/** POST / PATCH JSON to /api/staking/<path>. Service validation errors come back as {code, message, field}. */
export async function stakingSend<T = unknown>(path: string, body: Record<string, unknown>, method: "POST" | "PATCH" = "POST"): Promise<WriteResult<T>> {
  try {
    const r = await fetch(S(path), { method, headers: { "content-type": "application/json" }, body: JSON.stringify(body), credentials: "same-origin" });
    const data = await r.json().catch(() => ({}));
    if (r.status === 401) {
      expired();
      return { ok: false, error: { code: "unauthorized", message: "Your session has ended." } };
    }
    if (r.ok) return { ok: true, data: data as T };
    const e = (data as { error?: ApiErr })?.error;
    return { ok: false, error: e && e.message ? e : { code: String(r.status), message: r.status === 503 ? "The staking service isn't reachable right now." : "Something went wrong." } };
  } catch {
    return { ok: false, error: { code: "network", message: "Can't reach the Back Office server." } };
  }
}

/** GET a BFF endpoint once (exports). */
export async function stakingGet<T>(path: string): Promise<WriteResult<T>> {
  try {
    const r = await fetch(S(path), { cache: "no-store", credentials: "same-origin" });
    const data = await r.json().catch(() => ({}));
    if (r.status === 401) {
      expired();
      return { ok: false, error: { code: "unauthorized", message: "Your session has ended." } };
    }
    if (r.ok) return { ok: true, data: data as T };
    const e = (data as { error?: ApiErr })?.error;
    return { ok: false, error: e && e.message ? e : { code: String(r.status), message: "Something went wrong." } };
  } catch {
    return { ok: false, error: { code: "network", message: "Can't reach the Back Office server." } };
  }
}

/** Human label for a service validation field. */
export const FIELD_LABEL: Record<string, string> = {
  reason: "Reason",
  name: "Name",
  currency: "Currency",
  minAmount: "Minimum",
  maxAmount: "Maximum per subscription",
  perUserMax: "Maximum per client",
  capacity: "Capacity",
  termMonths: "Term",
  maxMonthlyRatePct: "Monthly rate ceiling",
  description: "Description",
  riskText: "Risk disclosure",
  sort: "Sort order",
  status: "Status",
  planId: "Plan",
  period: "Month",
  ratePct: "Rate",
  note: "Note",
};

export function errText(e: ApiErr) {
  const label = e.field ? FIELD_LABEL[e.field] : undefined;
  return label && !e.message.toLowerCase().includes(label.toLowerCase()) ? `${label}: ${e.message}` : e.message;
}
