"use client";

import * as React from "react";
import Link from "next/link";
import { ChevronDown, FlaskConical, Plus, Save, Server, ShieldAlert, Check } from "lucide-react";
import { toast } from "sonner";
import { Button, Card, CardHeader, Chip, Field, Icon3D, Input, Menu, Money, Sparkline, StatusChip, SymbolAvatar, Toggle, cn } from "@/components/kit";
import { ACCOUNTS } from "@kalks/mock";
import { LIVE_SIGNALS, MY_STRATEGIES, TEMPLATES, type StrategyRules } from "@kalks/mock/algo";

/* ------------------------------------------------------------------ */
/* Templates + my strategies (left column)                             */
/* ------------------------------------------------------------------ */

export function TemplatesCard({ active, onPick }: { active: string; onPick: (id: string) => void }) {
  return (
    <Card className="overflow-hidden">
      <CardHeader title="Templates" subtitle="Start from a proven setup" />
      <div className="mt-4 space-y-2 px-3 pb-4 sm:px-4">
        {TEMPLATES.map((t) => {
          const on = active === t.id;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => onPick(t.id)}
              className={cn(
                "k-row relative flex w-full items-start gap-3 overflow-hidden px-3 py-3 text-left transition-all hover:border-[var(--k-border-top)] hover:bg-surface-3/60",
                on && "border-ember/40 bg-ember-soft/40 shadow-[0_0_0_1px_color-mix(in_oklab,var(--k-ember)_15%,transparent),0_12px_30px_-18px_color-mix(in_oklab,var(--k-ember)_60%,transparent)]",
              )}
            >
              {on && <span className="absolute inset-y-2 left-0 w-[3px] rounded-r-full bg-ember" />}
              <span className="grid size-10 shrink-0 place-items-center rounded-xl border border-line bg-surface">
                <Icon3D name={t.icon} size={26} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex items-center justify-between gap-2">
                  <span className="truncate text-[13.5px] font-medium text-fg">{t.name}</span>
                  <Chip size="sm" tone={t.profile.winRate >= 0.6 ? "up" : t.profile.winRate >= 0.5 ? "gold" : "neutral"}>
                    {Math.round(t.profile.winRate * 100)}% win
                  </Chip>
                </span>
                <span className="mt-0.5 line-clamp-2 block text-[11.5px] leading-snug text-fg-3">{t.description}</span>
                <span className="mt-1.5 flex items-center gap-1.5 whitespace-nowrap text-[10.5px] text-fg-3">
                  <SymbolAvatar symbol={t.rules.symbol} size={13} />
                  <span className="font-mono text-fg-2">
                    {t.rules.symbol} · {t.rules.timeframe}
                  </span>
                  <span className="truncate">· {t.short}</span>
                </span>
              </span>
            </button>
          );
        })}
      </div>
    </Card>
  );
}

export function MyStrategiesCard({ active, onPick, onNew }: { active: string; onPick: (id: string) => void; onNew: () => void }) {
  return (
    <Card className="overflow-hidden">
      <CardHeader
        title="My strategies"
        subtitle={`${MY_STRATEGIES.filter((s) => s.status === "running").length} running · ${MY_STRATEGIES.length} total`}
        action={
          <Button size="xs" variant="surface" onClick={onNew}>
            <Plus /> New
          </Button>
        }
      />
      <div className="mt-4 space-y-2 px-3 pb-4 sm:px-4">
        {MY_STRATEGIES.map((s) => {
          const on = active === s.id;
          return (
            <button
              key={s.id}
              type="button"
              onClick={() => onPick(s.id)}
              className={cn("k-row flex w-full items-center gap-3 px-3 py-2.5 text-left transition-all hover:border-[var(--k-border-top)] hover:bg-surface-3/60", on && "border-ember/40 bg-ember-soft/40")}
            >
              <SymbolAvatar symbol={s.rules.symbol} size={24} />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[13px] font-medium">{s.name}</span>
                <span className="mt-0.5 flex items-center gap-1.5">
                  <StatusChip status={s.status} />
                </span>
              </span>
              <span className="text-right">
                <Sparkline data={s.spark} width={52} height={18} className="ml-auto" />
                <Money value={s.pnlTotal} signed tone="auto" countUp={false} className="mt-0.5 block text-[11.5px]" />
              </span>
            </button>
          );
        })}
      </div>
    </Card>
  );
}

/* ------------------------------------------------------------------ */
/* Deploy                                                              */
/* ------------------------------------------------------------------ */

