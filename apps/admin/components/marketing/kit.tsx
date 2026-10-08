"use client";

/**
 * Marketing module kit — small building blocks shared by the Marketing pages
 * (chip pickers, section labels, mini stats, the client-facing banner preview).
 */
import * as React from "react";
import { motion } from "motion/react";
import { Check } from "lucide-react";
import { Flag, cn } from "@ezymex/ui";

export const fmtInt = (v: number) => v.toLocaleString("en-US");
export const fmtUsd0 = (v: number) => `$${Math.round(v).toLocaleString("en-US")}`;
export const fmtK = (v: number) => (Math.abs(v) >= 1_000_000 ? `${(v / 1_000_000).toFixed(2)}M` : Math.abs(v) >= 10_000 ? `${(v / 1000).toFixed(1)}k` : v.toLocaleString("en-US"));

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
/** "24 Sep 2026" from an ISO string, deterministic (GMT+3). */
export function fmtDate(iso: string, year = true) {
  const d = new Date(new Date(iso).getTime() + 3 * 3600_000);
  return `${String(d.getUTCDate()).padStart(2, "0")} ${MONTHS[d.getUTCMonth()]}${year ? ` ${d.getUTCFullYear()}` : ""}`;
}
export function fmtDateTime(iso: string) {
  const d = new Date(new Date(iso).getTime() + 3 * 3600_000);
  return `${String(d.getUTCDate()).padStart(2, "0")} ${MONTHS[d.getUTCMonth()]}, ${String(d.getUTCHours()).padStart(2, "0")}:${String(d.getUTCMinutes()).padStart(2, "0")}`;
}
/** Whole days between "today" (24 Sep 2026) and a date. */
export function daysFromToday(iso: string) {
  return Math.round((new Date(iso).getTime() - Date.UTC(2026, 8, 24, 12)) / 86_400_000);
}

export function SectionLabel({ children, action, className }: { children: React.ReactNode; action?: React.ReactNode; className?: string }) {
  return (
    <div className={cn("mb-2.5 flex items-center justify-between gap-2", className)}>
      <span className="k-label">{children}</span>
      {action}
    </div>
  );
}

/** Multi-select pill picker (groups, segments, countries). */
export function ChipPicker<T extends string>({
  options,
  value,
  onChange,
  render,
  className,
}: {
  options: readonly T[];
  value: T[];
  onChange: (v: T[]) => void;
  render?: (o: T) => React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-wrap gap-1.5", className)}>
      {options.map((o) => {
        const on = value.includes(o);
        return (
          <button
            key={o}
            type="button"
            onClick={() => onChange(on ? value.filter((x) => x !== o) : [...value, o])}
            className={cn(
              "inline-flex h-8 items-center gap-1.5 rounded-full border px-3 text-[12.5px] font-medium transition-all",
              on ? "border-ember/40 bg-ember-soft text-ember shadow-[0_0_18px_-8px_rgba(255,90,31,0.8)]" : "border-line bg-surface-2 text-fg-2 hover:border-fg-3/40 hover:text-fg",
            )}
          >
            {on && <Check className="size-3.5" />}
            {render ? render(o) : o}
          </button>
        );
      })}
    </div>
  );
}

export function CountryPicker({ options, value, onChange }: { options: { code: string; name: string }[]; value: string[]; onChange: (v: string[]) => void }) {
  const names = Object.fromEntries(options.map((o) => [o.code, o.name]));
  return (
    <ChipPicker
      options={options.map((o) => o.code)}
      value={value}
      onChange={onChange}
      render={(c) => (
        <>
          <Flag country={c} className="size-4" />
          {names[c]}
        </>
      )}
    />
  );
}

/** Overlapping flag stack with +N overflow. */
export function FlagStack({ countries, max = 5 }: { countries: string[]; max?: number }) {
  const shown = countries.slice(0, max);
  return (
    <span className="inline-flex items-center">
      <span className="flex -space-x-1.5">
        {shown.map((c) => (
          <Flag key={c} country={c} className="ring-2 ring-surface" />
        ))}
      </span>
      {countries.length > max && <span className="k-num ml-1.5 text-[11.5px] text-fg-3">+{countries.length - max}</span>}
    </span>
  );
}

