"use client";

import * as React from "react";
import { AlertTriangle, Check, Minus, Search, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { Avatar, Button, Dialog, DialogClose, SymbolAvatar, Tooltip, cn, formatMoney, formatNumber } from "@kalks/ui";
import { INSTRUMENTS, getInstrument } from "@kalks/mock";
import { ADMIN_ACCOUNTS } from "@kalks/mock/admin-trading";
import { getClient } from "@kalks/mock/admin-clients";
import { DESK_REASONS, noteRequired, type Book, type DeskResult, type Reason } from "@/lib/trading-desk";

/* ------------------------------------------------------------------ */
/* Reason code + note (D117)                                           */
/* ------------------------------------------------------------------ */

export function useReason(initial?: string) {
  const [code, setCode] = React.useState<string>(initial ?? "");
  const [note, setNote] = React.useState("");
  const reset = React.useCallback(() => {
    setCode(initial ?? "");
    setNote("");
  }, [initial]);
  const reason: Reason = { code, note };
  const error = !code ? "Select a reason code" : noteRequired(code) && !note.trim() ? "Add a note for “Other”" : null;
  return { code, setCode, note, setNote, reason, error, reset };
}

export function ReasonFields({
  r,
  codes = DESK_REASONS,
  noteLabel = "Note",
  notePlaceholder = "Context for the audit log and the next reviewer…",
  noteRequiredHint,
}: {
  r: ReturnType<typeof useReason>;
  codes?: readonly string[];
  noteLabel?: string;
  notePlaceholder?: string;
  /** shows "Required" on the note even when the code itself does not require it */
  noteRequiredHint?: boolean;
}) {
  const needNote = noteRequiredHint || noteRequired(r.code);
  return (
    <div className="space-y-3">
      <div>
        <div className="mb-2 flex items-center justify-between text-[12.5px] font-medium text-fg-2">
          Reason code <span className="text-[11px] font-normal text-down">Required</span>
        </div>
        <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="Reason code">
          {codes.map((c) => {
            const on = c === r.code;
            const [id, label] = c.split(" · ");
            return (
              <button
                key={c}
                type="button"
                role="radio"
                aria-checked={on}
                onClick={() => r.setCode(c)}
                className={cn(
                  "flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[12px] transition-colors",
                  on ? "border-ember/50 bg-ember-soft text-fg" : "border-line bg-surface-2 text-fg-2 hover:border-fg-3 hover:text-fg",
                )}
              >
                <span className={cn("font-mono text-[10px]", on ? "text-ember" : "text-fg-3")}>{id}</span>
                {label}
              </button>
            );
          })}
        </div>
      </div>
      <label className="block">
        <span className="mb-1.5 flex items-center justify-between text-[12.5px] font-medium text-fg-2">
          {noteLabel}
          {needNote ? <span className="text-[11px] font-normal text-down">Required</span> : <span className="text-[11px] font-normal text-fg-3">Optional</span>}
        </span>
        <textarea
          value={r.note}
          onChange={(e) => r.setNote(e.target.value)}
          rows={2}
          aria-label={noteLabel}
          placeholder={notePlaceholder}
          className="w-full resize-none rounded-[14px] border border-line bg-surface-2 px-3.5 py-2.5 text-[13px] text-fg outline-none placeholder:text-fg-3 focus:border-ember/50 focus:ring-4 focus:ring-ember/10"
        />
      </label>
    </div>
  );
}

export function AuditNotice({ staff }: { staff?: string }) {
  return (
    <div className="flex items-start gap-2.5 rounded-[14px] border border-line bg-surface-2/60 px-3.5 py-2.5 text-[12px] text-fg-3">
      <ShieldCheck className="mt-0.5 size-3.5 shrink-0 text-up" />
      Written to the immutable dealing audit log{staff ? ` as ${staff}` : ""} with server time (GMT+3), before/after values and the reason code.
    </div>
  );
}

export function ErrorBanner({ error }: { error: string | null }) {
  if (!error) return null;
  return (
    <div role="alert" className="flex items-start gap-2.5 rounded-[14px] border border-down/30 bg-down-soft px-3.5 py-2.5 text-[12.5px] text-fg">
      <AlertTriangle className="mt-0.5 size-3.5 shrink-0 text-down" />
      {error}
    </div>
  );
}

/** Toast for a desk result; returns true when ok. */
export function reportResult<T>(res: DeskResult<T>, success: string | ((d: T) => string), extra?: string) {
  if (!res.ok) {
    toast.error("Rejected", { description: res.error });
    return false;
  }
  const first = res.audit[0];
  const msg = typeof success === "function" ? success(res.data) : success;
  toast.success(msg, { description: [extra, first ? `${res.audit.length > 1 ? `${res.audit.length} audit entries` : first.id} · ${first.reasonCode.split(" · ")[0]}` : null].filter(Boolean).join(" · ") });
  return true;
}

/* ------------------------------------------------------------------ */
/* Dialog with reason + async confirm                                  */
/* ------------------------------------------------------------------ */

export function DeskDialog<T>({
  open,
  onOpenChange,
  title,
  description,
  side,
  width = 560,
  codes,
  defaultCode,
  noteRequiredHint,
  confirmLabel,
  confirmVariant = "ember",
  disabled,
  onConfirm,
  success,
  children,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  title: React.ReactNode;
  description?: React.ReactNode;
  side?: "right";
  width?: number;
  codes?: readonly string[];
  defaultCode?: string;
  noteRequiredHint?: boolean;
  confirmLabel: string;
  confirmVariant?: "ember" | "sell" | "buy" | "gold" | "surface";
  disabled?: boolean | string;
  onConfirm: (reason: Reason) => Promise<DeskResult<T>> | DeskResult<T>;
  success: string | ((d: T) => string);
  children?: React.ReactNode;
}) {
  const r = useReason(defaultCode);
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
          <span className="mr-auto text-[11.5px] text-fg-3">{blocked ?? (r.error && r.code ? r.error : null)}</span>
          <DialogClose asChild>
            <Button variant="ghost" size="sm">
              Cancel
            </Button>
          </DialogClose>
          <Button
            variant={confirmVariant}
            size="sm"
            disabled={!!disabled || !!r.error || busy}
            onClick={async () => {
              setBusy(true);
              setError(null);
              const res = await onConfirm(r.reason);
              setBusy(false);
              if (!res.ok) {
                setError(res.error);
                toast.error("Rejected", { description: res.error });
                return;
              }
              reportResult(res, success);
              onOpenChange(false);
            }}
          >
            {busy ? "Working…" : confirmLabel}
          </Button>
        </>
      }
    >
      <div className="space-y-5">
        {children}
        <ReasonFields r={r} codes={codes} noteRequiredHint={noteRequiredHint} />
        <ErrorBanner error={error} />
        <AuditNotice />
      </div>
    </Dialog>
  );
}

