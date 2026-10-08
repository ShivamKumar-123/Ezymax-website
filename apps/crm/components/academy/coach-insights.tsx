"use client";

import * as React from "react";
import { motion } from "motion/react";
import { AlertTriangle, Clock, Gauge as GaugeIcon, Trophy } from "lucide-react";
import { Card, CardHeader, Chip, SymbolAvatar, Tooltip, cn, formatMoney } from "@/components/kit";
import { COACH, SESSIONS, WEEKDAYS } from "@ezymex/mock/academy";

const money = (v: number) => `${v >= 0 ? "+" : "-"}${formatMoney(Math.abs(v), "USD", 0)}`;

/* ------------------------------------------------------------------ */
/* Best / worst symbols                                                */
/* ------------------------------------------------------------------ */

export function SymbolInsight() {
  const top = COACH.bySymbol.slice(0, 4);
  const bottom = COACH.bySymbol.slice(-3);
  const rows = [...top, ...bottom];
  const max = Math.max(...rows.map((r) => Math.abs(r.net)));
  return (
    <Card className="flex h-full flex-col">
      <CardHeader title="Best & worst symbols" subtitle="Net P/L, all closed trades" icon={<Trophy />} />
      <div className="mt-4 flex-1 space-y-1.5 px-4 pb-4 sm:px-6">
        {rows.map((r, i) => {
          const pos = r.net >= 0;
          return (
            <React.Fragment key={r.symbol}>
              {i === top.length && <div className="my-2 h-px bg-line" />}
              <div className="grid grid-cols-[92px_1fr_70px] items-center gap-3">
                <div className="flex items-center gap-2">
                  <SymbolAvatar symbol={r.symbol} size={18} />
                  <span className="truncate text-[12.5px] font-medium">{r.symbol}</span>
                </div>
                <div className="relative h-5">
                  <span className="absolute inset-y-0 left-1/2 w-px bg-line" />
                  <motion.span
                    className={cn("absolute top-1 h-3 rounded-full", pos ? "left-1/2 bg-gradient-to-r from-up/50 to-up" : "right-1/2 bg-gradient-to-l from-down/50 to-down")}
                    initial={{ width: 0 }}
                    animate={{ width: `${Math.max(2, (Math.abs(r.net) / max) * 50)}%` }}
                    transition={{ duration: 0.8, delay: i * 0.05, ease: [0.16, 1, 0.3, 1] }}
                  />
                </div>
                <span className={cn("k-num text-right text-[12.5px] font-semibold", pos ? "text-up" : "text-down")}>{money(r.net)}</span>
              </div>
            </React.Fragment>
          );
        })}
      </div>
      <div className="mx-4 mb-5 rounded-[14px] border border-gold/25 bg-gold-soft px-3.5 py-2.5 text-[12px] text-fg-2 sm:mx-6">
        <span className="font-semibold text-gold">XAUUSD</span> made {((COACH.bySymbol[0]!.net / COACH.allTime.net) * 100).toFixed(0)}% of your total profit.
      </div>
    </Card>
  );
}

/* ------------------------------------------------------------------ */
/* Session × weekday heat                                              */
/* ------------------------------------------------------------------ */