function useUptime(on: boolean) {
  const [s, setS] = React.useState(0);
  React.useEffect(() => {
    if (!on) {
      setS(0);
      return;
    }
    const t = setInterval(() => setS((x) => x + 1), 1000);
    return () => clearInterval(t);
  }, [on]);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(Math.floor(s / 3600))}:${p(Math.floor(s / 60) % 60)}:${p(s % 60)}`;
}

export function DeployCard({ rules, initialRunning, initialLogin }: { rules: StrategyRules; initialRunning: boolean; initialLogin?: string }) {
  const [login, setLogin] = React.useState(initialLogin ?? ACCOUNTS[0]!.login);
  const [running, setRunning] = React.useState(initialRunning);
  const [maxLoss, setMaxLoss] = React.useState("500");
  const [maxPos, setMaxPos] = React.useState("3");
  React.useEffect(() => setRunning(initialRunning), [initialRunning, rules.name]);
  React.useEffect(() => {
    if (initialLogin) setLogin(initialLogin);
  }, [initialLogin]);
  const acc = ACCOUNTS.find((a) => a.login === login)!;
  const uptime = useUptime(running);

  return (
    <Card hot={running} className="overflow-hidden">
      <CardHeader
        title="Deploy"
        subtitle="Runs server-side, even when you're offline"
        action={running ? <Chip tone="ember" dot className="animate-pulse">Live</Chip> : <Chip tone="neutral" dot>Stopped</Chip>}
      />
      <div className="mt-4 space-y-3 px-4 pb-5 sm:px-5">
        <Field label="Trading account">
          <Menu
            align="start"
            width={300}
            trigger={
              <button type="button" className="flex h-12 w-full items-center gap-3 rounded-[14px] border border-line bg-surface-2 px-3.5 text-left transition hover:border-[var(--k-border-top)]">
                <Chip size="sm" tone={acc.type === "live" ? "ember" : "gold"}>
                  {acc.type.toUpperCase()}
                </Chip>
                <span className="min-w-0 flex-1">
                  <span className="block font-mono text-[13px] text-fg">#{acc.login}</span>
                  <span className="block truncate text-[11px] text-fg-3">
                    {acc.group} · {acc.server}
                  </span>
                </span>
                <Money value={acc.cent ? acc.equity / 100 : acc.equity} countUp={false} className="text-[12.5px] text-fg-2" />
                <ChevronDown className="size-4 text-fg-3" />
              </button>
            }
            items={ACCOUNTS.map((a) => ({
              label: (
                <span className="flex items-center gap-2">
                  <span className="font-mono">#{a.login}</span>
                  <span className="text-[11px] text-fg-3">
                    {a.type === "live" ? "Live" : "Demo"} · {a.group}
                  </span>
                </span>
              ),
              hint: a.login === login ? <Check className="size-3.5 text-ember" /> : a.server.replace("Kalks-", ""),
              onSelect: () => {
                setLogin(a.login);
                if (running) toast(`Strategy moved to #${a.login}`, { description: `${a.server} · restarts on next bar` });
              },
            }))}
          />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Max daily loss">
            <Input leading={<span className="text-[13px]">$</span>} value={maxLoss} onChange={(e) => setMaxLoss(e.target.value.replace(/[^\d.]/g, ""))} inputMode="decimal" className="h-10" inputClassName="k-num" />
          </Field>
          <Field label="Max positions">
            <Input value={maxPos} onChange={(e) => setMaxPos(e.target.value.replace(/\D/g, ""))} inputMode="numeric" className="h-10" inputClassName="k-num" trailing={<span className="text-[11px]">open</span>} />
          </Field>
        </div>

        <div className={cn("k-row flex items-center gap-3 px-3.5 py-3", running && "border-ember/30")}>
          <span className={cn("grid size-9 shrink-0 place-items-center rounded-full border", running ? "border-ember/40 bg-ember-soft text-ember" : "border-line bg-surface text-fg-3")}>
            <Server className="size-4" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-[13px] font-medium">{running ? "Running 24/7" : "Run 24/7 on server"}</span>
            <span className="block truncate font-mono text-[11px] text-fg-3">{running ? `${acc.server} · uptime ${uptime}` : `${acc.server} · LD4 · 3 ms to LP`}</span>
          </span>
          <Toggle
            checked={running}
            label="Run strategy"
            onChange={(v) => {
              setRunning(v);
              if (v) toast.success(`Running 24/7 on ${acc.server}`, { description: `${rules.name} · #${acc.login} · max loss $${maxLoss || 0}/day · ${maxPos || 0} positions` });
              else toast("Strategy stopped", { description: "Open positions are kept · no new entries" });
            }}
          />
        </div>

        <div className="flex items-center gap-2 rounded-[12px] border border-warn/20 bg-warn-soft px-3 py-2 text-[11.5px] text-warn">
          <ShieldAlert className="size-3.5 shrink-0" />
          Kill-switch stops trading at −${maxLoss || 0} equity for the day.
        </div>

        <div className="grid grid-cols-2 gap-2 pt-1">
          <Link href="/developer/backtests" className="contents">
            <Button variant="surface" className="w-full">
              <FlaskConical /> Backtest
            </Button>
          </Link>
          <Button variant="ember" className="w-full" onClick={() => toast.success("Strategy saved", { description: `${rules.name} · version 7` })}>
            <Save /> Save
          </Button>
        </div>
      </div>
    </Card>
  );
}

