"use client";

// Back Office for the ALGO service: overview + platform kill switch, strategies & deployments (kill per
// deployment / per user), marketplace moderation, API keys (revoke), webhook activity, platform settings.
// Data: /api/algo/* (app/api/algo/[...path]/route.ts → services/algo /v1/admin/*).

import * as React from "react";
import Link from "next/link";
import { Activity, Bot, KeyRound, Loader2, OctagonX, Percent, Power, ShieldAlert, Store, Webhook } from "lucide-react";
import { toast } from "sonner";
import { Button, Card, CardHeader, Chip, DataTable, Dialog, KpiCard, PageHeader, Tabs, Toggle, cn, type Column } from "@kalks/ui";
import { IS_DEMO } from "@kalks/mock/mode";
import { useStaff } from "@/components/staff-session";
import { ErrorState, TableSkeleton, sendJson, useApi, when } from "@/components/live/kit";
import { algoAllows, type AlgoPerm } from "@/lib/algo-perms";

function useAlgoCan(perm: AlgoPerm) {
  const s = useStaff();
  return IS_DEMO || algoAllows(s, perm);
}

const money = (v: number | null | undefined) => (v === null || v === undefined ? "–" : `${v < 0 ? "−" : ""}$${Math.abs(v).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`);

/** Asks for the audit note, then runs the action. */
function useNoted() {
  const [st, setSt] = React.useState<{ title: string; text?: string; confirm: string; danger?: boolean; extra?: (v: boolean, set: (b: boolean) => void) => React.ReactNode; run: (note: string, flag: boolean) => Promise<void> } | null>(null);
  const [note, setNote] = React.useState("");
  const [flag, setFlag] = React.useState(true);
  const [busy, setBusy] = React.useState(false);
  const dialog = (
    <Dialog
      open={!!st}
      onOpenChange={(o) => !o && setSt(null)}
      title={st?.title ?? ""}
      description={st?.text}
      width={480}
      footer={
        <>
          <Button variant="surface" onClick={() => setSt(null)}>
            Cancel
          </Button>
          <Button
            variant={st?.danger ? "sell" : "ember"}
            disabled={busy || !note.trim()}
            onClick={async () => {
              setBusy(true);
              try {
                await st!.run(note.trim(), flag);
                setSt(null);
                setNote("");
              } finally {
                setBusy(false);
              }
            }}
          >
            {busy && <Loader2 className="animate-spin" />} {st?.confirm}
          </Button>
        </>
      }
    >
      <div className="space-y-3 text-[13px]">
        {st?.extra?.(flag, setFlag)}
        <label className="block">
          <span className="text-fg-3">Note for the audit log</span>
          <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={3} aria-label="Audit note" className="mt-1 w-full rounded-[12px] border border-line bg-surface-2 px-3 py-2 text-fg outline-none focus:border-ember/50" />
        </label>
      </div>
    </Dialog>
  );
  return { ask: (s: NonNullable<typeof st>) => (setFlag(true), setSt(s)), dialog };
}

async function act(url: string, body: Record<string, unknown>, ok: string, method: "POST" | "PUT" = "POST") {
  const r = await sendJson<Record<string, unknown>>(url, body, method);
  if (r.ok) toast.success(ok);
  else toast.error(r.error.message);
  return r;
}

/* ------------------------------------------------------------------ */
/* Overview                                                            */
/* ------------------------------------------------------------------ */

interface Overview {
  strategies: number;
  deploymentsRunning: number;
  deploymentsLive: number;
  openPositions: number;
  backtests24h: number;
  backtestsQueued: number;
  webhookEvents24h: number;
  webhookRejected24h: number;
  apiKeysActive: number;
  apiRequests24h: number;
  listingsPending: number;
  listingsApproved: number;
  subscriptionsActive: number;
  usersKilled: number;
  aiRequests24h: number;
  revenue30d: { gross: number; platformFees: number };
  ordersBySource24h: { source: string; count: number }[];
  globalKill: boolean;
  settings: Record<string, number | boolean>;
}

