"use client";

/**
 * House accounts (Social & Algo → House accounts). Platform-owned accounts that each run one automated strategy
 * on a live account through the ALGO runtime, so copy trading and the strategy marketplace are not empty at
 * launch. Their track record is only what they trade live; clients see them labelled "House strategy ·
 * Operated by Kalks". The backtest shown here is a backtest (simulated), never presented as live history.
 *
 * Data: /api/house/* (app/api/house/[...path]/route.ts) → algo service /v1/admin/house/*.
 */
import * as React from "react";
import { Building2, Eye, EyeOff, MoreHorizontal, Play, Plus, Power, RefreshCw, RotateCcw, Trash2, Wallet } from "lucide-react";
import { Button, Card, CardHeader, Chip, DataTable, Dialog, EmptyState, EquityChart, IconButton, Input, KpiCard, Menu, PageHeader, Reveal, Toggle, cn, type Column } from "@kalks/ui";
import { MiniStat, Section } from "@/components/config/kit";
import { TableSkeleton, ago, sendJson, useApi, useNow, when } from "@/components/live/kit";
import { Checkbox } from "@/components/trading-desk/kit";
import { Pct, SocialError, int, useNoteAction, useSocialCan, usd, type WriteResult } from "./kit";

/* ------------------------------------------------------------------ */
/* Shapes (services/algo src/api/house.rs)                             */
/* ------------------------------------------------------------------ */

type DeploymentInfo = {
  id: number;
  status: "running" | "paused" | "stopped" | "killed" | "error";
  lastEvalAt: string | null;
  lastBarT: number | null;
  stats: { trades?: number; wins?: number; realized?: number; open?: number; orders?: number } | null;
  error: string | null;
  stopReason: string | null;
  openPositions: number;
  lastSignalAt: string | null;
  lastOrderAt: string | null;
  since: string | null;
};

type BacktestSummary = { netProfit?: number; returnPct?: number; trades?: number; winRate?: number; profitFactor?: number | null; maxDrawdownPct?: number; sharpe?: number | null; firstBar?: number | null; lastBar?: number | null };

type BacktestInfo = {
  id: number;
  status: "queued" | "running" | "done" | "failed" | "cancelled";
  progress: number;
  summary: BacktestSummary | null;
  error: string | null;
  params: { from?: number; to?: number; initialBalance?: number };
  finishedAt: string | null;
  report?: {
    metrics: Record<string, number | null>;
    equity: { t: number; equity: number; dd?: number }[];
    monthly: unknown;
    notes: string[] | null;
    coverage: unknown;
    model: string | Record<string, unknown> | null;
    firstBar: number | null;
    lastBar: number | null;
  };
};

type MasterInfo = {
  id: number;
  status: string;
  hidden: boolean;
  frozen: boolean;
  since: string | null;
  stats: { equity?: number; aum?: number; followers?: number; investors?: number; trades?: number; winRate?: number | null; returnAll?: number | null; return1m?: number | null; maxDd?: number | null } | null;
};

type HouseItem = {
  id: number;
  preset: string;
  nickname: string;
  capital: number;
  userId: number | null;
  login: number | null;
  masterId: number | null;
  strategyId: number | null;
  deploymentId: number | null;
  listingId: number | null;
  enabled: boolean;
  visible: boolean;
  status: "provisioning" | "active" | "failed" | "retired";
  error: string | null;
  createdBy: string;
  createdAt: string;
  symbol: string | null;
  timeframe: string | null;
  strategy: string | null;
  deployment?: DeploymentInfo;
  backtest?: BacktestInfo;
  listing?: { id: number; status: string; subscribers: number };
  master?: MasterInfo;
};

type HouseDetail = HouseItem & {
  logs?: { at: string; level: string; kind: string; message: string }[];
  positions?: { ticket: number; symbol: string; side: string; volume: number; openPrice: number | null; openedAt: string; closedAt: string | null; closePrice: number | null; profit: number | null; reason: string | null }[];
  source?: string | null;
  description?: string | null;
  audit?: { at: string; actor: string; action: string; data: Record<string, unknown> }[];
};

type Preset = { key: string; nickname: string; strategy: string; symbol: string; timeframe: string; description: string; source: string; dailyLossPct: number; backtestDays: number; houseId: number | null };

type HouseList = {
  settings: { enabled: boolean; updatedBy: string | null; updatedAt: string | null; defaultCapital: number; dailyLossPct: number; group: string };
  items: HouseItem[];
  presets: Preset[];
  totals: { accounts: number; on: number; capital: number; equity: number; followers: number; aum: number };
};

async function houseWrite<T = unknown>(path: string, body: Record<string, unknown>, method: "POST" | "PUT" = "POST"): Promise<WriteResult<T>> {
  const r = await sendJson<T>(`/api/house/${path}`, body, method);
  if (!r.ok) return { ok: false, error: r.error.message || "Something went wrong." };
  return { ok: true, data: r.data };
}

