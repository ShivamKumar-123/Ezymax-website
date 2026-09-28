"use client";

// Running strategies (/developer/deployments): every deployment with its stats, positions and log, the
// per-strategy controls (pause / resume / stop / kill) and the account-wide kill switch (D84).

import * as React from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Loader2, OctagonX, Pause, Play, Power, ShieldAlert, Square, Workflow, XCircle } from "lucide-react";
import { toast } from "sonner";
import { Button, Card, CardHeader, Chip, Dialog, EmptyState, EquityChart, PageHeader, Reveal, Skeleton, SymbolAvatar, Tabs, Toggle, cn } from "@kalks/ui";
import { DEP_TONE, SIGNAL_LABEL, ago, algoApi, algoError, fmtDateTime, fmtMoney, fmtSigned, useAlgo, type Controls, type Deployment, type DeploymentDetail } from "./api";

const LOG_TONE: Record<string, string> = { error: "text-down", warn: "text-warn", info: "text-fg-2" };
const KIND_TONE: Record<string, string> = { order: "text-up", close: "text-gold", signal: "text-ember", eval: "text-fg-3", manage: "text-info", error: "text-down", info: "text-fg-2" };

function KillSwitch({ onChange }: { onChange: () => void }) {
  const c = useAlgo<Controls>("controls", 10000);
  const [open, setOpen] = React.useState(false);
  const [close, setClose] = React.useState(true);
  const [busy, setBusy] = React.useState(false);
  const killed = !!c.data?.killed;
  const run = async (k: boolean) => {
    setBusy(true);
    try {
      const r = await algoApi<{ stopped: number; closed: number; failed: number }>("controls/kill", { body: { killed: k, closePositions: k && close } });
      toast[k ? "warning" : "success"](k ? "Kill switch on" : "Kill switch released", { description: k ? `${r.stopped} strateg${r.stopped === 1 ? "y" : "ies"} stopped · ${r.closed} position(s) closed${r.failed ? ` · ${r.failed} could not close` : ""}. Webhooks and API trading are blocked.` : "You can deploy strategies and trade through webhooks and the API again." });
      setOpen(false);
      c.reload();
      onChange();
    } catch (e) {
      algoError("Kill switch failed", e);
    } finally {
      setBusy(false);
    }
  };
  return (
    <Card className={cn(killed && "border-down/40")}>
      <CardHeader icon={<ShieldAlert />} title="Kill switch" subtitle="Stops every strategy, webhook and API order on your accounts" />
      <div className="space-y-3 px-5 pb-5 pt-4 text-[13px]">
        {c.data?.globalKill && <div className="rounded-[10px] border border-down/30 bg-down-soft px-3 py-2 text-[12px] text-down">Automated trading is paused platform-wide by Kalks risk management.</div>}
        {killed ? (
          <>
            <div className="flex items-center gap-2 text-down">
              <OctagonX className="size-4" /> On since {fmtDateTime(c.data?.killedAt ?? null)}
            </div>
            <Button variant="surface" className="w-full" disabled={busy} onClick={() => run(false)}>
              {busy ? <Loader2 className="animate-spin" /> : <Power />} Release kill switch
            </Button>
          </>
        ) : (
          <Button variant="down-outline" className="w-full" onClick={() => setOpen(true)}>
            <OctagonX /> Stop all automation
          </Button>
        )}
      </div>
      <Dialog
        open={open}
        onOpenChange={setOpen}
        title="Stop all automated trading?"
        description="Every running strategy is killed, and webhook alerts and API orders are refused until you release the switch."
        width={460}
        footer={
          <>
            <Button variant="surface" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button variant="sell" disabled={busy} onClick={() => run(true)}>
              {busy ? <Loader2 className="animate-spin" /> : <OctagonX />} Kill all
            </Button>
          </>
        }
      >
        <label className="flex items-center justify-between gap-3 text-[13px]">
          <span>
            Also close open positions
            <span className="block text-[12px] text-fg-3">Positions opened by strategies, webhooks and the API</span>
          </span>
          <Toggle checked={close} onChange={setClose} label="Close positions" />
        </label>
      </Dialog>
    </Card>
  );
}

