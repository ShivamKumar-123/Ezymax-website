"use client";

import * as React from "react";
import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import { ArrowLeft, RotateCw, Server } from "lucide-react";
import { Button, Card, CardHeader, Chip, CopyButton, EmptyState, Gauge, KeyValue, Money, Reveal, Skeleton, SymbolAvatar, Tabs, cn } from "@kalks/ui";
import { STATUS_LABEL, curOf, fmtAmount, fmtDate, fmtLevel, fmtPrice, levelTone, modeLabel, serverOf, serverTime, usePoll, type AccountDetail, type EngineAccount, type EnginePosition, type EngineOrder, type HistoryPage } from "./api";
import { DealsTable, HistoryPanel, LedgerPanel } from "./activity";
import { CredentialsPanel, SettingsPanel } from "./manage";
import { FundButton, KindBadge, RefillButton, StatusBadge, TradeButton } from "./ui";

const TAB_KEYS = ["overview", "positions", "history", "ledger", "credentials", "settings"] as const;
type TabKey = (typeof TAB_KEYS)[number];

function StatTile({ label, children, tone }: { label: string; children: React.ReactNode; tone?: "up" | "down" | "warn" }) {
  return (
    <div className="k-row min-w-0 px-4 py-3">
      <div className="text-[11px] uppercase tracking-wider text-fg-3">{label}</div>
      <div className={cn("k-num mt-1 truncate text-[15px] font-semibold sm:text-[16px]", tone === "up" && "text-up", tone === "down" && "text-down", tone === "warn" && "text-warn")}>{children}</div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Positions / orders                                                  */
/* ------------------------------------------------------------------ */

const ORDER_TYPE: Record<EngineOrder["type"], string> = { market: "Market", limit: "Limit", stop: "Stop", stop_limit: "Stop limit" };

function PositionsTable({ positions, cur }: { positions: EnginePosition[]; cur: string }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[820px] border-separate border-spacing-y-2 text-[13.5px]">
        <thead>
          <tr className="text-[11px] uppercase tracking-wider text-fg-3">
            <th className="px-4 text-left font-medium">Symbol</th>
            <th className="px-3 text-left font-medium">Ticket</th>
            <th className="px-3 text-right font-medium">Volume</th>
            <th className="px-3 text-right font-medium">Open</th>
            <th className="px-3 text-right font-medium">Current</th>
            <th className="px-3 text-right font-medium">SL / TP</th>
            <th className="px-3 text-right font-medium">Swap</th>
            <th className="px-4 text-right font-medium">P&L</th>
          </tr>
        </thead>
        <tbody>
          {positions.map((p) => {
            const d = p.openPrice >= 1000 ? 2 : p.openPrice >= 50 ? 3 : 5;
            return (
              <tr key={p.ticket} className="bg-surface-2">
                <td className="rounded-l-[14px] border-y border-l border-line px-4 py-3">
                  <div className="flex items-center gap-3">
                    <SymbolAvatar symbol={p.symbol} size={26} />
                    <div>
                      <div className="flex items-center gap-2 font-medium">
                        {p.symbol}
                        <Chip size="sm" tone={p.side === "buy" ? "up" : "down"}>
                          {p.side.toUpperCase()}
                        </Chip>
                      </div>
                      <div className="text-[11px] text-fg-3">{serverTime(p.openTime)}</div>
                    </div>
                  </div>
                </td>
                <td className="border-y border-line px-3 font-mono text-[12px] text-fg-3">#{p.ticket}</td>
                <td className="k-num border-y border-line px-3 text-right">{p.volume.toFixed(2)}</td>
                <td className="k-num border-y border-line px-3 text-right font-mono text-fg-2">{fmtPrice(p.openPrice, d)}</td>
                <td className="k-num border-y border-line px-3 text-right font-mono">{fmtPrice(p.currentPrice, d)}</td>
                <td className="k-num border-y border-line px-3 text-right font-mono text-[12px] text-fg-3">
                  <span className="text-down/80">{p.sl ? fmtPrice(p.sl, d) : "—"}</span> / <span className="text-up/80">{p.tp ? fmtPrice(p.tp, d) : "—"}</span>
                </td>
                <td className={cn("k-num border-y border-line px-3 text-right text-[12.5px]", p.swap < 0 ? "text-down" : "text-fg-2")}>{fmtAmount(p.swap, "")}</td>
                <td className={cn("k-num rounded-r-[14px] border-y border-r border-line px-4 text-right text-[14px] font-semibold", p.profit > 0 ? "text-up" : p.profit < 0 ? "text-down" : "")}>{fmtAmount(p.profit, cur, true)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function OrdersTable({ orders }: { orders: EngineOrder[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[640px] border-separate border-spacing-y-2 text-[13.5px]">
        <thead>
          <tr className="text-[11px] uppercase tracking-wider text-fg-3">
            <th className="px-4 text-left font-medium">Symbol</th>
            <th className="px-3 text-left font-medium">Ticket</th>
            <th className="px-3 text-left font-medium">Type</th>
            <th className="px-3 text-right font-medium">Volume</th>
            <th className="px-3 text-right font-medium">Price</th>
            <th className="px-4 text-right font-medium">Placed</th>
          </tr>
        </thead>
        <tbody>
          {orders.map((o) => (
            <tr key={o.ticket} className="bg-surface-2">
              <td className="rounded-l-[14px] border-y border-l border-line px-4 py-3">
                <div className="flex items-center gap-3">
                  <SymbolAvatar symbol={o.symbol} size={24} />
                  <span className="font-medium">{o.symbol}</span>
                </div>
              </td>
              <td className="border-y border-line px-3 font-mono text-[12px] text-fg-3">#{o.ticket}</td>
              <td className="border-y border-line px-3">
                <Chip size="sm" tone={o.side === "buy" ? "up" : "down"}>
                  {o.side === "buy" ? "Buy" : "Sell"} {ORDER_TYPE[o.type]}
                </Chip>
              </td>
              <td className="k-num border-y border-line px-3 text-right">{o.volume.toFixed(2)}</td>
              <td className="k-num border-y border-line px-3 text-right font-mono text-fg-2">{fmtPrice(o.price)}</td>
              <td className="k-num rounded-r-[14px] border-y border-r border-line px-4 text-right text-[12.5px] text-fg-3">{serverTime(o.placedAt)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function PositionsPanel({ a, positions, orders }: { a: EngineAccount; positions: EnginePosition[]; orders: EngineOrder[] }) {
  const cur = curOf(a);
  if (positions.length === 0 && orders.length === 0)
    return (
      <Card>
        <EmptyState
          illustration="chart_increasing"
          title="No open positions or pending orders"
          text="Trade in Kalks Trader; open positions and their P&L show here and update every few seconds."
          action={<TradeButton a={a} size="md" label="Open Kalks Trader" />}
        />
      </Card>
    );
  return (
    <div className="space-y-4">
      <Reveal>
        <Card>
          <CardHeader
            title="Open positions"
            subtitle={
              <span>
                {positions.length} open · floating <span className={cn("k-num font-medium", a.profit > 0 ? "text-up" : a.profit < 0 ? "text-down" : "")}>{fmtAmount(a.profit, cur, true)}</span> · manage and close them in Kalks Trader
              </span>
            }
            action={<TradeButton a={a} label="Manage in Trader" />}
          />
          <div className="mt-2 px-4 pb-5 sm:px-6">{positions.length ? <PositionsTable positions={positions} cur={cur} /> : <div className="py-6 text-center text-[13px] text-fg-3">No open positions.</div>}</div>
        </Card>
      </Reveal>
      {orders.length > 0 && (
        <Reveal delay={0.05}>
          <Card>
            <CardHeader title="Pending orders" subtitle={`${orders.length} waiting to trigger`} />
            <div className="mt-2 px-4 pb-5 sm:px-6">
              <OrdersTable orders={orders} />
            </div>
          </Card>
        </Reveal>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Overview                                                            */
/* ------------------------------------------------------------------ */

function OverviewPanel({ a, positions, onTab }: { a: EngineAccount; positions: EnginePosition[]; onTab: (t: TabKey) => void }) {
  const cur = curOf(a);
  const recent = usePoll<HistoryPage>(`accounts/${a.login}/history?limit=6`, 15000);
  const ml = a.marginLevel ?? 0;
  const tone = levelTone(a.marginLevel);
  const st = STATUS_LABEL[a.status];
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-12">
        <Reveal className="xl:col-span-5">
          <Card className="h-full">
            <CardHeader
              title="Margin"
              subtitle={`Margin call ${a.marginCallLevel}% · stop out ${a.stopOutLevel}%`}
              action={
                a.margin > 0 ? (
                  <Chip tone={a.marginCall ? "down" : tone === "up" ? "up" : tone === "warn" ? "warn" : "down"} dot>
                    {a.marginCall ? "Margin call" : tone === "up" ? "Healthy" : tone === "warn" ? "Watch" : "At risk"}
                  </Chip>
                ) : (
                  <Chip>No margin used</Chip>
                )
              }
            />
            <div className="flex justify-center py-2">
              <Gauge value={a.margin > 0 ? Math.min(ml, 3000) : 0} max={3000} size={180} display={fmtLevel(a.margin > 0 ? a.marginLevel : null)} label="Margin level" />
            </div>
            <div className="grid grid-cols-2 gap-2 px-4 pb-5 sm:px-6">
              <StatTile label="Balance">
                <Money value={a.balance} currency={cur} countUp={false} />
              </StatTile>
              <StatTile label="Equity">
                <Money value={a.equity} currency={cur} countUp={false} />
              </StatTile>
              <StatTile label="Margin">
                <Money value={a.margin} currency={cur} countUp={false} />
              </StatTile>
              <StatTile label="Free margin">
                <Money value={a.freeMargin} currency={cur} countUp={false} />
              </StatTile>
              <StatTile label="Credit">
                <Money value={a.credit + a.bonus} currency={cur} countUp={false} />
              </StatTile>
              <StatTile label="Floating P&L" tone={a.profit > 0 ? "up" : a.profit < 0 ? "down" : undefined}>
                {fmtAmount(a.profit, cur, true)}
              </StatTile>
            </div>
          </Card>
        </Reveal>
        <Reveal delay={0.05} className="xl:col-span-7">
          <Card className="h-full">
            <CardHeader
              title="Open positions"
              subtitle={`${a.positions} open · ${a.orders} pending`}
              action={
                <Button size="sm" variant="surface" onClick={() => onTab("positions")}>
                  All positions
                </Button>
              }
            />
            <div className="mt-4 space-y-2 px-4 pb-5 sm:px-6">
              {positions.slice(0, 5).map((p) => (
                <div key={p.ticket} className="k-row flex items-center gap-3 px-4 py-2.5">
                  <SymbolAvatar symbol={p.symbol} size={24} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 text-[13.5px] font-medium">
                      {p.symbol}
                      <Chip size="sm" tone={p.side === "buy" ? "up" : "down"}>
                        {p.side.toUpperCase()} {p.volume}
                      </Chip>
                    </div>
                    <div className="k-num mt-0.5 truncate font-mono text-[11px] text-fg-3">
                      {fmtPrice(p.openPrice)} → {fmtPrice(p.currentPrice)} · #{p.ticket}
                    </div>
                  </div>
                  <span className={cn("k-num text-[14px] font-semibold", p.profit > 0 ? "text-up" : p.profit < 0 ? "text-down" : "")}>{fmtAmount(p.profit, cur, true)}</span>
                </div>
              ))}
              {positions.length === 0 && <div className="py-8 text-center text-[13px] text-fg-3">No open positions. Trade in Kalks Trader and they appear here.</div>}
            </div>
          </Card>
        </Reveal>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-12">
        <Reveal delay={0.08} className="xl:col-span-7">
          <Card className="h-full">
            <CardHeader
              title="Recent deals"
              subtitle={recent.data ? `${recent.data.total} deals on this account` : "Latest entries and exits"}
              action={
                <Button size="sm" variant="surface" onClick={() => onTab("history")}>
                  Full history
                </Button>
              }
            />
            <div className="px-4 pb-5 pt-3 sm:px-6">
              {recent.loading && <Skeleton className="h-40 w-full rounded-[14px]" />}
              {recent.data && recent.data.deals.length > 0 && <DealsTable deals={recent.data.deals} cur={cur} />}
              {recent.data && recent.data.deals.length === 0 && <div className="py-8 text-center text-[13px] text-fg-3">No deals yet.</div>}
              {recent.error && !recent.data && <div className="py-8 text-center text-[13px] text-fg-3">{recent.error.message}</div>}
            </div>
          </Card>
        </Reveal>
        <Reveal delay={0.12} className="xl:col-span-5">
          <Card className="h-full">
            <CardHeader title="Account information" />
            <div className="px-6 pb-4 pt-1">
              <KeyValue
                rows={[
                  ["Type", `${a.type === "live" ? "Live" : "Demo"} · ${a.groupName}`],
                  ["Position mode", modeLabel(a.mode)],
                  ["Currency", a.cent ? "USC (US cents)" : a.currency],
                  ["Leverage", `1:${a.leverage.toLocaleString("en-US")}`],
                  ["Server", <span key="sv" className="font-mono">{serverOf(a)}</span>],
                  ["Status", <Chip key="st" size="sm" tone={st.tone}>{st.label}</Chip>],
                  ["Opened", fmtDate(a.createdAt)],
                ]}
              />
            </div>
          </Card>
        </Reveal>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */

function Detail() {
  const { login } = useParams<{ login: string }>();
  const sp = useSearchParams();
  const router = useRouter();
  const valid = /^\d{8}$/.test(login ?? "");
  const { data, error, loading, reload } = usePoll<AccountDetail>(valid ? `accounts/${login}` : null, 3000);
  const initial = (TAB_KEYS as readonly string[]).includes(sp.get("tab") ?? "") ? (sp.get("tab") as TabKey) : "overview";
  const [tab, setTabState] = React.useState<TabKey>(initial);
  const setTab = (t: TabKey) => {
    setTabState(t);
    router.replace(`/accounts/${login}${t === "overview" ? "" : `?tab=${t}`}`, { scroll: false });
  };

  if (!valid || (error && error.status === 404))
    return (
      <div className="pb-16">
        <Card className="mt-10">
          <EmptyState
            illustration="magnifying_glass_tilted_left"
            title={`Account #${login} not found`}
            text="It may belong to another profile. Check the login number and try again."
            action={
              <div className="flex gap-2">
                <Link href="/accounts">
                  <Button variant="surface">
                    <ArrowLeft /> My accounts
                  </Button>
                </Link>
                <Link href="/accounts/new">
                  <Button variant="ember">Open account</Button>
                </Link>
              </div>
            }
          />
        </Card>
      </div>
    );

  if (error && !data)
    return (
      <Card className="mt-10">
        <EmptyState
          illustration="satellite_antenna"
          title="This account is unavailable right now"
          text={error.message}
          action={
            <Button variant="surface" onClick={reload}>
              <RotateCw /> Try again
            </Button>
          }
        />
      </Card>
    );

  if (loading || !data)
    return (
      <div className="pb-16">
        <Skeleton className="mb-4 h-5 w-48" />
        <Skeleton className="h-[220px] w-full rounded-[20px]" />
        <Skeleton className="mt-6 h-10 w-full max-w-xl rounded-full" />
        <Skeleton className="mt-5 h-[320px] w-full rounded-[20px]" />
      </div>
    );

  const a = data.account;
  const cur = curOf(a);
  const lt = a.margin > 0 ? levelTone(a.marginLevel) : undefined;

  return (
    <div className="pb-16">
      <div className="mb-4 flex items-center gap-2 text-[13px] text-fg-3">
        <Link href="/accounts" className="inline-flex items-center gap-1.5 hover:text-fg">
          <ArrowLeft className="size-3.5" /> Accounts
        </Link>
        <span>/</span>
        <span className="font-mono text-fg-2">#{a.login}</span>
      </div>

      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}>
        <Card className="overflow-hidden">
          <div className="relative flex flex-col gap-6 p-6 lg:flex-row lg:items-end lg:justify-between">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <KindBadge type={a.type} />
                <h1 className="text-[20px] font-medium tracking-tight">
                  {a.groupName} · {modeLabel(a.mode)}
                </h1>
                {a.name && <span className="text-[14px] text-fg-3">“{a.name}”</span>}
                <StatusBadge a={a} />
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[13px] text-fg-2">
                <span className="inline-flex items-center gap-1 font-mono">
                  #{a.login}
                  <CopyButton value={String(a.login)} label="Login" />
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <Server className="size-3.5 text-fg-3" />
                  <span className="font-mono">{serverOf(a)}</span>
                </span>
                <Chip size="sm">1:{a.leverage.toLocaleString("en-US")}</Chip>
                <span className="text-fg-3">{a.cent ? "USC (cent)" : a.currency}</span>
              </div>
              <div className="k-label mt-5">Equity</div>
              <div className="mt-1 flex flex-wrap items-baseline gap-3">
                <Money value={a.equity} currency={cur} countUp={false} className="text-[40px] font-semibold leading-none tracking-[-0.02em] sm:text-[46px]" />
                {a.type === "live" && a.balance === 0 && a.equity === 0 && <Chip tone="warn">Not funded yet</Chip>}
              </div>
              <div className="mt-4 flex flex-wrap gap-x-6 gap-y-2 text-[13px]">
                <span className="text-fg-3">
                  Balance <Money value={a.balance} currency={cur} countUp={false} className="ml-1 font-medium text-fg" />
                </span>
                <span className="text-fg-3">
                  Free margin <Money value={a.freeMargin} currency={cur} countUp={false} className="ml-1 font-medium text-fg" />
                </span>
                <span className="text-fg-3">
                  Margin level <span className={cn("k-num ml-1 font-medium", lt === "up" && "text-up", lt === "warn" && "text-warn", lt === "down" && "text-down")}>{fmtLevel(a.margin > 0 ? a.marginLevel : null)}</span>
                </span>
                <span className="text-fg-3">
                  Floating P&L <span className={cn("k-num ml-1 font-medium", a.profit > 0 ? "text-up" : a.profit < 0 ? "text-down" : "text-fg")}>{fmtAmount(a.profit, cur, true)}</span>
                </span>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {a.type === "live" ? <FundButton a={a} size="md" /> : <RefillButton a={a} onDone={reload} size="md" />}
              <TradeButton a={a} size="lg" />
            </div>
          </div>
        </Card>
      </motion.div>

      <div className="-mx-4 mt-6 overflow-x-auto px-4 sm:mx-0 sm:px-0">
        <Tabs
          className="min-w-max"
          value={tab}
          onChange={setTab}
          tabs={[
            { value: "overview", label: "Overview" },
            { value: "positions", label: "Positions", count: a.positions + a.orders },
            { value: "history", label: "History" },
            { value: "ledger", label: "Ledger" },
            { value: "credentials", label: "Credentials" },
            { value: "settings", label: "Settings" },
          ]}
        />
      </div>

      <div className="mt-5">
        <AnimatePresence mode="wait">
          <motion.div key={tab} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }} transition={{ duration: 0.2 }}>
            {tab === "overview" && <OverviewPanel a={a} positions={data.positions} onTab={setTab} />}
            {tab === "positions" && <PositionsPanel a={a} positions={data.positions} orders={data.orders} />}
            {tab === "history" && <HistoryPanel a={a} />}
            {tab === "ledger" && <LedgerPanel a={a} />}
            {tab === "credentials" && <CredentialsPanel a={a} />}
            {tab === "settings" && <SettingsPanel a={a} onChanged={reload} />}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}

export function LiveAccountDetail() {
  return (
    <React.Suspense fallback={null}>
      <Detail />
    </React.Suspense>
  );
}
