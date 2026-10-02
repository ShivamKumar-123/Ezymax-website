"use client";

/**
 * Options section building blocks: data access (live BFFs, or the in-memory mock in demo builds), permission flags,
 * number formatting for vols / rates / Greeks, the reason dialog every change goes through, and small shared bits.
 *
 *   /api/options/*                      options service (services/options): reference data, controls, fixings, audit
 *   /api/trading/admin/options/*        trading engine: the option book, settlement re-runs, voids
 */
import * as React from "react";
import { Hourglass, Lock, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { Button, Chip, Dialog, DialogClose, EmptyState, SymbolAvatar, cn, formatNumber, type ChipTone } from "@kalks/ui";
import { INSTRUMENT_MAP } from "@kalks/mock";
import { IS_DEMO } from "@kalks/mock/mode";
import { mockOptionsRequest } from "@kalks/mock/admin-options";
import { useApi, type ApiErr } from "@/components/live/kit";
import { useCan, useStaff } from "@/components/staff-session";
import { ErrorBanner, ReasonFields, useReason } from "@/components/trading-desk/kit";
import { PLATFORM_TENANT } from "@/lib/options-perms";

export type { ApiErr };

/* ------------------------------------------------------------------ */
/* Data                                                                */
/* ------------------------------------------------------------------ */

type Loaded<T> = { data: T | null; error: ApiErr | null; loading: boolean; reload: () => void };

/** Demo builds: the same request answered by packages/mock/src/admin-options.ts. */
function useDemoApi<T>(url: string | null, refreshMs?: number): Loaded<T> {
  const [data, setData] = React.useState<T | null>(null);
  const [error, setError] = React.useState<ApiErr | null>(null);
  const [loading, setLoading] = React.useState(!!url);
  const [tick, setTick] = React.useState(0);
  React.useEffect(() => {
    if (!url) return;
    let alive = true;
    setLoading(true);
    void mockOptionsRequest("GET", url).then((r) => {
      if (!alive) return;
      const body = r.data as { error?: ApiErr };
      if (r.status >= 400) setError(body?.error ?? { code: "unknown", message: "Something went wrong." });
      else {
        setError(null);
        setData(r.data as T);
      }
      setLoading(false);
    });
    return () => {
      alive = false;
    };
  }, [url, tick]);
  React.useEffect(() => {
    if (!url || !refreshMs) return;
    const t = setInterval(() => setTick((n) => n + 1), refreshMs);
    return () => clearInterval(t);
  }, [url, refreshMs]);
  const reload = React.useCallback(() => setTick((n) => n + 1), []);
  return { data, error, loading, reload };
}

/** GET a BFF endpoint (`null` skips). Live builds use the shared cached loader; demo builds the mock. */
export function useOpt<T>(url: string | null, opts: { refreshMs?: number } = {}): Loaded<T> {
  const live = useApi<T>(IS_DEMO ? null : url, opts);
  const demo = useDemoApi<T>(IS_DEMO ? url : null, opts.refreshMs);
  return IS_DEMO ? demo : live;
}

export type SendResult<T> = { ok: true; data: T } | { ok: false; status: number; error: ApiErr };

/** POST / PUT / DELETE JSON to a BFF endpoint (DELETE carries the reason in the body; the BFF moves it to the query). */
export async function optSend<T = unknown>(method: "POST" | "PUT" | "DELETE", url: string, body: Record<string, unknown>): Promise<SendResult<T>> {
  if (IS_DEMO) {
    const r = await mockOptionsRequest(method, url, body);
    if (r.status < 400) return { ok: true, data: r.data as T };
    return { ok: false, status: r.status, error: (r.data as { error?: ApiErr })?.error ?? { code: "unknown", message: "Something went wrong." } };
  }
  try {
    const r = await fetch(url, { method, headers: { "content-type": "application/json" }, body: JSON.stringify(body), credentials: "same-origin" });
    const data = await r.json().catch(() => null);
    if (r.status === 401) {
      window.location.assign(`/api/auth/expired?next=${encodeURIComponent(window.location.pathname + window.location.search)}`);
      return { ok: false, status: 401, error: { code: "unauthorized", message: "Your session has ended." } };
    }
    if (r.ok) return { ok: true, data: data as T };
    return { ok: false, status: r.status, error: (data as { error?: ApiErr } | null)?.error ?? { code: r.status === 404 ? "not_found" : "unknown", message: r.status === 404 ? "Not found." : "Something went wrong." } };
  } catch {
    return { ok: false, status: 0, error: { code: "network", message: "Can't reach the Back Office server." } };
  }
}

/** True when an engine option route isn't there yet (the trading BFF maps the engine's generic 404 to `engine_pending`). */
export const enginePending = (e: ApiErr | null | undefined) => e?.code === "engine_pending";

/* ------------------------------------------------------------------ */
/* Permissions                                                         */
/* ------------------------------------------------------------------ */

export function useOptPerms() {
  const staff = useStaff();
  const config = useCan("options.config");
  const dealing = useCan("options.dealing");
  const settle = useCan("options.settle");
  const read = useCan("options.read");
  /** Kalks staff: platform-wide data (underlyings, rates, holidays, surfaces, fixings, switches) is theirs to change. */
  const platform = (staff.tenant?.slug || PLATFORM_TENANT) === PLATFORM_TENANT;
  const owner = IS_DEMO || !!staff.permissions?.includes("owner.tenants");
  return { read, config, dealing, settle, platform, owner, tenant: staff.tenant?.slug || PLATFORM_TENANT };
}

/** Why a platform-wide action is unavailable, or null when it is. */
export function platformBlock(p: ReturnType<typeof useOptPerms>, need: "config" | "settle" = "config"): string | null {
  if (!p[need]) return "Read-only for your role";
  if (!p.platform) return "Shared from Kalks: only Kalks staff change this";
  return null;
}

/* ------------------------------------------------------------------ */
/* Formatting                                                          */
/* ------------------------------------------------------------------ */

/** Decimal → percent text (0.0725 → "7.25%"). */
export const pct = (v: number | null | undefined, d = 2) => (v === null || v === undefined || !Number.isFinite(v) ? "—" : `${formatNumber(v * 100, d)}%`);
/** Decimal vol → vol points (0.004 → "0.40"). */
export const volPts = (v: number | null | undefined, d = 2) => (v === null || v === undefined || !Number.isFinite(v) ? "—" : formatNumber(v * 100, d));
export const signedVolPts = (v: number, d = 2) => `${v > 0 ? "+" : v < 0 ? "−" : ""}${formatNumber(Math.abs(v * 100), d)}`;
export const num = (v: number | null | undefined, d = 2) => (v === null || v === undefined || !Number.isFinite(v) ? "—" : formatNumber(v, d));
export const usd = (v: number | null | undefined, d = 0) => (v === null || v === undefined || !Number.isFinite(v) ? "—" : `${v < 0 ? "−" : ""}$${formatNumber(Math.abs(v), d)}`);
export const signedUsd = (v: number | null | undefined, d = 0) => (v === null || v === undefined || !Number.isFinite(v) ? "—" : `${v > 0 ? "+" : v < 0 ? "−" : ""}$${formatNumber(Math.abs(v), d)}`);
export function usdCompact(v: number) {
  const a = Math.abs(v);
  const s = a >= 1e6 ? `${formatNumber(a / 1e6, 2)}M` : a >= 1e4 ? `${formatNumber(a / 1e3, 1)}k` : formatNumber(a, 0);
  return `${v < 0 ? "−" : ""}$${s}`;
}
export function signedUsdCompact(v: number) {
  return `${v > 0 ? "+" : ""}${usdCompact(v)}`;
}
/** Parses a typed number ("1,234.5" → 1234.5); "" → null; garbage → NaN. */
export function parseNum(v: string): number | null {
  const s = v.replace(/,/g, "").trim();
  if (!s) return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : NaN;
}

export function fmtPrice(v: number | null | undefined, digits: number) {
  return v === null || v === undefined ? "—" : formatNumber(v, digits);
}

/** "in 3h 12m" / "4m 05s" countdown to an ISO time. */
export function countdown(isoAt: string, now: number) {
  let s = Math.round((Date.parse(isoAt) - now) / 1000);
  const past = s < 0;
  s = Math.abs(s);
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const body = d ? `${d}d ${h}h` : h ? `${h}h ${String(m).padStart(2, "0")}m` : `${m}m ${String(sec).padStart(2, "0")}s`;
  return past ? `${body} ago` : body;
}

export const MODEL_LABEL: Record<string, string> = { gk: "Garman-Kohlhagen", bs: "Black-Scholes", black76: "Black-76" };
export const MODEL_SHORT: Record<string, string> = { gk: "GK", bs: "BS", black76: "B76" };

export const EXPIRY_STATUS: Record<string, { label: string; tone: ChipTone }> = {
  listed: { label: "Listed", tone: "info" },
  fixing: { label: "Fixing", tone: "warn" },
  fixed: { label: "Fixed", tone: "up" },
  expired: { label: "Expired", tone: "neutral" },
};
/** `running`: the TWAP window of a listed expiry is open (the service still says `listed` until the cut). */
export function ExpiryStatusChip({ status, running }: { status: string; running?: boolean }) {
  const s = running && status === "listed" ? { label: "TWAP running", tone: "ember" as ChipTone } : (EXPIRY_STATUS[status] ?? { label: status, tone: "neutral" as ChipTone });
  return (
    <Chip size="sm" tone={s.tone} dot>
      {s.label}
    </Chip>
  );
}

export const TRADE_STATE: Record<string, { label: string; tone: ChipTone }> = {
  open: { label: "Open", tone: "up" },
  close_only: { label: "Close-only", tone: "warn" },
  halted: { label: "Halted", tone: "down" },
  closed: { label: "Closed", tone: "neutral" },
};
export function TradeStateChip({ state }: { state: string }) {
  const s = TRADE_STATE[state] ?? { label: state, tone: "neutral" as ChipTone };
  return <Chip size="sm" tone={s.tone}>{s.label}</Chip>;
}

export const CONTROL_MODE: Record<string, { label: string; tone: ChipTone; text: string }> = {
  halt: { label: "Halt", tone: "down", text: "No trading at all: no opens, no closes." },
  close_only: { label: "Close-only", tone: "warn", text: "Clients can close or reduce; no new opens." },
  freeze: { label: "Price freeze", tone: "info", text: "Prices from a frozen spot (the current mid unless you give one)." },
  manual_vol: { label: "Manual vol", tone: "gold", text: "Replaces the blended ATM vol; the smile shape stays." },
};

/* ------------------------------------------------------------------ */
/* Reasons                                                             */
/* ------------------------------------------------------------------ */

export const REASONS = {
  config: ["CFG-01 · New offering", "CFG-02 · Market conditions", "CFG-03 · Risk policy", "CFG-04 · Regulatory", "CFG-05 · Error correction", "CFG-99 · Other"],
  surface: ["VOL-01 · Initial marks", "VOL-02 · Re-mark to market quotes", "VOL-03 · Event premium", "VOL-04 · Realized vol shift", "VOL-05 · Error correction", "VOL-99 · Other"],
  rate: ["RTE-01 · Central-bank decision", "RTE-02 · Lease / carry update", "RTE-03 · Periodic review", "RTE-04 · Error correction", "RTE-99 · Other"],
  holiday: ["HOL-01 · New public holiday", "HOL-02 · Not a bank holiday", "HOL-03 · Date moved", "HOL-04 · Seed correction", "HOL-99 · Other"],
  fees: ["FEE-01 · Launch pricing", "FEE-02 · Risk / volatility", "FEE-03 · Commercial terms", "FEE-04 · Promotion", "FEE-99 · Other"],
  dealing: ["DLR-01 · Feed problem", "DLR-02 · Concentrated exposure", "DLR-03 · Market event", "DLR-04 · Price error", "DLR-05 · Maintenance", "DLR-99 · Other"],
  limit: ["LIM-01 · Live tester allow-list", "LIM-02 · Risk limit", "LIM-03 · Toxic flow", "LIM-04 · Suitability / compliance", "LIM-99 · Other"],
  void: ["VOD-01 · Off-market price", "VOD-02 · Feed error", "VOD-03 · Duplicate fill", "VOD-04 · System error", "VOD-99 · Other"],
  settle: ["SET-01 · Feed gap in the TWAP window", "SET-02 · Wrong fixing source", "SET-03 · Off-market ticks", "SET-04 · Engine error", "SET-99 · Other"],
  broker: ["BRK-01 · Broker onboarding", "BRK-02 · Jurisdiction check passed", "BRK-03 · Live test (allow-list)", "BRK-04 · Public launch", "BRK-05 · Suspended / risk", "BRK-99 · Other"],
} as const;

/** The reason string sent to the service: the code, then the note. */
export const reasonText = (code: string, note: string) => (note.trim() ? `${code} — ${note.trim()}` : code);

export function AuditNote({ engine }: { engine?: boolean }) {
  return (
    <div className="flex items-start gap-2.5 rounded-[14px] border border-line bg-surface-2/60 px-3.5 py-2.5 text-[12px] text-fg-3">
      <ShieldCheck className="mt-0.5 size-3.5 shrink-0 text-up" />
      {engine ? "Written to the dealing audit log with your name, server time and the reason." : "Written to the options audit log with your name, before / after values and the reason. The engine picks up the new snapshot within seconds."}
    </div>
  );
}

/**
 * Dialog for a change: content + reason code + note, then `onConfirm(reason)`. Shows the service's error in place
 * (e.g. a calendar-arbitrage rejection) and toasts the result.
 */
export function ReasonDialog<T>({
  open,
  onOpenChange,
  title,
  description,
  codes,
  confirmLabel,
  confirmVariant = "ember",
  disabled,
  side,
  width = 560,
  requireNote,
  onConfirm,
  success,
  engine,
  children,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  title: React.ReactNode;
  description?: React.ReactNode;
  codes: readonly string[];
  confirmLabel: string;
  confirmVariant?: "ember" | "sell" | "gold" | "surface" | "down-outline";
  /** true or a message: the confirm button is locked */
  disabled?: boolean | string | null;
  side?: "right";
  width?: number;
  requireNote?: boolean;
  onConfirm: (reason: string, parts: { code: string; note: string }) => Promise<SendResult<T>>;
  success: string | ((d: T) => string);
  engine?: boolean;
  children?: React.ReactNode;
}) {
  const r = useReason(undefined, requireNote);
  const [error, setError] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);
  const { reset } = r;
  React.useEffect(() => {
    if (!open) {
      reset();
      setError(null);
      setBusy(false);
    }
  }, [open, reset]);
  const blocked = typeof disabled === "string" ? disabled : null;
  const go = async () => {
    setBusy(true);
    setError(null);
    const res = await onConfirm(reasonText(r.code, r.note), { code: r.code, note: r.note.trim() });
    setBusy(false);
    if (!res.ok) {
      const msg = enginePending(res.error) && engine ? "Available after the engine update." : res.error.message;
      setError(msg);
      toast.error(res.error.code === "validation" ? "Rejected" : "Couldn't save", { description: msg });
      return;
    }
    toast.success(typeof success === "function" ? success(res.data) : success, { description: `Audit · ${r.code.split(" · ")[0]}` });
    onOpenChange(false);
  };
  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={title}
      description={description}
      side={side}
      width={width}
      footer={
        <>
          <span className="mr-auto max-w-[280px] truncate text-[11.5px] text-fg-3">{blocked ?? (r.code ? r.error : null)}</span>
          <DialogClose asChild>
            <Button variant="ghost" size="sm">
              Cancel
            </Button>
          </DialogClose>
          <Button variant={confirmVariant} size="sm" disabled={!!disabled || !!r.error || busy} onClick={go}>
            {busy ? "Working…" : confirmLabel}
          </Button>
        </>
      }
    >
      <div className="space-y-5">
        {children}
        <ReasonFields r={r} codes={codes} noteRequiredHint={requireNote} />
        <ErrorBanner error={error} />
        <AuditNote engine={engine} />
      </div>
    </Dialog>
  );
}

