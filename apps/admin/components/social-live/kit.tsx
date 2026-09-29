"use client";

/**
 * Live-build building blocks for the Social & Algo pages (copy trading, PAMM, fee payouts).
 * Everything goes through the Back Office BFF /api/social/* (app/api/social/[...path]) to the trading engine's
 * social API (/v1/social/*). Types follow the engine's JSON shapes (services/trading README, "Social API").
 */
import * as React from "react";
import { toast } from "sonner";
import { Button, Card, Chip, Dialog, DialogClose, cn, formatNumber, type ChipTone } from "@kalks/ui";
import { IS_DEMO } from "@kalks/mock/mode";
import { ErrorState, sendJson, type ApiErr } from "@/components/live/kit";
import { useStaff } from "@/components/staff-session";
import { AuditNotice, ErrorBanner } from "@/components/trading-desk/kit";
import { socialAllows, type SocialPerm } from "@/lib/social-perms";

/* ------------------------------------------------------------------ */
/* Engine shapes                                                        */
/* ------------------------------------------------------------------ */

export type Program = "copy" | "pamm" | "both";
export type FeePeriod = "daily" | "weekly" | "monthly";
export type MasterStatus = "pending" | "approved" | "rejected" | "suspended";

export type MasterStats = {
  return1m: number | null;
  return3m: number | null;
  return1y: number | null;
  returnAll: number | null;
  maxDd: number | null;
  currentDd: number | null;
  volatility: number | null;
  riskScore: number | null;
  equity: number;
  aum: number;
  followers: number;
  investors: number;
  trades: number;
  winRate: number | null;
  spark: number[];
};

export type FundRef = { id: number; name: string; nav: number; period: FeePeriod; perfFeePct: number; lockInDays: number; minInvestment: number; status: string };

export type MasterView = {
  id: number;
  nickname: string;
  strategy: string;
  description: string;
  program: Program;
  perfFeePct: number;
  feePeriod: FeePeriod;
  minAllocation: number;
  status: MasterStatus;
  hidden: boolean;
  frozen: boolean;
  since: string | null;
  ageDays: number | null;
  stats: Partial<MasterStats> | null;
  fund: FundRef | null;
  // private (admin)
  login?: number | string | null;
  kycVerified?: boolean;
  reviewNote?: string | null;
  reviewedBy?: string | null;
  createdAt?: string | null;
  userId?: number | string | null;
};

export type Sizing = { mode: "equity" | "allocation" | "multiplier" | "fixed_lot"; value: number };

export type SubscriptionView = {
  id: number;
  masterId: number;
  master: { id: number; nickname: string; strategy: string; riskScore: number | null; frozen: boolean; status: string };
  login: number | string;
  userId?: number | string;
  status: "active" | "paused" | "stopped";
  stopReason: string | null;
  sizing: Sizing;
  maxLot: number | null;
  equityStop: number | null;
  maxDdPct: number | null;
  excludedSymbols: string[];
  perfFeePct: number;
  feePeriod: FeePeriod;
  allocation: number;
  netDeposits: number;
  hwm: number;
  peakEquity: number;
  feesPaid: number;
  feesPending: number;
  balance: number;
  equity: number;
  profit: number;
  returnPct: number;
  positions: number;
  orders: number;
  createdAt: string;
  stoppedAt: string | null;
  nextFeeAt: string | null;
};

export type RequestView = { id: number; fundId: number; kind: "invest" | "redeem"; amount: number | null; units: number | null; all: boolean; status: string; reason: string | null; createdAt: string };

export type FundView = {
  id: number;
  masterId: number;
  master: { id: number; nickname: string };
  name: string;
  status: "active" | "frozen" | "closed";
  period: FeePeriod;
  perfFeePct: number;
  lockInDays: number;
  minInvestment: number;
  maxDdPct: number;
  minOwnPct: number;
  nav: number;
  units: number;
  equity: number;
  aum: number;
  investors: number;
  masterSharePct: number;
  navPeak: number;
  drawdownPct: number;
  returnAll: number | null;
  return1m: number | null;
  lastRolloverAt: string | null;
  nextRolloverAt: string | null;
  createdAt: string;
  login?: number | string;
  /** admin list: pending request count, or the pending requests themselves */
  pending?: number | RequestView[] | { count: number; invest?: number; redeem?: number } | null;
};