export function SessionHeat() {
  const cells = COACH.heat.flat();
  const max = Math.max(...cells.map((c) => Math.abs(c.net)));
  const best = [...cells].sort((a, b) => b.net - a.net)[0]!;
  return (
    <Card className="flex h-full flex-col">
      <CardHeader title="Session performance" subtitle="Net P/L by session and weekday · GMT+3" icon={<Clock />} action={<Chip tone="up">Best: {best.day} NY</Chip>} />
      <div className="mt-5 px-4 pb-5 sm:px-6">
        <div className="grid grid-cols-[64px_repeat(5,minmax(0,1fr))] gap-1.5">
          <span />
          {WEEKDAYS.map((d) => (
            <span key={d} className="text-center text-[10.5px] uppercase tracking-wider text-fg-3">
              {d}
            </span>
          ))}
          {COACH.heat.map((row, ri) => (
            <React.Fragment key={SESSIONS[ri]}>
              <span className="flex items-center text-[11.5px] text-fg-2">{SESSIONS[ri]}</span>
              {row.map((c, ci) => {
                const a = Math.abs(c.net) / max;
                const pos = c.net >= 0;
                return (
                  <Tooltip key={c.day} content={`${c.session} · ${c.day}: ${money(c.net)} (${c.count} trades)`}>
                    <motion.div
                      initial={{ opacity: 0, scale: 0.8 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ delay: (ri * 5 + ci) * 0.025 }}
                      className="k-num grid h-12 cursor-default place-items-center rounded-[10px] border text-[10.5px] font-medium transition-transform hover:scale-105"
                      style={{
                        background: pos ? `rgba(34,197,94,${0.08 + a * 0.62})` : `rgba(240,68,56,${0.12 + a * 0.6})`,
                        borderColor: pos ? `rgba(34,197,94,${0.15 + a * 0.4})` : `rgba(240,68,56,${0.25 + a * 0.4})`,
                        color: a > 0.45 ? "#fff" : pos ? "var(--k-up)" : "var(--k-down)",
                      }}
                    >
                      {Math.abs(c.net) >= 1000 ? `${pos ? "+" : "-"}${(Math.abs(c.net) / 1000).toFixed(1)}k` : `${pos ? "+" : "-"}${Math.round(Math.abs(c.net))}`}
                    </motion.div>
                  </Tooltip>
                );
              })}
            </React.Fragment>
          ))}
        </div>
        <div className="mt-4 flex items-center justify-between text-[11px] text-fg-3">
          <span className="flex items-center gap-1.5">
            <span className="h-2 w-10 rounded-full bg-gradient-to-r from-down to-down/20" /> Loss
          </span>
          <span className="flex items-center gap-1.5">
            Profit <span className="h-2 w-10 rounded-full bg-gradient-to-r from-up/20 to-up" />
          </span>
        </div>
      </div>
    </Card>
  );
}

/* ------------------------------------------------------------------ */
/* Risk per trade distribution                                         */
/* ------------------------------------------------------------------ */

export function RiskDistribution() {
  const b = COACH.riskBuckets;
  const max = Math.max(...b.map((x) => x.count));
  const total = b.reduce((s, x) => s + x.count, 0);
  const over = b[3]!.count + b[4]!.count;
  return (
    <Card className="flex h-full flex-col">
      <CardHeader title="Risk per trade" subtitle="% of equity at risk, all trades" icon={<GaugeIcon />} action={<Chip tone="warn">{over} over 2%</Chip>} />
      <div className="flex flex-1 items-end gap-3 px-4 pb-2 pt-6 sm:px-6" style={{ minHeight: 190 }}>
        {b.map((x, i) => {
          const danger = i >= 3;
          return (
            <div key={x.label} className="flex h-full flex-1 flex-col items-center justify-end">
              <span className={cn("k-num mb-1.5 text-[11.5px] font-medium", danger ? "text-down" : "text-fg-2")}>{((x.count / total) * 100).toFixed(0)}%</span>
              <motion.div
                className={cn("w-full max-w-12 rounded-t-[10px] rounded-b-[4px] border", danger ? "border-down/40 bg-gradient-to-b from-down to-down/30" : i === 0 ? "border-ember/40 bg-gradient-to-b from-[var(--k-ember-2)] to-[color-mix(in_oklab,var(--k-ember)_78%,#000)] shadow-[0_0_30px_-8px_color-mix(in_oklab,var(--k-ember)_70%,transparent)]" : "border-line bg-gradient-to-b from-surface-3 to-surface-2")}
                initial={{ height: 0 }}
                animate={{ height: `${Math.max(4, (x.count / max) * 120)}px` }}
                transition={{ duration: 0.8, delay: i * 0.06, ease: [0.16, 1, 0.3, 1] }}
              />
              <span className="mt-2 whitespace-nowrap text-[10.5px] text-fg-3">{x.label}</span>
            </div>
          );
        })}
      </div>
      <div className="mx-4 mb-5 mt-3 flex items-start gap-2 rounded-[14px] border border-line bg-surface-2 px-3.5 py-2.5 text-[12px] text-fg-2 sm:mx-6">
        <span className="mt-1 size-1.5 shrink-0 rounded-full bg-ember" />
        Target: keep every trade under 1%. {((over / total) * 100).toFixed(0)}% of trades broke the 2% line.
      </div>
    </Card>
  );
}

/* ------------------------------------------------------------------ */
/* Overtrading after losses                                            */
/* ------------------------------------------------------------------ */