function GlobalKill({ on, onDone }: { on: boolean; onDone: () => void }) {
  const can = useAlgoCan("algo.settings");
  const n = useNoted();
  return (
    <Card className={cn(on && "border-down/50")}>
      <CardHeader icon={<ShieldAlert />} title="Platform kill switch" subtitle="Halts every strategy, webhook alert and API order for all clients" />
      <div className="space-y-3 px-6 pb-5 pt-4 text-[13px]">
        <div className={cn("flex items-center gap-2 font-medium", on ? "text-down" : "text-up")}>
          {on ? <OctagonX className="size-4" /> : <Power className="size-4" />} {on ? "ON: automated trading is halted" : "Off: automation running normally"}
        </div>
        <Button
          variant={on ? "surface" : "down-outline"}
          disabled={!can}
          className="w-full"
          onClick={() =>
            n.ask({
              title: on ? "Release the platform kill switch?" : "Halt all automated trading?",
              text: on ? "Strategies stay stopped; clients can redeploy them. Webhooks and the API accept orders again." : "New strategy, webhook and API orders are refused for every client until you release it.",
              confirm: on ? "Release" : "Halt all",
              danger: !on,
              extra: on ? undefined : (v, set) => (
                <label className="flex items-center justify-between gap-3">
                  <span>
                    Also kill running deployments and close their positions
                    <span className="block text-[12px] text-fg-3">Otherwise running strategies just stop sending new orders</span>
                  </span>
                  <Toggle checked={v} onChange={set} label="Close positions" />
                </label>
              ),
              run: async (note, flag) => {
                const r = await act("/api/algo/settings", { settings: { globalKill: !on }, closePositions: !on && flag, note }, on ? "Kill switch released" : "Automated trading halted", "PUT");
                if (r.ok) onDone();
              },
            })
          }
        >
          {on ? <Power /> : <OctagonX />} {on ? "Release" : "Halt all automated trading"}
        </Button>
        {!can && <p className="text-[11.5px] text-fg-3">Only admins can use the platform kill switch.</p>}
      </div>
      {n.dialog}
    </Card>
  );
}

export function AlgoOverviewPage() {
  const o = useApi<Overview>("/api/algo/overview", { refreshMs: 10000 });
  const d = o.data;
  return (
    <>
      <PageHeader title="Algo & API" subtitle="Client strategies running 24/7, webhooks, public API keys and the strategy marketplace." />
      {o.error && <ErrorState error={o.error} onRetry={o.reload} />}
      {d && (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <KpiCard label="Strategies running" icon={<Bot />} value={<span className="k-num">{d.deploymentsRunning}</span>} chip={`${d.deploymentsLive} on live accounts · ${d.openPositions} open positions`} href="/algo/deployments" />
            <KpiCard label="Webhook alerts · 24h" icon={<Webhook />} value={<span className="k-num">{d.webhookEvents24h}</span>} chip={`${d.webhookRejected24h} rejected`} chipTone={d.webhookRejected24h ? "warn" : "neutral"} href="/algo/webhooks" delay={0.05} />
            <KpiCard label="API requests · 24h" icon={<KeyRound />} value={<span className="k-num">{d.apiRequests24h.toLocaleString("en-US")}</span>} chip={`${d.apiKeysActive} active keys`} href="/algo/keys" delay={0.1} />
            <KpiCard label="Marketplace" icon={<Store />} hot value={<span className="k-num">{d.listingsApproved}</span>} chip={`${d.listingsPending} awaiting review · ${d.subscriptionsActive} subscriptions`} chipTone={d.listingsPending ? "warn" : "neutral"} href="/algo/marketplace" delay={0.15} />
          </div>
          <div className="mt-5 grid grid-cols-1 gap-5 xl:grid-cols-3">
            <GlobalKill on={d.globalKill} onDone={o.reload} />
            <Card>
              <CardHeader icon={<Activity />} title="Orders by source · 24h" subtitle="Tagged on every order (D84)" />
              <div className="space-y-2 px-6 pb-5 pt-4">
                {d.ordersBySource24h.map((s) => (
                  <div key={s.source} className="flex items-center justify-between text-[13px]">
                    <Chip size="sm">{s.source}</Chip>
                    <span className="k-num text-fg">{s.count}</span>
                  </div>
                ))}
                <div className="flex items-center justify-between border-t border-line pt-2 text-[12.5px] text-fg-3">
                  <span>Backtests · 24h</span>
                  <span className="k-num">
                    {d.backtests24h} ({d.backtestsQueued} queued)
                  </span>
                </div>
                <div className="flex items-center justify-between text-[12.5px] text-fg-3">
                  <span>AI assistant requests · 24h</span>
                  <span className="k-num">{d.aiRequests24h}</span>
                </div>
                <div className="flex items-center justify-between text-[12.5px] text-fg-3">
                  <span>Clients with kill switch on</span>
                  <span className="k-num">{d.usersKilled}</span>
                </div>
              </div>
            </Card>
            <Card>
              <CardHeader icon={<Percent />} title="Marketplace revenue · 30 days" subtitle={`Platform cut ${d.settings.platformCutPct}%`} />
              <div className="space-y-2 px-6 pb-5 pt-4 text-[13px]">
                <div className="flex justify-between">
                  <span className="text-fg-3">Subscriptions charged</span>
                  <span className="k-num">{d.revenue30d.gross.toFixed(2)} USDT</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-fg-3">Platform fees kept</span>
                  <span className="k-num text-up">{d.revenue30d.platformFees.toFixed(2)} USDT</span>
                </div>
                <Link href="/algo/settings" className="inline-block pt-2 text-[12.5px] text-ember hover:underline">
                  Settings and limits
                </Link>
              </div>
            </Card>
          </div>
        </>
      )}
      {o.loading && !d && <TableSkeleton />}
    </>
  );
}