export type FeeView = {
  id: number;
  source: "copy" | "pamm";
  masterId: number;
  master: string;
  subscriptionId: number | null;
  fundId: number | null;
  payerUserId: number | string;
  login: number | string;
  amount: number;
  platformCut: number;
  masterAmount: number;
  periodStart: string | null;
  periodEnd: string | null;
  hwmBefore: number | null;
  hwmAfter: number | null;
  equity: number | null;
  status: "pending" | "approved" | "paid" | "rejected" | "failed";
  reviewedBy: string | null;
  note: string | null;
  createdAt: string;
  paidAt: string | null;
};

export type SocialSettings = {
  feeMinPct: number;
  feeMaxPct: number;
  platformCutPct: number;
  minTrackDays: number;
  minOwnCapitalPct: number;
  minMasterEquity: number;
  minAllocation: number;
  tradeDelayMinutes: number;
};

export type Overview = {
  masters: { pending: number; approved: number; suspended: number };
  subscriptions: { active: number; stopped: number };
  funds: { active: number; frozen: number };
  aum: number;
  feesPending: { count: number; amount: number };
  settings?: Partial<SocialSettings>;
};

export type MasterDetail = {
  master: MasterView;
  equity: { day: string; equity: number; index: number }[];
  monthly: { month: string; returnPct: number }[];
  trades: { id: number; symbol: string; side: "buy" | "sell"; volume: number; openPrice: number; closePrice: number; openTime: string; closeTime: string; profit: number }[];
  symbols: { symbol: string; trades: number; share: number }[];
  tradeDelayMinutes: number;
  terms: { perfFeePct: number; feePeriod: FeePeriod; hwm: boolean; minAllocation: number; platformCutPct: number };
};

export type FundDetail = {
  fund: FundView;
  master: MasterView | { id: number; nickname: string };
  navHistory: { at: string; nav: number }[];
  rollovers: { at: string; nav: number; invested: number; redeemed: number; fees: number }[];
};

export type SocialAudit = {
  id: string;
  at: string;
  staff: { id: string | number; name: string; role: string } | string | null;
  action: string;
  tickets?: string[];
  login?: string | null;
  symbol?: string | null;
  before?: Record<string, unknown> | null;
  after?: Record<string, unknown> | null;
  reasonCode?: string | null;
  note?: string | null;
  flags?: string[] | null;
};

/* ------------------------------------------------------------------ */
/* Permissions & writes                                                 */
/* ------------------------------------------------------------------ */

/** Whether the signed-in staff member may use a social permission (demo builds: everything). */
export function useSocialCan(perm: SocialPerm): boolean {
  const s = useStaff();
  if (IS_DEMO) return true;
  return socialAllows(s, perm);
}

export type WriteResult<T> = { ok: true; data: T } | { ok: false; error: string };

/** POST/PUT to /api/social/<path>. */
export async function socialWrite<T = unknown>(path: string, body: Record<string, unknown>, method: "POST" | "PUT" = "POST"): Promise<WriteResult<T>> {
  const r = await sendJson<T>(`/api/social/${path}`, body, method);
  if (!r.ok) return { ok: false, error: r.error.message || "Something went wrong." };
  return { ok: true, data: r.data };
}

/* ------------------------------------------------------------------ */
/* Confirm dialog with a mandatory note                                */
/* ------------------------------------------------------------------ */

export type NoteAction = {
  title: React.ReactNode;
  description?: React.ReactNode;
  confirmLabel: string;
  confirmVariant?: "ember" | "sell" | "buy" | "surface";
  notePlaceholder?: string;
  /** extra content above the note (impact summary, options) */
  body?: React.ReactNode;
  /** blocks the confirm button (string = reason shown in the footer) */
  disabled?: boolean | string;
  run: (note: string) => Promise<WriteResult<unknown>>;
  success: string;
  onDone?: () => void;
};

