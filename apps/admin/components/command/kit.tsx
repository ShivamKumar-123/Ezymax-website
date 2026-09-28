"use client";

import * as React from "react";
import Link from "next/link";
import { motion } from "motion/react";
import { toast } from "sonner";
import { ShieldCheck, Timer } from "lucide-react";
import { Avatar, Button, Chip, Dialog, DialogClose, Flag, cn, formatMoney, type ChipTone } from "@kalks/ui";
import { KYC_LABEL, type AdminClient, type KycStatus } from "@kalks/mock/admin-clients";

/* ------------------------------------------------------------------ */
/* Reason-code dialog — every admin action is audited                  */
/* ------------------------------------------------------------------ */

export function ReasonDialog({
  open,
  onOpenChange,
  trigger,
  title,
  description,
  codes,
  confirmLabel = "Confirm",
  confirmVariant = "ember",
  children,
  onConfirm,
  successMessage,
  width = 540,
}: {
  open?: boolean;
  onOpenChange?: (o: boolean) => void;
  trigger?: React.ReactNode;
  title: React.ReactNode;
  description?: React.ReactNode;
  codes: readonly string[];
  confirmLabel?: string;
  confirmVariant?: "ember" | "sell" | "buy" | "gold";
  children?: React.ReactNode;
  onConfirm?: (code: string, note: string) => void;
  successMessage?: string | ((code: string) => string);
  width?: number;
}) {
  const [inner, setInner] = React.useState(false);
  const isOpen = open ?? inner;
  const setOpen = onOpenChange ?? setInner;
  const [code, setCode] = React.useState<string | null>(null);
  const [note, setNote] = React.useState("");
  React.useEffect(() => {
    if (!isOpen) {
      setCode(null);
      setNote("");
    }
  }, [isOpen]);

  return (
    <Dialog
      open={isOpen}
      onOpenChange={setOpen}
      trigger={trigger}
      title={title}
      description={description}
      width={width}
      footer={
        <>
          <DialogClose asChild>
            <Button variant="ghost" size="sm">
              Cancel
            </Button>
          </DialogClose>
          <Button
            variant={confirmVariant}
            size="sm"
            disabled={!code}
            onClick={() => {
              if (!code) return;
              onConfirm?.(code, note);
              const msg = typeof successMessage === "function" ? successMessage(code) : successMessage ?? "Action recorded";
              toast.success(msg, { description: `Reason ${code.split(" · ")[0]} · logged to audit trail` });
              setOpen(false);
            }}
          >
            {confirmLabel}
          </Button>
        </>
      }
    >
      <div className="space-y-5">
        {children}
        <div>
          <div className="mb-2 flex items-center justify-between text-[12.5px] font-medium text-fg-2">
            Reason code <span className="text-[11px] font-normal text-down">Required</span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {codes.map((c) => {
              const on = c === code;
              const [id, label] = c.split(" · ");
              return (
                <button
                  key={c}
                  type="button"
                  onClick={() => setCode(c)}
                  className={cn(
                    "flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[12.5px] transition-colors",
                    on ? "border-ember/50 bg-ember-soft text-fg" : "border-line bg-surface-2 text-fg-2 hover:border-fg-3 hover:text-fg",
                  )}
                >
                  <span className={cn("font-mono text-[10.5px]", on ? "text-ember" : "text-fg-3")}>{id}</span>
                  {label}
                </button>
              );
            })}
          </div>
        </div>
        <label className="block">
          <span className="mb-1.5 block text-[12.5px] font-medium text-fg-2">Comment</span>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={3}
            placeholder="Context for the audit log and the next reviewer…"
            className="w-full resize-none rounded-[14px] border border-line bg-surface-2 px-3.5 py-2.5 text-sm text-fg outline-none placeholder:text-fg-3 focus:border-ember/50 focus:ring-4 focus:ring-ember/10"
          />
        </label>
        <div className="flex items-start gap-2.5 rounded-[14px] border border-line bg-surface-2/60 px-3.5 py-2.5 text-[12px] text-fg-3">
          <ShieldCheck className="mt-0.5 size-3.5 shrink-0 text-up" />
          Recorded in the immutable audit log with your staff ID, IP 103.21.44.12 and server time (GMT+3).
        </div>
      </div>
    </Dialog>
  );
}

/* ------------------------------------------------------------------ */
/* Scores & statuses                                                   */
/* ------------------------------------------------------------------ */