export function OvertradingCard() {
  const { days, avg } = COACH.overtrading;
  const W = 520;
  const H = 150;
  const pad = 8;
  const max = Math.max(...days.map((d) => d.count)) + 1;
  const x = (i: number) => pad + (i / (days.length - 1)) * (W - pad * 2);
  const y = (v: number) => H - 22 - (v / max) * (H - 40);
  const path = days.map((d, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(d.count).toFixed(1)}`).join(" ");
  const flagged = days.filter((d) => d.afterLoss).length;
  const [hover, setHover] = React.useState<number | null>(null);
  const h = hover !== null ? days[hover]! : null;
  return (
    <Card className="flex h-full flex-col">
      <CardHeader title="Overtrading after losses" subtitle="Trades per day · last 30 trading days" icon={<AlertTriangle />} action={<Chip tone="down">{flagged} flagged {flagged === 1 ? "day" : "days"}</Chip>} />
      <div className="relative mt-3 px-3 sm:px-5">
        <div className="pointer-events-none absolute left-6 top-0 z-10 text-[11.5px] text-fg-3 sm:left-8">
          {h ? (
            <span>
              <span className="text-fg">{new Date(h.date).toLocaleDateString("en-GB", { day: "2-digit", month: "short" })}</span> · {h.count} trades ·{" "}
              <span className={h.net >= 0 ? "text-up" : "text-down"}>{money(h.net)}</span>
              {h.afterLoss && <span className="text-down"> · after a losing day</span>}
            </span>
          ) : (
            <span>Hover to inspect a day</span>
          )}
        </div>
        <svg viewBox={`0 0 ${W} ${H}`} className="k-dotgrid mt-5 w-full rounded-xl" onMouseLeave={() => setHover(null)}>
          <defs>
            <linearGradient id="ot-fill" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0" stopColor="var(--k-gold)" stopOpacity="0.25" />
              <stop offset="1" stopColor="var(--k-gold)" stopOpacity="0" />
            </linearGradient>
          </defs>
          <line x1={pad} x2={W - pad} y1={y(avg)} y2={y(avg)} stroke="var(--k-fg-3)" strokeDasharray="4 4" strokeWidth={1} />
          <text x={W - pad} y={y(avg) - 5} textAnchor="end" fontSize="10" fill="var(--k-fg-3)">
            avg {avg}/day
          </text>
          {days.map((d, i) => (
            <rect key={i} x={x(i) - 3} y={H - 4 - Math.max(2, Math.min(14, Math.abs(d.net) / 120))} width={6} height={Math.max(2, Math.min(14, Math.abs(d.net) / 120))} rx={1.5} fill={d.net >= 0 ? "var(--k-up)" : "var(--k-down)"} opacity={0.55} />
          ))}
          <path d={`${path} L${x(days.length - 1)},${H - 22} L${x(0)},${H - 22} Z`} fill="url(#ot-fill)" />
          <motion.path d={path} fill="none" stroke="var(--k-gold)" strokeWidth={1.8} strokeLinejoin="round" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 1.1 }} />
          {days.map((d, i) =>
            d.afterLoss ? (
              <g key={`m${i}`}>
                <circle cx={x(i)} cy={y(d.count)} r={9} fill="var(--k-down)" opacity={0.18}>
                  <animate attributeName="r" values="6;11;6" dur="2s" repeatCount="indefinite" />
                </circle>
                <circle cx={x(i)} cy={y(d.count)} r={4} fill="var(--k-down)" stroke="var(--k-surface)" strokeWidth={1.5} />
              </g>
            ) : null,
          )}
          {hover !== null && <line x1={x(hover)} x2={x(hover)} y1={10} y2={H - 4} stroke="var(--k-fg-3)" strokeDasharray="3 3" />}
          {days.map((_, i) => (
            <rect key={`h${i}`} x={x(i) - W / days.length / 2} y={0} width={W / days.length} height={H} fill="transparent" onMouseEnter={() => setHover(i)} />
          ))}
        </svg>
      </div>
      <div className="mx-4 mb-5 mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11.5px] text-fg-3 sm:mx-6">
        <span className="flex items-center gap-1.5">
          <span className="h-0.5 w-4 rounded bg-gold" /> Trades / day
        </span>
        <span className="flex items-center gap-1.5">
          <span className="size-2 rounded-full bg-down" /> Spike after a losing day
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-1.5 rounded-sm bg-up/60" /> Day P/L
        </span>
      </div>
    </Card>
  );
}