export function NoteDialog({ action, open, onOpenChange }: { action: NoteAction | null; open: boolean; onOpenChange: (o: boolean) => void }) {
  const [note, setNote] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  React.useEffect(() => {
    if (open) {
      setNote("");
      setError(null);
      setBusy(false);
    }
  }, [open, action]);
  if (!action) return null;
  const blocked = typeof action.disabled === "string" ? action.disabled : null;
  const missing = !note.trim();
  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={action.title}
      description={action.description}
      width={540}
      footer={
        <>
          <span className="mr-auto text-[11.5px] text-fg-3">{blocked}</span>
          <DialogClose asChild>
            <Button variant="ghost" size="sm">
              Cancel
            </Button>
          </DialogClose>
          <Button
            variant={action.confirmVariant ?? "ember"}
            size="sm"
            disabled={!!action.disabled || missing || busy}
            onClick={async () => {
              setBusy(true);
              setError(null);
              const res = await action.run(note.trim());
              setBusy(false);
              if (!res.ok) {
                setError(res.error);
                toast.error("Rejected", { description: res.error });
                return;
              }
              toast.success(action.success, { description: "Recorded in the social audit log" });
              action.onDone?.();
              onOpenChange(false);
            }}
          >
            {busy ? "Working…" : action.confirmLabel}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {action.body}
        <label className="block">
          <span className="mb-1.5 flex items-center justify-between text-[12.5px] font-medium text-fg-2">
            Reason
            <span className="text-[11px] font-normal text-down">Required</span>
          </span>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={3}
            aria-label="Reason"
            placeholder={action.notePlaceholder ?? "Why is this being done? Written to the audit log."}
            className="w-full resize-none rounded-[14px] border border-line bg-surface-2 px-3.5 py-2.5 text-[13px] text-fg outline-none placeholder:text-fg-3 focus:border-ember/50 focus:ring-4 focus:ring-ember/10"
          />
        </label>
        <ErrorBanner error={error} />
        <AuditNotice />
      </div>
    </Dialog>
  );
}

/** const act = useNoteAction(); act.ask({...}); {act.node} */
export function useNoteAction() {
  const [action, setAction] = React.useState<NoteAction | null>(null);
  const [open, setOpen] = React.useState(false);
  const ask = React.useCallback((a: NoteAction) => {
    setAction(a);
    setOpen(true);
  }, []);
  return { ask, node: <NoteDialog action={action} open={open} onOpenChange={setOpen} /> };
}

/* ------------------------------------------------------------------ */
/* States                                                               */
/* ------------------------------------------------------------------ */

const DOWN = ["unavailable", "not_configured", "bad_gateway", "network", "not_found"];

/** Error card; engine outages get a friendly message instead of a raw code. */
export function SocialError({ error, onRetry, className }: { error: ApiErr; onRetry?: () => void; className?: string }) {
  const friendly: ApiErr = DOWN.includes(error.code)
    ? { ...error, message: "Copy trading and PAMM data comes from the trading engine, which isn't reachable right now. Try again in a moment." }
    : error;
  return (
    <Card className={className}>
      <ErrorState error={friendly} onRetry={onRetry} />
    </Card>
  );
}

/* ------------------------------------------------------------------ */
/* Chips & cells                                                        */
/* ------------------------------------------------------------------ */

export const MASTER_STATUS: Record<string, { label: string; tone: ChipTone }> = {
  pending: { label: "Pending", tone: "warn" },
  approved: { label: "Approved", tone: "up" },
  rejected: { label: "Rejected", tone: "down" },
  suspended: { label: "Suspended", tone: "down" },
  active: { label: "Active", tone: "up" },
  paused: { label: "Paused", tone: "neutral" },
  stopped: { label: "Stopped", tone: "neutral" },
  frozen: { label: "Frozen", tone: "down" },
  closed: { label: "Closed", tone: "neutral" },
  paid: { label: "Paid", tone: "up" },
  failed: { label: "Failed", tone: "down" },
};