/* ------------------------------------------------------------------ */
/* Deployments & strategies                                            */
/* ------------------------------------------------------------------ */

interface Dep {
  id: number;
  userId: number;
  strategyName: string;
  symbol: string;
  timeframe: string;
  version: number;
  login: number;
  accountType: string;
  status: string;
  stats: { trades?: number; realized?: number; orders?: number };
  openPositions: number;
  lastEvalAt: string | null;
  subscriptionId: number | null;
  stopReason: string | null;
  createdAt: string;
}

export function AlgoDeploymentsPage() {
  const can = useAlgoCan("algo.write");
  const [status, setStatus] = React.useState<"active" | "all">("active");
  const [tab, setTab] = React.useState<"deployments" | "strategies">("deployments");
  const deps = useApi<{ items: Dep[]; alerts: { deploymentId: number; at: string; level: string; kind: string; message: string }[] }>(`/api/algo/deployments${status === "active" ? "?status=active" : ""}`, { refreshMs: 8000 });
  const strats = useApi<{ items: { id: number; userId: number; name: string; symbol: string; timeframe: string; kind: string; origin: string; version: number; running: number; backtests: number; updatedAt: string }[] }>(tab === "strategies" ? "/api/algo/strategies" : null);
  const n = useNoted();
  const kill = (d: Dep) =>
    n.ask({
      title: `Kill deployment #${d.id}?`,
      text: `“${d.strategyName}” on ${d.accountType} #${d.login} (client ${d.userId}) stops at once.`,
      confirm: "Kill",
      danger: true,
      extra: (v, set) => (
        <label className="flex items-center justify-between">
          Close its open positions <Toggle checked={v} onChange={set} label="Close positions" />
        </label>
      ),
      run: async (note, flag) => {
        const r = await act(`/api/algo/deployments/${d.id}/kill`, { note, closePositions: flag }, `Deployment #${d.id} killed`);
        if (r.ok) deps.reload();
      },
    });
  const killUser = (userId: number) =>
    n.ask({
      title: `Stop all automation of client ${userId}?`,
      text: "Every deployment is killed and the client's webhooks and API orders are refused until released.",
      confirm: "Kill client automation",
      danger: true,
      extra: (v, set) => (
        <label className="flex items-center justify-between">
          Close positions opened by strategies, webhooks and the API <Toggle checked={v} onChange={set} label="Close positions" />
        </label>
      ),
      run: async (note, flag) => {
        const r = await act(`/api/algo/users/${userId}/kill`, { note, killed: true, closePositions: flag }, `Client ${userId} halted`);
        if (r.ok) deps.reload();
      },
    });
  const cols: Column<Dep>[] = [
    { key: "id", header: "#", cell: (d) => <span className="font-mono text-fg-3">{d.id}</span>, sort: (d) => d.id },
    { key: "s", header: "Strategy", cell: (d) => <div><div className="text-fg">{d.strategyName} <span className="text-fg-3">v{d.version}</span></div><div className="font-mono text-[11px] text-fg-3">{d.symbol} {d.timeframe}{d.subscriptionId ? " · marketplace copy" : ""}</div></div>, sort: (d) => d.strategyName },
    { key: "c", header: "Client / account", cell: (d) => <div className="font-mono text-[12px]"><div>client {d.userId}</div><div className="text-fg-3">{d.accountType} #{d.login}</div></div>, sort: (d) => d.userId },
    { key: "st", header: "Status", cell: (d) => <Chip size="sm" tone={d.status === "running" ? "ember" : d.status === "killed" || d.status === "error" ? "down" : "neutral"} dot={d.status === "running"}>{d.status}</Chip>, sort: (d) => d.status },
    { key: "t", header: "Trades", align: "right", cell: (d) => <span className="k-num">{d.stats.trades ?? 0}</span>, sort: (d) => d.stats.trades ?? 0 },
    { key: "p", header: "Realized", align: "right", cell: (d) => <span className={cn("k-num", Number(d.stats.realized ?? 0) >= 0 ? "text-up" : "text-down")}>{money(Number(d.stats.realized ?? 0))}</span>, sort: (d) => Number(d.stats.realized ?? 0) },
    { key: "o", header: "Open", align: "right", cell: (d) => <span className="k-num">{d.openPositions}</span> },
    { key: "e", header: "Last bar", cell: (d) => <span className="text-[12px] text-fg-3">{when(d.lastEvalAt)}</span>, hideOn: "lg" },
    {
      key: "a",
      header: "",
      align: "right",
      cell: (d) =>
        can ? (
          <div className="flex justify-end gap-1.5">
            {(d.status === "running" || d.status === "paused") && (
              <Button size="xs" variant="down-outline" onClick={() => kill(d)}>
                Kill
              </Button>
            )}
            <Button size="xs" variant="ghost" onClick={() => killUser(d.userId)}>
              Kill client
            </Button>
          </div>
        ) : null,
    },
  ];
  return (
    <>
      <PageHeader title="Strategies & deployments" subtitle="Every client strategy running on the servers, with its account, results and kill switches." />
      <Tabs value={tab} onChange={setTab} tabs={[{ value: "deployments", label: "Deployments", count: deps.data?.items.length }, { value: "strategies", label: "Strategies" }]} className="mb-5" />
      {tab === "deployments" ? (
        <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1fr)_380px]">
          <Card>
            <CardHeader title="Deployments" action={<Tabs value={status} onChange={setStatus} tabs={[{ value: "active", label: "Active" }, { value: "all", label: "All" }]} />} />
            <div className="px-6 pb-6 pt-4">{deps.error ? <ErrorState error={deps.error} onRetry={deps.reload} /> : deps.loading && !deps.data ? <TableSkeleton /> : <DataTable columns={cols} rows={deps.data?.items ?? []} pageSize={15} search={(d) => `${d.strategyName} ${d.userId} ${d.login} ${d.symbol}`} exportName="algo-deployments" rowKey={(d) => String(d.id)} empty={<div className="py-8 text-center text-fg-3">No deployments</div>} />}</div>
          </Card>
          <Card>
            <CardHeader title="Warnings and errors" subtitle="Latest runtime log lines" />
            <div className="max-h-[560px] space-y-2 overflow-y-auto px-6 pb-6 pt-4 text-[12px]">
              {(deps.data?.alerts ?? []).map((a, i) => (
                <div key={i} className="border-b border-line/60 pb-2">
                  <div className="flex items-center gap-2 text-fg-3">
                    <span className="font-mono">#{a.deploymentId}</span> {when(a.at)}
                    <Chip size="sm" tone={a.level === "error" ? "down" : "warn"}>{a.kind}</Chip>
                  </div>
                  <div className={a.level === "error" ? "text-down" : "text-warn"}>{a.message}</div>
                </div>
              ))}
              {deps.data && deps.data.alerts.length === 0 && <p className="text-fg-3">No warnings.</p>}
            </div>
          </Card>
        </div>
      ) : (
        <Card>
          <div className="px-6 pb-6 pt-5">
            {strats.loading && !strats.data ? (
              <TableSkeleton />
            ) : (
              <DataTable
                rows={strats.data?.items ?? []}
                pageSize={20}
                search={(s) => `${s.name} ${s.symbol} ${s.userId}`}
                exportName="algo-strategies"
                rowKey={(s) => String(s.id)}
                columns={[
                  { key: "n", header: "Strategy", cell: (s) => <div><div className="text-fg">{s.name}</div><div className="font-mono text-[11px] text-fg-3">{s.symbol} {s.timeframe} · v{s.version}</div></div>, sort: (s) => s.name },
                  { key: "u", header: "Client", cell: (s) => <span className="font-mono">{s.userId}</span>, sort: (s) => s.userId },
                  { key: "k", header: "Type", cell: (s) => <Chip size="sm">{s.kind}</Chip> },
                  { key: "o", header: "Origin", cell: (s) => <span className="text-fg-2">{s.origin}</span> },
                  { key: "r", header: "Running", align: "right", cell: (s) => <span className="k-num">{s.running}</span>, sort: (s) => s.running },
                  { key: "b", header: "Backtests", align: "right", cell: (s) => <span className="k-num">{s.backtests}</span>, sort: (s) => s.backtests },
                  { key: "d", header: "Updated", cell: (s) => <span className="text-[12px] text-fg-3">{when(s.updatedAt)}</span>, sort: (s) => s.updatedAt },
                ]}
              />
            )}
          </div>
        </Card>
      )}
      {n.dialog}
    </>
  );
}

