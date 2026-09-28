"use client";

/**
 * Back-office form & data kit shared by the Config / Finance / Partners /
 * Social / Prop modules. Small, dense controls that sit on top of @kalks/ui.
 */
import * as React from "react";
import { motion } from "motion/react";
import { Check, ChevronDown, ExternalLink, Minus, Plus, X, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { Avatar, Button, Chip, CopyButton, Dialog, Flag, cn, shortHash, type ChipTone } from "@kalks/ui";

/* ------------------------------------------------------------------ */
/* Audit toast                                                          */
/* ------------------------------------------------------------------ */

let auditSeq = 48213;
/** Toast used after every config / money mutation. */
export function auditToast(title: string, description?: string) {
  auditSeq += 1;
  toast.success(title, { description: `${description ? description + " · " : ""}Change logged to audit trail #A-${auditSeq}` });
}

/* ------------------------------------------------------------------ */
/* Drawer sections                                                      */
/* ------------------------------------------------------------------ */

export function Section({ title, hint, children, className, action }: { title: string; hint?: React.ReactNode; children: React.ReactNode; className?: string; action?: React.ReactNode }) {
  return (
    <section className={cn("border-b border-line pb-5 pt-5 first:pt-0 last:border-b-0 last:pb-0", className)}>
      <div className="mb-3 flex items-center justify-between gap-3">
        <div>
          <div className="k-label">{title}</div>
          {hint && <div className="mt-1 text-[12px] text-fg-3">{hint}</div>}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

/** Label + description on the left, control on the right. */
export function SettingRow({ label, hint, children, className }: { label: React.ReactNode; hint?: React.ReactNode; children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("flex items-center justify-between gap-4 py-2.5", className)}>
      <div className="min-w-0">
        <div className="text-[13.5px] font-medium text-fg">{label}</div>
        {hint && <div className="mt-0.5 text-[12px] text-fg-3">{hint}</div>}
      </div>
      <div className="flex shrink-0 items-center gap-2">{children}</div>
    </div>
  );
}

export function MiniField({ label, hint, children, className }: { label: string; hint?: React.ReactNode; children: React.ReactNode; className?: string }) {
  return (
    <div role="group" aria-label={label} className={cn("flex min-w-0 flex-col gap-1.5", className)}>
      <span className="flex items-center justify-between gap-2 text-[12px] font-medium text-fg-2">
        {label}
        {hint && <span className="font-normal text-fg-3">{hint}</span>}
      </span>
      {children}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Inputs                                                               */
/* ------------------------------------------------------------------ */

export function NumInput({
  value,
  onChange,
  suffix,
  prefix,
  step = 1,
  min,
  max,
  className,
  size = "md",
  align = "left",
  stepper,
  decimals,
}: {
  value: number;
  onChange: (v: number) => void;
  suffix?: React.ReactNode;
  prefix?: React.ReactNode;
  step?: number;
  min?: number;
  max?: number;
  className?: string;
  size?: "sm" | "md";
  align?: "left" | "right";
  stepper?: boolean;
  decimals?: number;
}) {
  const [text, setText] = React.useState(String(value));
  React.useEffect(() => setText(decimals !== undefined ? value.toFixed(decimals) : String(value)), [value, decimals]);
  const clamp = (v: number) => Math.min(max ?? Infinity, Math.max(min ?? -Infinity, v));
  const commit = (s: string) => {
    const n = parseFloat(s.replace(/,/g, ""));
    if (Number.isFinite(n)) onChange(clamp(n));
    else setText(String(value));
  };
  return (
    <div
      className={cn(
        "flex items-center gap-1.5 rounded-[12px] border border-line bg-surface-2 transition-colors focus-within:border-ember/50 focus-within:ring-4 focus-within:ring-ember/10",
        size === "sm" ? "h-8 px-2.5 text-[12.5px]" : "h-10 px-3 text-[13.5px]",
        className,
      )}
    >
      {stepper && (
        <button type="button" onClick={() => onChange(clamp(+(value - step).toFixed(6)))} className="grid size-5 shrink-0 place-items-center rounded-full text-fg-3 hover:bg-surface-3 hover:text-fg" aria-label="Decrease">
          <Minus className="size-3" />
        </button>
      )}
      {prefix && <span className="shrink-0 text-fg-3">{prefix}</span>}
      <input
        inputMode="decimal"
        value={text}
        onChange={(e) => setText(e.target.value)}
        onBlur={(e) => commit(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") commit((e.target as HTMLInputElement).value);
          if (e.key === "ArrowUp") {
            e.preventDefault();
            onChange(clamp(+(value + step).toFixed(6)));
          }
          if (e.key === "ArrowDown") {
            e.preventDefault();
            onChange(clamp(+(value - step).toFixed(6)));
          }
        }}
        className={cn("k-num h-full w-full min-w-0 bg-transparent font-medium text-fg outline-none", align === "right" && "text-right")}
      />
      {suffix && <span className="shrink-0 text-[11.5px] text-fg-3">{suffix}</span>}
      {stepper && (
        <button type="button" onClick={() => onChange(clamp(+(value + step).toFixed(6)))} className="grid size-5 shrink-0 place-items-center rounded-full text-fg-3 hover:bg-surface-3 hover:text-fg" aria-label="Increase">
          <Plus className="size-3" />
        </button>
      )}
    </div>
  );
}

export function TextInput({ value, onChange, placeholder, className, mono, size = "md" }: { value: string; onChange: (v: string) => void; placeholder?: string; className?: string; mono?: boolean; size?: "sm" | "md" }) {
  return (
    <input
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className={cn(
        "w-full rounded-[12px] border border-line bg-surface-2 text-fg outline-none transition-colors placeholder:text-fg-3 focus:border-ember/50 focus:ring-4 focus:ring-ember/10",
        size === "sm" ? "h-8 px-2.5 text-[12.5px]" : "h-10 px-3 text-[13.5px]",
        mono && "font-mono",
        className,
      )}
    />
  );
}

export function TextArea({ value, onChange, placeholder, rows = 3, className }: { value: string; onChange: (v: string) => void; placeholder?: string; rows?: number; className?: string }) {
  return (
    <textarea
      value={value}
      rows={rows}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className={cn("w-full resize-none rounded-[12px] border border-line bg-surface-2 px-3 py-2.5 text-[13.5px] text-fg outline-none transition-colors placeholder:text-fg-3 focus:border-ember/50 focus:ring-4 focus:ring-ember/10", className)}
    />
  );
}

export function Select<T extends string>({
  value,
  onChange,
  options,
  className,
  size = "md",
}: {
  value: T;
  onChange: (v: T) => void;
  options: readonly (T | { value: T; label: string })[];
  className?: string;
  size?: "sm" | "md";
}) {
  return (
    <div className={cn("relative", className)}>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value as T)}
        className={cn(
          "w-full cursor-pointer appearance-none rounded-[12px] border border-line bg-surface-2 pr-8 text-fg outline-none transition-colors focus:border-ember/50 focus:ring-4 focus:ring-ember/10",
          size === "sm" ? "h-8 pl-2.5 text-[12.5px]" : "h-10 pl-3 text-[13.5px]",
        )}
      >
        {options.map((o) => {
          const v = typeof o === "string" ? o : o.value;
          const l = typeof o === "string" ? o : o.label;
          return (
            <option key={v} value={v} className="bg-surface text-fg">
              {l}
            </option>
          );
        })}
      </select>
      <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 size-3.5 -translate-y-1/2 text-fg-3" />
    </div>
  );
}

/** Ember range slider with value bubble. */
export function Slider({ value, onChange, min = 0, max = 100, step = 1, suffix = "%", className, marks }: { value: number; onChange: (v: number) => void; min?: number; max?: number; step?: number; suffix?: string; className?: string; marks?: number[] }) {
  const pct = ((value - min) / (max - min)) * 100;
  return (
    <div className={cn("w-full", className)}>
      <div className="relative h-6">
        <div className="absolute inset-x-0 top-1/2 h-1.5 -translate-y-1/2 rounded-full bg-surface-3" />
        <div className="absolute left-0 top-1/2 h-1.5 -translate-y-1/2 rounded-full bg-gradient-to-r from-[#ff8a3d] to-ember" style={{ width: `${pct}%` }} />
        <div className="pointer-events-none absolute top-1/2 size-[18px] -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-ember bg-white shadow-[0_0_16px_-2px_rgba(255,90,31,0.8)]" style={{ left: `${pct}%` }} />
        <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(+e.target.value)} className="absolute inset-0 w-full cursor-pointer opacity-0" aria-label="Slider" />
      </div>
      {marks && (
        <div className="mt-1 flex justify-between text-[10.5px] text-fg-3">
          {marks.map((m) => (
            <button key={m} type="button" onClick={() => onChange(m)} className={cn("k-num hover:text-fg", m === value && "text-ember")}>
              {m}
              {suffix}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/** Editable chip list (leverage options, banned strategies, tags). */
export function ChipList<T extends string | number>({
  values,
  onChange,
  options,
  format = (v) => String(v),
  placeholder = "Add…",
  tone = "ember",
  allowCustom = true,
}: {
  values: T[];
  onChange: (v: T[]) => void;
  options?: T[];
  format?: (v: T) => string;
  placeholder?: string;
  tone?: ChipTone;
  allowCustom?: boolean;
}) {
  const [text, setText] = React.useState("");
  const toneCls: Record<string, string> = {
    ember: "border-ember/30 bg-ember-soft text-ember",
    gold: "border-gold/30 bg-gold-soft text-gold",
    down: "border-down/25 bg-down-soft text-down",
    neutral: "border-line bg-surface-3 text-fg-2",
    up: "border-up/25 bg-up-soft text-up",
    info: "border-info/25 bg-info-soft text-info",
    warn: "border-warn/25 bg-warn-soft text-warn",
    solid: "border-transparent bg-fg text-bg",
  };
  if (options) {
    return (
      <div className="flex flex-wrap gap-1.5">
        {options.map((o) => {
          const on = values.includes(o);
          return (
            <button
              key={String(o)}
              type="button"
              onClick={() => onChange(on ? values.filter((v) => v !== o) : [...values, o].sort((a, b) => (typeof a === "number" && typeof b === "number" ? a - b : 0)))}
              className={cn("k-num inline-flex h-7 items-center gap-1 rounded-full border px-2.5 text-[12px] font-medium transition-colors", on ? toneCls[tone] : "border-line bg-surface-2 text-fg-3 hover:text-fg-2")}
            >
              {on && <Check className="size-3" />}
              {format(o)}
            </button>
          );
        })}
      </div>
    );
  }
  return (
    <div className="flex min-h-10 flex-wrap items-center gap-1.5 rounded-[12px] border border-line bg-surface-2 p-1.5">
      {values.map((v) => (
        <span key={String(v)} className={cn("inline-flex h-7 items-center gap-1 rounded-full border pl-2.5 pr-1 text-[12px] font-medium", toneCls[tone])}>
          {format(v)}
          <button type="button" onClick={() => onChange(values.filter((x) => x !== v))} className="grid size-5 place-items-center rounded-full hover:bg-black/20" aria-label={`Remove ${format(v)}`}>
            <X className="size-3" />
          </button>
        </span>
      ))}
      {allowCustom && (
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && text.trim()) {
              e.preventDefault();
              const v = (typeof values[0] === "number" ? Number(text) : text.trim()) as T;
              if (!values.includes(v)) onChange([...values, v]);
              setText("");
            }
          }}
          placeholder={placeholder}
          className="h-7 min-w-24 flex-1 bg-transparent px-1.5 text-[12.5px] outline-none placeholder:text-fg-3"
        />
      )}
    </div>
  );
}

export function Checkbox({ checked, onChange, indeterminate, label }: { checked: boolean; onChange: (v: boolean) => void; indeterminate?: boolean; label?: string }) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={indeterminate ? "mixed" : checked}
      aria-label={label ?? "Select"}
      onClick={(e) => {
        e.stopPropagation();
        onChange(!checked);
      }}
      className={cn(
        "grid size-[18px] shrink-0 place-items-center rounded-[6px] border transition-colors",
        checked || indeterminate ? "border-ember bg-ember text-white" : "border-fg-3/50 bg-surface-2 hover:border-fg-2",
      )}
    >
      {indeterminate ? <Minus className="size-3" strokeWidth={3} /> : checked ? <Check className="size-3" strokeWidth={3} /> : null}
    </button>
  );
}

/* ------------------------------------------------------------------ */
/* Reason dialog — every sensitive action needs a reason code           */
/* ------------------------------------------------------------------ */

export function ReasonDialog({
  open,
  onOpenChange,
  title,
  description,
  reasons,
  confirmLabel = "Confirm",
  tone = "ember",
  onConfirm,
  children,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  title: React.ReactNode;
  description?: React.ReactNode;
  reasons: string[];
  confirmLabel?: string;
  tone?: "ember" | "sell" | "buy";
  onConfirm: (reason: string, note: string) => void;
  children?: React.ReactNode;
}) {
  const [reason, setReason] = React.useState(reasons[0] ?? "");
  const [note, setNote] = React.useState("");
  React.useEffect(() => {
    if (open) {
      setReason(reasons[0] ?? "");
      setNote("");
    }
  }, [open, reasons]);
  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={title}
      description={description}
      width={480}
      footer={
        <>
          <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            variant={tone}
            size="sm"
            onClick={() => {
              onConfirm(reason, note);
              onOpenChange(false);
            }}
          >
            {confirmLabel}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {children}
        <MiniField label="Reason code">
          <Select value={reason} onChange={setReason} options={reasons} />
        </MiniField>
        <MiniField label="Internal note" hint="Visible to staff only">
          <TextArea value={note} onChange={setNote} placeholder="Add context for the audit log…" />
        </MiniField>
        <div className="flex items-center gap-2 rounded-[12px] border border-line bg-surface-2 px-3 py-2.5 text-[12px] text-fg-3">
          <ShieldCheck className="size-4 text-ember" />
          This action is recorded in the admin audit log with your staff ID, IP and timestamp.
        </div>
      </div>
    </Dialog>
  );
}

/** Convenience hook: const confirm = useReason(); confirm.ask({...}); <confirm.Dialog/> */
export function useReason() {
  const [state, setState] = React.useState<null | { title: React.ReactNode; description?: React.ReactNode; reasons: string[]; confirmLabel?: string; tone?: "ember" | "sell" | "buy"; onConfirm: (r: string, n: string) => void; body?: React.ReactNode }>(null);
  const [open, setOpen] = React.useState(false);
  const ask = React.useCallback((s: NonNullable<typeof state>) => {
    setState(s);
    setOpen(true);
  }, []);
  const node = state ? (
    <ReasonDialog open={open} onOpenChange={setOpen} title={state.title} description={state.description} reasons={state.reasons} confirmLabel={state.confirmLabel} tone={state.tone} onConfirm={state.onConfirm}>
      {state.body}
    </ReasonDialog>
  ) : null;
  return { ask, node };
}

/* ------------------------------------------------------------------ */
/* Cells                                                                */
/* ------------------------------------------------------------------ */

export function PersonCell({ name, photo, sub, country, size = 30, verified }: { name: string; photo?: string; sub?: React.ReactNode; country?: string; size?: number; verified?: boolean }) {
  return (
    <span className="flex min-w-0 items-center gap-2.5">
      <Avatar src={photo} name={name} size={size} verified={verified} />
      <span className="min-w-0">
        <span className="flex items-center gap-1.5 truncate text-[13.5px] font-medium text-fg">
          {name}
          {country && <Flag country={country} className="size-3.5" />}
        </span>
        {sub && <span className="block truncate text-[11.5px] text-fg-3">{sub}</span>}
      </span>
    </span>
  );
}

export function TxHash({ hash, chain = "tron", head = 6, tail = 4, className }: { hash: string; chain?: "tron" | "eth" | "btc"; head?: number; tail?: number; className?: string }) {
  const url = chain === "tron" ? `https://tronscan.org/#/transaction/${hash}` : chain === "eth" ? `https://etherscan.io/tx/${hash}` : `https://mempool.space/tx/${hash}`;
  return (
    <span className={cn("inline-flex items-center gap-1", className)}>
      <a href={url} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()} className="inline-flex items-center gap-1 font-mono text-[12px] text-fg-2 hover:text-ember">
        {shortHash(hash, head, tail)}
        <ExternalLink className="size-3 opacity-60" />
      </a>
      <CopyButton value={hash} label="Tx hash" />
    </span>
  );
}

export function Addr({ value, head = 5, tail = 4, copy = true, className }: { value: string; head?: number; tail?: number; copy?: boolean; className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-1 font-mono text-[12px] text-fg-2", className)}>
      {shortHash(value, head, tail)}
      {copy && <CopyButton value={value} label="Address" />}
    </span>
  );
}

/** k-row mini stat block used in drawers and card bodies. */
export function MiniStat({ label, value, sub, className, tone }: { label: React.ReactNode; value: React.ReactNode; sub?: React.ReactNode; className?: string; tone?: "up" | "down" | "warn" | "gold" | "ember" }) {
  const t = tone ? { up: "text-up", down: "text-down", warn: "text-warn", gold: "text-gold", ember: "text-ember" }[tone] : "text-fg";
  return (
    <div className={cn("k-row min-w-0 px-4 py-3", className)}>
      <div className="truncate text-[11px] uppercase tracking-wider text-fg-3">{label}</div>
      <div className={cn("k-num mt-1 truncate text-[15px] font-medium", t)}>{value}</div>
      {sub && <div className="mt-0.5 truncate text-[11.5px] text-fg-3">{sub}</div>}
    </div>
  );
}

/** Thin segmented progress used for rule status / confirmations. */
export function SegBar({ value, total, tone = "ember", className }: { value: number; total: number; tone?: "ember" | "up" | "warn" | "down" | "gold"; className?: string }) {
  const bg = { ember: "bg-ember", up: "bg-up", warn: "bg-warn", down: "bg-down", gold: "bg-gold" }[tone];
  return (
    <div className={cn("flex h-1.5 gap-[2px]", className)}>
      {Array.from({ length: total }).map((_, i) => (
        <span key={i} className={cn("flex-1 rounded-full", i < value ? bg : "bg-surface-3")} />
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Charts                                                               */
/* ------------------------------------------------------------------ */

export interface BarDatum {
  label: string;
  values: number[]; // one per series (stacked)
}

/**
 * Stacked / grouped SVG column chart over the dotted grid, with a hover
 * tooltip. Series colours come from tokens.
 */
export function ColumnChart({
  data,
  series,
  height = 240,
  format = (v) => v.toLocaleString("en-US", { maximumFractionDigits: 0 }),
  mode = "stack",
  className,
  labelEvery = 1,
}: {
  data: BarDatum[];
  series: { label: string; tone: "ember" | "gold" | "up" | "down" | "info" | "warn" | "fg3" }[];
  height?: number;
  format?: (v: number) => string;
  mode?: "stack" | "group";
  className?: string;
  labelEvery?: number;
}) {
  const [hover, setHover] = React.useState<number | null>(null);
  const colors: Record<string, string> = { ember: "var(--k-ember)", gold: "var(--k-gold)", up: "var(--k-up)", down: "var(--k-down)", info: "var(--k-info)", warn: "var(--k-warn)", fg3: "var(--k-fg-3)" };
  const max = Math.max(1, ...data.map((d) => (mode === "stack" ? d.values.reduce((a, b) => a + b, 0) : Math.max(...d.values))));
  const nice = niceMax(max);
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((t) => t * nice);
  return (
    <div className={cn("relative", className)}>
      <div className="flex items-center gap-4 pb-3 text-[11.5px] text-fg-3">
        {series.map((s) => (
          <span key={s.label} className="inline-flex items-center gap-1.5">
            <span className="size-2 rounded-full" style={{ background: colors[s.tone] }} />
            {s.label}
          </span>
        ))}
      </div>
      <div className="relative flex" style={{ height }}>
        <div className="flex w-12 shrink-0 flex-col-reverse justify-between pb-5 pr-2 text-right font-mono text-[10px] text-fg-3">
          {ticks.map((t) => (
            <span key={t}>{format(t)}</span>
          ))}
        </div>
        <div className="relative flex-1">
          <div className="k-dotgrid absolute inset-0 bottom-5 rounded-lg opacity-60" />
          <div className="absolute inset-0 bottom-5 flex items-end gap-[3px] px-1">
            {data.map((d, i) => {
              const total = d.values.reduce((a, b) => a + b, 0);
              return (
                <div key={i} className="relative flex h-full flex-1 items-end justify-center" onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)}>
                  {hover === i && <div className="absolute inset-y-0 left-1/2 w-px -translate-x-1/2 border-l border-dashed border-fg-3/50" />}
                  {mode === "stack" ? (
                    <motion.div className="relative flex w-full max-w-7 flex-col-reverse overflow-hidden rounded-t-[5px]" initial={{ height: 0 }} animate={{ height: `${(total / nice) * 100}%` }} transition={{ duration: 0.7, delay: i * 0.012, ease: [0.16, 1, 0.3, 1] }}>
                      {d.values.map((v, si) => (
                        <div key={si} style={{ height: `${total ? (v / total) * 100 : 0}%`, background: colors[series[si]!.tone], opacity: hover === null || hover === i ? 1 : 0.45 }} className="w-full transition-opacity" />
                      ))}
                    </motion.div>
                  ) : (
                    <div className="flex h-full w-full max-w-9 items-end justify-center gap-[2px]">
                      {d.values.map((v, si) => (
                        <motion.div key={si} className="w-full rounded-t-[4px] transition-opacity" style={{ background: colors[series[si]!.tone], opacity: hover === null || hover === i ? 1 : 0.45 }} initial={{ height: 0 }} animate={{ height: `${(v / nice) * 100}%` }} transition={{ duration: 0.7, delay: i * 0.012, ease: [0.16, 1, 0.3, 1] }} />
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          <div className="absolute inset-x-0 bottom-0 flex h-5 items-end gap-[3px] px-1">
            {data.map((d, i) => (
              <span key={i} className="flex-1 truncate text-center font-mono text-[10px] text-fg-3">
                {i % labelEvery === 0 ? d.label : ""}
              </span>
            ))}
          </div>
          {hover !== null && data[hover] && (
            <div className="pointer-events-none absolute top-0 z-10 min-w-40 rounded-xl border border-line bg-surface-3/95 px-3 py-2 text-[12px] shadow-xl backdrop-blur" style={{ left: `clamp(0px, calc(${((hover + 0.5) / data.length) * 100}% - 80px), calc(100% - 160px))` }}>
              <div className="mb-1 font-medium text-fg">{data[hover]!.label}</div>
              {series.map((s, si) => (
                <div key={s.label} className="flex items-center justify-between gap-4 text-fg-2">
                  <span className="inline-flex items-center gap-1.5">
                    <span className="size-1.5 rounded-full" style={{ background: colors[s.tone] }} />
                    {s.label}
                  </span>
                  <span className="k-num font-medium text-fg">{format(data[hover]!.values[si] ?? 0)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function niceMax(v: number) {
  const p = Math.pow(10, Math.floor(Math.log10(v)));
  const n = v / p;
  const m = n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10;
  return m * p;
}

/** Horizontal funnel steps (Phase 1 → Phase 2 → Funded → Payout). */
export function FunnelBars({ steps, className }: { steps: { label: string; value: number; sub?: string }[]; className?: string }) {
  const max = Math.max(...steps.map((s) => s.value), 1);
  return (
    <div className={cn("space-y-2.5", className)}>
      {steps.map((s, i) => {
        const prev = i > 0 ? steps[i - 1]!.value : null;
        return (
          <div key={s.label} className="flex items-center gap-3">
            <div className="w-24 shrink-0 text-[12.5px] text-fg-2 sm:w-28">{s.label}</div>
            <div className="relative h-9 flex-1 overflow-hidden rounded-[10px] bg-surface-2">
              <motion.div
                className="absolute inset-y-0 left-0 rounded-[10px] bg-gradient-to-r from-[#b8330f] via-ember to-[#ff8a3d]"
                style={{ opacity: 1 - i * 0.16 }}
                initial={{ width: 0 }}
                animate={{ width: `${(s.value / max) * 100}%` }}
                transition={{ duration: 0.9, delay: i * 0.08, ease: [0.16, 1, 0.3, 1] }}
              />
              <div className="relative flex h-full items-center justify-between px-3 text-[12.5px]">
                <span className="k-num font-semibold text-white">{s.value.toLocaleString()}</span>
                {s.sub && <span className="text-[11px] text-white/80">{s.sub}</span>}
              </div>
            </div>
            <div className="k-num w-14 shrink-0 text-right text-[12px] text-fg-3">{prev ? `${((s.value / prev) * 100).toFixed(1)}%` : "100%"}</div>
          </div>
        );
      })}
    </div>
  );
}

/** Tone helper for a 0–100 risk score. */
export function riskTone(score: number): ChipTone {
  return score >= 70 ? "down" : score >= 40 ? "warn" : "up";
}

export function RiskScore({ score }: { score: number }) {
  const tone = riskTone(score);
  const bg = tone === "down" ? "bg-down" : tone === "warn" ? "bg-warn" : "bg-up";
  return (
    <span className="inline-flex items-center gap-2">
      <span className="relative h-1.5 w-12 overflow-hidden rounded-full bg-surface-3">
        <span className={cn("absolute inset-y-0 left-0 rounded-full", bg)} style={{ width: `${score}%` }} />
      </span>
      <Chip size="sm" tone={tone}>
        {score}
      </Chip>
    </span>
  );
}
