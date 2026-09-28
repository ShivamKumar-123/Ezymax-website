"use client";

import * as React from "react";
import { motion } from "motion/react";
import { Card, CardHeader, Chip, DataTable, KeyValue, Money, Starfield, cn, formatMoney, type Column } from "@kalks/ui";
import { getInstrument } from "@kalks/mock";
import { MONTH_LABELS, monteCarlo, serverTime, type BacktestResult, type BtPoint, type BtTrade } from "@kalks/mock/algo";

function useWidth(initial = 600) {
  const ref = React.useRef<HTMLDivElement>(null);
  const [w, setW] = React.useState(initial);
  React.useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setW(Math.max(240, Math.round(e!.contentRect.width))));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, w] as const;
}

/* ------------------------------------------------------------------ */
/* KPI tiles                                                           */
/* ------------------------------------------------------------------ */

export function BacktestKpis({ r }: { r: BacktestResult }) {
  const k = r.kpis;
  const tiles: { label: string; value: React.ReactNode; sub: React.ReactNode; tone?: string }[] = [
    { label: "Win rate", value: `${k.winRate.toFixed(1)}%`, sub: `${Math.round((k.winRate / 100) * k.trades)} of ${k.trades} trades` },
    { label: "Profit factor", value: k.profitFactor.toFixed(2), sub: k.profitFactor >= 1.5 ? "Robust" : k.profitFactor >= 1 ? "Marginal edge" : "Losing system", tone: k.profitFactor >= 1 ? undefined : "text-down" },
    { label: "Sharpe ratio", value: k.sharpe.toFixed(2), sub: "Annualised, daily" },
    { label: "Max drawdown", value: `${k.maxDdPct.toFixed(2)}%`, sub: `−${formatMoney(k.maxDdAbs)} peak-to-trough`, tone: "text-down" },
    { label: "Trades", value: k.trades.toLocaleString("en-US"), sub: `${k.longPct.toFixed(0)}% long · ${(100 - k.longPct).toFixed(0)}% short` },
  ];
  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-3 2xl:grid-cols-6">
      <div className="k-hot-card relative col-span-2 overflow-hidden rounded-[16px] px-4 py-3.5 md:col-span-1 2xl:col-span-1">
        <Starfield density={24} />
        <div className="relative">
          <div className="k-label">Net profit</div>
          <Money key={r.seed} value={r.kpis.netProfit} signed tone="auto" className="mt-1.5 block text-[24px] font-semibold tracking-tight" />
          <div className={cn("k-num mt-0.5 text-[11.5px]", k.returnPct >= 0 ? "text-up" : "text-down")}>
            {k.returnPct >= 0 ? "+" : ""}
            {k.returnPct.toFixed(2)}% on {formatMoney(r.params.balance, "USD", 0)}
          </div>
        </div>
      </div>
      {tiles.map((t, i) => (
        <motion.div key={t.label + r.seed} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.04 * i }} className={cn("k-row px-4 py-3.5", i === tiles.length - 1 && "max-md:col-span-2")}>
          <div className="k-label truncate">{t.label}</div>
          <div className={cn("k-num mt-1.5 text-[22px] font-semibold leading-tight tracking-tight", t.tone)}>{t.value}</div>
          <div className="mt-0.5 truncate text-[11.5px] text-fg-3">{t.sub}</div>
        </motion.div>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Drawdown underwater chart                                           */
/* ------------------------------------------------------------------ */

export function DrawdownChart({ data, height = 110 }: { data: BtPoint[]; height?: number }) {
  const [ref, w] = useWidth();
  const [hover, setHover] = React.useState<number | null>(null);
  const min = Math.min(-0.5, ...data.map((d) => d.value)) * 1.12;
  const padL = 8;
  const padR = 52;
  const iw = w - padL - padR;
  const x = (i: number) => padL + (i / (data.length - 1)) * iw;
  const y = (v: number) => 4 + (v / min) * (height - 8);
  const line = data.map((d, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(d.value).toFixed(1)}`).join(" ");
  const area = `${line} L${x(data.length - 1)},${y(0)} L${x(0)},${y(0)} Z`;
  const worst = data.reduce((m, d, i) => (d.value < data[m]!.value ? i : m), 0);
  const h = hover !== null ? data[hover] : null;
  return (
    <div>
    <div className="mb-1 flex items-center justify-between gap-3 px-3">
      <span className="k-label">Drawdown</span>
      <span className="truncate font-mono text-[11px] text-fg-3">
        {h ? (
          <>
            {serverTime(h.time, false)} · <span className="text-down">{h.value.toFixed(2)}%</span>
          </>
        ) : (
          <>
            Max <span className="text-down">{data[worst]!.value.toFixed(2)}%</span> on {serverTime(data[worst]!.time, false)}
          </>
        )}
      </span>
    </div>
    <div ref={ref} className="relative" style={{ height }}>
      <svg
        width={w}
        height={height}
        className="block"
        onMouseMove={(e) => {
          const bx = e.currentTarget.getBoundingClientRect().left;
          const i = Math.round(((e.clientX - bx - padL) / iw) * (data.length - 1));
          setHover(Math.max(0, Math.min(data.length - 1, i)));
        }}
        onMouseLeave={() => setHover(null)}
      >
        <defs>
          <linearGradient id="dd-fill" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0" stopColor="var(--k-down)" stopOpacity="0.05" />
            <stop offset="1" stopColor="var(--k-down)" stopOpacity="0.45" />
          </linearGradient>
        </defs>
        {[0, 0.5, 1].map((f) => (
          <g key={f}>
            <line x1={padL} x2={padL + iw} y1={y(min * f)} y2={y(min * f)} stroke="var(--k-border)" strokeDasharray={f ? "2 4" : undefined} />
            <text x={w - padR + 8} y={y(min * f) + 3.5} className="fill-fg-3 font-mono text-[10px]">
              {(min * f).toFixed(1)}%
            </text>
          </g>
        ))}
        <motion.path key={data.length + (data[worst]?.value ?? 0)} d={area} fill="url(#dd-fill)" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.6 }} />
        <motion.path key={`l${data.length}${data[worst]?.value}`} d={line} fill="none" stroke="var(--k-down)" strokeWidth={1.3} initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 1.1, ease: "easeOut" }} />
        <circle cx={x(worst)} cy={y(data[worst]!.value)} r={3.5} fill="var(--k-bg)" stroke="var(--k-down)" strokeWidth={1.5} />
        {h && hover !== null && (
          <g>
            <line x1={x(hover)} x2={x(hover)} y1={0} y2={height} stroke="var(--k-fg-2)" strokeDasharray="3 3" opacity={0.6} />
            <circle cx={x(hover)} cy={y(h.value)} r={3} fill="var(--k-down)" />
          </g>
        )}
      </svg>
    </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Monthly returns heat table                                          */
/* ------------------------------------------------------------------ */

function heat(v: number, max: number) {
  const pct = Math.round(10 + Math.min(1, Math.abs(v) / max) * 48);
  return `color-mix(in srgb, var(--k-${v >= 0 ? "up" : "down"}) ${pct}%, transparent)`;
}

export function MonthlyReturns({ r }: { r: BacktestResult }) {
  const max = Math.max(1, ...r.monthly.flatMap((y) => y.months.filter((m): m is number => m !== null).map(Math.abs)));
  const cells = r.monthly.flatMap((y) => y.months.filter((m): m is number => m !== null));
  const pos = cells.filter((c) => c > 0).length;
  return (
    <Card className="overflow-hidden">
      <CardHeader
        title="Monthly returns"
        subtitle="% change in equity, compounded"
        action={
          <Chip tone={pos / Math.max(1, cells.length) >= 0.5 ? "up" : "down"}>
            {pos}/{cells.length} green months
          </Chip>
        }
      />
      <div className="overflow-x-auto px-4 pb-5 pt-4 sm:px-6">
        <table className="w-full min-w-[720px] border-separate border-spacing-1 text-center text-[11.5px]">
          <thead>
            <tr className="text-[10.5px] uppercase tracking-[0.05em] text-fg-3">
              <th className="w-14 text-left font-medium">Year</th>
              {MONTH_LABELS.map((m) => (
                <th key={m} className="font-medium">
                  {m}
                </th>
              ))}
              <th className="w-20 font-medium text-fg-2">YTD</th>
            </tr>
          </thead>
          <tbody>
            {r.monthly.map((y, yi) => (
              <tr key={y.year}>
                <td className="text-left font-mono text-[12px] text-fg-2">{y.year}</td>
                {y.months.map((m, mi) => (
                  <td key={mi} className="p-0">
                    {m === null ? (
                      <div className="grid h-9 place-items-center rounded-[8px] border border-dashed border-line text-fg-3/60">—</div>
                    ) : (
                      <motion.div
                        initial={{ opacity: 0, scale: 0.85 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ delay: (yi * 12 + mi) * 0.008, duration: 0.3 }}
                        className={cn("k-num grid h-9 place-items-center rounded-[8px] font-medium", Math.abs(m) / max > 0.45 ? "text-fg" : m >= 0 ? "text-up" : "text-down")}
                        style={{ background: heat(m, max) }}
                        title={`${MONTH_LABELS[mi]} ${y.year}: ${m.toFixed(2)}%`}
                      >
                        {m > 0 ? "+" : ""}
                        {m.toFixed(1)}
                      </motion.div>
                    )}
                  </td>
                ))}
                <td className="p-0">
                  <div className={cn("k-num grid h-9 place-items-center rounded-[8px] border text-[12px] font-semibold", y.ytd >= 0 ? "border-up/30 bg-up-soft text-up" : "border-down/30 bg-down-soft text-down")}>
                    {y.ytd > 0 ? "+" : ""}
                    {y.ytd.toFixed(1)}%
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

/* ------------------------------------------------------------------ */
/* Distribution of returns                                             */
/* ------------------------------------------------------------------ */

export function ReturnDistribution({ r }: { r: BacktestResult }) {
  const [hover, setHover] = React.useState<number | null>(null);
  const bins = r.distribution;
  const max = Math.max(...bins.map((b) => b.count));
  const k = r.kpis;
  const hb = hover !== null ? bins[hover]! : null;
  return (
    <Card className="flex h-full flex-col overflow-hidden">
      <CardHeader title="Distribution of returns" subtitle="Profit per trade, USD" action={<Chip tone={k.expectancy >= 0 ? "up" : "down"}>E = {k.expectancy >= 0 ? "+" : "−"}{formatMoney(Math.abs(k.expectancy))}</Chip>} />
      <div className="flex flex-1 flex-col px-4 pb-5 pt-5 sm:px-6">
        <div className="mb-2 h-4 text-[11.5px] text-fg-3">
          {hb ? (
            <span className="k-num">
              {formatMoney(hb.from, "USD", 0)} → {formatMoney(hb.to, "USD", 0)} · <span className="text-fg">{hb.count} trades</span>
            </span>
          ) : (
            <span>Hover a bar to inspect</span>
          )}
        </div>
        <div className="flex h-40 items-end gap-[3px]" onMouseLeave={() => setHover(null)}>
          {bins.map((b, i) => {
            const loss = b.to <= 0;
            const win = b.from >= 0;
            return (
              <div key={i} className="flex h-full flex-1 items-end" onMouseEnter={() => setHover(i)}>
                <motion.div
                  className={cn("w-full rounded-t-[3px] transition-opacity", loss ? "bg-down" : win ? "bg-up" : "bg-fg-3", hover !== null && hover !== i && "opacity-40")}
                  initial={{ height: 0 }}
                  animate={{ height: `${Math.max(b.count ? 3 : 0.5, (b.count / max) * 100)}%` }}
                  transition={{ duration: 0.6, delay: i * 0.015, ease: [0.16, 1, 0.3, 1] }}
                />
              </div>
            );
          })}
        </div>
        <div className="mt-2 flex justify-between border-t border-line pt-2 font-mono text-[10.5px] text-fg-3">
          <span className="text-down">{formatMoney(bins[0]!.from, "USD", 0)}</span>
          <span>$0</span>
          <span className="text-up">+{formatMoney(bins[bins.length - 1]!.to, "USD", 0)}</span>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-3">
          <div className="k-row px-3.5 py-2.5">
            <div className="text-[10.5px] uppercase tracking-[0.05em] text-fg-3">Avg win</div>
            <Money value={k.avgWin} countUp={false} tone="up" className="mt-0.5 block text-[15px] font-semibold" />
          </div>
          <div className="k-row px-3.5 py-2.5">
            <div className="text-[10.5px] uppercase tracking-[0.05em] text-fg-3">Avg loss</div>
            <Money value={k.avgLoss} countUp={false} tone="down" className="mt-0.5 block text-[15px] font-semibold" />
          </div>
        </div>
      </div>
    </Card>
  );
}

export function TradeStats({ r }: { r: BacktestResult }) {
  const k = r.kpis;
  const h = k.avgHoldMin;
  const hold = h >= 1440 ? `${(h / 1440).toFixed(1)} d` : h >= 60 ? `${Math.floor(h / 60)}h ${Math.round(h % 60)}m` : `${Math.round(h)}m`;
  return (
    <Card className="h-full overflow-hidden">
      <CardHeader title="Trade statistics" subtitle={`${r.params.symbol} · ${r.params.timeframe} · ${r.trades.length} trades`} />
      <KeyValue
        className="px-6 pb-3 pt-2 [&>div]:py-2.5 [&>div]:text-[13px]"
        rows={[
          ["Gross profit", <Money key="gp" value={k.grossProfit} countUp={false} tone="up" />],
          ["Gross loss", <Money key="gl" value={-k.grossLoss} countUp={false} tone="down" />],
          ["Largest win", <Money key="lw" value={k.largestWin} countUp={false} signed tone="up" />],
          ["Largest loss", <Money key="ll" value={k.largestLoss} countUp={false} tone="down" />],
          ["Max consecutive wins / losses", <span key="c">{k.maxConsecWins} / <span className="text-down">{k.maxConsecLosses}</span></span>],
          ["Recovery factor", k.recoveryFactor.toFixed(2)],
          ["Avg holding time", hold],
          ["Commission & spread", <Money key="cm" value={-k.commission} countUp={false} className="text-fg-2" />],
        ]}
      />
    </Card>
  );
}

/* ------------------------------------------------------------------ */
/* Trade list                                                          */
/* ------------------------------------------------------------------ */

export function TradesTable({ r }: { r: BacktestResult }) {
  const digits = getInstrument(r.params.symbol).digits;
  const columns: Column<BtTrade>[] = [
    { key: "ticket", header: "Ticket", cell: (t) => <span className="font-mono text-[12.5px] text-fg-2">#{t.ticket}</span> },
    { key: "open", header: "OPEN TIME", cell: (t) => <span className="k-num whitespace-nowrap text-fg-2">{serverTime(t.openTime)}</span>, sort: (t) => t.openTime },
    { key: "close", header: "Close time", cell: (t) => <span className="k-num whitespace-nowrap text-fg-3">{serverTime(t.closeTime)}</span>, hideOn: "lg" },
    {
      key: "side",
      header: "Side",
      cell: (t) => (
        <Chip size="sm" tone={t.side === "buy" ? "up" : "down"}>
          {t.side.toUpperCase()}
        </Chip>
      ),
    },
    { key: "lots", header: "LOTS", align: "right", cell: (t) => <span className="k-num">{t.lots.toFixed(2)}</span>, sort: (t) => t.lots },
    { key: "entry", header: "Entry", align: "right", cell: (t) => <span className="k-num font-mono text-[12.5px]">{t.entry.toFixed(digits)}</span>, hideOn: "md" },
    { key: "exit", header: "Exit", align: "right", cell: (t) => <span className="k-num font-mono text-[12.5px]">{t.exit.toFixed(digits)}</span>, hideOn: "md" },
    { key: "pips", header: "PIPS", align: "right", cell: (t) => <span className={cn("k-num", t.pips >= 0 ? "text-up" : "text-down")}>{t.pips > 0 ? "+" : ""}{t.pips.toFixed(1)}</span>, sort: (t) => t.pips },
    { key: "profit", header: "PROFIT", align: "right", cell: (t) => <Money value={t.profit} signed tone="auto" countUp={false} className="font-medium" />, sort: (t) => t.profit },
  ];
  return (
    <Card className="overflow-hidden">
      <CardHeader title="Trade list" subtitle={`${r.trades.length} simulated fills · newest first · server time GMT+3`} />
      <div className="px-3 pb-5 pt-4 sm:px-6">
        <DataTable
          columns={columns}
          rows={r.trades}
          rowKey={(t) => t.ticket}
          pageSize={10}
          dense
          search={(t) => `${t.ticket} ${t.side} ${t.symbol}`}
          searchPlaceholder="Ticket or side…"
          exportName={`backtest-${r.params.symbol.toLowerCase()}-${r.seed}`}
        />
      </div>
    </Card>
  );
}

/* ------------------------------------------------------------------ */
/* Monte Carlo robustness                                              */
/* ------------------------------------------------------------------ */

export function MonteCarloCard({ r }: { r: BacktestResult }) {
  const mc = React.useMemo(() => monteCarlo(r), [r]);
  const [ref, w] = useWidth(300);
  const H = 120;
  const all = mc.curves.flat();
  const lo = Math.min(...all, r.params.balance);
  const hi = Math.max(...all);
  const y = (v: number) => 6 + ((hi - v) / (hi - lo || 1)) * (H - 12);
  const stats: { label: string; value: string; tone?: string }[] = [
    { label: "Prob. of profit", value: `${mc.probProfit.toFixed(1)}%`, tone: mc.probProfit >= 80 ? "text-up" : mc.probProfit >= 50 ? "text-gold" : "text-down" },
    { label: "Median return", value: `${mc.medianReturn >= 0 ? "+" : ""}${mc.medianReturn.toFixed(1)}%`, tone: mc.medianReturn >= 0 ? "text-up" : "text-down" },
    { label: "5th pct return", value: `${mc.p5Return >= 0 ? "+" : ""}${mc.p5Return.toFixed(1)}%` },
    { label: "95% worst DD", value: `${mc.worstDd95.toFixed(1)}%`, tone: "text-down" },
    { label: "Median DD", value: `${mc.medianDd.toFixed(1)}%` },
    { label: "Risk of ruin", value: `${mc.ruin.toFixed(1)}%`, tone: mc.ruin > 5 ? "text-down" : "text-up" },
  ];
  return (
    <Card className="overflow-hidden">
      <CardHeader title="Monte Carlo" subtitle={`${mc.sims} reshuffles · ±15% fill noise`} action={<Chip tone={mc.probProfit >= 80 ? "up" : mc.probProfit >= 50 ? "gold" : "down"}>{mc.probProfit >= 80 ? "Robust" : mc.probProfit >= 50 ? "Fragile" : "Unstable"}</Chip>} />
      <div ref={ref} className="relative mx-4 mt-4 sm:mx-5" style={{ height: H }}>
        <div className="k-dotgrid absolute inset-0 rounded-lg opacity-60" />
        <svg width={w} height={H} className="relative block">
          <line x1={0} x2={w} y1={y(r.params.balance)} y2={y(r.params.balance)} stroke="var(--k-fg-3)" strokeDasharray="3 4" opacity={0.6} />
          {mc.curves.map((c, i) => (
            <motion.path
              key={`${r.seed}-${i}`}
              d={c.map((v, k) => `${k ? "L" : "M"}${((k / (c.length - 1)) * w).toFixed(1)},${y(v).toFixed(1)}`).join(" ")}
              fill="none"
              stroke={c[c.length - 1]! >= r.params.balance ? "var(--k-gold)" : "var(--k-down)"}
              strokeWidth={1}
              opacity={0.35}
              initial={{ pathLength: 0 }}
              animate={{ pathLength: 1 }}
              transition={{ duration: 1, delay: i * 0.02 }}
            />
          ))}
        </svg>
      </div>
      <div className="grid grid-cols-2 gap-2 px-4 pb-5 pt-4 sm:grid-cols-3 sm:px-5 xl:grid-cols-2">
        {stats.map((s) => (
          <div key={s.label} className="k-row px-3 py-2">
            <div className="truncate text-[10px] uppercase tracking-[0.05em] text-fg-3">{s.label}</div>
            <div className={cn("k-num mt-0.5 text-[14.5px] font-semibold", s.tone)}>{s.value}</div>
          </div>
        ))}
      </div>
    </Card>
  );
}
