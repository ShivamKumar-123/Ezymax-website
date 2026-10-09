"use client";

/**
 * Shared building blocks for the live Staking pages (components/staking-live/*).
 */
import * as React from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Info, ShieldCheck } from "lucide-react";
import { Button, Card, Dialog, DialogClose, Money, cn, formatNumber, type ChipTone } from "@ezymex/ui";
import { ErrorState, useApi, type ApiErr } from "@/components/live/kit";
import { ErrorBanner } from "@/components/trading-desk/kit";
import { EmptyNote, ReadOnlyNote, StatusPill, useUrlParam } from "@/components/partners-live/kit";
import { S, errText, type LineStatus, type Perms, type PlanStatus, type PositionStatus, type SettlementStatus, type WriteResult } from "./api";

export { EmptyNote, ReadOnlyNote, StatusPill, useUrlParam };

/* ------------------------------------------------------------------ */
/* Permissions                                                          */
/* ------------------------------------------------------------------ */

/** The signed-in staff member's Staking permissions (GET /api/staking/me). Nothing is allowed until it loads. */
export function usePerms(): Perms & { loaded: boolean } {
  const { data } = useApi<Perms>(S("me"));
  return { read: data?.read ?? true, write: !!data?.write, approve: !!data?.approve, export: !!data?.export, actorId: data?.actorId ?? null, loaded: !!data };
}

/* ------------------------------------------------------------------ */
/* Formatting                                                           */
/* ------------------------------------------------------------------ */

/** "1,250.00 USDT" (amounts are in the plan's currency, always 2 decimals). */
export const amt = (v: number | null | undefined, currency = "USDT") => (v === null || v === undefined || !Number.isFinite(v) ? "—" : `${v < 0 ? "−" : ""}${formatNumber(Math.abs(v), 2)} ${currency}`);

/** Amount for stat tiles: the number with a small, dim currency code (fits two tiles a row on a phone). */
export const money = (v: number | null | undefined, currency = "USDT") =>
  v === null || v === undefined || !Number.isFinite(v) ? (
    "—"
  ) : (
    <>
      {v < 0 ? "−" : ""}
      {formatNumber(Math.abs(v), 2)}
      <span className="ml-1 text-[0.72em] font-normal text-fg-3">{currency}</span>
    </>
  );

/** Compact amount for chart axes: "12.5k", "1.20M". */
export const amtK = (v: number) => {
  const a = Math.abs(v);
  const s = a === 0 ? "0" : a >= 1_000_000 ? `${(a / 1_000_000).toFixed(2)}M` : a >= 10_000 ? `${(a / 1000).toFixed(a >= 100_000 ? 0 : 1)}k` : formatNumber(a, a >= 100 ? 0 : 2);
  return v < 0 ? `−${s}` : s;
};

/** A monthly rate: "1.25%", up to 4 decimals. */
export const pct = (v: number | null | undefined) => (v === null || v === undefined || !Number.isFinite(v) ? "—" : `${v.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 4 })}%`);

export const int = (v: number | null | undefined) => (v === null || v === undefined ? "—" : v.toLocaleString("en-US", { maximumFractionDigits: 0 }));

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

/** "2026-09" → "September 2026" (short: "Sep 2026"; tiny: "Sep"). */
export function monthName(period: string | null | undefined, style: "long" | "short" | "tiny" = "long") {
  if (!period) return "—";
  const [y, m] = period.split("-");
  const name = MONTHS[Number(m) - 1];
  if (!name) return period;
  if (style === "tiny") return name.slice(0, 3);
  return `${style === "short" ? name.slice(0, 3) : name} ${y}`;
}

export const isPeriod = (v: string | null | undefined): v is string => !!v && /^\d{4}-(0[1-9]|1[0-2])$/.test(v);