/* ------------------------------------------------------------------ */
/* State chips                                                         */
/* ------------------------------------------------------------------ */

function effectiveOn(h: HouseItem, master: boolean) {
  return master && h.enabled && h.status === "active";
}

function StateChip({ h, master }: { h: HouseItem; master: boolean }) {
  if (h.status === "failed") return <Chip size="sm" dot tone="down">Failed</Chip>;
  if (h.status === "provisioning") return <Chip size="sm" dot tone="warn">Provisioning</Chip>;
  const dep = h.deployment?.status;
  if (dep && (dep === "stopped" || dep === "killed" || dep === "error"))
    return (
      <Chip size="sm" dot tone="down">
        Strategy {dep}
      </Chip>
    );
  if (!master) return <Chip size="sm" dot tone="neutral">Off (master switch)</Chip>;
  if (!h.enabled) return <Chip size="sm" dot tone="neutral">Off</Chip>;
  return <Chip size="sm" dot tone="up">On</Chip>;
}

export function HouseLabel({ className }: { className?: string }) {
  return (
    <Chip size="sm" tone="info" className={className}>
      <Building2 className="size-3" /> House
    </Chip>
  );
}

function BacktestCell({ b }: { b?: BacktestInfo }) {
  if (!b) return <span className="text-fg-3">—</span>;
  if (b.status === "queued" || b.status === "running") return <span className="text-[12px] text-fg-3">Backtest {b.status === "queued" ? "queued" : `${Math.round((b.progress || 0) * 100)}%`}</span>;
  if (b.status !== "done" || !b.summary) return <span className="text-[12px] text-down">Backtest {b.status}</span>;
  return (
    <span className="whitespace-nowrap">
      <Pct value={b.summary.returnPct ?? null} decimals={1} />
      <span className="block text-[11px] text-fg-3">{int(b.summary.trades ?? 0)} simulated trades</span>
    </span>
  );
}

/* ------------------------------------------------------------------ */
/* Page                                                                */
/* ------------------------------------------------------------------ */