export function riskTone(score: number): ChipTone {
  return score >= 8 ? "down" : score >= 6 ? "warn" : score >= 4 ? "gold" : "up";
}

/** Risk score 1–10 as a compact chip with a 10-segment meter. */
export function RiskScore({ score, meter = false, className }: { score: number; meter?: boolean; className?: string }) {
  const tone = riskTone(score);
  const color = { down: "bg-down", warn: "bg-warn", gold: "bg-gold", up: "bg-up" }[tone as "down" | "warn" | "gold" | "up"];
  return (
    <span className={cn("inline-flex items-center gap-2", className)}>
      <Chip tone={tone} size="sm" className="min-w-9 justify-center font-mono">
        {Number.isInteger(score) ? score : score.toFixed(1)}
      </Chip>
      {meter && (
        <span className="flex gap-[2px]">
          {Array.from({ length: 10 }, (_, i) => (
            <span key={i} className={cn("h-2.5 w-[3px] rounded-full", i < Math.round(score) ? color : "bg-surface-3")} />
          ))}
        </span>
      )}
    </span>
  );
}

const KYC_TONE: Record<KycStatus, ChipTone> = { verified: "up", pending: "warn", review: "info", rejected: "down", none: "neutral" };

export function KycChip({ status, size = "md" }: { status: KycStatus; size?: "sm" | "md" }) {
  return (
    <Chip tone={KYC_TONE[status]} dot size={size}>
      {KYC_LABEL[status]}
    </Chip>
  );
}

export const SEVERITY_TONE = { critical: "down", high: "ember", medium: "warn", low: "info" } as const;
export const SEVERITY_BAR = { critical: "bg-down", high: "bg-ember", medium: "bg-warn", low: "bg-info" } as const;

export function SeverityChip({ severity }: { severity: keyof typeof SEVERITY_TONE }) {
  return (
    <Chip tone={SEVERITY_TONE[severity]} size="sm" className="uppercase tracking-wide">
      {severity}
    </Chip>
  );
}

/* ------------------------------------------------------------------ */
/* Client cell                                                         */
/* ------------------------------------------------------------------ */