/** "2026-09" shifted by `n` months. */
export function shiftPeriod(period: string, n: number) {
  const [y, m] = period.split("-").map(Number);
  const d = new Date(Date.UTC(y!, m! - 1 + n, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

/** The month of `iso` in server time (GMT+3), "YYYY-MM". */
export function periodOf(iso: string | number = Date.now()) {
  const d = new Date(new Date(iso).getTime() + 3 * 3600_000);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

/** Amount with dimmed decimals and the currency code. */
export function Amount({ value, currency = "USDT", className, codeClassName }: { value: number | null | undefined; currency?: string; className?: string; codeClassName?: string }) {
  if (value === null || value === undefined || !Number.isFinite(value)) return <span className={cn("text-fg-3", className)}>—</span>;
  return (
    <span className={cn("k-num whitespace-nowrap", className)}>
      <Money value={value} currency="" countUp={false} />
      <span className={cn("ml-1 text-[0.78em] font-normal text-fg-3", codeClassName)}>{currency}</span>
    </span>
  );
}

/* ------------------------------------------------------------------ */
/* Status chips                                                         */
/* ------------------------------------------------------------------ */

const T = (label: string, tone: ChipTone) => ({ label, tone });

export const PLAN_STATUS: Record<PlanStatus, { label: string; tone: ChipTone }> = {
  draft: T("Draft", "neutral"),
  active: T("On sale", "up"),
  paused: T("Paused", "warn"),
  closed: T("Closed", "down"),
};

export const SETTLEMENT_STATUS: Record<SettlementStatus, { label: string; tone: ChipTone }> = {
  pending_approval: T("Awaiting approval", "warn"),
  approved: T("Approved · transferring", "info"),
  paid: T("Paid", "up"),
  partially_paid: T("Partly paid", "down"),
  rejected: T("Rejected", "neutral"),
};

export const LINE_STATUS: Record<LineStatus, { label: string; tone: ChipTone }> = {
  pending_approval: T("Awaiting approval", "warn"),
  transfer_pending: T("Pending transfer", "info"),
  paid: T("Credited", "up"),
  failed: T("Transfer failed", "down"),
  rejected: T("Rejected", "neutral"),
};

export const POSITION_STATUS: Record<PositionStatus, { label: string; tone: ChipTone }> = {
  pending_payment: T("Payment pending", "warn"),
  payment_failed: T("Payment failed", "down"),
  active: T("Active", "up"),
  matured: T("Matured", "neutral"),
};

/* ------------------------------------------------------------------ */
/* Cells & notes                                                        */
/* ------------------------------------------------------------------ */

/** Client name + id, linking to the client profile. */
export function ClientLink({ id, name, sub, className }: { id: number; name?: string | null; sub?: React.ReactNode; className?: string }) {
  return (
    <span className={cn("block min-w-0", className)}>
      <Link href={`/clients/${id}`} onClick={(e) => e.stopPropagation()} className="block truncate text-[13px] font-medium text-fg hover:text-ember">
        {name?.trim() || `Client #${id}`}
      </Link>
      <span className="block truncate font-mono text-[11px] text-fg-3">
        #{id}
        {sub ? <> · {sub}</> : null}
      </span>
    </span>
  );
}

/** Quiet explanatory panel. */
export function Note({ children, tone = "neutral", icon, className }: { children: React.ReactNode; tone?: "neutral" | "warn" | "down" | "up" | "info"; icon?: React.ReactNode; className?: string }) {
  const cls = {
    neutral: "border-line bg-surface-2/60 text-fg-3",
    warn: "border-warn/30 bg-warn-soft text-fg",
    down: "border-down/30 bg-down-soft text-fg",
    up: "border-up/25 bg-up-soft text-fg",
    info: "border-info/25 bg-info-soft text-fg",
  }[tone];
  const ic = { neutral: "text-fg-2", warn: "text-warn", down: "text-down", up: "text-up", info: "text-info" }[tone];
  return (
    <div className={cn("flex items-start gap-2.5 rounded-[14px] border px-3.5 py-2.5 text-[12.5px]", cls, className)}>
      <span className={cn("mt-0.5 shrink-0 [&_svg]:size-3.5", ic)}>{icon ?? <Info />}</span>
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* States                                                               */
/* ------------------------------------------------------------------ */

const DOWN = ["unavailable", "not_configured", "bad_gateway", "network", "internal"];

export function StakingError({ error, onRetry, className }: { error: ApiErr; onRetry?: () => void; className?: string }) {
  const friendly: ApiErr = DOWN.includes(error.code) ? { ...error, message: `The staking service isn't reachable right now. ${error.code === "not_configured" ? "It isn't configured for this Back Office." : "Try again in a moment."}` } : error;
  return (
    <Card className={className}>
      <ErrorState error={friendly} onRetry={onRetry} />
    </Card>
  );
}

/* ------------------------------------------------------------------ */
/* Action dialog: every staking write carries a reason (3–500 chars)    */
/* ------------------------------------------------------------------ */

export type ReasonAction<T = unknown> = {
  title: React.ReactNode;
  description?: React.ReactNode;
  body?: React.ReactNode;
  confirmLabel: string;
  confirmVariant?: "ember" | "buy" | "sell" | "surface";
  placeholder?: string;
  /** blocks the confirm button; a string is shown next to it */
  disabled?: boolean | string;
  run: (reason: string) => Promise<WriteResult<T>>;
  success: string | ((data: T) => string);
  /** title of the error toast (default "Not saved") */
  failure?: string;
  successDetail?: string | ((data: T) => string | undefined);
  onDone?: (data: T) => void;
};

export function ReasonDialog({ action, open, onOpenChange }: { action: ReasonAction<any> | null; open: boolean; onOpenChange: (o: boolean) => void }) {
  const [text, setText] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  React.useEffect(() => {
    if (open) {
      setText("");
      setError(null);
      setBusy(false);
    }
  }, [open, action]);
  if (!action) return null;
  const len = text.trim().length;
  const short = len < 3;
  const long = len > 500;
  const blocked = typeof action.disabled === "string" ? action.disabled : null;
  return (
    <Dialog
      open={open}
      onOpenChange={(o) => !busy && onOpenChange(o)}
      title={action.title}
      description={action.description}
      width={560}
      footer={
        <>
          <span className="mr-auto text-[11.5px] text-fg-3">{blocked}</span>
          <DialogClose asChild>
            <Button variant="ghost" size="sm" disabled={busy}>
              Cancel
            </Button>
          </DialogClose>
          <Button
            variant={action.confirmVariant ?? "ember"}
            size="sm"
            disabled={!!action.disabled || short || long || busy}
            onClick={async () => {
              setBusy(true);
              setError(null);
              const res = await action.run(text.trim());
              setBusy(false);
              if (!res.ok) {
                const msg = errText(res.error);
                setError(msg);
                toast.error(action.failure ?? "Not saved", { description: msg });
                return;
              }
              const title = typeof action.success === "function" ? action.success(res.data) : action.success;
              const detail = typeof action.successDetail === "function" ? action.successDetail(res.data) : action.successDetail;
              toast.success(title, { description: detail ?? "Recorded in the staking audit log" });
              action.onDone?.(res.data);
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
            <span className={cn("text-[11px] font-normal", short || long ? "text-down" : "text-fg-3")}>{short ? "Required · at least 3 characters" : `${len}/500`}</span>
          </span>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={3}
            maxLength={600}
            aria-label="Reason"
            placeholder={action.placeholder ?? "Why is this being done? Kept in the staking audit log."}
            className="w-full resize-none rounded-[14px] border border-line bg-surface-2 px-3.5 py-2.5 text-[13px] text-fg outline-none placeholder:text-fg-3 focus:border-ember/50 focus:ring-4 focus:ring-ember/10"
          />
          {long && <span className="mt-1 block text-[11.5px] text-down">Keep it under 500 characters.</span>}
        </label>
        <ErrorBanner error={error} />
        <div className="flex items-start gap-2.5 rounded-[14px] border border-line bg-surface-2/60 px-3.5 py-2.5 text-[12px] text-fg-3">
          <ShieldCheck className="mt-0.5 size-3.5 shrink-0 text-up" />
          Written to the staking audit log with your staff ID, the time, the reason and the before / after values.
        </div>
      </div>
    </Dialog>
  );
}

/** const act = useReasonAction(); act.ask({...}); {act.node} */
export function useReasonAction() {
  const [action, setAction] = React.useState<ReasonAction<any> | null>(null);
  const [open, setOpen] = React.useState(false);
  const ask = React.useCallback(<T,>(a: ReasonAction<T>) => {
    setAction(a as ReasonAction<any>);
    setOpen(true);
  }, []);
  return { ask, node: <ReasonDialog action={action} open={open} onOpenChange={setOpen} /> };
}

/** Plain value of a Chip-like status map for CSV. */
export const statusLabel = (map: Record<string, { label: string }>, s: string) => map[s]?.label ?? s;

/** Small "Rates · Settlements" style link button. */
export function LinkButton({ href, children, variant = "surface" }: { href: string; children: React.ReactNode; variant?: "surface" | "ember" | "ghost" }) {
  return (
    <Link href={href}>
      <Button size="sm" variant={variant}>
        {children}
      </Button>
    </Link>
  );
}