export function LiveHousePage() {
  const now = useNow();
  const canWrite = useSocialCan("social.write");
  const list = useApi<HouseList>("/api/house/list", { refreshMs: 30_000 });
  const act = useNoteAction();
  const [sel, setSel] = React.useState<number | null>(null);
  const [capitalFor, setCapitalFor] = React.useState<HouseItem | null>(null);
  const [seedOpen, setSeedOpen] = React.useState(false);
  const d = list.data;
  const master = d?.settings.enabled ?? true;
  const items = d?.items ?? [];
  const reload = list.reload;
  const missing = (d?.presets ?? []).filter((p) => !p.houseId);

  const toggle = (h: HouseItem, enabled: boolean) => {
    let close = false;
    act.ask({
      title: enabled ? `Switch on ${h.nickname}` : `Switch off ${h.nickname}`,
      description: enabled
        ? "The strategy resumes on its live account (new entries from the next closed bar), and the account is listed on the leaderboard and in the marketplace if its visibility is on."
        : "The strategy is paused (no new entries), the account is hidden from the leaderboard and unlisted from the marketplace. Existing followers keep their copies; nothing is mirrored while no trades are opened.",
      confirmLabel: enabled ? "Switch on" : "Switch off",
      confirmVariant: enabled ? "buy" : "sell",
      body: enabled ? undefined : <CloseOption onChange={(v) => (close = v)} />,
      run: (note) => houseWrite(`${h.id}/switch`, { enabled, closePositions: close, note }),
      success: `${h.nickname} switched ${enabled ? "on" : "off"}`,
      onDone: reload,
    });
  };
  const visibility = (h: HouseItem, visible: boolean) =>
    act.ask({
      title: visible ? `Show ${h.nickname}` : `Hide ${h.nickname}`,
      description: visible ? "The account is listed on the copy-trading leaderboard and in the strategy marketplace while it is on." : "The account keeps trading but is removed from the leaderboard and the marketplace. Existing followers keep copying.",
      confirmLabel: visible ? "Show" : "Hide",
      run: (note) => houseWrite(`${h.id}/visibility`, { visible, note }),
      success: `${h.nickname} ${visible ? "shown" : "hidden"}`,
      onDone: reload,
    });
  const retry = (h: HouseItem) =>
    act.ask({
      title: h.status === "active" ? `Redeploy ${h.nickname}` : `Resume provisioning ${h.nickname}`,
      description: h.status === "active" ? "Starts the strategy again on the same account as a new deployment. The marketplace track record restarts from the new deployment." : "Runs the provisioning steps that did not complete. Steps already done are not repeated.",
      confirmLabel: h.status === "active" ? "Redeploy" : "Resume",
      run: (note) => houseWrite(`${h.id}/retry`, { note }),
      success: `${h.nickname} updated`,
      onDone: reload,
    });
  const remove = (h: HouseItem) => {
    let withdraw = true;
    act.ask({
      title: `Delete ${h.nickname}`,
      description: "Stops the strategy and closes its positions, stops every follower (their copied positions close), closes the master profile and unlists the marketplace listing. The account's trading history stays on the ledger.",
      confirmLabel: "Delete house account",
      confirmVariant: "sell",
      body: <WithdrawOption onChange={(v) => (withdraw = v)} />,
      run: (note) => houseWrite(`${h.id}/delete`, { note, withdrawCapital: withdraw }),
      success: `${h.nickname} deleted`,
      onDone: () => {
        setSel(null);
        reload();
      },
    });
  };
  const masterSwitch = (enabled: boolean) => {
    let close = false;
    act.ask({
      title: enabled ? "Switch house accounts on" : "Switch every house account off",
      description: enabled
        ? "Every house account whose own switch is on resumes trading and is listed again (when visible)."
        : "Every house strategy is paused and every house account is hidden from the leaderboard and the marketplace. Each account keeps its own switch for when this is turned back on.",
      confirmLabel: enabled ? "Switch on" : "Switch all off",
      confirmVariant: enabled ? "buy" : "sell",
      body: enabled ? undefined : <CloseOption onChange={(v) => (close = v)} all />,
      run: (note) => houseWrite("settings", { enabled, closePositions: close, note }, "PUT"),
      success: enabled ? "House accounts switched on" : "House accounts switched off",
      onDone: reload,
    });
  };
  const provisionOne = (p: Preset) =>
    act.ask({
      title: `Provision ${p.nickname}`,
      description: `Creates the house user, a live ${d?.settings.group ?? "standard"} account funded with ${usd(d?.settings.defaultCapital ?? 10000, 0)} of house capital, an approved house master, the strategy, its backtest, the runtime deployment and a free marketplace listing.`,
      confirmLabel: "Provision",
      confirmVariant: "ember",
      run: (note) => houseWrite("provision", { preset: p.key, capital: d?.settings.defaultCapital ?? 10000, note }),
      success: `${p.nickname} provisioned`,
      onDone: reload,
    });

  const cols: Column<HouseItem>[] = [
    {
      key: "n",
      header: "House account",
      csv: (h) => h.nickname,
      cell: (h) => (
        <span className="min-w-0">
          <span className="flex items-center gap-2 truncate text-[13.5px] font-medium text-fg">
            {h.nickname}
            <span className="sm:hidden">
              <StateChip h={h} master={master} />
            </span>
          </span>
          <span className="block truncate text-[11.5px] text-fg-3">
            {h.strategy ?? h.preset} · <span className="font-mono">{h.login ?? "—"}</span>
          </span>
        </span>
      ),
    },
    {
      key: "s",
      header: "State",
      hideOn: "sm",
      csv: (h) => (effectiveOn(h, master) ? "on" : "off"),
      cell: (h) => (
        <span onClick={(e) => e.stopPropagation()} className="inline-flex items-center gap-2 whitespace-nowrap">
          {canWrite && h.status === "active" ? <Toggle checked={h.enabled} onChange={(v) => toggle(h, v)} label={`${h.nickname} on`} /> : null}
          <StateChip h={h} master={master} />
        </span>
      ),
    },
    {
      key: "rt",
      header: "Runtime",
      hideOn: "lg",
      csv: (h) => h.deployment?.status ?? "",
      cell: (h) =>
        h.deployment ? (
          <span className="whitespace-nowrap text-[12px]">
            <span className="text-fg-2">{h.deployment.status}</span>
            <span className="block text-[11px] text-fg-3">{h.deployment.lastEvalAt ? `evaluated ${ago(h.deployment.lastEvalAt, now)}` : "waiting for the first closed bar"}</span>
          </span>
        ) : (
          <span className="text-fg-3">—</span>
        ),
    },
    { key: "t", header: "Live trades", align: "right", hideOn: "md", sort: (h) => h.master?.stats?.trades ?? 0, cell: (h) => <span className="k-num">{int(h.master?.stats?.trades ?? 0)}</span> },
    { key: "r", header: "Live return", align: "right", sort: (h) => h.master?.stats?.returnAll ?? -1e9, cell: (h) => <Pct value={h.master?.stats?.returnAll ?? null} decimals={2} /> },
    { key: "f", header: "Followers", align: "right", hideOn: "sm", sort: (h) => h.master?.stats?.followers ?? 0, cell: (h) => <span className="k-num">{int(h.master?.stats?.followers ?? 0)}</span> },
    { key: "bt", header: "Backtest", align: "right", hideOn: "lg", sort: (h) => h.backtest?.summary?.returnPct ?? -1e9, cell: (h) => <BacktestCell b={h.backtest} /> },
    {
      key: "v",
      header: "Listed",
      hideOn: "md",
      csv: (h) => (h.visible ? "visible" : "hidden"),
      cell: (h) => (
        <span onClick={(e) => e.stopPropagation()} className="inline-flex items-center gap-2">
          {canWrite && h.status === "active" ? <Toggle checked={h.visible} onChange={(v) => visibility(h, v)} label={`${h.nickname} visible on the leaderboard`} /> : null}
          <span className="text-[11.5px] text-fg-3">{h.visible ? (effectiveOn(h, master) ? "Shown" : "When on") : "Hidden"}</span>
        </span>
      ),
    },
    {
      key: "x",
      header: "",
      align: "right",
      width: "52px",
      cell: (h) => (
        <span onClick={(e) => e.stopPropagation()}>
          <Menu
            trigger={
              <IconButton size="sm" aria-label={`Actions for ${h.nickname}`}>
                <MoreHorizontal />
              </IconButton>
            }
            items={[
              { label: "Open details", icon: <Eye />, onSelect: () => setSel(h.id) },
              ...(canWrite
                ? ([
                    ...(h.status === "active"
                      ? [
                          { label: h.enabled ? "Switch off" : "Switch on", icon: <Power />, onSelect: () => toggle(h, !h.enabled) },
                          { label: h.visible ? "Hide from leaderboard" : "Show on leaderboard", icon: h.visible ? <EyeOff /> : <Eye />, onSelect: () => visibility(h, !h.visible) },
                          { label: "Top up capital", icon: <Wallet />, onSelect: () => setCapitalFor(h) },
                        ]
                      : []),
                    ...(h.status === "failed" || h.status === "provisioning" || (h.deployment && ["stopped", "killed", "error"].includes(h.deployment.status))
                      ? [{ label: h.status === "active" ? "Redeploy strategy" : "Resume provisioning", icon: <RotateCcw />, onSelect: () => retry(h) }]
                      : []),
                    "sep",
                    { label: "Delete", icon: <Trash2 />, danger: true, onSelect: () => remove(h) },
                  ] satisfies React.ComponentProps<typeof Menu>["items"])
                : []),
            ]}
          />
        </span>
      ),
    },
  ];

  const t = d?.totals;
  return (
    <div className="pb-16">
      <PageHeader
        title="House accounts"
        subtitle="Broker-operated accounts, each running one automated strategy on a live account. Their record is only what they trade live."
        actions={
          <>
            <Button variant="surface" onClick={reload}>
              <RefreshCw /> Refresh
            </Button>
            {canWrite && missing.length > 0 && (
              <Button variant="ember" onClick={() => setSeedOpen(true)}>
                <Plus /> Provision {missing.length === (d?.presets.length ?? 10) ? `all ${missing.length}` : `${missing.length} remaining`}
              </Button>
            )}
          </>
        }
      />

      {list.error && !d ? (
        <SocialError error={list.error} onRetry={reload} />
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <Card className="flex flex-col justify-between gap-3 p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-[11px] uppercase tracking-wider text-fg-3">Master switch</div>
                  <div className={cn("mt-1 text-[20px] font-semibold", master ? "text-up" : "text-fg-2")}>{d ? (master ? "On" : "Off") : "—"}</div>
                </div>
                {canWrite && d && <Toggle checked={master} onChange={masterSwitch} label="House accounts master switch" />}
              </div>
              <div className="text-[11.5px] text-fg-3">{d?.settings.updatedBy ? `Changed by ${d.settings.updatedBy} · ${when(d.settings.updatedAt)}` : "Off pauses and hides every house account"}</div>
            </Card>
            <KpiCard label="Accounts on" icon={<Power />} value={<span className="k-num">{t ? `${t.on} / ${t.accounts}` : "—"}</span>} chip={t ? `${(d?.presets.length ?? 0) - missing.length} of ${d?.presets.length ?? 0} presets provisioned` : "Loading"} delay={0.05} />
            <KpiCard label="House capital" icon={<Wallet />} value={<span className="k-num">{t ? usd(t.capital, 0) : "—"}</span>} chip={t ? `Equity ${usd(t.equity, 0)}` : "Loading"} delay={0.1} />
            <KpiCard label="Followers" icon={<Building2 />} value={<span className="k-num">{t ? int(t.followers) : "—"}</span>} chip={t ? `Copying ${usd(t.aum, 0)}` : "Loading"} delay={0.15} />
          </div>

          <Reveal delay={0.05}>
            <Card className="mt-4 p-4 sm:p-6">
              {!d ? (
                <TableSkeleton />
              ) : (
                <DataTable
                  columns={cols}
                  rows={items}
                  dense
                  pageSize={20}
                  rowKey={(h) => String(h.id)}
                  onRowClick={(h) => setSel(h.id)}
                  search={(h) => `${h.nickname} ${h.preset} ${h.symbol ?? ""} ${h.login ?? ""}`}
                  searchPlaceholder="Name, symbol, login…"
                  exportName="house-accounts"
                  empty={
                    <EmptyState
                      illustration="bank"
                      title="No house accounts yet"
                      text="Provision the ten preset strategies with one click. Each gets its own live account and starts with an empty track record."
                      action={
                        canWrite ? (
                          <Button variant="ember" onClick={() => setSeedOpen(true)}>
                            <Plus /> Provision all presets
                          </Button>
                        ) : undefined
                      }
                    />
                  }
                />
              )}
            </Card>
          </Reveal>

          {d && missing.length > 0 && (
            <Reveal delay={0.1}>
              <Card className="mt-4">
                <CardHeader title="Presets not provisioned" subtitle={`Risk-sized strategies with a stop loss on every trade and a ${d.settings.dailyLossPct}% daily loss limit`} />
                <div className="mt-3 grid grid-cols-1 gap-2 px-4 pb-5 sm:px-6 lg:grid-cols-2">
                  {missing.map((p) => (
                    <div key={p.key} className="k-row flex items-start gap-3 px-4 py-3">
                      <div className="min-w-0 flex-1">
                        <div className="text-[13px] font-medium">{p.nickname}</div>
                        <div className="text-[11.5px] text-fg-3">{p.strategy}</div>
                        <p className="mt-1 line-clamp-2 text-[12px] text-fg-2">{p.description}</p>
                      </div>
                      {canWrite && (
                        <Button size="xs" variant="surface" onClick={() => provisionOne(p)}>
                          <Play /> Provision
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
              </Card>
            </Reveal>
          )}

          <p className="mt-4 max-w-3xl text-[12px] leading-relaxed text-fg-3">
            House capital is booked on the ledger as <span className="font-mono">house_capital</span>, never as a client deposit, so it is not counted in deposit or FTD reports. House users cannot sign in and are left out of client lists. Clients see every house account labelled
            &ldquo;House strategy · Operated by Kalks&rdquo; on the leaderboard, the master profile, their subscriptions and the marketplace.
          </p>
        </>
      )}

      <HouseDrawer id={sel} onClose={() => setSel(null)} canWrite={canWrite} master={master} actions={{ toggle, visibility, retry, remove, capital: setCapitalFor }} />
      <CapitalDialog h={capitalFor} onClose={() => setCapitalFor(null)} onDone={reload} />
      <SeedDialog open={seedOpen} onOpenChange={setSeedOpen} missing={missing} defaultCapital={d?.settings.defaultCapital ?? 10000} onDone={reload} />
      {act.node}
    </div>
  );
}

function CloseOption({ onChange, all }: { onChange: (v: boolean) => void; all?: boolean }) {
  const [v, setV] = React.useState(false);
  return (
    <label className="flex items-start gap-2.5 rounded-[14px] border border-line bg-surface-2/60 px-3.5 py-3 text-[12.5px] text-fg-2">
      <Checkbox
        checked={v}
        onChange={(x) => {
          setV(x);
          onChange(x);
        }}
        label="Also close open positions"
      />
      <span>
        Also close {all ? "every house account's" : "the account's"} open strategy positions at market. Followers&apos; copied positions close with them. Otherwise open positions keep their stop loss and take profit.
      </span>
    </label>
  );
}

function WithdrawOption({ onChange }: { onChange: (v: boolean) => void }) {
  const [v, setV] = React.useState(true);
  return (
    <label className="flex items-start gap-2.5 rounded-[14px] border border-line bg-surface-2/60 px-3.5 py-3 text-[12.5px] text-fg-2">
      <Checkbox
        checked={v}
        onChange={(x) => {
          setV(x);
          onChange(x);
        }}
        label="Withdraw remaining house capital"
      />
      <span>Withdraw the remaining balance back to house capital and disable the account.</span>
    </label>
  );
}

/* ------------------------------------------------------------------ */
/* Seed and capital dialogs                                            */
/* ------------------------------------------------------------------ */

function SeedDialog({ open, onOpenChange, missing, defaultCapital, onDone }: { open: boolean; onOpenChange: (o: boolean) => void; missing: Preset[]; defaultCapital: number; onDone: () => void }) {
  const [capital, setCapital] = React.useState(String(defaultCapital));
  const [note, setNote] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [result, setResult] = React.useState<{ created: { preset: string }[]; failed: { preset: string; error: string }[] } | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  React.useEffect(() => {
    if (open) {
      setCapital(String(defaultCapital));
      setNote("");
      setResult(null);
      setError(null);
    }
  }, [open, defaultCapital]);
  const cap = Number(capital);
  const valid = Number.isFinite(cap) && cap >= 100 && cap <= 10_000_000 && note.trim().length > 0;
  return (
    <Dialog
      open={open}
      onOpenChange={(o) => !busy && onOpenChange(o)}
      width={560}
      title={`Provision ${missing.length} house account${missing.length === 1 ? "" : "s"}`}
      description="Each preset gets a house user, a live account funded with house capital, an approved house master, a backtest, a runtime deployment and a free marketplace listing."
      footer={
        result ? (
          <Button variant="ember" size="sm" onClick={() => onOpenChange(false)}>
            Done
          </Button>
        ) : (
          <>
            <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)} disabled={busy}>
              Cancel
            </Button>
            <Button
              variant="ember"
              size="sm"
              disabled={!valid || busy}
              onClick={async () => {
                setBusy(true);
                setError(null);
                const r = await houseWrite<{ created: { preset: string }[]; failed: { preset: string; error: string }[] }>("seed", { capital: cap, note: note.trim() });
                setBusy(false);
                if (!r.ok) return setError(r.error);
                setResult(r.data);
                onDone();
              }}
            >
              {busy ? "Provisioning…" : `Provision ${missing.length}`}
            </Button>
          </>
        )
      }
    >
      {result ? (
        <div className="space-y-2 text-[13px]">
          <div className="text-up">{result.created.length} provisioned</div>
          {result.failed.map((f) => (
            <div key={f.preset} className="rounded-[12px] border border-down/30 bg-down-soft px-3 py-2 text-[12px]">
              {f.preset}: {f.error}
            </div>
          ))}
          <p className="text-[12px] text-fg-3">Backtests run in the background. Live results start empty and grow only with real trades.</p>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="max-h-[180px] space-y-1 overflow-y-auto rounded-[14px] border border-line p-2">
            {missing.map((p) => (
              <div key={p.key} className="flex items-center justify-between gap-3 px-2 py-1 text-[12.5px]">
                <span className="truncate">{p.nickname}</span>
                <span className="shrink-0 text-fg-3">{p.strategy}</span>
              </div>
            ))}
          </div>
          <Field2 label="House capital per account (USD)">
            <Input inputMode="decimal" value={capital} onChange={(e) => setCapital(e.target.value)} aria-label="House capital per account" />
          </Field2>
          <Field2 label="Reason">
            <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} aria-label="Reason" placeholder="Written to the audit log" className="w-full resize-none rounded-[14px] border border-line bg-surface-2 px-3.5 py-2.5 text-[13px] text-fg outline-none placeholder:text-fg-3 focus:border-ember/50" />
          </Field2>
          {error && <div className="rounded-[12px] border border-down/30 bg-down-soft px-3 py-2 text-[12.5px]">{error}</div>}
        </div>
      )}
    </Dialog>
  );
}

function Field2({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[12.5px] font-medium text-fg-2">{label}</span>
      {children}
    </label>
  );
}

function CapitalDialog({ h, onClose, onDone }: { h: HouseItem | null; onClose: () => void; onDone: () => void }) {
  const [amount, setAmount] = React.useState("");
  const [note, setNote] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  React.useEffect(() => {
    setAmount("");
    setNote("");
    setError(null);
  }, [h]);
  const a = Number(amount);
  const valid = Number.isFinite(a) && a !== 0 && Math.abs(a) <= 10_000_000 && note.trim().length > 0;
  return (
    <Dialog
      open={!!h}
      onOpenChange={(o) => !o && !busy && onClose()}
      width={480}
      title={h ? `House capital · ${h.nickname}` : ""}
      description="Booked on the ledger as house capital, never as a client deposit. A negative amount withdraws free capital."
      footer={
        <>
          <Button variant="ghost" size="sm" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button
            variant="ember"
            size="sm"
            disabled={!valid || busy || !h}
            onClick={async () => {
              if (!h) return;
              setBusy(true);
              setError(null);
              const r = await houseWrite(`${h.id}/capital`, { amount: a, note: note.trim() });
              setBusy(false);
              if (!r.ok) return setError(r.error);
              onDone();
              onClose();
            }}
          >
            {busy ? "Booking…" : a < 0 ? "Withdraw" : "Top up"}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {h && <div className="text-[12.5px] text-fg-3">Capital booked so far {usd(h.capital, 2)} · equity {usd(h.master?.stats?.equity ?? null, 2)}</div>}
        <Field2 label="Amount (USD)">
          <Input inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="5000" aria-label="Amount" />
        </Field2>
        <Field2 label="Reason">
          <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} aria-label="Reason" placeholder="Written to the audit log" className="w-full resize-none rounded-[14px] border border-line bg-surface-2 px-3.5 py-2.5 text-[13px] text-fg outline-none placeholder:text-fg-3 focus:border-ember/50" />
        </Field2>
        {error && <div className="rounded-[12px] border border-down/30 bg-down-soft px-3 py-2 text-[12.5px]">{error}</div>}
      </div>
    </Dialog>
  );
}

/* ------------------------------------------------------------------ */
/* Drawer                                                              */
/* ------------------------------------------------------------------ */

type Actions = {
  toggle: (h: HouseItem, v: boolean) => void;
  visibility: (h: HouseItem, v: boolean) => void;
  retry: (h: HouseItem) => void;
  remove: (h: HouseItem) => void;
  capital: (h: HouseItem) => void;
};

function HouseDrawer({ id, onClose, canWrite, master, actions }: { id: number | null; onClose: () => void; canWrite: boolean; master: boolean; actions: Actions }) {
  const now = useNow();
  const q = useApi<HouseDetail>(id ? `/api/house/${id}` : null, { refreshMs: 30_000 });
  const h = q.data && q.data.id === id ? q.data : null;
  const bt = h?.backtest;
  const chart = React.useMemo(() => (bt?.report?.equity ?? []).map((p) => ({ time: p.t, value: p.equity })).filter((p) => Number.isFinite(p.time)), [bt]);
  const s = h?.master?.stats ?? null;
  const m = bt?.report?.metrics ?? {};
  const range = bt?.report?.firstBar && bt?.report?.lastBar ? `${new Date(bt.report.firstBar * 1000).toISOString().slice(0, 10)} to ${new Date(bt.report.lastBar * 1000).toISOString().slice(0, 10)}` : null;
  return (
    <Dialog
      open={id !== null}
      onOpenChange={(o) => !o && onClose()}
      side="right"
      title={
        h ? (
          <span className="min-w-0">
            <span className="flex flex-wrap items-center gap-2">
              {h.nickname}
              <HouseLabel />
              <StateChip h={h} master={master} />
            </span>
            <span className="mt-0.5 block text-[12px] font-normal text-fg-3">
              {h.strategy} · login <span className="font-mono">{h.login ?? "—"}</span> · master #{h.masterId ?? "—"} · deployment #{h.deploymentId ?? "—"}
            </span>
          </span>
        ) : (
          "House account"
        )
      }
      footer={
        h && canWrite && h.status === "active" ? (
          <div className="flex w-full flex-wrap items-center gap-2">
            <Button variant={h.enabled ? "down-outline" : "up-outline"} size="sm" onClick={() => actions.toggle(h, !h.enabled)}>
              <Power /> {h.enabled ? "Switch off" : "Switch on"}
            </Button>
            <Button variant="surface" size="sm" onClick={() => actions.visibility(h, !h.visible)}>
              {h.visible ? <EyeOff /> : <Eye />} {h.visible ? "Hide" : "Show"}
            </Button>
            <Button variant="surface" size="sm" onClick={() => actions.capital(h)}>
              <Wallet /> Capital
            </Button>
            <span className="flex-1" />
            <Button variant="sell" size="sm" onClick={() => actions.remove(h)}>
              <Trash2 /> Delete
            </Button>
          </div>
        ) : undefined
      }
    >
      {q.error && !h ? (
        <SocialError error={q.error} onRetry={q.reload} />
      ) : !h ? (
        <div className="h-[320px] animate-pulse rounded-[16px] bg-surface-2" />
      ) : (
        <>
          {h.error && <div className="mb-4 rounded-[14px] border border-down/30 bg-down-soft px-3.5 py-2.5 text-[12.5px]">{h.error}</div>}
          <Section title="Live results" hint="From the account's own closed deals and equity since it was provisioned. Nothing is backfilled.">
            <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
              <MiniStat label="Equity" value={usd(s?.equity ?? null)} sub={`Capital booked ${usd(h.capital, 0)}`} />
              <MiniStat label="Return (all)" value={<Pct value={s?.returnAll ?? null} decimals={2} />} sub={h.master?.since ? `Since ${when(h.master.since)}` : undefined} />
              <MiniStat label="Live trades" value={int(s?.trades ?? 0)} sub={s?.winRate !== null && s?.winRate !== undefined && (s?.trades ?? 0) > 0 ? `Win rate ${s.winRate.toFixed(1)}%` : "No closed trades yet"} />
              <MiniStat label="Followers" value={int(s?.followers ?? 0)} sub={`Copying ${usd(s?.aum ?? 0, 0)}`} />
              <MiniStat label="Open positions" value={int(h.deployment?.openPositions ?? 0)} sub={h.deployment?.lastOrderAt ? `Last order ${ago(h.deployment.lastOrderAt, now)}` : "No orders yet"} />
              <MiniStat label="Runtime" value={h.deployment?.status ?? "—"} sub={h.deployment?.lastEvalAt ? `Evaluated ${ago(h.deployment.lastEvalAt, now)}` : "Waiting for the first closed bar"} />
            </div>
          </Section>

          <Section title="Backtest" hint="Simulated on historical data with the account group's spread and commission. This is not live history and is labelled as a backtest wherever it is shown.">
            {!bt ? (
              <div className="text-[12.5px] text-fg-3">No backtest.</div>
            ) : bt.status !== "done" ? (
              <div className="text-[12.5px] text-fg-3">{bt.status === "failed" ? `Backtest failed: ${bt.error ?? "unknown error"}` : `Backtest ${bt.status}${bt.status === "running" ? ` · ${Math.round(bt.progress * 100)}%` : ""}`}</div>
            ) : (
              <>
                <div className="mb-2 flex flex-wrap items-center gap-2">
                  <Chip size="sm" tone="warn">
                    Backtest · simulated
                  </Chip>
                  {range && <span className="text-[11.5px] text-fg-3">{range}</span>}
                </div>
                {chart.length > 1 && (
                  <div className="-mx-2 mb-3">
                    <EquityChart data={chart} height={170} color="ember" showVolume={false} />
                  </div>
                )}
                <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
                  <MiniStat label="Return" value={<Pct value={bt.summary?.returnPct ?? null} decimals={2} />} sub={`Net ${usd(bt.summary?.netProfit ?? null)}`} />
                  <MiniStat label="Trades" value={int(bt.summary?.trades ?? 0)} sub={bt.summary?.winRate !== undefined ? `Win rate ${(bt.summary.winRate ?? 0).toFixed(1)}%` : undefined} />
                  <MiniStat label="Max drawdown" value={bt.summary?.maxDrawdownPct !== undefined ? `${(bt.summary.maxDrawdownPct ?? 0).toFixed(2)}%` : "—"} sub={`Profit factor ${m.profitFactor === null || m.profitFactor === undefined ? "—" : Number(m.profitFactor).toFixed(2)}`} />
                </div>
                {(bt.report?.notes?.length ?? 0) > 0 && (
                  <ul className="mt-3 space-y-1 text-[11.5px] text-fg-3">
                    {bt.report!.notes!.slice(0, 4).map((n) => (
                      <li key={n}>{n}</li>
                    ))}
                  </ul>
                )}
              </>
            )}
          </Section>

          <Section title="Strategy" hint={h.description ?? undefined}>
            <pre className="max-h-[260px] overflow-auto rounded-[14px] border border-line bg-surface-2 p-3 font-mono text-[11.5px] leading-relaxed text-fg-2">{h.source ?? "—"}</pre>
          </Section>

          <Section title="Runtime log" hint="Most recent first">
            <div className="max-h-[260px] space-y-1 overflow-y-auto">
              {(h.logs ?? []).length === 0 && <div className="text-[12.5px] text-fg-3">Nothing logged yet.</div>}
              {(h.logs ?? []).map((l, i) => (
                <div key={i} className="flex gap-2 text-[11.5px]">
                  <span className="shrink-0 font-mono text-fg-3">{when(l.at, true)}</span>
                  <span className={cn("shrink-0 uppercase", l.level === "error" ? "text-down" : l.level === "warn" ? "text-warn" : "text-fg-3")}>{l.kind}</span>
                  <span className="min-w-0 text-fg-2">{l.message}</span>
                </div>
              ))}
            </div>
          </Section>

          {(h.positions ?? []).length > 0 && (
            <Section title="Strategy positions">
              <div className="space-y-1">
                {h.positions!.map((p) => (
                  <div key={p.ticket} className="k-row flex items-center gap-3 px-3 py-2 text-[12px]">
                    <Chip size="sm" tone={p.side === "buy" ? "up" : "down"}>
                      {p.side.toUpperCase()}
                    </Chip>
                    <span className="font-mono">#{p.ticket}</span>
                    <span>
                      {p.volume} {p.symbol}
                    </span>
                    <span className="flex-1 text-fg-3">{p.closedAt ? `closed ${when(p.closedAt)}` : `open since ${when(p.openedAt)}`}</span>
                    {p.profit !== null && <span className={cn("k-num", p.profit >= 0 ? "text-up" : "text-down")}>{usd(p.profit)}</span>}
                  </div>
                ))}
              </div>
            </Section>
          )}

          <Section title="Audit">
            <div className="space-y-1">
              {(h.audit ?? []).map((a, i) => (
                <div key={i} className="flex gap-2 text-[11.5px]">
                  <span className="shrink-0 font-mono text-fg-3">{when(a.at)}</span>
                  <span className="shrink-0 text-fg-2">{a.action}</span>
                  <span className="min-w-0 truncate text-fg-3">{typeof a.data?.note === "string" ? a.data.note : a.actor}</span>
                </div>
              ))}
            </div>
          </Section>
        </>
      )}
    </Dialog>
  );
}