/* ------------------------------------------------------------------ */
/* Small controls                                                      */
/* ------------------------------------------------------------------ */

export function Checkbox({ checked, indeterminate, onChange, label }: { checked: boolean; indeterminate?: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={indeterminate ? "mixed" : checked}
      aria-label={label}
      onClick={(e) => {
        e.stopPropagation();
        onChange(!checked);
      }}
      className={cn(
        "grid size-4 shrink-0 place-items-center rounded-[5px] border transition-colors [&_svg]:size-3",
        checked || indeterminate ? "border-ember bg-ember text-white" : "border-fg-3/60 bg-surface-2 hover:border-fg-2",
      )}
    >
      {indeterminate ? <Minus strokeWidth={3} /> : checked ? <Check strokeWidth={3} /> : null}
    </button>
  );
}

export function BookChip({ book, size = "sm", className }: { book: Book; size?: "sm" | "md"; className?: string }) {
  return (
    <Tooltip content={book === "A" ? "A-book · risk passed to the LP (held on B while no LP is connected)" : "B-book · risk kept in-house"}>
      <span
        className={cn(
          "inline-grid place-items-center rounded-md border font-mono font-semibold",
          size === "sm" ? "h-5 min-w-5 px-1 text-[10.5px]" : "h-6 min-w-6 px-1.5 text-[12px]",
          book === "A" ? "border-info/30 bg-info-soft text-info" : "border-ember/30 bg-ember-soft text-ember",
          className,
        )}
      >
        {book}
      </span>
    </Tooltip>
  );
}

