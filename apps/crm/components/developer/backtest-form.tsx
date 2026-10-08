"use client";

import * as React from "react";
import { AnimatePresence, motion } from "motion/react";
import { CalendarDays, ChevronDown, Cpu, Play, Check } from "lucide-react";
import { Button, Card, CardHeader, Chip, Field, Input, Menu, Segmented, SymbolAvatar, cn, formatMoney } from "@/components/kit";
import { INSTRUMENTS } from "@ezymex/mock";
import { BACKTEST_STRATEGIES, COST_MODELS, TIMEFRAMES, formatDateLabel, type BacktestParams, type BacktestResult, type PastRun } from "@ezymex/mock/algo";

const selectCls = "flex h-11 w-full items-center gap-2.5 rounded-[14px] border border-line bg-surface-2 px-3.5 text-left text-sm transition hover:border-[var(--k-border-top)] outline-none focus-visible:border-ember/50";

const RANGES: { label: string; from: string }[] = [
  { label: "3M", from: "2026-06-01" },
  { label: "6M", from: "2026-03-01" },
  { label: "1Y", from: "2025-09-01" },
  { label: "2Y", from: "2024-09-01" },
  { label: "Max", from: "2024-01-01" },
];

const SYMBOLS = INSTRUMENTS.filter((i) => i.assetClass !== "stocks");

