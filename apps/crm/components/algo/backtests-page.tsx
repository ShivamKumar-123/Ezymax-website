"use client";

// Live backtests (/developer/backtests): queue a server-side backtest for a saved strategy version, follow its
// progress, and read the report.

import * as React from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { FlaskConical, Loader2, Play, Workflow, X } from "lucide-react";
import { toast } from "sonner";
import { Button, Card, CardHeader, Chip, EmptyState, Menu, PageHeader, Progress, Reveal, Segmented, Skeleton, SymbolAvatar, cn } from "@/components/kit";
import { Trans, useT } from "@ezymex/i18n/react";
import { NumInput } from "./builder";
import { BacktestReport } from "./report";
import { algoApi, algoError, fmtDate, fmtPct, fmtNum, useAlgo, useCfdAccounts, type BacktestDetail, type BacktestRow, type StrategyItem } from "./api";

const GROUPS = [
  { value: "standard", label: "developer.group.standard" },
  { value: "pro", label: "developer.group.pro" },
  { value: "ecn", label: "developer.group.ecn" },
  { value: "vip", label: "developer.group.vip" },
] as const;

const iso = (d: Date) => d.toISOString().slice(0, 10);

function StatusChip({ b }: { b: BacktestRow }) {
  const t = useT();
  const tone = b.status === "done" ? "up" : b.status === "failed" ? "down" : b.status === "running" ? "ember" : "neutral";
  return (
    <Chip size="sm" tone={tone} dot={b.status === "running"}>
      {t.dyn(`developer.btStatus.${b.status}`, b.status)}
    </Chip>
  );
}