export function Stepper({ value, onChange, step, min = 0, digits = 2, suffix, className, ariaLabel }: { value: string; onChange: (v: string) => void; step: number; min?: number; digits?: number; suffix?: string; className?: string; ariaLabel: string }) {
  const n = Number(value) || 0;
  const set = (v: number) => onChange(Math.max(min, v).toFixed(digits));
  return (
    <div className={cn("flex h-11 items-center rounded-[14px] border border-line bg-surface-2 focus-within:border-ember/50 focus-within:ring-4 focus-within:ring-ember/10", className)}>
      <button type="button" onClick={() => set(n - step)} className="grid h-full w-9 place-items-center text-fg-3 hover:text-fg" aria-label={`Decrease ${ariaLabel}`}>
        −
      </button>
      <input value={value} onChange={(e) => onChange(e.target.value.replace(/[^0-9.]/g, ""))} aria-label={ariaLabel} inputMode="decimal" className="k-num h-full min-w-0 flex-1 bg-transparent text-center font-mono text-[14px] text-fg outline-none" />
      {suffix && <span className="pr-1 text-[11px] text-fg-3">{suffix}</span>}
      <button type="button" onClick={() => set(n + step)} className="grid h-full w-9 place-items-center text-fg-3 hover:text-fg" aria-label={`Increase ${ariaLabel}`}>
        +
      </button>
    </div>
  );
}

/** Parse a user-typed price ("2,654.30" → 2654.3). Empty → undefined. */
export function parseNum(v: string): number | undefined {
  const s = v.replace(/,/g, "").trim();
  if (!s) return undefined;
  const n = Number(s);
  return Number.isFinite(n) ? n : NaN;
}

/* ------------------------------------------------------------------ */
/* Account & symbol pickers                                            */
/* ------------------------------------------------------------------ */

const ACCOUNT_INDEX = ADMIN_ACCOUNTS.map((a) => {
  const c = getClient(a.clientId);
  return { a, c, hay: `${a.login} ${c.name} ${c.id} ${c.email}`.toLowerCase() };
});

