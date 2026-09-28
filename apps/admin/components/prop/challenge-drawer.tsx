"use client";

import * as React from "react";
import { BadgeCheck, CalendarPlus, Copy, RotateCcw, XCircle } from "lucide-react";
import { Button, Chip, CopyButton, Dialog, EquityChart, Menu, StatusChip, KeyValue } from "@kalks/ui";
import { MiniStat, NumInput, PersonCell, auditToast, type useReason } from "@/components/config/kit";
import { challengeRules, equityPath, fmtDate, type Challenge, type ChallengeStatus } from "./data";
import { PlanTypeChip, RuleMeter, TargetProgress } from "./rules";

export const CH_STATUS: Record<ChallengeStatus, { status: string; label: string }> = {
  active: { status: "running", label: "Active" },
  passed: { status: "passed", label: "Passed" },
  breached: { status: "failed", label: "Breached" },
  expired: { status: "expired", label: "Expired" },
};

function ExtendDays({ valueRef }: { valueRef: React.MutableRefObject<number> }) {
  const [v, setV] = React.useState(valueRef.current);
  return (
    <div className="flex items-center justify-between gap-3 rounded-[12px] border border-line bg-surface-2 px-3 py-2.5">
      <span className="text-[13px] text-fg-2">Extra calendar days</span>
      <NumInput
        size="sm"
        className="w-28"
        stepper
        value={v}
        min={1}
        max={30}
        onChange={(n) => {
          setV(n);
          valueRef.current = n;
        }}
      />
    </div>
  );
}