/* ------------------------------------------------------------------ */
/* Small pieces                                                        */
/* ------------------------------------------------------------------ */

/** Placeholder for engine data the trading engine doesn't serve yet. */
export function EnginePending({ what, className }: { what: string; className?: string }) {
  return (
    <div className={cn("flex items-start gap-3 rounded-[16px] border border-dashed border-line bg-surface-2/50 px-4 py-4", className)}>
      <Hourglass className="mt-0.5 size-4 shrink-0 text-fg-3" />
      <div>
        <div className="text-[13px] font-medium text-fg-2">Available after the engine update</div>
        <div className="mt-0.5 text-[12px] text-fg-3">{what} comes from the trading engine's option book, which isn't deployed on this environment yet.</div>
      </div>
    </div>
  );
}

export function ReadOnlyHint({ text }: { text: string | null }) {
  if (!text) return null;
  return (
    <span className="inline-flex items-center gap-1.5 text-[12px] text-fg-3">
      <Lock className="size-3.5" /> {text}
    </span>
  );
}

/** Native select styled like the kit's inputs. */
export function Select({ value, onChange, options, label, className, disabled }: { value: string; onChange: (v: string) => void; options: { value: string; label: string }[]; label: string; className?: string; disabled?: boolean }) {
  return (
    <select
      value={value}
      disabled={disabled}
      onChange={(e) => onChange(e.target.value)}
      aria-label={label}
      className={cn("h-11 w-full rounded-[14px] border border-line bg-surface-2 px-3 text-[13.5px] text-fg outline-none focus:border-ember/50 focus:ring-4 focus:ring-ember/10 disabled:opacity-60", className)}
    >
      {options.map((o) => (
        <option key={o.value} value={o.value} className="bg-surface text-fg">
          {o.label}
        </option>
      ))}
    </select>
  );
}