export function BacktestForm({
  params,
  onChange,
  onRun,
  running,
  progress,
  stage,
}: {
  params: BacktestParams;
  onChange: (p: BacktestParams) => void;
  onRun: () => void;
  running: boolean;
  progress: number;
  stage: string;
}) {
  const strat = BACKTEST_STRATEGIES.find((s) => s.id === params.strategyId)!;
  const cost = COST_MODELS.find((c) => c.value === params.costModel)!;
  const set = (p: Partial<BacktestParams>) => onChange({ ...params, ...p });
  const activeRange = params.to === "2026-08-31" ? RANGES.find((r) => r.from === params.from)?.label : undefined;
  return (
    <Card className="overflow-hidden">
      <CardHeader title="New backtest" subtitle="M1 bars · tick-reconstructed fills" icon={<Cpu />} />
      <div className="mt-4 space-y-4 px-4 pb-5 sm:px-5">
        <Field label="Strategy">
          <Menu
            align="start"
            width={300}
            trigger={
              <button type="button" className={selectCls}>
                <SymbolAvatar symbol={strat.symbol} size={20} />
                <span className="min-w-0 flex-1 truncate">{strat.name}</span>
                <ChevronDown className="size-4 text-fg-3" />
              </button>
            }
            items={BACKTEST_STRATEGIES.map((s) => ({
              label: s.name,
              icon: <SymbolAvatar symbol={s.symbol} size={16} />,
              hint: s.id === params.strategyId ? <Check className="size-3.5 text-ember" /> : `${s.symbol} ${s.timeframe}`,
              onSelect: () => set({ strategyId: s.id, symbol: s.symbol, timeframe: s.timeframe }),
            }))}
          />
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Symbol">
            <Menu
              align="start"
              width={240}
              trigger={
                <button type="button" className={selectCls}>
                  <SymbolAvatar symbol={params.symbol} size={18} />
                  <span className="min-w-0 flex-1 truncate font-medium">{params.symbol}</span>
                  <ChevronDown className="size-4 text-fg-3" />
                </button>
              }
              items={SYMBOLS.map((i) => ({ label: i.symbol, icon: <SymbolAvatar symbol={i.symbol} size={16} />, hint: i.symbol === params.symbol ? <Check className="size-3.5 text-ember" /> : i.assetClass, onSelect: () => set({ symbol: i.symbol }) }))}
            />
          </Field>
          <Field label="Initial balance">
            <Input
              leading={<span className="text-[13px]">$</span>}
              value={params.balance.toLocaleString("en-US")}
              inputMode="numeric"
              inputClassName="k-num"
              onChange={(e) => {
                const n = parseInt(e.target.value.replace(/\D/g, "") || "0", 10);
                set({ balance: Math.min(10_000_000, n) });
              }}
            />
          </Field>
        </div>

        <Field label="Timeframe">
          <Segmented size="xs" value={params.timeframe} onChange={(v) => set({ timeframe: v })} options={TIMEFRAMES} className="flex w-full justify-between" />
        </Field>

        <Field label="Date range" hint={<span className="font-mono">{formatDateLabel(params.from)} → {formatDateLabel(params.to)}</span>}>
          <div className="grid grid-cols-2 gap-2">
            <Input type="date" value={params.from} min="2019-01-01" max={params.to} onChange={(e) => e.target.value && set({ from: e.target.value })} leading={<CalendarDays />} className="h-10 px-3 text-[12.5px]" inputClassName="[color-scheme:dark] k-num" />
            <Input type="date" value={params.to} min={params.from} max="2026-09-23" onChange={(e) => e.target.value && set({ to: e.target.value })} leading={<CalendarDays />} className="h-10 px-3 text-[12.5px]" inputClassName="[color-scheme:dark] k-num" />
          </div>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {RANGES.map((r) => (
              <button
                key={r.label}
                type="button"
                onClick={() => set({ from: r.from, to: "2026-08-31" })}
                className={cn("rounded-full border px-2.5 py-1 text-[11.5px] font-medium transition", activeRange === r.label ? "border-ember/40 bg-ember-soft text-ember" : "border-line bg-surface-2 text-fg-3 hover:text-fg")}
              >
                {r.label}
              </button>
            ))}
          </div>
        </Field>

        <Field label="Spread & commission">
          <Menu
            align="start"
            width={300}
            trigger={
              <button type="button" className={cn(selectCls, "h-auto py-2.5")}>
                <span className="min-w-0 flex-1">
                  <span className="block truncate">{cost.label}</span>
                  <span className="block truncate text-[11px] text-fg-3">{cost.hint}</span>
                </span>
                <ChevronDown className="size-4 text-fg-3" />
              </button>
            }
            items={COST_MODELS.map((c) => ({ label: c.label, hint: c.value === params.costModel ? <Check className="size-3.5 text-ember" /> : undefined, onSelect: () => set({ costModel: c.value }) }))}
          />
        </Field>

        <AnimatePresence initial={false}>
          {running && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
              <div className="k-row px-3.5 py-3">
                <div className="mb-2 flex items-center justify-between text-[12px]">
                  <span className="truncate text-fg-2">{stage}</span>
                  <span className="k-num text-ember">{Math.round(progress)}%</span>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-surface-3">
                  <div className="h-full rounded-full bg-gradient-to-r from-ember-2 to-ember" style={{ width: `${progress}%` }} />
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <Button variant="ember" size="lg" shimmer className="w-full" onClick={onRun} disabled={running}>
          <Play /> {running ? "Running…" : "Run backtest"}
        </Button>
      </div>
    </Card>
  );
}

export function PastRuns({ runs, results, active, onPick }: { runs: PastRun[]; results: Record<string, BacktestResult>; active: string; onPick: (id: string) => void }) {
  return (
    <Card className="overflow-hidden">
      <CardHeader title="Past runs" subtitle={`${runs.length} runs · kept for 90 days`} />
      <div className="mt-4 space-y-2 px-3 pb-4 sm:px-4">
        <AnimatePresence initial={false}>
          {runs.map((run) => {
            const res = results[run.id]!;
            const strat = BACKTEST_STRATEGIES.find((s) => s.id === run.params.strategyId)!;
            const on = run.id === active;
            return (
              <motion.button
                layout
                key={run.id}
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                type="button"
                onClick={() => onPick(run.id)}
                className={cn("k-row relative flex w-full items-center gap-3 overflow-hidden px-3 py-2.5 text-left transition hover:border-[var(--k-border-top)] hover:bg-surface-3/60", on && "border-ember/40 bg-ember-soft/40")}
              >
                {on && <span className="absolute inset-y-2 left-0 w-[3px] rounded-r-full bg-ember" />}
                <SymbolAvatar symbol={run.params.symbol} size={24} />
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-1.5">
                    <span className="truncate text-[13px] font-medium">{strat.name.replace(" (template)", "")}</span>
                  </span>
                  <span className="mt-0.5 block truncate font-mono text-[10.5px] text-fg-3">
                    {run.params.symbol} · {run.params.timeframe} · {run.created}
                  </span>
                </span>
                <span className="text-right">
                  <span className={cn("k-num block text-[12.5px] font-semibold", res.kpis.netProfit >= 0 ? "text-up" : "text-down")}>
                    {res.kpis.netProfit >= 0 ? "+" : "−"}
                    {formatMoney(Math.abs(res.kpis.netProfit), "USD", 0)}
                  </span>
                  <span className="k-num block text-[10.5px] text-fg-3">PF {res.kpis.profitFactor.toFixed(2)}</span>
                </span>
              </motion.button>
            );
          })}
        </AnimatePresence>
      </div>
      <div className="flex items-center justify-between border-t border-line px-5 py-3 text-[11.5px] text-fg-3">
        <span>Compute quota</span>
        <span className="flex items-center gap-2">
          <span className="k-num text-fg-2">{runs.length * 3 + 14}/200 runs</span>
          <Chip size="sm" tone="gold">
            Pro
          </Chip>
        </span>
      </div>
    </Card>
  );
}