export function ChallengeDrawer({ c, open, onOpenChange, reason, onUpdate }: { c: Challenge | null; open: boolean; onOpenChange: (o: boolean) => void; reason: ReturnType<typeof useReason>; onUpdate: (c: Challenge) => void }) {
  const days = React.useRef(7);
  if (!c) return null;
  const rules = challengeRules(c);
  const data = equityPath(c.login, c.size, c.equity, c.day, c.started);
  const pnl = c.equity - c.size;
  const dailyLeft = c.dailyLossLimit - c.dailyLossUsed;
  const ddLeft = c.maxDDLimit - c.ddUsed;
  const target$ = (c.size * c.targetPct) / 100;

  const act = (kind: "reset" | "extend" | "pass" | "fail") => {
    const cfg = {
      reset: { title: `Reset challenge #${c.login}`, description: "Balance returns to the starting size and all rule counters restart. Trade history is archived.", reasons: ["Platform / feed incident", "Goodwill (support ticket)", "Paid reset", "Duplicate purchase"], confirmLabel: "Reset account", tone: "ember" as const },
      extend: { title: `Extend time limit · #${c.login}`, description: c.limit ? `Current limit: ${c.limit} days (day ${c.day}).` : "This phase has no time limit; extension adds a grace window.", reasons: ["Server outage", "Medical / personal", "Goodwill", "Holiday calendar"], confirmLabel: "Extend", tone: "ember" as const },
      pass: { title: `Force-pass ${c.phase} · #${c.login}`, description: "Promotes the trader to the next phase immediately, bypassing remaining targets.", reasons: ["Target reached; rule engine lag", "Rounding dispute resolved", "Management override"], confirmLabel: "Force pass", tone: "buy" as const },
      fail: { title: `Fail challenge · #${c.login}`, description: "Account is disabled and the trader is notified. Fee is not refunded.", reasons: ["Banned strategy confirmed", "Account sharing", "Copy trading across accounts", "Terms of service breach"], confirmLabel: "Fail account", tone: "sell" as const },
    }[kind];
    reason.ask({
      ...cfg,
      body: kind === "extend" ? <ExtendDays valueRef={days} /> : undefined,
      onConfirm: (r) => {
        if (kind === "reset") onUpdate({ ...c, day: 1, tradingDays: 0, profitPct: 0, balance: c.size, equity: c.size, dailyLossUsed: 0, ddUsed: 0, status: "active" });
        if (kind === "extend") onUpdate({ ...c, limit: (c.limit || c.day) + days.current, status: c.status === "expired" ? "active" : c.status });
        if (kind === "pass") onUpdate({ ...c, status: "passed" });
        if (kind === "fail") onUpdate({ ...c, status: "breached" });
        auditToast(kind === "reset" ? `#${c.login} reset` : kind === "extend" ? `#${c.login} extended by ${days.current} days` : kind === "pass" ? `#${c.login} force-passed` : `#${c.login} failed`, r);
      },
    });
  };

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      side="right"
      title={
        <span className="flex items-center gap-2">
          Challenge <span className="font-mono text-fg-2">#{c.login}</span>
          <CopyButton value={c.login} label="Login" />
        </span>
      }
      description={`${c.id} · ${c.server} · started ${fmtDate(c.started)}`}
      footer={
        <>
          <Menu
            align="start"
            trigger={
              <Button size="sm" variant="ghost" className="mr-auto">
                More
              </Button>
            }
            items={[
              { label: "Reset account", icon: <RotateCcw />, onSelect: () => act("reset") },
              { label: "Copy investor link", icon: <Copy />, onSelect: () => auditToast("Investor link copied", `Read-only access for #${c.login}`) },
            ]}
          />
          <Button size="sm" variant="surface" onClick={() => act("extend")}>
            <CalendarPlus /> Extend
          </Button>
          <Button size="sm" variant="up-outline" onClick={() => act("pass")} disabled={c.status === "passed"}>
            <BadgeCheck /> Force pass
          </Button>
          <Button size="sm" variant="down-outline" onClick={() => act("fail")} disabled={c.status === "breached"}>
            <XCircle /> Fail
          </Button>
        </>
      }
    >
      <div className="space-y-5">
        <div className="flex items-center justify-between gap-3">
          <PersonCell name={c.trader.name} photo={c.trader.photo} country={c.trader.country} sub={c.trader.email} size={40} verified />
          <StatusChip status={CH_STATUS[c.status].status} label={CH_STATUS[c.status].label} />
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <PlanTypeChip type={c.planType} />
          <Chip size="sm">{c.planName}</Chip>
          <Chip size="sm" tone="ember">
            ${c.size.toLocaleString()}
          </Chip>
          <Chip size="sm">{c.phase}</Chip>
          <Chip size="sm">
            Day {c.day}
            {c.limit ? ` / ${c.limit}` : " · no limit"}
          </Chip>
        </div>

        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <MiniStat label="Balance" value={`$${c.balance.toLocaleString("en-US", { maximumFractionDigits: 2 })}`} />
          <MiniStat label="Equity" value={`$${c.equity.toLocaleString("en-US", { maximumFractionDigits: 2 })}`} />
          <MiniStat label="P/L" value={`${pnl >= 0 ? "+" : "-"}$${Math.abs(pnl).toLocaleString("en-US", { maximumFractionDigits: 0 })}`} tone={pnl >= 0 ? "up" : "down"} />
          <MiniStat label="To target" value={`$${Math.max(0, target$ - pnl).toLocaleString("en-US", { maximumFractionDigits: 0 })}`} sub={`${c.targetPct}% = $${target$.toLocaleString()}`} />
        </div>

        <div className="k-row px-4 py-3">
          <div className="mb-1 flex items-center justify-between text-[12px] text-fg-3">
            <span>Profit target progress</span>
            <span className="k-num">{Math.max(0, (c.profitPct / c.targetPct) * 100).toFixed(0)}%</span>
          </div>
          <TargetProgress profitPct={c.profitPct} targetPct={c.targetPct} className="w-full" />
        </div>

        <div>
          <div className="k-label mb-2">Rule meters · live</div>
          <div className="space-y-2">
            {rules.map((r) => (
              <RuleMeter
                key={r.key}
                rule={r}
                headroom={
                  r.key === "daily" ? `$${Math.max(0, dailyLeft).toLocaleString("en-US", { maximumFractionDigits: 0 })} left` : r.key === "maxdd" ? `$${Math.max(0, ddLeft).toLocaleString("en-US", { maximumFractionDigits: 0 })} left` : r.key === "days" ? `${Math.max(0, c.minDays - c.tradingDays)} to go` : undefined
                }
              />
            ))}
          </div>
        </div>

        <div>
          <div className="k-label mb-1">Equity curve</div>
          <EquityChart data={data} height={200} color={pnl >= 0 ? "gold" : "down"} />
        </div>

        <KeyValue
          rows={[
            ["Trades", <span key="t">{c.trades}</span>],
            ["Win rate", `${c.winRate.toFixed(1)}%`],
            ["Volume", `${c.lots} lots`],
            ["Best day share", `${c.bestDayShare.toFixed(1)}%`],
            ["Last IP", <span key="ip" className="font-mono text-[12.5px]">{c.ip}</span>],
          ]}
        />
      </div>
    </Dialog>
  );
}