/** Numeric input bound to a typed string (keeps what the user types; parsing is the caller's). */
export function NumInput({ value, onChange, label, suffix, className, invalid, placeholder, disabled }: { value: string; onChange: (v: string) => void; label: string; suffix?: React.ReactNode; className?: string; invalid?: boolean; placeholder?: string; disabled?: boolean }) {
  return (
    <div className={cn("flex h-11 items-center gap-2 rounded-[14px] border bg-surface-2 px-3 focus-within:border-ember/50 focus-within:ring-4 focus-within:ring-ember/10", invalid ? "border-down/60" : "border-line", disabled && "opacity-60", className)}>
      <input
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value.replace(/[^0-9.,\-]/g, ""))}
        inputMode="decimal"
        aria-label={label}
        placeholder={placeholder}
        className="k-num h-full min-w-0 flex-1 bg-transparent text-right font-mono text-[13.5px] text-fg outline-none placeholder:text-fg-3"
      />
      {suffix && <span className="shrink-0 text-[11.5px] text-fg-3">{suffix}</span>}
    </div>
  );
}

export function SectionEmpty({ title, text }: { title: string; text?: string }) {
  return <EmptyState title={title} text={text} illustration="magnifying_glass_tilted_left" />;
}

const CCY_FLAG: Record<string, string> = { USD: "us", EUR: "eu", GBP: "gb", JPY: "jp", CHF: "ch", AUD: "au", CAD: "ca", NZD: "nz", SEK: "se", NOK: "no", SGD: "sg", HKD: "hk", CNH: "cn", MXN: "mx", ZAR: "za", TRY: "tr", PLN: "pl" };