function Detail({ id, onChanged }: { id: number; onChanged: () => void }) {
  const d = useAlgo<DeploymentDetail>(`deployments/${id}`, 3000);
  const [tab, setTab] = React.useState<"log" | "positions" | "setup">("log");
  const [busy, setBusy] = React.useState<string | null>(null);
  const [confirmKill, setConfirmKill] = React.useState(false);
  if (!d.data) return <Skeleton className="h-[520px]" />;
  const x = d.data;
  const act = async (action: string, body: Record<string, unknown> = {}) => {
    setBusy(action);
    try {
      const r = await algoApi<{ closed?: number; failed?: number }>(`deployments/${id}/${action}`, { body });
      toast.success(action === "kill" ? "Strategy killed" : action === "stop" ? "Strategy stopped" : action === "pause" ? "Paused" : action === "resume" ? "Resumed" : "Positions closed", {
        description: r.closed !== undefined ? `${r.closed} position(s) closed${r.failed ? `, ${r.failed} failed` : ""}` : undefined,
      });
      d.reload();
      onChanged();
    } catch (e) {
      algoError("Action failed", e);
    } finally {
      setBusy(null);
      setConfirmKill(false);
    }
  };
  const live = x.status === "running" || x.status === "paused";
  let cum = Number(x.startBalance ?? 0) || 0;
  const curve = x.daily.map((p) => ({ time: Math.floor(new Date(p.day).getTime() / 1000), value: +(cum += p.realized).toFixed(2) }));
  const wins = x.stats.wins ?? 0;
  const trades = x.stats.trades ?? 0;
  return (
    <Card className="overflow-hidden" data-testid="deployment-detail">
      <div className="flex flex-wrap items-start gap-3 px-6 pt-5">
        <SymbolAvatar symbol={x.symbol} size={28} />
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[18px] font-medium text-fg">{x.strategyName}</span>
            <Chip size="sm">v{x.version}</Chip>
            <Chip size="sm" tone={DEP_TONE[x.status]} dot={x.status === "running"}>
              {x.status}
            </Chip>
            {x.subscriptionId && <Chip size="sm" tone="gold">Marketplace copy</Chip>}
          </div>
          <div className="mt-0.5 font-mono text-[12px] text-fg-3">
            {x.symbol} · {x.timeframe} · {x.accountType === "live" ? "Live" : "Demo"} #{x.login} · last bar evaluated {ago(x.lastEvalAt)}
          </div>
        </div>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          {x.status === "running" && (
            <Button size="sm" variant="surface" disabled={!!busy} onClick={() => act("pause")}>
              <Pause /> Pause
            </Button>
          )}
          {x.status === "paused" && (
            <Button size="sm" variant="surface" disabled={!!busy} onClick={() => act("resume")}>
              <Play /> Resume
            </Button>
          )}
          {live && (
            <Button size="sm" variant="surface" disabled={!!busy} onClick={() => act("stop", { closePositions: false })}>
              <Square /> Stop
            </Button>
          )}
          {(x.openPositions > 0 || x.positions.some((p) => !p.closedAt)) && (
            <Button size="sm" variant="surface" disabled={!!busy} onClick={() => act("close-positions")}>
              <XCircle /> Close positions
            </Button>
          )}
          {live && (
            <Button size="sm" variant="down-outline" disabled={!!busy} onClick={() => setConfirmKill(true)}>
              <OctagonX /> Kill
            </Button>
          )}
        </div>
      </div>
      {x.error && <div className="mx-6 mt-3 rounded-[10px] border border-down/30 bg-down-soft px-3 py-2 text-[12px] text-down">{x.error}</div>}
      {x.stopReason && !live && <div className="mx-6 mt-3 text-[12px] text-fg-3">Stopped: {x.stopReason}</div>}
      <div className="mt-4 grid grid-cols-2 gap-3 px-6 sm:grid-cols-4">
        {(
          [
            ["Realized P&L", fmtSigned(Number(x.stats.realized ?? 0)), Number(x.stats.realized ?? 0) >= 0 ? "text-up" : "text-down"],
            ["Closed trades", String(trades), "text-fg"],
            ["Win rate", trades ? `${((wins / trades) * 100).toFixed(1)}%` : "–", "text-fg"],
            ["Open positions", String(x.positions.filter((p) => !p.closedAt).length), "text-fg"],
          ] as const
        ).map(([l, v, t]) => (
          <div key={l} className="rounded-[12px] bg-surface-2/60 px-3 py-2.5">
            <div className="text-[10.5px] uppercase tracking-wider text-fg-3">{l}</div>
            <div className={cn("k-num mt-1 text-[17px] font-semibold", t)}>{v}</div>
          </div>
        ))}
      </div>
      {curve.length > 1 && (
        <div className="px-3 pt-3">
          <EquityChart data={curve} height={150} showVolume={false} color="gold" />
        </div>
      )}
      <div className="px-6 pt-4">
        <Tabs value={tab} onChange={setTab} tabs={[{ value: "log", label: "Log", count: x.logs.length }, { value: "positions", label: "Trades", count: x.positions.length }, { value: "setup", label: "Setup" }]} />
      </div>
      <div className="px-6 pb-6 pt-3">
        {tab === "log" && (
          <div className="max-h-[420px] overflow-y-auto rounded-[12px] border border-line bg-black/20 p-3 font-mono text-[11.5px] leading-[18px]" data-testid="deployment-log">
            {x.logs.length === 0 && <div className="text-fg-3">Waiting for the first closed bar…</div>}
            {x.logs.map((l) => (
              <div key={l.id} className={cn("flex gap-3", LOG_TONE[l.level])}>
                <span className="shrink-0 text-fg-3">{new Date(l.at).toISOString().slice(11, 19)}</span>
                <span className={cn("w-14 shrink-0 uppercase", KIND_TONE[l.kind])}>{l.kind}</span>
                <span className="min-w-0 break-words">{l.message}</span>
              </div>
            ))}
          </div>
        )}
        {tab === "positions" && (
          <table className="w-full text-[12.5px] [&_td]:px-2 [&_th]:px-2">
            <thead className="text-fg-3">
              <tr>
                <th className="py-1.5 text-left font-medium">Ticket</th>
                <th className="py-1.5 text-left font-medium">Side</th>
                <th className="py-1.5 text-right font-medium">Lots</th>
                <th className="py-1.5 text-right font-medium">Open</th>
                <th className="py-1.5 text-right font-medium">Close</th>
                <th className="py-1.5 text-left font-medium">Exit</th>
                <th className="py-1.5 text-right font-medium">P&L</th>
              </tr>
            </thead>
            <tbody>
              {x.positions.map((p) => (
                <tr key={p.ticket} className="border-t border-line/60">
                  <td className="py-1.5 font-mono text-fg-2">#{p.ticket}</td>
                  <td>
                    <Chip size="sm" tone={p.side === "buy" ? "up" : "down"}>{p.side.toUpperCase()}</Chip>
                  </td>
                  <td className="k-num text-right">{p.volume}</td>
                  <td className="k-num text-right text-fg-2">{p.openPrice ?? "–"}</td>
                  <td className="k-num text-right text-fg-2">{p.closedAt ? p.closePrice : <Chip size="sm" tone="ember">open</Chip>}</td>
                  <td className="text-fg-3">{p.reason === "client" ? "closed" : p.reason === "sl" ? "stop loss" : p.reason === "tp" ? "take profit" : (p.reason ?? "").replace(/_/g, " ")}</td>
                  <td className={cn("k-num text-right font-medium", (p.profit ?? 0) >= 0 ? "text-up" : "text-down")}>{p.profit === null ? "–" : fmtSigned(p.profit)}</td>
                </tr>
              ))}
              {x.positions.length === 0 && (
                <tr>
                  <td colSpan={7} className="py-6 text-center text-fg-3">
                    No trades yet
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}
        {tab === "setup" && (
          <div className="grid grid-cols-1 gap-6 text-[13px] md:grid-cols-2">
            <div>
              <div className="k-label mb-2">Signals</div>
              {x.rulesHidden ? (
                <p className="text-fg-3">The author keeps this strategy's rules private; it runs on your account with the settings shown here.</p>
              ) : (
                Object.entries(x.summary ?? {}).map(([k, v]) => (
                  <div key={k} className="flex gap-3 py-1">
                    <span className="w-16 shrink-0 text-[11px] uppercase text-fg-3">{SIGNAL_LABEL[k]}</span>
                    <code className="min-w-0 break-words font-mono text-[12px] text-fg-2">{v}</code>
                  </div>
                ))
              )}
            </div>
            <div>
              <div className="k-label mb-2">Limits on this account</div>
              {(
                [
                  ["Lot multiplier", x.risk.lotMultiplier ?? 1],
                  ["Max lots per order", x.risk.maxLots ?? x.spec?.maxLots ?? "–"],
                  ["Max open positions", x.risk.maxOpenPositions ?? (x.spec?.oneAtATime ? 1 : 5)],
                  ["Max daily loss", x.risk.maxDailyLoss ? fmtMoney(x.risk.maxDailyLoss) : x.spec?.maxDailyLoss ? fmtMoney(x.spec.maxDailyLoss) : "off"],
                  ["Started", fmtDateTime(x.createdAt)],
                  ["Starting balance", x.startBalance ? fmtMoney(Number(x.startBalance)) : "–"],
                ] as const
              ).map(([k, v]) => (
                <div key={k} className="flex justify-between border-b border-line/60 py-1.5">
                  <span className="text-fg-3">{k}</span>
                  <span className="k-num text-fg">{String(v)}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
      <Dialog
        open={confirmKill}
        onOpenChange={setConfirmKill}
        title={`Kill “${x.strategyName}”?`}
        description="The strategy stops immediately and its open positions are closed at market."
        width={440}
        footer={
          <>
            <Button variant="surface" onClick={() => setConfirmKill(false)}>
              Cancel
            </Button>
            <Button variant="sell" disabled={!!busy} onClick={() => act("kill", { closePositions: true })}>
              {busy === "kill" ? <Loader2 className="animate-spin" /> : <OctagonX />} Kill and close
            </Button>
          </>
        }
      >
        <p className="text-[13px] text-fg-2">Orders already sent stay in your account history. You can deploy the strategy again at any time.</p>
      </Dialog>
    </Card>
  );
}

export function LiveDeploymentsPage() {
  const router = useRouter();
  const params = useSearchParams();
  const list = useAlgo<{ items: Deployment[] }>("deployments", 5000);
  const items = list.data?.items ?? [];
  const idParam = params.get("id") ? Number(params.get("id")) : null;
  const selected = idParam ?? items.find((d) => d.status === "running")?.id ?? items[0]?.id ?? null;
  const [filter, setFilter] = React.useState<"active" | "all">("active");
  const shown = items.filter((d) => filter === "all" || d.status === "running" || d.status === "paused");
  return (
    <>
      <PageHeader
        title="Running strategies"
        subtitle="Strategies run on our servers around the clock, on closed bars, with your limits. Every order is tagged “strategy” on your account."
        actions={
          <Link href="/developer/strategies">
            <Button variant="ember">
              <Workflow /> Strategy builder
            </Button>
          </Link>
        }
      />
      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[360px_minmax(0,1fr)]">
        <Reveal className="space-y-5">
          <KillSwitch onChange={list.reload} />
          <Card>
            <CardHeader title="Deployments" subtitle={`${items.filter((d) => d.status === "running").length} running`} action={<Tabs value={filter} onChange={setFilter} tabs={[{ value: "active", label: "Active" }, { value: "all", label: "All" }]} />} />
            <div className="space-y-1 px-3 pb-4 pt-3">
              {list.loading && <Skeleton className="h-24" />}
              {!list.loading && shown.length === 0 && <p className="px-2 text-[12.5px] text-fg-3">{filter === "active" ? "Nothing running." : "No deployments yet."} Deploy a saved strategy from the builder.</p>}
              {shown.map((d) => (
                <button key={d.id} type="button" onClick={() => router.replace(`/developer/deployments?id=${d.id}`)} className={cn("w-full rounded-[12px] px-3 py-2 text-left transition", selected === d.id ? "bg-surface-3" : "hover:bg-surface-2")}>
                  <div className="flex items-center gap-2">
                    <SymbolAvatar symbol={d.symbol} size={16} />
                    <span className="truncate text-[13px] font-medium text-fg">{d.strategyName}</span>
                    <span className="ml-auto">
                      <Chip size="sm" tone={DEP_TONE[d.status]} dot={d.status === "running"}>
                        {d.status}
                      </Chip>
                    </span>
                  </div>
                  <div className="mt-0.5 flex items-center gap-2 pl-6 text-[11px] text-fg-3">
                    <span className="font-mono">
                      {d.symbol} {d.timeframe} · #{d.login}
                    </span>
                    <span className={cn("ml-auto k-num", Number(d.stats.realized ?? 0) >= 0 ? "text-up" : "text-down")}>{fmtSigned(Number(d.stats.realized ?? 0))}</span>
                  </div>
                </button>
              ))}
            </div>
          </Card>
        </Reveal>
        <Reveal delay={0.05} className="min-w-0">
          {selected ? (
            <Detail key={selected} id={selected} onChanged={list.reload} />
          ) : (
            <Card className="grid min-h-[420px] place-items-center">
              <EmptyState title="No strategy running" text="Save a strategy in the builder, backtest it, then deploy it on a demo account to watch it trade." />
            </Card>
          )}
        </Reveal>
      </div>
    </>
  );
}