/** Small label/value tile on surface-2. */
export function MiniStat({ label, value, sub, className, tone }: { label: React.ReactNode; value: React.ReactNode; sub?: React.ReactNode; className?: string; tone?: "up" | "down" | "gold" | "ember" }) {
  return (
    <div className={cn("k-row min-w-0 px-3.5 py-2.5", className)}>
      <div className="truncate text-[10.5px] font-medium uppercase tracking-[0.06em] text-fg-3">{label}</div>
      <div className={cn("k-num mt-1 truncate text-[15px] font-medium", tone === "up" && "text-up", tone === "down" && "text-down", tone === "gold" && "text-gold", tone === "ember" && "text-ember")}>{value}</div>
      {sub && <div className="mt-0.5 truncate text-[11px] text-fg-3">{sub}</div>}
    </div>
  );
}

/** Numeric input with a unit suffix, used in rule editors. */
export function NumField({ value, onChange, prefix, suffix, className, step = 1 }: { value: number; onChange: (v: number) => void; prefix?: string; suffix?: string; className?: string; step?: number }) {
  return (
    <div className={cn("flex h-10 items-center gap-1.5 rounded-[12px] border border-line bg-surface-2 px-3 text-sm transition-colors focus-within:border-ember/50 focus-within:ring-4 focus-within:ring-ember/10", className)}>
      {prefix && <span className="text-fg-3">{prefix}</span>}
      <input
        type="number"
        step={step}
        value={Number.isFinite(value) ? value : 0}
        onChange={(e) => onChange(Number(e.target.value))}
        className="k-num h-full min-w-0 flex-1 bg-transparent text-fg outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none"
      />
      {suffix && <span className="whitespace-nowrap text-[12px] text-fg-3">{suffix}</span>}
    </div>
  );
}

/**
 * The banner exactly as a client sees it in the Client Area:
 * real photo, dark gradient, eyebrow, headline, sub copy and an ember CTA pill.
 */
export function BannerPreview({
  photo,
  eyebrow,
  headline,
  sub,
  cta,
  placement = "dashboard",
  className,
}: {
  photo: string;
  eyebrow?: string;
  headline: string;
  sub?: string;
  cta: string;
  placement?: "dashboard" | "wallet" | "login";
  className?: string;
}) {
  const tall = placement === "login";
  return (
    <div className={cn("group relative isolate overflow-hidden rounded-[18px] border border-line bg-surface-2", tall ? "aspect-[4/5]" : "aspect-[16/8]", className)}>
      <motion.img
        key={photo}
        src={photo}
        alt=""
        initial={{ opacity: 0, scale: 1.04 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.6 }}
        className="absolute inset-0 -z-10 size-full object-cover transition-transform duration-700 group-hover:scale-[1.03]"
      />
      <div className={cn("absolute inset-0 -z-10", tall ? "bg-gradient-to-t from-black via-black/70 to-black/10" : "bg-gradient-to-r from-black/95 via-black/70 to-black/5")} />
      <div className="absolute inset-0 -z-10 bg-[radial-gradient(120%_80%_at_0%_100%,rgba(255,90,31,0.28),transparent_60%)]" />
      <div className={cn("flex h-full flex-col p-4 sm:p-5", tall ? "justify-end" : "justify-center")}>
        {eyebrow && <span className="mb-2 inline-flex w-fit items-center gap-1.5 rounded-full border border-white/15 bg-white/10 px-2.5 py-0.5 text-[10.5px] font-medium uppercase tracking-[0.08em] text-white/85 backdrop-blur">{eyebrow}</span>}
        <div className={cn("font-medium leading-tight tracking-tight text-white", tall ? "text-[19px]" : "max-w-[70%] text-[17px] sm:text-[19px]")}>{headline || "Your headline"}</div>
        {sub && <div className={cn("mt-1.5 text-[12px] leading-snug text-white/70", !tall && "max-w-[62%]")}>{sub}</div>}
        <span className="k-ember-btn mt-3.5 inline-flex h-8 w-fit shrink-0 items-center rounded-full px-4 text-[12.5px] font-medium">{cta || "Call to action"}</span>
      </div>
    </div>
  );
}

/** Deterministic ring percentage used on cards. */
export function RingPct({ value, size = 44, stroke = 4, tone = "ember", children }: { value: number; size?: number; stroke?: number; tone?: "ember" | "gold" | "up"; children?: React.ReactNode }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  return (
    <span className="relative inline-grid shrink-0 place-items-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--k-surface-3)" strokeWidth={stroke} />
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={`var(--k-${tone})`}
          strokeWidth={stroke}
          strokeLinecap="round"
          initial={{ strokeDasharray: `0 ${c}` }}
          animate={{ strokeDasharray: `${(Math.min(100, value) / 100) * c} ${c}` }}
          transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
        />
      </svg>
      <span className="absolute inset-0 grid place-items-center text-[10.5px] font-semibold k-num">{children ?? `${Math.round(value)}%`}</span>
    </span>
  );
}