/* ------------------------------------------------------------------ */
/* Marketplace moderation                                              */
/* ------------------------------------------------------------------ */

interface AdminListing {
  id: number;
  title: string;
  description: string;
  author: string;
  authorUserId: number;
  symbol: string;
  timeframe: string;
  priceMonthly: number;
  status: string;
  moderationNote: string | null;
  moderatedBy: string | null;
  subscribers: number;
  rating: number;
  allowClone: boolean;
  createdAt: string;
  track: { trades: number; winRate: number; returnPct: number; maxDrawdownPct: number; days: number; accountType: string };
}

export function AlgoMarketplacePage() {
  const can = useAlgoCan("algo.write");
  const [tab, setTab] = React.useState<"pending" | "approved" | "all">("pending");
  const l = useApi<{ items: AdminListing[] }>(`/api/algo/listings${tab === "all" ? "" : `?status=${tab}`}`);
  const pays = useApi<{ payments: { id: number; title: string; author: string; userId: number; amount: number; platformFee: number; authorAmount: number; status: string; error: string | null; createdAt: string }[] }>(tab === "all" ? "/api/algo/subscriptions" : null);
  const n = useNoted();
  const moderate = (x: AdminListing, status: "approved" | "rejected" | "suspended") =>
    n.ask({
      title: `${status === "approved" ? "Approve" : status === "rejected" ? "Reject" : "Suspend"} “${x.title}”?`,
      text: status === "approved" ? "It appears in the client marketplace with its verified track record." : "The author sees your note.",
      confirm: status === "approved" ? "Approve" : status === "rejected" ? "Reject" : "Suspend",
      danger: status !== "approved",
      run: async (note) => {
        const r = await act(`/api/algo/listings/${x.id}/moderate`, { status, note }, `Listing ${status}`);
        if (r.ok) l.reload();
      },
    });
  return (
    <>
      <PageHeader title="Marketplace moderation" subtitle="Review strategies before clients can subscribe. Track records come from the author's own deployment, computed from engine deals." />
      <Tabs value={tab} onChange={setTab} tabs={[{ value: "pending", label: "Awaiting review" }, { value: "approved", label: "Live" }, { value: "all", label: "All + payments" }]} className="mb-5" />
      {l.error && <ErrorState error={l.error} onRetry={l.reload} />}
      <div className="space-y-3">
        {(l.data?.items ?? []).map((x) => (
          <Card key={x.id} className="px-6 py-5" data-testid={`admin-listing-${x.id}`}>
            <div className="flex flex-wrap items-start gap-3">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-[16px] font-medium text-fg">{x.title}</span>
                  <Chip size="sm" tone={x.status === "approved" ? "up" : x.status === "pending" ? "warn" : "down"}>{x.status}</Chip>
                  <Chip size="sm" tone={x.priceMonthly > 0 ? "gold" : "neutral"}>{x.priceMonthly > 0 ? `${x.priceMonthly} USDT/mo` : "Free"}</Chip>
                  {x.allowClone && <Chip size="sm">clone allowed</Chip>}
                </div>
                <div className="mt-0.5 text-[12px] text-fg-3">
                  by {x.author} (client {x.authorUserId}) · {x.symbol} {x.timeframe} · submitted {when(x.createdAt)} · {x.subscribers} subscribers
                </div>
                <p className="mt-2 whitespace-pre-line text-[13px] text-fg-2">{x.description}</p>
                {x.moderationNote && <p className="mt-1 text-[12px] text-fg-3">Note: {x.moderationNote} ({x.moderatedBy})</p>}
              </div>
              <div className="grid grid-cols-2 gap-2 text-[12px] sm:grid-cols-4">
                {(
                  [
                    ["Return", `${x.track.returnPct.toFixed(2)}%`],
                    ["Win rate", `${x.track.winRate.toFixed(1)}%`],
                    ["Max DD", `${x.track.maxDrawdownPct.toFixed(2)}%`],
                    ["Trades", `${x.track.trades} · ${x.track.days.toFixed(1)}d ${x.track.accountType}`],
                  ] as const
                ).map(([k, v]) => (
                  <div key={k} className="rounded-[10px] bg-surface-2/60 px-3 py-1.5">
                    <div className="text-fg-3">{k}</div>
                    <div className="k-num text-fg">{v}</div>
                  </div>
                ))}
              </div>
            </div>
            {can && (
              <div className="mt-3 flex gap-2">
                {x.status !== "approved" && (
                  <Button size="sm" variant="ember" onClick={() => moderate(x, "approved")}>
                    Approve
                  </Button>
                )}
                {x.status === "pending" && (
                  <Button size="sm" variant="surface" onClick={() => moderate(x, "rejected")}>
                    Reject
                  </Button>
                )}
                {x.status === "approved" && (
                  <Button size="sm" variant="down-outline" onClick={() => moderate(x, "suspended")}>
                    Suspend
                  </Button>
                )}
              </div>
            )}
          </Card>
        ))}
        {l.data && l.data.items.length === 0 && <Card className="py-12 text-center text-fg-3">Nothing here.</Card>}
      </div>
      {tab === "all" && (
        <Card className="mt-5">
          <CardHeader title="Subscription payments" subtitle="Charged from the subscriber's wallet; the author gets the price minus the platform cut" />
          <div className="px-6 pb-6 pt-4">
            <DataTable
              rows={pays.data?.payments ?? []}
              pageSize={15}
              exportName="algo-subscription-payments"
              rowKey={(p) => String(p.id)}
              empty={<div className="py-6 text-center text-fg-3">No payments yet</div>}
              columns={[
                { key: "t", header: "Listing", cell: (p) => <div><div className="text-fg">{p.title}</div><div className="text-[11px] text-fg-3">by {p.author} · subscriber {p.userId}</div></div> },
                { key: "a", header: "Amount", align: "right", cell: (p) => <span className="k-num">{p.amount.toFixed(2)}</span> },
                { key: "f", header: "Platform", align: "right", cell: (p) => <span className="k-num text-up">{p.platformFee.toFixed(2)}</span> },
                { key: "u", header: "Author", align: "right", cell: (p) => <span className="k-num">{p.authorAmount.toFixed(2)}</span> },
                { key: "s", header: "Status", cell: (p) => <Chip size="sm" tone={p.status === "completed" ? "up" : "down"}>{p.status}</Chip> },
                { key: "d", header: "When", cell: (p) => <span className="text-[12px] text-fg-3">{when(p.createdAt)}</span> },
              ]}
            />
          </div>
        </Card>
      )}
      {n.dialog}
    </>
  );
}