/* ------------------------------------------------------------------ */
/* Live signals strip                                                  */
/* ------------------------------------------------------------------ */

export function SignalsCard() {
  return (
    <Card className="overflow-hidden">
      <CardHeader
        title={
          <span className="flex items-center gap-2">
            Last signals
            <span className="relative flex size-2">
              <span className="absolute inline-flex size-full animate-ping rounded-full bg-up opacity-60" />
              <span className="relative inline-flex size-2 rounded-full bg-up" />
            </span>
          </span>
        }
        subtitle="Today · server time GMT+3"
        action={
          <Link href="/portfolio/history">
            <Button size="xs" variant="ghost">
              History
            </Button>
          </Link>
        }
      />
      <div className="k-fade-bottom mt-3 space-y-1.5 px-3 pb-4 sm:px-4">
        {LIVE_SIGNALS.map((s) => (
          <div key={s.id} className="k-row flex items-center gap-2.5 px-3 py-2">
            <SymbolAvatar symbol={s.symbol} size={20} />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5 text-[12px]">
                <span className="font-medium">{s.symbol}</span>
                <span className={cn("rounded px-1 text-[10px] font-semibold uppercase", s.side === "buy" ? "bg-up-soft text-up" : "bg-down-soft text-down")}>{s.side}</span>
                <span className="k-num text-fg-3">{s.lots}</span>
              </div>
              <div className="truncate text-[10.5px] text-fg-3">{s.note}</div>
            </div>
            <div className="text-right">
              <div className="font-mono text-[10.5px] text-fg-3">{s.time}</div>
              <div className={cn("text-[10.5px] font-medium capitalize", s.status === "filled" ? "text-ember" : s.status === "closed" ? "text-up" : "text-fg-3")}>{s.status}</div>
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}

/* ------------------------------------------------------------------ */
/* Top stats strip                                                     */
/* ------------------------------------------------------------------ */

export function AlgoStatsStrip() {
  const running = MY_STRATEGIES.filter((s) => s.status === "running");
  const today = MY_STRATEGIES.reduce((s, x) => s + x.pnlToday, 0);
  const items: { icon: string; label: string; value: React.ReactNode; sub: React.ReactNode }[] = [
    { icon: "robot", label: "Running strategies", value: <span className="k-num">{running.length} <span className="text-fg-3">/ {MY_STRATEGIES.length}</span></span>, sub: <span className="text-ember">● Live on 2 servers</span> },
    { icon: "money_bag", label: "Algo P/L today", value: <Money value={today} signed tone="auto" />, sub: "Realised + floating" },
    { icon: "satellite_antenna", label: "Signals today", value: <span className="k-num">{LIVE_SIGNALS.length}</span>, sub: `${LIVE_SIGNALS.filter((s) => s.status !== "skipped").length} executed · ${LIVE_SIGNALS.filter((s) => s.status === "skipped").length} filtered` },
    { icon: "shield", label: "Engine uptime · 30d", value: <span className="k-num">99.98%</span>, sub: "Median latency 3.1 ms" },
  ];
  return (
    <Card className="overflow-hidden">
      <div className="grid grid-cols-2 lg:grid-cols-4">
        {items.map((it, i) => (
          <div key={it.label} className={cn("flex items-center gap-3 px-4 py-4 sm:px-5", i % 2 === 1 && "border-l border-line", i >= 2 && "border-t border-line lg:border-t-0", i === 2 && "lg:border-l")}>
            <Icon3D name={it.icon} size={38} className="hidden shrink-0 sm:block" />
            <div className="min-w-0">
              <div className="k-label truncate">{it.label}</div>
              <div className="mt-1 text-[20px] font-semibold leading-none tracking-tight">{it.value}</div>
              <div className="mt-1 truncate text-[11.5px] text-fg-3">{it.sub}</div>
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}

