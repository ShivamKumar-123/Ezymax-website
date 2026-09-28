"use client";

import * as React from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "motion/react";
import { ArrowUpRight, Code2, Copy, Download, FlaskConical, LayoutGrid, MoreHorizontal, Pencil, Play, RotateCcw, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";
import { Button, Card, Chip, IconButton, Menu, PageHeader, Reveal, Segmented, Sparkline, SymbolAvatar, cn } from "@kalks/ui";
import { hashString } from "@kalks/mock";
import { MY_STRATEGIES, SESSIONS, TEMPLATES, cloneRules, generateCode, runBacktest, slugify, type StrategyRules } from "@kalks/mock/algo";
import { RulesSentence, VisualBuilder } from "@/components/developer/strategy-builder";
import { CodeEditor } from "@/components/developer/strategy-code";
import { ExecutionFilters, SignalPreview } from "@/components/developer/strategy-preview";
import { AiAssistant } from "@/components/developer/strategy-ai";
import { AlgoStatsStrip, DeployCard, MyStrategiesCard, SignalsCard, TemplatesCard } from "@/components/developer/strategy-panels";

type Mode = "visual" | "code";

function QuickEstimate({ rules, templateId }: { rules: StrategyRules; templateId: string }) {
  const seed = hashString(generateCode(rules));
  const res = React.useMemo(
    () => runBacktest({ strategyId: templateId, symbol: rules.symbol, timeframe: rules.timeframe, from: "2026-06-24", to: "2026-09-23", balance: 10000, costModel: "raw" }, seed),
    [templateId, rules.symbol, rules.timeframe, seed],
  );
  const k = res.kpis;
  const stats = [
    { label: "Net return", value: `${k.returnPct >= 0 ? "+" : ""}${k.returnPct.toFixed(1)}%`, tone: k.returnPct >= 0 ? "text-up" : "text-down" },
    { label: "Win rate", value: `${k.winRate.toFixed(1)}%`, tone: "text-fg" },
    { label: "Profit factor", value: k.profitFactor.toFixed(2), tone: k.profitFactor >= 1 ? "text-fg" : "text-down" },
    { label: "Max DD", value: `${k.maxDdPct.toFixed(1)}%`, tone: "text-down" },
    { label: "Trades", value: String(k.trades), tone: "text-fg" },
  ];
  const eq = res.equity.filter((_, i) => i % 2 === 0).map((p) => p.value);
  return (
    <div className="k-row px-4 py-4">
      <div className="flex items-center gap-3">
        <span className="grid size-9 shrink-0 place-items-center rounded-full border border-gold/30 bg-gold-soft text-gold">
          <FlaskConical className="size-4" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="text-[13px] font-medium">Quick estimate</div>
          <div className="truncate text-[11px] text-fg-3">Last 90 days · M1 data · $10,000 · raw spread</div>
        </div>
        <Sparkline key={seed} data={eq} width={110} height={30} tone={k.netProfit >= 0 ? "gold" : "down"} className="hidden sm:block" />
        <Link href="/developer/backtests">
          <Button size="xs" variant="surface">
            Full backtest <ArrowUpRight />
          </Button>
        </Link>
      </div>
      <div className="mt-3.5 grid grid-cols-3 gap-2 sm:grid-cols-5">
        {stats.map((s) => (
          <motion.div key={s.label + s.value} initial={{ opacity: 0.4, y: 3 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }} className="rounded-[10px] bg-surface/70 px-3 py-2">
            <div className="truncate text-[10px] uppercase tracking-[0.05em] text-fg-3">{s.label}</div>
            <div className={cn("k-num mt-0.5 text-[15px] font-semibold", s.tone)}>{s.value}</div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}

export default function StrategyBuilderPage() {
  const first = MY_STRATEGIES[0]!;
  const [active, setActive] = React.useState<string>(first.id);
  const [baseTpl, setBaseTpl] = React.useState(first.templateId);
  const [rules, setRulesState] = React.useState<StrategyRules>(() => cloneRules(first.rules));
  const [prev, setPrev] = React.useState<StrategyRules | null>(null);
  const [mode, setMode] = React.useState<Mode>("visual");
  const [draft, setDraft] = React.useState<string | null>(null);
  const code = draft ?? generateCode(rules);
  const mine = MY_STRATEGIES.find((s) => s.id === active);

  const setRules = (r: StrategyRules) => {
    setRulesState(r);
    setDraft(null);
  };

  const load = (id: string) => {
    const t = TEMPLATES.find((x) => x.id === id);
    const s = MY_STRATEGIES.find((x) => x.id === id);
    const next = t ? t.rules : s!.rules;
    setPrev(rules);
    setActive(id);
    setBaseTpl(t ? t.id : s!.templateId);
    setRules(cloneRules(next));
    toast(`Loaded “${next.name}”`, { description: t ? `${t.name} template · ${next.conditions.length + 2} blocks` : `${s!.status === "running" ? "Running" : "Paused"} on #${s!.login}` });
  };

  const newStrategy = () => {
    setPrev(rules);
    setActive("new");
    setBaseTpl("ma-cross");
    setRules({ ...cloneRules(TEMPLATES[0]!.rules), name: "Untitled strategy", conditions: [cloneRules(TEMPLATES[0]!.rules).conditions[0]!] });
    setMode("visual");
    toast.success("New strategy created", { description: "Start with a trigger and add conditions" });
  };

  const fileName = `${slugify(rules.name)}.kst`;

  return (
    <>
      <PageHeader
        title="Strategy builder"
        subtitle="Build rules visually, in code, or just describe them — then run them 24/7 on our servers."
        actions={
          <>
            <Button variant="surface" onClick={() => toast("Import a .kst or MQL5 file", { description: "Drag a file here or pick from disk · max 1 MB" })}>
              <Upload /> Import
            </Button>
            <Link href="/developer/backtests">
              <Button variant="surface">
                <FlaskConical /> Backtests
              </Button>
            </Link>
            <Button variant="ember" shimmer onClick={() => document.getElementById("deploy")?.scrollIntoView({ behavior: "smooth", block: "center" })}>
              <Play /> Deploy
            </Button>
          </>
        }
      />

      <Reveal>
        <AlgoStatsStrip />
      </Reveal>

      <div className="mt-5 grid grid-cols-1 gap-5 lg:grid-cols-[272px_minmax(0,1fr)] xl:grid-cols-[272px_minmax(0,1fr)_340px]">
        {/* left */}
        <Reveal delay={0.05} className="order-2 space-y-5 lg:order-1">
          <TemplatesCard active={active} onPick={load} />
          <MyStrategiesCard active={active} onPick={load} onNew={newStrategy} />
        </Reveal>

        {/* center */}
        <Reveal delay={0.1} className="order-1 min-w-0 lg:order-2">
          <Card className="overflow-hidden">
            <div className="flex flex-col gap-4 px-4 pt-5 sm:px-6 md:flex-row md:items-start md:justify-between">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <label className="group relative flex min-w-0 items-center gap-2">
                    <input
                      value={rules.name}
                      onChange={(e) => setRulesState({ ...rules, name: e.target.value })}
                      aria-label="Strategy name"
                      className="min-w-0 max-w-full truncate rounded-lg bg-transparent py-0.5 text-[20px] font-medium tracking-tight text-fg outline-none transition focus:bg-surface-2 focus:px-2"
                      style={{ width: `${Math.max(8, rules.name.length + 1)}ch` }}
                    />
                    <Pencil className="size-3.5 shrink-0 text-fg-3 opacity-0 transition group-hover:opacity-100" />
                  </label>
                </div>
                <div className="mt-1.5 flex flex-wrap items-center gap-2 text-[12px] text-fg-3">
                  <SymbolAvatar symbol={rules.symbol} size={16} />
                  <span className="font-mono text-fg-2">
                    {rules.symbol} · {rules.timeframe}
                  </span>
                  <span>·</span>
                  <span>{SESSIONS.find((s) => s.value === rules.session)!.label}</span>
                  {mine ? <Chip size="sm" tone={mine.status === "running" ? "ember" : "neutral"} dot>{mine.status === "running" ? `Running · #${mine.login}` : "Paused"}</Chip> : <Chip size="sm" tone="gold">Draft</Chip>}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Segmented
                  size="sm"
                  value={mode}
                  onChange={setMode}
                  options={[
                    { value: "visual", label: <><LayoutGrid className="size-3.5" /> Visual</> },
                    { value: "code", label: <><Code2 className="size-3.5" /> Code</> },
                  ]}
                />
                <Menu
                  trigger={
                    <IconButton size="sm" aria-label="More">
                      <MoreHorizontal />
                    </IconButton>
                  }
                  items={[
                    { label: "Duplicate", icon: <Copy />, onSelect: () => toast.success(`“${rules.name} (copy)” created`) },
                    { label: "Export .kst", icon: <Download />, onSelect: () => toast.success(`${fileName} downloaded`, { description: `${code.split("\n").length} lines` }) },
                    {
                      label: "Undo last load",
                      icon: <RotateCcw />,
                      onSelect: () => (prev ? (setRules(prev), setPrev(null), toast("Previous rules restored")) : toast("Nothing to undo")),
                    },
                    "sep",
                    { label: "Delete strategy", icon: <Trash2 />, danger: true, onSelect: () => toast.error("Stop the strategy before deleting it") },
                  ]}
                />
              </div>
            </div>

            <div className="mx-4 mt-4 rounded-[14px] border border-line bg-surface-2/50 px-4 py-2.5 sm:mx-6">
              <RulesSentence rules={rules} />
            </div>

            <div className="px-4 pb-5 pt-4 sm:px-6">
              <AnimatePresence mode="wait" initial={false}>
                <motion.div key={mode} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.22 }}>
                  {mode === "visual" ? (
                    <VisualBuilder rules={rules} onChange={setRules} />
                  ) : (
                    <CodeEditor code={code} generated={draft === null} fileName={fileName} onChange={setDraft} onReset={() => (setDraft(null), toast("Code regenerated from visual rules"))} />
                  )}
                </motion.div>
              </AnimatePresence>
              <div className="mt-4 space-y-4">
                <SignalPreview rules={rules} />
                <QuickEstimate rules={rules} templateId={baseTpl} />
                <div>
                  <div className="mb-2.5 flex items-center justify-between">
                    <span className="k-label">Execution filters</span>
                    <span className="text-[11px] text-fg-3">Applied by the server engine</span>
                  </div>
                  <ExecutionFilters />
                </div>
              </div>
            </div>
          </Card>
        </Reveal>

        {/* right */}
        <Reveal delay={0.15} className="order-3 grid grid-cols-1 gap-5 md:grid-cols-2 lg:col-span-2 xl:col-span-1 xl:grid-cols-1 xl:content-start">
          <AiAssistant
            onApply={(r, tpl) => {
              setPrev(rules);
              setRules(r);
              setBaseTpl(tpl);
              setActive(tpl);
              setMode("visual");
            }}
            onUndo={() => prev && (setRules(prev), setPrev(null))}
          />
          <div id="deploy" className="space-y-5">
            <DeployCard rules={rules} initialRunning={mine?.status === "running"} initialLogin={mine?.login} />
            <SignalsCard />
          </div>
        </Reveal>
      </div>
    </>
  );
}