export function AccountPicker({ value, onChange }: { value: string | null; onChange: (login: string) => void }) {
  const [q, setQ] = React.useState("");
  const [open, setOpen] = React.useState(false);
  const list = React.useMemo(() => {
    const s = q.trim().toLowerCase();
    return (s ? ACCOUNT_INDEX.filter((x) => x.hay.includes(s)) : ACCOUNT_INDEX).slice(0, 7);
  }, [q]);
  const sel = value ? ACCOUNT_INDEX.find((x) => x.a.login === value) : null;
  return (
    <div className="relative">
      <div className="mb-1.5 text-[12.5px] font-medium text-fg-2">Client / account</div>
      <div className="flex h-11 items-center gap-2 rounded-[14px] border border-line bg-surface-2 px-3.5 focus-within:border-ember/50 focus-within:ring-4 focus-within:ring-ember/10">
        <Search className="size-4 text-fg-3" />
        <input
          value={q}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          onChange={(e) => {
            setQ(e.target.value);
            setOpen(true);
          }}
          placeholder={sel ? `${sel.c.name} · ${sel.a.login}` : "Search name, login or client ID"}
          aria-label="Search client or account"
          className={cn("h-full min-w-0 flex-1 bg-transparent text-[13.5px] outline-none", sel ? "placeholder:text-fg" : "placeholder:text-fg-3")}
        />
      </div>
      {open && list.length > 0 && (
        <div className="absolute inset-x-0 top-full z-20 mt-1 max-h-72 overflow-y-auto rounded-[14px] border border-line bg-surface p-1 shadow-[0_24px_60px_-20px_rgba(0,0,0,0.7)]" role="listbox">
          {list.map(({ a, c }) => (
            <button
              key={a.login}
              type="button"
              role="option"
              aria-selected={a.login === value}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => {
                onChange(a.login);
                setQ("");
                setOpen(false);
              }}
              className="flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-left hover:bg-surface-3"
            >
              <Avatar src={c.photo} name={c.name} size={24} />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[13px]">{c.name}</span>
                <span className="block text-[11px] text-fg-3">
                  {a.group} · 1:{a.leverage} · {a.currency}
                  {a.status !== "active" && <span className="text-down"> · {a.status}</span>}
                </span>
              </span>
              <span className="text-right">
                <span className="block font-mono text-[11.5px] text-fg-2">{a.login}</span>
                <span className="k-num block font-mono text-[10.5px] text-fg-3">{formatMoney(a.currency === "USC" ? a.equity / 100 : a.equity, "USD", 0)}</span>
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

const QUICK = ["XAUUSD", "EURUSD", "GBPUSD", "USDJPY", "NAS100", "US30", "BTCUSD", "ETHUSD", "USOIL"];

export function SymbolPicker({ value, onChange }: { value: string; onChange: (s: string) => void }) {
  const [q, setQ] = React.useState("");
  const [open, setOpen] = React.useState(false);
  const s = q.trim().toUpperCase();
  const list = s ? INSTRUMENTS.filter((i) => i.symbol.includes(s) || i.name.toUpperCase().includes(s)).slice(0, 8) : [];
  return (
    <div className="relative">
      <div className="mb-1.5 text-[12.5px] font-medium text-fg-2">Symbol</div>
      <div className="flex h-11 items-center gap-2 rounded-[14px] border border-line bg-surface-2 px-3 focus-within:border-ember/50 focus-within:ring-4 focus-within:ring-ember/10">
        <SymbolAvatar symbol={value} size={22} />
        <input
          value={q}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          onChange={(e) => {
            setQ(e.target.value);
            setOpen(true);
          }}
          placeholder={`${value} · ${getInstrument(value).name}`}
          aria-label="Search symbol"
          className="h-full min-w-0 flex-1 bg-transparent text-[13.5px] outline-none placeholder:text-fg"
        />
      </div>
      {open && list.length > 0 && (
        <div className="absolute inset-x-0 top-full z-20 mt-1 max-h-72 overflow-y-auto overscroll-contain rounded-[14px] border border-line bg-surface p-1 shadow-[0_24px_60px_-20px_rgba(0,0,0,0.7)]" role="listbox">
          {list.map((i) => (
            <button
              key={i.symbol}
              type="button"
              role="option"
              aria-selected={i.symbol === value}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => {
                onChange(i.symbol);
                setQ("");
                setOpen(false);
              }}
              className="flex w-full items-center gap-2.5 rounded-xl px-2.5 py-1.5 text-left hover:bg-surface-3"
            >
              <SymbolAvatar symbol={i.symbol} size={20} />
              <span className="text-[13px] font-medium">{i.symbol}</span>
              <span className="flex-1 truncate text-[11.5px] text-fg-3">{i.name}</span>
            </button>
          ))}
        </div>
      )}
      <div className="mt-2 flex flex-wrap gap-1">
        {QUICK.map((x) => (
          <button key={x} type="button" onClick={() => onChange(x)} className={cn("rounded-full border px-2 py-0.5 font-mono text-[10.5px]", value === x ? "border-ember/50 bg-ember-soft text-fg" : "border-line bg-surface-2 text-fg-3 hover:text-fg")}>
            {x}
          </button>
        ))}
      </div>
    </div>
  );
}

export function MetaTile({ label, value, tone, className }: { label: React.ReactNode; value: React.ReactNode; tone?: "up" | "down" | "warn"; className?: string }) {
  return (
    <div className={cn("k-row px-3 py-2", className)}>
      <div className="text-[10px] uppercase tracking-wider text-fg-3">{label}</div>
      <div className={cn("k-num mt-0.5 truncate font-mono text-[13px]", tone === "up" && "text-up", tone === "down" && "text-down", tone === "warn" && "text-warn")}>{value}</div>
    </div>
  );
}

export const money = (v: number, d = 2) => `${v < 0 ? "−" : ""}$${formatNumber(Math.abs(v), d)}`;
export const signedMoney = (v: number, d = 2) => `${v > 0 ? "+" : v < 0 ? "−" : ""}$${formatNumber(Math.abs(v), d)}`;
