"use client";

// Shared pieces of Analytics → Traders and Broker risk: formatting, vertical count bars, flag / routing chips and
// the client cell. Data shapes: @ezymex/mock/admin-broker-analytics (= the reports service responses).

import * as React from "react";
import { motion } from "motion/react";
import { Chip, Flag, Tooltip, cn } from "@ezymex/ui";
import type { BookMix, RouteHint, TraderPeriod, TraderRow } from "@ezymex/mock/admin-broker-analytics";
import { compactMoney } from "@/components/analytics/stacked-bars";

export { compactMoney };

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const MONTHS_LONG = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/** "2026-10-05" → parts without timezone shifts. */
function parts(iso: string) {
  const [y, m, d] = iso.slice(0, 10).split("-").map(Number);
  return { y: y!, m: m!, d: d!, wd: new Date(Date.UTC(y!, m! - 1, d!)).getUTCDay() };
}

/** Axis label and tooltip title of a time-series bucket. */
export function bucketLabel(start: string, period: TraderPeriod): { label: string; title: string } {
  const p = parts(start);
  if (period === "month") return { label: `${MONTHS[p.m - 1]} ${String(p.y).slice(2)}`, title: `${MONTHS_LONG[p.m - 1]} ${p.y}` };
  if (period === "week") return { label: `${p.d} ${MONTHS[p.m - 1]}`, title: `Week of ${p.d} ${MONTHS[p.m - 1]} ${p.y}` };
  return { label: `${p.d} ${MONTHS[p.m - 1]}`, title: `${WEEKDAYS[p.wd]}, ${p.d} ${MONTHS[p.m - 1]} ${p.y}` };
}

export function isoDay(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function addDays(iso: string, n: number) {
  const p = parts(iso);
  return new Date(Date.UTC(p.y, p.m - 1, p.d + n)).toISOString().slice(0, 10);
}

/** Default range (inclusive) ending `today`: 30 days, 12 weeks from a Monday, or 12 calendar months. */
export function defaultRange(period: TraderPeriod, today: string): { from: string; to: string } {
  const p = parts(today);
  if (period === "day") return { from: addDays(today, -29), to: today };
  if (period === "week") return { from: addDays(today, -((p.wd + 6) % 7) - 77), to: today };
  return { from: new Date(Date.UTC(p.y, p.m - 1 - 11, 1)).toISOString().slice(0, 10), to: today };
}

export function holdLabel(secs: number) {
  if (!secs) return "—";
  if (secs < 60) return `${secs.toFixed(0)} s`;
  if (secs < 3600) return `${(secs / 60).toFixed(secs < 600 ? 1 : 0)} min`;
  if (secs < 86_400) return `${(secs / 3600).toFixed(1)} h`;
  return `${(secs / 86_400).toFixed(1)} d`;
}

export const pct1 = (v: number | null | undefined) => (v === null || v === undefined ? "—" : `${v.toFixed(1)}%`);
export const countFmt = (v: number) => String(Math.abs(Math.round(v)));

/** Vertical bars with a value on top and a label below (distribution, margin-level histogram). */
export function CountBars({
  rows,
  height = 180,
  format = (v: number) => String(v),
}: {
  rows: { key: string; label: string; value: number; sub?: string; color: string; hint?: React.ReactNode }[];
  height?: number;
  format?: (v: number) => string;
}) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  return (
    <div className="flex items-end gap-2 sm:gap-3" style={{ height: height + 52 }}>
      {rows.map((r, i) => {
        const h = Math.max(r.value > 0 ? 4 : 2, (r.value / max) * height);
        const bar = (
          <div className="flex min-w-0 flex-1 flex-col items-center justify-end gap-1.5">
            <span className="k-num text-[12px] font-medium text-fg">{format(r.value)}</span>
            <motion.div
              className="w-full rounded-t-[8px]"
              style={{ background: r.color, height: h, opacity: r.value ? 0.92 : 0.25, transformOrigin: "50% 100%" }}
              initial={{ scaleY: 0 }}
              animate={{ scaleY: 1 }}
              transition={{ duration: 0.7, delay: i * 0.04, ease: [0.16, 1, 0.3, 1] }}
            />
            <span className="line-clamp-2 h-8 text-center text-[10.5px] leading-tight text-fg-3">{r.label}</span>
          </div>
        );
        return r.hint ? (
          <Tooltip key={r.key} content={r.hint}>
            {bar}
          </Tooltip>
        ) : (
          <React.Fragment key={r.key}>{bar}</React.Fragment>
        );
      })}
    </div>
  );
}