/** Underlying icon: the platform's instrument icon when it has one, else the pair's two flags, else a monogram. */
export function UnderlyingAvatar({ symbol, size = 26 }: { symbol: string; size?: number }) {
  if (INSTRUMENT_MAP[symbol]) return <SymbolAvatar symbol={symbol} size={size} />;
  const b = CCY_FLAG[symbol.slice(0, 3)];
  const q = CCY_FLAG[symbol.slice(3, 6)];
  if (symbol.length === 6 && b && q)
    return (
      <span className="relative inline-block shrink-0" style={{ width: size * 1.45, height: size }}>
        <span className={cn("fi fis absolute left-0 top-0 rounded-full ring-2 ring-surface", `fi-${b}`)} style={{ width: size, height: size }} />
        <span className={cn("fi fis absolute right-0 top-0 rounded-full ring-2 ring-surface", `fi-${q}`)} style={{ width: size, height: size }} />
      </span>
    );
  return (
    <span className="grid shrink-0 place-items-center rounded-full border border-line bg-surface-3 font-mono text-[9px] font-semibold text-fg-2" style={{ width: size, height: size }}>
      {symbol.slice(0, 3)}
    </span>
  );
}

/** Symbol + subtitle; safe for underlyings the instrument catalogue doesn't know (unlike SymbolCell). */
export function UnderlyingCell({ symbol, sub, size = 26 }: { symbol: string; sub?: React.ReactNode; size?: number }) {
  return (
    <span className="flex min-w-0 items-center gap-3">
      <UnderlyingAvatar symbol={symbol} size={size} />
      <span className="min-w-0">
        <span className="block truncate text-[14px] font-medium text-fg">{symbol}</span>
        {sub && <span className="block truncate text-[12px] text-fg-3">{sub}</span>}
      </span>
    </span>
  );
}

/** "kalks" → "Kalks", "*" → "All brokers". */
export const tenantLabel = (t: string) => (t === "*" ? "All brokers" : t);