export function ClientCell({
  client,
  sub,
  size = 32,
  href = true,
  className,
}: {
  client: Pick<AdminClient, "id" | "name" | "photo" | "country"> & { kyc?: KycStatus };
  sub?: React.ReactNode;
  size?: number;
  href?: boolean;
  className?: string;
}) {
  const body = (
    <span className={cn("flex min-w-0 items-center gap-2.5", className)}>
      <Avatar src={client.photo} name={client.name} size={size} verified={client.kyc === "verified"} />
      <span className="min-w-0">
        <span className="flex items-center gap-1.5">
          <span className="truncate text-[13.5px] font-medium text-fg group-hover/cc:text-ember">{client.name}</span>
          <Flag country={client.country} className="size-3.5" />
        </span>
        <span className="block truncate text-[11.5px] text-fg-3">{sub ?? <span className="font-mono">#{client.id}</span>}</span>
      </span>
    </span>
  );
  if (!href) return body;
  return (
    <Link href={`/clients/${client.id}`} onClick={(e) => e.stopPropagation()} className="group/cc min-w-0">
      {body}
    </Link>
  );
}

/* ------------------------------------------------------------------ */
/* SLA timer — ticks down live                                         */
/* ------------------------------------------------------------------ */

export function useTick(ms = 1000) {
  const [n, setN] = React.useState(0);
  React.useEffect(() => {
    const t = setInterval(() => setN((x) => x + 1), ms);
    return () => clearInterval(t);
  }, [ms]);
  return n;
}

export function SlaTimer({ mins, total, compact }: { mins: number; total?: number; compact?: boolean }) {
  const [start] = React.useState(() => Date.now());
  useTick(1000);
  const left = mins * 60 - Math.floor((Date.now() - start) / 1000);
  const breached = left < 0;
  const a = Math.abs(left);
  const h = Math.floor(a / 3600);
  const m = Math.floor((a % 3600) / 60);
  const s = a % 60;
  const text = `${breached ? "-" : ""}${h ? `${h}:` : ""}${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  const tone = breached ? "text-down border-down/30 bg-down-soft" : left < 30 * 60 ? "text-warn border-warn/30 bg-warn-soft" : "text-fg-2 border-line bg-surface-2";
  return (
    <span className="inline-flex flex-col items-end gap-1">
      <span className={cn("inline-flex items-center gap-1 rounded-full border px-2 py-0.5 font-mono text-[11.5px] k-num", tone)}>
        <Timer className="size-3" />
        {text}
      </span>
      {!compact && total && (
        <span className="h-1 w-16 overflow-hidden rounded-full bg-surface-3">
          <span className={cn("block h-full rounded-full", breached ? "bg-down" : left < 1800 ? "bg-warn" : "bg-up")} style={{ width: `${breached ? 100 : Math.max(4, (1 - left / 60 / total) * 100)}%` }} />
        </span>
      )}
    </span>
  );
}

/* ------------------------------------------------------------------ */
/* Server clock string                                                 */
/* ------------------------------------------------------------------ */

export function useServerClock() {
  const [now, setNow] = React.useState<{ date: string; time: string } | null>(null);
  React.useEffect(() => {
    const f = () => {
      const d = new Date(Date.now() + 3 * 3600_000);
      const date = new Intl.DateTimeFormat("en-GB", { weekday: "long", day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }).format(d);
      const time = `${String(d.getUTCHours()).padStart(2, "0")}:${String(d.getUTCMinutes()).padStart(2, "0")}:${String(d.getUTCSeconds()).padStart(2, "0")}`;
      setNow({ date, time });
    };
    f();
    const t = setInterval(f, 1000);
    return () => clearInterval(t);
  }, []);
  return now;
}

/* ------------------------------------------------------------------ */
/* Signed money text (compact tables)                                  */
/* ------------------------------------------------------------------ */

export function PnlText({ value, className, compact }: { value: number; className?: string; compact?: boolean }) {
  const txt = compact && Math.abs(value) >= 10000 ? `$${(Math.abs(value) / 1000).toFixed(1)}k` : formatMoney(Math.abs(value)).replace("-", "");
  return (
    <span className={cn("k-num font-medium", value > 0 ? "text-up" : value < 0 ? "text-down" : "text-fg-2", className)}>
      {value > 0 ? "+" : value < 0 ? "-" : ""}
      {txt}
    </span>
  );
}

export function usdCompact(v: number, digits = 2) {
  const a = Math.abs(v);
  const s = a >= 1e9 ? `${(a / 1e9).toFixed(digits)}B` : a >= 1e6 ? `${(a / 1e6).toFixed(digits)}M` : a >= 1e3 ? `${(a / 1e3).toFixed(1)}k` : a.toFixed(0);
  return `${v < 0 ? "-" : ""}$${s}`;
}

/* ------------------------------------------------------------------ */
/* Intraday chart — gold line over a dotted grid, hatched volume bars  */
/* ------------------------------------------------------------------ */

export interface IntradaySeriesPoint {
  t: number;
  v: number;
  vol?: number;
}

export function IntradayChart({
  data,
  height = 280,
  format = (v: number) => formatMoney(v),
  tone = "gold",
  timeLabel = (t: number) => {
    const d = new Date(t + 3 * 3600_000);
    return `${String(d.getUTCHours()).padStart(2, "0")}:${String(d.getUTCMinutes()).padStart(2, "0")}`;
  },
  xTicks = 7,
  onHover,
  zeroLine = true,
  className,
}: {
  data: IntradaySeriesPoint[];
  height?: number;
  format?: (v: number) => string;
  tone?: "gold" | "ember" | "up" | "down" | "info";
  timeLabel?: (t: number) => string;
  xTicks?: number;
  onHover?: (p: IntradaySeriesPoint | null) => void;
  zeroLine?: boolean;
  className?: string;
}) {
  const id = React.useId().replace(/:/g, "");
  const ref = React.useRef<HTMLDivElement>(null);
  const [w, setW] = React.useState(800);
  const [hover, setHover] = React.useState<number | null>(null);
  React.useEffect(() => {
    if (!ref.current) return;
    const ro = new ResizeObserver(([e]) => setW(Math.max(280, e!.contentRect.width)));
    ro.observe(ref.current);
    return () => ro.disconnect();
  }, []);

  const padR = 64;
  const padB = 22;
  const volH = data.some((d) => d.vol) ? height * 0.16 : 0;
  const plotW = w - padR;
  const plotH = height - padB - volH - 8;
  const vals = data.map((d) => d.v);
  let min = Math.min(...vals, zeroLine ? 0 : Infinity);
  let max = Math.max(...vals, zeroLine ? 0 : -Infinity);
  const pad = (max - min) * 0.12 || 1;
  min -= pad;
  max += pad;
  const x = (i: number) => (i / Math.max(1, data.length - 1)) * plotW;
  const y = (v: number) => 8 + (1 - (v - min) / (max - min)) * plotH;
  const line = data.map((d, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(d.v).toFixed(1)}`).join(" ");
  const base = zeroLine ? y(0) : 8 + plotH;
  const area = `${line} L${x(data.length - 1).toFixed(1)},${base.toFixed(1)} L0,${base.toFixed(1)} Z`;
  const volMax = Math.max(...data.map((d) => d.vol ?? 0), 1);
  const color = `var(--k-${tone})`;

  // "nice" y ticks
  const step = niceStep((max - min) / 4);
  const yTicks: number[] = [];
  for (let v = Math.ceil(min / step) * step; v <= max; v += step) yTicks.push(v);

  const hp = hover !== null ? data[hover] : null;
  const barW = Math.max(1, plotW / data.length - 1.2);

  return (
    <div ref={ref} className={cn("relative select-none", className)} style={{ height }}>
      <div className="k-dotgrid absolute inset-0 rounded-xl opacity-60" style={{ right: padR }} />
      <svg
        width={w}
        height={height}
        className="absolute inset-0 overflow-visible"
        onMouseMove={(e) => {
          const r = (e.currentTarget as SVGSVGElement).getBoundingClientRect();
          const i = Math.round(((e.clientX - r.left) / plotW) * (data.length - 1));
          const k = Math.max(0, Math.min(data.length - 1, i));
          setHover(k);
          onHover?.(data[k] ?? null);
        }}
        onMouseLeave={() => {
          setHover(null);
          onHover?.(null);
        }}
      >
        <defs>
          <linearGradient id={`a${id}`} x1="0" x2="0" y1="0" y2="1">
            <stop offset="0" stopColor={color} stopOpacity="0.28" />
            <stop offset="1" stopColor={color} stopOpacity="0" />
          </linearGradient>
          <pattern id={`h${id}`} width="4" height="4" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
            <rect width="4" height="4" fill="var(--k-fg-3)" opacity="0.18" />
            <line x1="0" y1="0" x2="0" y2="4" stroke="var(--k-fg-2)" strokeWidth="1.4" opacity="0.5" />
          </pattern>
        </defs>

        {yTicks.map((v) => (
          <g key={v}>
            <line x1={0} x2={plotW} y1={y(v)} y2={y(v)} stroke="var(--k-border)" strokeDasharray="2 4" />
            <text x={plotW + 8} y={y(v) + 3.5} className="fill-fg-3 font-mono text-[10.5px]">
              {compactAxis(v)}
            </text>
          </g>
        ))}
        {zeroLine && min < 0 && max > 0 && <line x1={0} x2={plotW} y1={y(0)} y2={y(0)} stroke="var(--k-fg-3)" strokeOpacity={0.6} strokeDasharray="4 3" />}

        {volH > 0 &&
          data.map((d, i) => {
            const h = ((d.vol ?? 0) / volMax) * volH;
            return <rect key={i} x={x(i) - barW / 2} y={height - padB - h} width={barW} height={h} rx={0.8} fill={hover === i ? color : `url(#h${id})`} />;
          })}

        <motion.path d={area} fill={`url(#a${id})`} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.8, delay: 0.3 }} />
        <motion.path
          d={line}
          fill="none"
          stroke={color}
          strokeWidth={2}
          strokeLinejoin="round"
          strokeLinecap="round"
          style={{ filter: `drop-shadow(0 0 6px color-mix(in oklab, ${color} 45%, transparent))` }}
          initial={{ pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={{ duration: 1.2, ease: [0.16, 1, 0.3, 1] }}
        />

        {/* last value marker */}
        {data.length > 0 && hover === null && (
          <g>
            <circle cx={x(data.length - 1)} cy={y(data[data.length - 1]!.v)} r={4} fill={color} />
            <circle cx={x(data.length - 1)} cy={y(data[data.length - 1]!.v)} r={9} fill={color} opacity={0.18}>
              <animate attributeName="r" values="5;11;5" dur="2s" repeatCount="indefinite" />
            </circle>
          </g>
        )}

        {Array.from({ length: xTicks }, (_, k) => {
          const i = Math.round((k / (xTicks - 1)) * (data.length - 1));
          const d = data[i];
          if (!d) return null;
          return (
            <text key={k} x={x(i)} y={height - 5} textAnchor={k === 0 ? "start" : k === xTicks - 1 ? "end" : "middle"} className="fill-fg-3 font-mono text-[10.5px]">
              {timeLabel(d.t)}
            </text>
          );
        })}

        {hp && hover !== null && (
          <g>
            <line x1={x(hover)} x2={x(hover)} y1={4} y2={height - padB} stroke="var(--k-fg-2)" strokeDasharray="3 3" />
            <circle cx={x(hover)} cy={y(hp.v)} r={5} fill="var(--k-bg)" stroke={color} strokeWidth={2} />
          </g>
        )}
      </svg>
      {hp && hover !== null && (
        <div
          className="pointer-events-none absolute z-10 -translate-x-1/2 rounded-full border border-line bg-surface-2/95 px-3 py-1 font-mono text-[11.5px] text-fg shadow-lg backdrop-blur"
          style={{ left: Math.min(Math.max(x(hover), 70), plotW - 70), top: Math.max(0, y(hp.v) - 38) }}
        >
          <span className={hp.v >= 0 ? "text-up" : "text-down"}>{format(hp.v)}</span>
          <span className="ml-2 text-fg-3">{timeLabel(hp.t)}</span>
        </div>
      )}
    </div>
  );
}