export function FlagChips({ flags }: { flags: TraderRow["flags"] }) {
  const items: [keyof TraderRow["flags"], string][] = [
    ["consistent", "Consistent"],
    ["scalper", "Scalping"],
    ["highWinRate", "High win rate"],
    ["largeSize", "Large size"],
  ];
  const on = items.filter(([k]) => flags[k]);
  if (!on.length) return <span className="text-[12px] text-fg-3">—</span>;
  return (
    <span className="flex flex-wrap gap-1">
      {on.map(([k, l]) => (
        <Chip key={k} size="sm" tone={k === "largeSize" ? "info" : "warn"}>
          {l}
        </Chip>
      ))}
    </span>
  );
}

const HINT: Record<RouteHint, { label: string; tone: "down" | "info" | "neutral"; text: string }> = {
  A: { label: "A-book", tone: "down", text: "Profitable with a persistent edge: consider routing to A-book" },
  review: { label: "Review", tone: "info", text: "Profitable and trading large against equity: review the routing" },
  B: { label: "B-book", tone: "neutral", text: "No persistent edge: internalising stays profitable" },
};

export function HintChip({ hint, reasons, book }: { hint: RouteHint; reasons: string[]; book: BookMix }) {
  const h = HINT[hint];
  return (
    <Tooltip
      content={
        <div className="max-w-[260px] space-y-1 text-[12px]">
          <div className="font-medium">{h.text}</div>
          {reasons.map((r) => (
            <div key={r} className="text-fg-2">· {r}</div>
          ))}
          <div className="text-fg-3">Routed now: {book === "mixed" ? "A and B" : `${book}-book`}</div>
        </div>
      }
    >
      <span className="inline-flex items-center gap-1.5">
        <Chip size="sm" tone={h.tone} dot={hint !== "B"}>
          {h.label}
        </Chip>
        {hint === "A" && book === "A" && <span className="text-[10.5px] text-fg-3">already A</span>}
      </span>
    </Tooltip>
  );
}

export function ClientCell({ name, userId, country, logins, sub }: { name: string; userId: number; country: string; logins: number[]; sub?: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <div className="flex items-center gap-1.5 text-[13.5px] font-medium">
        <span className="truncate">{name || `Client ${userId}`}</span>
        {country && country !== "--" && <Flag country={country.toLowerCase()} className="size-3.5" />}
      </div>
      <div className="truncate font-mono text-[11.5px] text-fg-3">
        {logins.map((l) => `#${l}`).join(" · ")}
        {sub && <span className="font-sans"> · {sub}</span>}
      </div>
    </div>
  );
}

export const SELECT = "h-10 rounded-[12px] border border-line bg-surface-2 px-3 text-[13px] text-fg outline-none transition-colors focus:border-ember/50";

export function SelectBox({ value, onChange, options, label, className }: { value: string; onChange: (v: string) => void; options: { value: string; label: string }[]; label: string; className?: string }) {
  return (
    <label className={cn("flex flex-col gap-1", className)}>
      <span className="text-[11px] uppercase tracking-wider text-fg-3">{label}</span>
      <select value={value} onChange={(e) => onChange(e.target.value)} className={SELECT}>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}

export function countryName(code: string) {
  if (!code || code === "--") return "Unknown";
  try {
    return new Intl.DisplayNames(["en"], { type: "region" }).of(code.toUpperCase()) ?? code.toUpperCase();
  } catch {
    return code.toUpperCase();
  }
}
