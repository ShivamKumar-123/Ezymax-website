"use client";

import * as React from "react";
import { AnimatePresence, motion } from "motion/react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Chip, Dialog, IconButton, Money, SymbolAvatar, cn, formatDateTime, formatNumber } from "@/components/kit";
import type { ClosedTrade } from "@kalks/mock";
import { useFormat, useT } from "@kalks/i18n/react";

// 2024-01-01 is a Monday: the calendar is Monday-first. Names come from Intl in the reader's language.
const DOW_DATES = Array.from({ length: 7 }, (_, i) => Date.UTC(2024, 0, 1 + i));

interface DayCell {
  date: string;
  day: number;
  pnl: number;
  trades: ClosedTrade[];
}

function ym(iso: string) {
  return iso.slice(0, 7);
}

/** Monthly realised-P&L heatmap. Click a day to see its trades. */
export function PnlCalendar({ trades, currency = "$", mult = 1 }: { trades: ClosedTrade[]; currency?: string; mult?: number }) {
  const t = useT();
  const f = useFormat();
  const months = React.useMemo(() => {
    const set = new Set(trades.map((t) => ym(t.closeTime)));
    set.add("2026-09");
    return [...set].sort();
  }, [trades]);
  const [idx, setIdx] = React.useState(months.length - 1);
  const [dir, setDir] = React.useState(0);
  const [open, setOpen] = React.useState<DayCell | null>(null);
  const month = months[idx] ?? "2026-09";
  const [y, m] = month.split("-").map(Number) as [number, number];

  const cells = React.useMemo(() => {
    const days = new Date(Date.UTC(y, m, 0)).getUTCDate();
    const out: DayCell[] = [];
    for (let d = 1; d <= days; d++) {
      const date = `${month}-${String(d).padStart(2, "0")}`;
      const list = trades.filter((t) => t.closeTime.startsWith(date));
      out.push({ date, day: d, pnl: list.reduce((s, t) => s + t.profit, 0) * mult, trades: list });
    }
    return out;
  }, [trades, month, y, m, mult]);

  const lead = (new Date(Date.UTC(y, m - 1, 1)).getUTCDay() + 6) % 7; // Monday-first
  const max = Math.max(1, ...cells.map((c) => Math.abs(c.pnl)));
  const total = cells.reduce((s, c) => s + c.pnl, 0);
  const active = cells.filter((c) => c.trades.length);
  const green = active.filter((c) => c.pnl > 0).length;
  const best = active.reduce<DayCell | null>((b, c) => (!b || c.pnl > b.pnl ? c : b), null);
  const worst = active.reduce<DayCell | null>((b, c) => (!b || c.pnl < b.pnl ? c : b), null);
  const today = "2026-09-24";

  // weekly totals (rows)
  const rows: (DayCell | null)[][] = [];
  const flat: (DayCell | null)[] = [...Array(lead).fill(null), ...cells];
  while (flat.length % 7) flat.push(null);
  for (let i = 0; i < flat.length; i += 7) rows.push(flat.slice(i, i + 7));

  const go = (d: number) => {
    setDir(d);
    setIdx((i) => Math.min(months.length - 1, Math.max(0, i + d)));
  };

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <IconButton size="sm" onClick={() => go(-1)} disabled={idx === 0} aria-label={t("accountDetail.cal.prevMonth")}>
            <ChevronLeft className="rtl:-scale-x-100" />
          </IconButton>
          <div className="w-36 text-center text-[15px] font-medium">
            {f.date(Date.UTC(y, m - 1, 15), { month: "long", year: "numeric", timeZone: "UTC" })}
          </div>
          <IconButton size="sm" onClick={() => go(1)} disabled={idx === months.length - 1} aria-label={t("accountDetail.cal.nextMonth")}>
            <ChevronRight className="rtl:-scale-x-100" />
          </IconButton>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Chip tone={total >= 0 ? "up" : "down"}>
            {t("accountDetail.cal.month", { amount: `${total >= 0 ? "+" : "-"}${currency}${formatNumber(Math.abs(total))}` })}
          </Chip>
          <Chip>
            {t("accountDetail.cal.greenDays", { green, total: active.length })}
          </Chip>
        </div>
      </div>

      <div className="mt-4 overflow-hidden">
        <div className="grid grid-cols-[repeat(7,minmax(0,1fr))_auto] gap-1.5 sm:gap-2">
          {DOW_DATES.map((d, i) => (
            <div key={i} className="pb-1 text-center text-[10.5px] font-medium uppercase tracking-wider text-fg-3">
              {f.date(d, { weekday: "short", timeZone: "UTC" })}
            </div>
          ))}
          <div className="hidden w-20 pb-1 text-end text-[10.5px] font-medium uppercase tracking-wider text-fg-3 sm:block">{t("accountDetail.cal.week")}</div>
        </div>
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={month}
            initial={{ opacity: 0, x: dir * 24 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: dir * -24 }}
            transition={{ duration: 0.25 }}
            className="space-y-1.5 sm:space-y-2"
          >
            {rows.map((row, ri) => {
              const wk = row.reduce((s, c) => s + (c?.pnl ?? 0), 0);
              const wkTrades = row.reduce((s, c) => s + (c?.trades.length ?? 0), 0);
              return (
                <div key={ri} className="grid grid-cols-[repeat(7,minmax(0,1fr))_auto] gap-1.5 sm:gap-2">
                  {row.map((c, ci) => {
                    if (!c) return <div key={ci} className="aspect-square rounded-xl sm:aspect-[1.25]" />;
                    const has = c.trades.length > 0;
                    const k = has ? Math.sqrt(Math.abs(c.pnl) / max) : 0;
                    const a = has ? 0.1 + k * 0.62 : 0;
                    const color = c.pnl >= 0 ? "34,197,94" : "240,68,56";
                    return (
                      <motion.button
                        key={ci}
                        type="button"
                        disabled={!has}
                        onClick={() => setOpen(c)}
                        initial={{ opacity: 0, scale: 0.92 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ duration: 0.25, delay: (ri * 7 + ci) * 0.008 }}
                        className={cn(
                          "group relative flex aspect-square flex-col justify-between overflow-hidden rounded-xl border p-1.5 text-start transition-all sm:aspect-[1.25] sm:p-2",
                          has ? "cursor-pointer border-transparent hover:-translate-y-0.5 hover:border-[var(--k-border-top)]" : "border-line bg-surface-2/60",
                          c.date === today && "ring-1 ring-ember/60",
                        )}
                        style={has ? { background: `rgba(${color},${a.toFixed(3)})`, boxShadow: k > 0.75 ? `0 0 24px -8px rgba(${color},.8)` : undefined } : undefined}
                        aria-label={`${c.date}: ${has ? formatNumber(c.pnl) : t("accountDetail.cal.noTrades")}`}
                      >
                        <span className={cn("k-num text-[11px] font-medium", has ? "text-fg" : "text-fg-3")}>{c.day}</span>
                        {has && (
                          <span className="hidden min-w-0 sm:block">
                            <span className={cn("k-num block truncate text-[12px] font-semibold", k > 0.6 ? "text-white" : c.pnl >= 0 ? "text-up" : "text-down")}>
                              {c.pnl >= 0 ? "+" : "-"}
                              {Math.abs(c.pnl) >= 10000 ? `${(Math.abs(c.pnl) / 1000).toFixed(1)}k` : formatNumber(Math.abs(c.pnl), 0)}
                            </span>
                            <span className={cn("block text-[10px]", k > 0.6 ? "text-white/75" : "text-fg-2")}>
                              {t("accountDetail.cal.trades", { count: c.trades.length })}
                            </span>
                          </span>
                        )}
                        {has && <span className={cn("absolute bottom-1.5 end-1.5 size-1.5 rounded-full sm:hidden", c.pnl >= 0 ? "bg-up" : "bg-down")} />}
                      </motion.button>
                    );
                  })}
                  <div className="hidden w-20 flex-col items-end justify-center rounded-xl border border-line bg-surface-2 px-2 sm:flex">
                    <span className={cn("k-num text-[12px] font-semibold", wkTrades === 0 ? "text-fg-3" : wk >= 0 ? "text-up" : "text-down")}>
                      {wkTrades === 0 ? "—" : `${wk >= 0 ? "+" : "-"}${formatNumber(Math.abs(wk), 0)}`}
                    </span>
                    <span className="text-[10px] text-fg-3">{t("accountDetail.cal.trades", { count: wkTrades })}</span>
                  </div>
                </div>
              );
            })}
          </motion.div>
        </AnimatePresence>
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-[12px] text-fg-3">
        <div className="flex items-center gap-2">
          <span>{t("common.loss")}</span>
          {[0.7, 0.45, 0.2].map((o) => (
            <span key={`d${o}`} className="size-3 rounded" style={{ background: `rgba(240,68,56,${o})` }} />
          ))}
          <span className="size-3 rounded border border-line bg-surface-2" />
          {[0.2, 0.45, 0.7].map((o) => (
            <span key={`u${o}`} className="size-3 rounded" style={{ background: `rgba(34,197,94,${o})` }} />
          ))}
          <span>{t("common.profit")}</span>
        </div>
        <div className="flex gap-4">
          {best && best.pnl > 0 && (
            <span>
              {t("accountDetail.cal.bestDay")} <span className="k-num font-medium text-up">+{currency}{formatNumber(best.pnl)}</span>
            </span>
          )}
          {worst && worst.pnl < 0 && (
            <span>
              {t("accountDetail.cal.worstDay")} <span className="k-num font-medium text-down">-{currency}{formatNumber(Math.abs(worst.pnl))}</span>
            </span>
          )}
        </div>
      </div>

      <Dialog
        side="right"
        open={!!open}
        onOpenChange={(o) => !o && setOpen(null)}
        title={open ? f.date(open.date + "T12:00:00Z", { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }) : ""}
        description={open ? t("accountDetail.cal.dayDescription", { count: open.trades.length }) : undefined}
      >
        {open && (
          <div>
            <div className="grid grid-cols-3 gap-2">
              <div className="k-row px-3 py-3">
                <div className="text-[12px] text-fg-3">{t("accountDetail.cal.netPnl")}</div>
                <Money value={open.pnl} currency={currency} signed tone="auto" className="mt-1 block text-[17px] font-semibold" />
              </div>
              <div className="k-row px-3 py-3">
                <div className="text-[12px] text-fg-3">{t("accountDetail.perf.winRate")}</div>
                <div className="k-num mt-1 text-[17px] font-semibold">{Math.round((open.trades.filter((t) => t.profit > 0).length / open.trades.length) * 100)}%</div>
              </div>
              <div className="k-row px-3 py-3">
                <div className="text-[12px] text-fg-3">{t("accountDetail.col.volume")}</div>
                <div className="k-num mt-1 text-[17px] font-semibold">{t("accountDetail.perf.lots", { value: formatNumber(open.trades.reduce((s, x) => s + x.volume, 0)) })}</div>
              </div>
            </div>
            <div className="mt-4 space-y-2">
              {open.trades.map((tr) => (
                <div key={tr.ticket} className="k-row flex items-center gap-3 px-4 py-3">
                  <SymbolAvatar symbol={tr.symbol} size={26} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 text-[13.5px] font-medium">
                      {tr.symbol}
                      <Chip size="sm" tone={tr.side === "buy" ? "up" : "down"}>
                        {tr.side === "buy" ? t("accountDetail.side.buy") : t("accountDetail.side.sell")} {tr.volume}
                      </Chip>
                    </div>
                    <div className="k-num mt-0.5 truncate font-mono text-[11px] text-fg-3">
                      #{tr.ticket} · {tr.openPrice} → {tr.closePrice} · {formatDateTime(tr.closeTime, { hour: "2-digit", minute: "2-digit" })}
                    </div>
                  </div>
                  <Money value={tr.profit * mult} currency={currency} signed tone="auto" countUp={false} className="text-[14px] font-semibold" />
                </div>
              ))}
            </div>
          </div>
        )}
      </Dialog>
    </div>
  );
}