/* ------------------------------------------------------------------ */
/* API keys                                                            */
/* ------------------------------------------------------------------ */

interface AdminKey {
  id: number;
  userId: number;
  name: string;
  keyId: string;
  login: number;
  accountType: string;
  scopes: string[];
  ipWhitelist: string[];
  expiresAt: string | null;
  status: string;
  lastUsedAt: string | null;
  lastIp: string | null;
  requests24h: number;
  revokedBy: string | null;
  createdAt: string;
}

export function AlgoKeysPage() {
  const can = useAlgoCan("algo.write");
  const k = useApi<{ items: AdminKey[] }>("/api/algo/keys", { refreshMs: 15000 });
  const n = useNoted();
  const revoke = (x: AdminKey) =>
    n.ask({
      title: `Revoke key ${x.keyId}?`,
      text: `“${x.name}” of client ${x.userId} stops working at once.`,
      confirm: "Revoke",
      danger: true,
      run: async (note) => {
        const r = await act(`/api/algo/keys/${x.id}/revoke`, { note }, "Key revoked");
        if (r.ok) k.reload();
      },
    });
  return (
    <>
      <PageHeader title="API keys" subtitle="Client keys for the public REST API: scopes, IP whitelist, expiry and usage." />
      <Card>
        <div className="px-6 pb-6 pt-5">
          {k.error ? (
            <ErrorState error={k.error} onRetry={k.reload} />
          ) : (
            <DataTable
              rows={k.data?.items ?? []}
              pageSize={20}
              search={(x) => `${x.name} ${x.keyId} ${x.userId} ${x.login}`}
              exportName="algo-api-keys"
              rowKey={(x) => String(x.id)}
              empty={<div className="py-8 text-center text-fg-3">No API keys</div>}
              columns={[
                { key: "k", header: "Key", cell: (x) => <div><div className="text-fg">{x.name}</div><div className="font-mono text-[11px] text-fg-3">{x.keyId}</div></div>, sort: (x) => x.name },
                { key: "u", header: "Client / account", cell: (x) => <div className="font-mono text-[12px]"><div>client {x.userId}</div><div className="text-fg-3">{x.accountType} #{x.login}</div></div>, sort: (x) => x.userId },
                { key: "s", header: "Scopes", cell: (x) => <div className="flex gap-1">{x.scopes.map((s) => <Chip key={s} size="sm" tone={s === "trade" ? "ember" : "up"}>{s}</Chip>)}</div> },
                { key: "i", header: "IP whitelist", cell: (x) => <span className="text-[12px] text-fg-3">{x.ipWhitelist.length ? x.ipWhitelist.join(", ") : "any"}</span>, hideOn: "lg" },
                { key: "r", header: "Req · 24h", align: "right", cell: (x) => <span className="k-num">{x.requests24h}</span>, sort: (x) => x.requests24h },
                { key: "l", header: "Last used", cell: (x) => <span className="text-[12px] text-fg-3">{when(x.lastUsedAt)}{x.lastIp ? ` · ${x.lastIp}` : ""}</span> },
                { key: "st", header: "Status", cell: (x) => <Chip size="sm" tone={x.status === "active" ? "up" : "neutral"}>{x.status}</Chip>, sort: (x) => x.status },
                { key: "a", header: "", align: "right", cell: (x) => (can && x.status === "active" ? <Button size="xs" variant="down-outline" onClick={() => revoke(x)}>Revoke</Button> : x.revokedBy ? <span className="text-[11px] text-fg-3">by {x.revokedBy}</span> : null) },
              ]}
            />
          )}
        </div>
      </Card>
      {n.dialog}
    </>
  );
}

/* ------------------------------------------------------------------ */
/* Webhook activity                                                    */
/* ------------------------------------------------------------------ */

export function AlgoWebhooksPage() {
  const [status, setStatus] = React.useState<"all" | "accepted" | "failed" | "blocked" | "rejected">("all");
  const w = useApi<{ events: { id: number; webhookId: number; webhook: string; userId: number; receivedAt: string; ip: string | null; payload: Record<string, unknown> | null; status: string; error: string | null; results: { login: number; status: string; error?: string; ticket?: number }[] }[]; webhooks: { id: number; userId: number; name: string; status: string; routes: number; lastUsedAt: string | null }[] }>(`/api/algo/webhooks${status === "all" ? "" : `?status=${status}`}`, { refreshMs: 10000 });
  return (
    <>
      <PageHeader title="Webhook activity" subtitle="TradingView-style alerts received by client webhooks, with the result on each routed account." />
      <Tabs value={status} onChange={setStatus} tabs={[{ value: "all", label: "All" }, { value: "accepted", label: "Accepted" }, { value: "failed", label: "Failed" }, { value: "rejected", label: "Rejected" }, { value: "blocked", label: "Blocked" }]} className="mb-5" />
      <Card>
        <div className="px-6 pb-6 pt-5">
          {w.error ? (
            <ErrorState error={w.error} onRetry={w.reload} />
          ) : (
            <DataTable
              rows={w.data?.events ?? []}
              pageSize={25}
              search={(e) => `${e.webhook} ${e.userId} ${JSON.stringify(e.payload)}`}
              exportName="algo-webhook-events"
              rowKey={(e) => String(e.id)}
              empty={<div className="py-8 text-center text-fg-3">No alerts</div>}
              columns={[
                { key: "t", header: "Received", cell: (e) => <span className="text-[12px] text-fg-2">{when(e.receivedAt, true)}</span>, sort: (e) => e.receivedAt },
                { key: "w", header: "Webhook", cell: (e) => <div><div className="text-fg">{e.webhook}</div><div className="text-[11px] text-fg-3">client {e.userId}</div></div> },
                { key: "p", header: "Alert", cell: (e) => <span className="font-mono text-[11.5px]">{String(e.payload?.action ?? "")} {String(e.payload?.symbol ?? "")}</span> },
                { key: "s", header: "Status", cell: (e) => <div><Chip size="sm" tone={e.status === "accepted" ? "up" : e.status === "partial" ? "warn" : "down"}>{e.status}</Chip>{e.error && <div className="mt-0.5 text-[11px] text-down">{e.error}</div>}</div>, sort: (e) => e.status },
                { key: "r", header: "Accounts", cell: (e) => <div className="text-[11.5px]">{e.results.map((r, i) => <div key={i} className={r.status === "rejected" ? "text-down" : "text-fg-2"}>#{r.login} {r.status}{r.ticket ? ` #${r.ticket}` : ""}{r.error ? ` · ${r.error}` : ""}</div>)}</div> },
                { key: "i", header: "IP", cell: (e) => <span className="font-mono text-[11px] text-fg-3">{e.ip}</span>, hideOn: "lg" },
              ]}
            />
          )}
        </div>
      </Card>
    </>
  );
}

/* ------------------------------------------------------------------ */
/* Settings                                                            */
/* ------------------------------------------------------------------ */

const FIELDS: { key: string; label: string; hint: string; step: number; suffix: string }[] = [
  { key: "platformCutPct", label: "Platform cut", hint: "Kept from every paid marketplace subscription", step: 1, suffix: "%" },
  { key: "apiRatePerMin", label: "API rate limit", hint: "Requests per minute per key (default)", step: 10, suffix: "/ min" },
  { key: "webhookRatePerMin", label: "Webhook rate limit", hint: "Alerts per minute per webhook URL", step: 5, suffix: "/ min" },
  { key: "maxDeploymentsPerUser", label: "Strategies per client", hint: "Running or paused at the same time", step: 1, suffix: "" },
  { key: "minTrackTrades", label: "Track record to publish", hint: "Closed trades a deployment needs before listing", step: 1, suffix: "trades" },
  { key: "aiPerHour", label: "AI assistant", hint: "Requests per client per hour", step: 5, suffix: "/ hour" },
  { key: "backtestsPerDay", label: "Backtests", hint: "Per client per day", step: 10, suffix: "/ day" },
];

export function AlgoSettingsPage() {
  const can = useAlgoCan("algo.settings");
  const s = useApi<{ settings: Record<string, number | boolean> }>("/api/algo/settings");
  const audit = useApi<{ items: { id: number; at: string; actor: string; action: string; target: string | null; data: Record<string, unknown> }[] }>("/api/algo/audit?limit=100");
  const [draft, setDraft] = React.useState<Record<string, number> | null>(null);
  const n = useNoted();
  const cur = { ...(s.data?.settings ?? {}), ...(draft ?? {}) } as Record<string, number>;
  return (
    <>
      <PageHeader title="Algo settings" subtitle="Marketplace platform cut, rate limits and client limits for automated trading." />
      <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
        <Card>
          <CardHeader title="Limits and fees" subtitle={can ? "Changes apply at once and are audited" : "Read-only for your role"} />
          <div className="px-6 pb-6 pt-4">
            {FIELDS.map((f) => (
              <div key={f.key} className="flex items-center justify-between gap-4 border-b border-line/60 py-3">
                <div>
                  <div className="text-[13.5px] text-fg">{f.label}</div>
                  <div className="text-[12px] text-fg-3">{f.hint}</div>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    aria-label={f.label}
                    disabled={!can}
                    step={f.step}
                    value={cur[f.key] ?? ""}
                    onChange={(e) => setDraft({ ...(draft ?? {}), [f.key]: Number(e.target.value) })}
                    className="k-num h-9 w-24 rounded-[10px] border border-line bg-surface-2 px-2 text-right text-[13px] text-fg outline-none focus:border-ember/50"
                  />
                  <span className="w-12 text-[12px] text-fg-3">{f.suffix}</span>
                </div>
              </div>
            ))}
            {can && (
              <div className="mt-4 flex gap-2">
                <Button
                  variant="ember"
                  disabled={!draft}
                  onClick={() =>
                    n.ask({
                      title: "Save algo settings?",
                      confirm: "Save",
                      run: async (note) => {
                        const r = await act("/api/algo/settings", { settings: draft, note }, "Settings saved", "PUT");
                        if (r.ok) {
                          setDraft(null);
                          s.reload();
                          audit.reload();
                        }
                      },
                    })
                  }
                >
                  Save changes
                </Button>
                {draft && (
                  <Button variant="surface" onClick={() => setDraft(null)}>
                    Discard
                  </Button>
                )}
              </div>
            )}
          </div>
        </Card>
        <Card>
          <CardHeader title="Audit" subtitle="Kill switches, moderation, revocations, settings and client actions" />
          <div className="max-h-[600px] space-y-2 overflow-y-auto px-6 pb-6 pt-4 text-[12.5px]">
            {(audit.data?.items ?? []).map((a) => (
              <div key={a.id} className="border-b border-line/60 pb-2">
                <div className="flex items-center gap-2">
                  <Chip size="sm">{a.action}</Chip>
                  <span className="font-mono text-fg-3">{a.target}</span>
                  <span className="ml-auto text-[11px] text-fg-3">{when(a.at)}</span>
                </div>
                <div className="mt-0.5 text-[11.5px] text-fg-3">
                  {a.actor}
                  {typeof a.data.note === "string" ? ` · “${a.data.note}”` : ""}
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>
      {n.dialog}
    </>
  );
}