export function LiveBacktestsPage() {
  const t = useT();
  const router = useRouter();
  const params = useSearchParams();
  const strategies = useAlgo<{ items: StrategyItem[] }>("strategies");
  const accounts = useCfdAccounts();
  const [runningPoll, setRunningPoll] = React.useState(3000);
  const list = useAlgo<{ items: BacktestRow[] }>("backtests?limit=30", runningPoll);
  const [strategyId, setStrategyId] = React.useState<number | null>(params.get("strategy") ? Number(params.get("strategy")) : null);
  const today = new Date();
  const [from, setFrom] = React.useState(iso(new Date(today.getTime() - 365 * 86400_000)));
  const [to, setTo] = React.useState(iso(today));
  const [balance, setBalance] = React.useState(10000);
  const [costMode, setCostMode] = React.useState<"group" | "account">("group");
  const [group, setGroup] = React.useState("standard");
  const [login, setLogin] = React.useState<number | null>(null);
  const [spread, setSpread] = React.useState<number | null>(null);
  const [busy, setBusy] = React.useState(false);
  const openId = params.get("id") ? Number(params.get("id")) : null;
  const [detail, setDetail] = React.useState<BacktestDetail | null>(null);

  const items = strategies.data?.items ?? [];
  React.useEffect(() => {
    if (strategyId === null && items.length) setStrategyId(items.find((s) => s.valid)?.id ?? items[0]!.id);
  }, [items, strategyId]);
  const strat = items.find((s) => s.id === strategyId);
  const rows = list.data?.items ?? [];
  const anyActive = rows.some((b) => b.status === "queued" || b.status === "running");
  React.useEffect(() => setRunningPoll(anyActive ? 1500 : 10000), [anyActive]);

  // report of the selected backtest (polls while it runs)
  React.useEffect(() => {
    if (!openId) return setDetail(null);
    let stop = false;
    let timer: ReturnType<typeof setTimeout>;
    const run = async () => {
      try {
        const d = await algoApi<BacktestDetail>(`backtests/${openId}`);
        if (stop) return;
        setDetail(d);
        if (d.status === "queued" || d.status === "running") timer = setTimeout(run, 1200);
      } catch (e) {
        if (!stop) algoError(t("developer.bt.loadFailed"), e);
      }
    };
    run();
    return () => {
      stop = true;
      clearTimeout(timer);
    };
  }, [openId]);

  const start = async () => {
    if (!strat) return;
    setBusy(true);
    try {
      const body: Record<string, unknown> = { strategyId: strat.id, from, to, initialBalance: balance };
      if (costMode === "account" && login) body.login = login;
      else body.group = group;
      if (spread !== null) body.spreadPoints = spread;
      const r = await algoApi<{ id: number }>("backtests", { body });
      toast.success(t("developer.bt.queued"), { description: `${strat.name} · ${strat.symbol} ${strat.timeframe} · ${from} → ${to}` });
      list.reload();
      router.replace(`/developer/backtests?id=${r.id}`);
    } catch (e) {
      algoError(t("developer.bt.startFailed"), e);
    } finally {
      setBusy(false);
    }
  };

  const cancel = async (id: number) => {
    try {
      await algoApi(`backtests/${id}/cancel`, { body: {} });
      list.reload();
    } catch (e) {
      algoError(t("developer.bt.cancelFailed"), e);
    }
  };

  const acct = (accounts.data?.items ?? []).find((a) => a.login === login);
  return (
    <>
      <PageHeader
        title={t("developer.bt.title")}
        subtitle={t("developer.bt.subtitle")}
        actions={
          <Link href="/developer/strategies">
            <Button variant="surface">
              <Workflow /> {t("developer.bt.strategyBuilder")}
            </Button>
          </Link>
        }
      />
      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[360px_minmax(0,1fr)]">
        <Reveal className="space-y-5">
          <Card>
            <CardHeader icon={<FlaskConical />} title={t("developer.bt.new")} subtitle={t("developer.bt.newSubtitle")} />
            <div className="space-y-3 px-5 pb-5 pt-4 text-[13px]">
              {strategies.loading ? (
                <Skeleton className="h-10" />
              ) : items.length === 0 ? (
                <p className="text-fg-3">
                  <Trans k="developer.bt.saveFirst" tags={{ link: (c) => <Link href="/developer/strategies" className="text-ember hover:underline">{c}</Link> }} />
                </p>
              ) : (
                <Menu
                  align="start"
                  width={320}
                  trigger={
                    <button type="button" aria-label={t("developer.bt.strategy")} className="flex w-full items-center gap-2 rounded-[12px] border border-line bg-surface-2 px-3 py-2 text-start">
                      {strat && <SymbolAvatar symbol={strat.symbol} size={16} />}
                      <span className="truncate font-medium text-fg">{strat?.name ?? t("developer.bt.chooseStrategy")}</span>
                      <span className="ms-auto font-mono text-[11.5px] text-fg-3" dir="ltr">{strat ? `${strat.symbol} ${strat.timeframe} · v${strat.version}` : ""}</span>
                    </button>
                  }
                  items={items.map((s) => ({ label: s.name, hint: `${s.symbol} ${s.timeframe}${s.valid ? "" : ` · ${t("developer.draft")}`}`, onSelect: () => setStrategyId(s.id) }))}
                />
              )}
              {strat && !strat.valid && <p className="text-[12px] text-down">{t("developer.bt.versionHasErrors")}</p>}
              <div className="grid grid-cols-2 gap-2">
                <label className="text-[11.5px] text-fg-3">
                  {t("developer.bt.from")}
                  <input type="date" value={from} max={to} onChange={(e) => setFrom(e.target.value)} className="mt-1 h-9 w-full rounded-[10px] border border-line bg-surface-2 px-2.5 text-[13px] text-fg outline-none [color-scheme:dark]" />
                </label>
                <label className="text-[11.5px] text-fg-3">
                  {t("developer.bt.to")}
                  <input type="date" value={to} min={from} max={iso(today)} onChange={(e) => setTo(e.target.value)} className="mt-1 h-9 w-full rounded-[10px] border border-line bg-surface-2 px-2.5 text-[13px] text-fg outline-none [color-scheme:dark]" />
                </label>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {[
                  ["1M", 30],
                  ["3M", 91],
                  ["6M", 182],
                  ["1Y", 365],
                  ["3Y", 1095],
                ].map(([l, d]) => (
                  <button key={l} type="button" onClick={() => (setFrom(iso(new Date(today.getTime() - (d as number) * 86400_000))), setTo(iso(today)))} className="h-7 rounded-full border border-line px-2.5 text-[11.5px] text-fg-2 hover:border-ember/50 hover:text-ember">
                    {l}
                  </button>
                ))}
              </div>
              <div className="flex items-center justify-between rounded-[12px] bg-surface-2/60 px-3 py-2">
                <span className="text-fg-3">{t("developer.bt.initialBalance")}</span>
                <NumInput label={t("developer.bt.initialBalance")} value={balance} step={1000} min={100} onChange={setBalance} suffix="USD" />
              </div>
              <div>
                <div className="mb-1.5 flex items-center justify-between">
                  <span className="text-fg-3">{t("developer.bt.costsFrom")}</span>
                  <Segmented size="xs" value={costMode} onChange={setCostMode} options={[{ value: "group", label: t("developer.bt.accountType") }, { value: "account", label: t("developer.bt.myAccount") }]} />
                </div>
                {costMode === "group" ? (
                  <div className="flex flex-wrap gap-1.5">
                    {GROUPS.map((g) => (
                      <button key={g.value} type="button" onClick={() => setGroup(g.value)} className={cn("h-7 rounded-full border px-2.5 text-[11.5px]", group === g.value ? "border-ember/40 bg-ember-soft text-ember" : "border-line text-fg-2")}>
                        {t(g.label)}
                      </button>
                    ))}
                  </div>
                ) : (
                  <Menu
                    align="start"
                    width={300}
                    trigger={
                      <button type="button" aria-label={t("developer.bt.accountForCosts")} className="w-full rounded-[10px] border border-line bg-surface-2 px-3 py-2 text-start text-[12.5px]">
                        {acct ? `${acct.type === "live" ? t("common.live") : t("common.demo")} #${acct.login} · ${acct.groupName}` : t("developer.chooseAccount")}
                      </button>
                    }
                    items={(accounts.data?.items ?? []).map((a) => ({ label: `${a.type === "live" ? t("common.live") : t("common.demo")} #${a.login}`, hint: a.groupName, onSelect: () => setLogin(a.login) }))}
                  />
                )}
              </div>
              <div className="flex items-center justify-between rounded-[12px] bg-surface-2/60 px-3 py-2">
                <span className="text-fg-3">{t("developer.bt.spread")}</span>
                <span className="flex items-center gap-2">
                  {spread === null ? (
                    <button type="button" onClick={() => setSpread(10)} className="text-[12px] text-fg-2 hover:text-ember">
                      {t("developer.bt.liveSpreadSetFixed")}
                    </button>
                  ) : (
                    <>
                      <NumInput label={t("developer.bt.fixedSpread")} value={spread} min={0} onChange={setSpread} suffix={t("developer.unit.pts")} />
                      <button type="button" aria-label={t("developer.bt.useLiveSpread")} onClick={() => setSpread(null)} className="text-fg-3 hover:text-fg">
                        <X className="size-3.5" />
                      </button>
                    </>
                  )}
                </span>
              </div>
              <Button variant="ember" className="w-full" disabled={!strat || !strat.valid || busy} onClick={start}>
                {busy ? <Loader2 className="animate-spin" /> : <Play />} {t("developer.bt.run")}
              </Button>
              <p className="text-[11px] text-fg-3">{t("developer.bt.limitsNote")}</p>
            </div>
          </Card>
          <Card>
            <CardHeader title={t("developer.bt.history")} subtitle={t("developer.bt.recent", { count: rows.length })} />
            <div className="space-y-1 px-3 pb-4 pt-3">
              {list.loading && <Skeleton className="h-20" />}
              {!list.loading && rows.length === 0 && <p className="px-2 text-[12.5px] text-fg-3">{t("developer.bt.none")}</p>}
              {rows.map((b) => (
                <div key={b.id} className={cn("rounded-[12px] px-3 py-2 transition", openId === b.id ? "bg-surface-3" : "hover:bg-surface-2")}>
                  <button type="button" className="w-full text-start" onClick={() => router.replace(`/developer/backtests?id=${b.id}`)}>
                    <div className="flex items-center gap-2">
                      <span className="truncate text-[13px] font-medium text-fg">{b.strategyName}</span>
                      <span className="text-[11px] text-fg-3">v{b.version}</span>
                      <span className="ms-auto">
                        <StatusChip b={b} />
                      </span>
                    </div>
                    <div className="mt-0.5 flex items-center gap-2 text-[11px] text-fg-3">
                      <span className="font-mono" dir="ltr">
                        {b.params.symbol} {b.params.timeframe} · {fmtDate(b.params.from)} → {fmtDate(b.params.to)}
                      </span>
                      {b.summary && <span className={cn("ms-auto k-num tabular-nums", b.summary.returnPct >= 0 ? "text-up" : "text-down")}>{fmtPct(b.summary.returnPct)}</span>}
                    </div>
                  </button>
                  {(b.status === "running" || b.status === "queued") && (
                    <div className="mt-1.5 flex items-center gap-2">
                      <Progress value={Math.round(b.progress * 100)} className="flex-1" />
                      <button type="button" onClick={() => cancel(b.id)} className="text-[11px] text-fg-3 hover:text-down">
                        {t("common.cancel")}
                      </button>
                    </div>
                  )}
                  {b.status === "failed" && <div className="mt-1 text-[11px] text-down">{b.error}</div>}
                </div>
              ))}
            </div>
          </Card>
        </Reveal>
        <Reveal delay={0.05} className="min-w-0">
          {!openId ? (
            <Card className="grid min-h-[420px] place-items-center">
              <EmptyState title={t("developer.bt.emptyTitle")} text={t("developer.bt.emptyText")} />
            </Card>
          ) : !detail ? (
            <Skeleton className="h-[480px]" />
          ) : detail.status !== "done" ? (
            <Card className="grid min-h-[420px] place-items-center p-8 text-center">
              {detail.status === "failed" ? (
                <div className="max-w-md">
                  <div className="text-[16px] font-medium text-down">{t("developer.bt.failed")}</div>
                  <p className="mt-2 text-[13px] text-fg-2">{detail.error}</p>
                </div>
              ) : detail.status === "cancelled" ? (
                <div className="text-fg-2">{t("common.cancelled")}</div>
              ) : (
                <div className="w-full max-w-md">
                  <div className="flex items-center justify-center gap-2 text-[15px] text-fg">
                    <Loader2 className="size-4 animate-spin" /> {detail.status === "queued" ? t("developer.bt.queuedLabel") : detail.stage ?? t("developer.bt.running")}
                  </div>
                  <Progress value={Math.round(detail.progress * 100)} className="mt-4" />
                  <div className="k-num mt-2 text-[12px] text-fg-3">{Math.round(detail.progress * 100)}%</div>
                </div>
              )}
            </Card>
          ) : (
            <>
              <div className="mb-4 flex flex-wrap items-center gap-2">
                <SymbolAvatar symbol={detail.params.symbol} size={20} />
                <span className="text-[17px] font-medium text-fg">{detail.strategyName}</span>
                <Chip size="sm">v{detail.version}</Chip>
                <span className="font-mono text-[12px] text-fg-3" dir="ltr">
                  {detail.params.symbol} {detail.params.timeframe} · {fmtDate(detail.params.from)} → {fmtDate(detail.params.to)} · ${fmtNum(detail.params.initialBalance, 0)}
                </span>
                <span className="ms-auto text-[11.5px] text-fg-3">{t("developer.bt.computedIn", { s: ((detail.cpuMs ?? 0) / 1000).toFixed(1) })}</span>
              </div>
              <BacktestReport bt={detail} />
            </>
          )}
        </Reveal>
      </div>
    </>
  );
}