function niceStep(raw: number) {
  const p = Math.pow(10, Math.floor(Math.log10(Math.abs(raw) || 1)));
  const n = raw / p;
  return (n < 1.5 ? 1 : n < 3 ? 2 : n < 7 ? 5 : 10) * p;
}

function compactAxis(v: number) {
  const a = Math.abs(v);
  const s = a >= 1e6 ? `${(a / 1e6).toFixed(1)}M` : a >= 1e3 ? `${(a / 1e3).toFixed(a >= 1e4 ? 0 : 1)}k` : a.toFixed(a < 1 && a > 0 ? 2 : 0);
  return `${v < 0 ? "-" : ""}${s}`;
}

/* ------------------------------------------------------------------ */
/* Segment bar (stacked share)                                         */
/* ------------------------------------------------------------------ */

export function ShareBar({ parts, className, height = 8 }: { parts: { value: number; className: string; label?: string }[]; className?: string; height?: number }) {
  const total = parts.reduce((s, p) => s + p.value, 0) || 1;
  return (
    <div className={cn("flex w-full gap-[3px] overflow-hidden rounded-full", className)} style={{ height }}>
      {parts.map((p, i) => (
        <motion.span
          key={i}
          className={cn("h-full rounded-full", p.className)}
          initial={{ width: 0 }}
          animate={{ width: `${(p.value / total) * 100}%` }}
          transition={{ duration: 0.9, delay: 0.1 + i * 0.08, ease: [0.16, 1, 0.3, 1] }}
        />
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Mini label/value tile                                               */
/* ------------------------------------------------------------------ */

export function Tile({ label, value, sub, className }: { label: React.ReactNode; value: React.ReactNode; sub?: React.ReactNode; className?: string }) {
  return (
    <div className={cn("k-row px-4 py-3", className)}>
      <div className="text-[11px] uppercase tracking-wider text-fg-3">{label}</div>
      <div className="k-num mt-1 text-[15px] font-medium text-fg">{value}</div>
      {sub && <div className="mt-0.5 text-[11.5px] text-fg-3">{sub}</div>}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Checkbox                                                            */
/* ------------------------------------------------------------------ */

export function Check({ checked, onChange, indeterminate, label }: { checked: boolean; onChange: (v: boolean) => void; indeterminate?: boolean; label?: string }) {
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
        checked || indeterminate ? "border-ember bg-ember text-white" : "border-fg-3/60 bg-surface-2 hover:border-fg-2",
      )}
    >
      {indeterminate ? (
        <span className="h-0.5 w-2 rounded bg-white" />
      ) : checked ? (
        <svg viewBox="0 0 12 12" className="size-3 fill-none stroke-current stroke-2">
          <path d="M2.5 6.2l2.2 2.2 4.8-4.8" />
        </svg>
      ) : null}
    </button>
  );
}