export function SocialStatus({ status }: { status: string }) {
  const s = MASTER_STATUS[status] ?? { label: status, tone: "neutral" as ChipTone };
  return (
    <Chip size="sm" dot tone={s.tone}>
      {s.label}
    </Chip>
  );
}

export function ProgramChip({ program }: { program: Program }) {
  return (
    <Chip size="sm" tone={program === "pamm" ? "gold" : program === "both" ? "info" : "neutral"}>
      {program === "pamm" ? "PAMM" : program === "both" ? "Copy + PAMM" : "Copy"}
    </Chip>
  );
}

export const riskTone10 = (s: number): ChipTone => (s >= 7 ? "down" : s >= 4 ? "warn" : "up");

/** Engine risk score 1–10. */
export function Risk10({ score }: { score: number | null | undefined }) {
  if (score === null || score === undefined) return <span className="text-fg-3">—</span>;
  const tone = riskTone10(score);
  return (
    <span className="inline-flex items-center gap-2">
      <span className="relative h-1.5 w-12 overflow-hidden rounded-full bg-surface-3">
        <span className={cn("absolute inset-y-0 left-0 rounded-full", tone === "down" ? "bg-down" : tone === "warn" ? "bg-warn" : "bg-up")} style={{ width: `${score * 10}%` }} />
      </span>
      <Chip size="sm" tone={tone}>
        {score}
      </Chip>
    </span>
  );
}

/** Signed percentage cell ("+12.40%"), "—" when unknown. */
export function Pct({ value, decimals = 2, className }: { value: number | null | undefined; decimals?: number; className?: string }) {
  if (value === null || value === undefined || !Number.isFinite(value)) return <span className={cn("text-fg-3", className)}>—</span>;
  return (
    <span className={cn("k-num font-medium", value > 0 ? "text-up" : value < 0 ? "text-down" : "text-fg-2", className)}>
      {value > 0 ? "+" : value < 0 ? "−" : ""}
      {formatNumber(Math.abs(value), decimals)}%
    </span>
  );
}

export function ddTone(dd: number | null | undefined) {
  if (dd === null || dd === undefined) return "text-fg-3";
  return dd > 30 ? "text-down" : dd > 20 ? "text-warn" : "text-fg-2";
}

export const usd = (v: number | null | undefined, d = 2) => (v === null || v === undefined ? "—" : `${v < 0 ? "−" : ""}$${formatNumber(Math.abs(v), d)}`);
export const usdK = (v: number | null | undefined) => {
  if (v === null || v === undefined) return "—";
  const a = Math.abs(v);
  const s = a >= 1_000_000 ? `$${(a / 1_000_000).toFixed(2)}M` : a >= 10_000 ? `$${(a / 1000).toFixed(a >= 100_000 ? 0 : 1)}k` : `$${formatNumber(a, 2)}`;
  return v < 0 ? `−${s}` : s;
};
export const int = (v: number | null | undefined) => (v === null || v === undefined ? "—" : v.toLocaleString("en-US", { maximumFractionDigits: 0 }));
export const PERIOD_LABEL: Record<string, string> = { daily: "Daily", weekly: "Weekly", monthly: "Monthly" };

/** Pending request count of an admin fund row (the engine sends a count or the requests). */
export function pendingCount(p: FundView["pending"]): number {
  if (p === null || p === undefined) return 0;
  if (typeof p === "number") return p;
  if (Array.isArray(p)) return p.length;
  return p.count ?? 0;
}

/** A totals value that may be a plain amount or {count, amount}. */
export function amountOf(v: unknown): { amount: number; count: number | null } {
  if (typeof v === "number") return { amount: v, count: null };
  if (v && typeof v === "object") {
    const o = v as { amount?: number; count?: number };
    return { amount: o.amount ?? 0, count: o.count ?? null };
  }
  return { amount: 0, count: null };
}

/** Small read-only notice for a role that can view but not act. */
export function ReadOnlyNote({ what }: { what: string }) {
  return <Chip tone="neutral">View only · your role can't {what}</Chip>;
}
