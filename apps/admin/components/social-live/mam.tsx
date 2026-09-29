"use client";

/**
 * Back Office → Social & Algo → MAM: programmes (managers), linked client accounts with their consent record,
 * the allocation audit (every block and its per-account split) and the emergency stop. Fees of MAM programmes
 * are approved on the shared Fee payouts page. Everything goes through /api/social/admin/mam/* to the engine.
 */
import * as React from "react";
import { Briefcase, Layers, OctagonAlert, PlayCircle, RefreshCw, Unlink, Users, Wallet } from "lucide-react";
import { Button, Card, Chip, DataTable, Dialog, EmptyState, KpiCard, PageHeader, Segmented, Toggle, type Column } from "@kalks/ui";
import { MiniStat } from "@/components/config/kit";
import { TableSkeleton, ago, day, useApi, useNow, when } from "@/components/live/kit";
import { PERIOD_LABEL, ReadOnlyNote, SocialError, SocialStatus, int, socialWrite, useNoteAction, useSocialCan, usd, usdK } from "./kit";

type Method = "equity" | "balance" | "multiplier" | "percent";

type Manager = {
  id: number;
  masterId: number;
  nickname: string | null;
  name: string;
  description: string;
  method: Method;
  perfFeePct: number;
  mgmtFeePct: number;
  feePeriod: string;
  minEquity: number;
  status: "active" | "frozen" | "closed";
  freezeReason: string | null;
  createdAt: string;
  accounts: number;
  aum: number;
  login?: number;
  userId?: number;
  totals?: { accounts: number; equity: number; mamResult: number; feesPending: number; feesPaid: number };
};

type LinkRow = {
  id: number;
  managerId: number;
  manager: { id: number; name: string; nickname: string; method: Method; status: string } | null;
  login: number;
  userId?: number;
  status: "active" | "revoked" | "stopped";
  stopReason: string | null;
  allocValue: number;
  maxLot: number | null;
  equityStop: number | null;
  perfFeePct: number;
  mgmtFeePct: number;
  hwm: number;
  feesPaid: number;
  feesPending: number;
  equity: number;
  mamResult: number;
  mamPositions: number;
  mamOrders: number;
  createdAt: string;
  endedAt: string | null;
  endedBy: string | null;
  consent?: { ip: string | null; userAgent: string | null; hash: string; at: string };
};

type Detail = { linkId: number; login: number | null; equity: number; balance: number; value: number | null; maxLot: number | null; basis: number; raw: number; volume: number | null; reason: string | null; status: string; ticket: number | null; message: string };
type Allocation = { id: number; managerId: number; masterTicket: number | null; action: string; symbol: string; side: "buy" | "sell"; block: number; method: Method; allocated: number; accounts: number; details: Detail[]; at: string };

const METHOD: Record<Method, string> = { equity: "Equity share", balance: "Balance share", multiplier: "Multiplier", percent: "Percent" };
const STOP: Record<string, string> = { client: "Revoked by client", equity_stop: "Equity stop", admin: "Stopped by staff" };
const lots = (v: number | null | undefined) => (v === null || v === undefined ? "—" : v.toFixed(2));
const valueText = (m: Method | undefined, v: number | null) => (v === null ? "—" : m === "multiplier" ? `${v}×` : m === "percent" ? `${v}%` : "—");

/** Toggle whose value is read by the note action when it runs. */
function CloseToggle({ state, label, detail }: { state: { current: boolean }; label: string; detail: string }) {
  const [on, setOn] = React.useState(false);
  return (
    <div className="flex items-start justify-between gap-3 rounded-[14px] border border-line bg-surface-2 px-4 py-3">
      <div>
        <div className="text-[13px] font-medium">{label}</div>
        <div className="text-[12px] text-fg-3">{detail}</div>
      </div>
      <Toggle
        checked={on}
        onChange={(v) => {
          state.current = v;
          setOn(v);
        }}
        label={label}
      />
    </div>
  );
}

function AllocationDialog({ a, managers, onClose }: { a: Allocation | null; managers: Manager[]; onClose: () => void }) {
  if (!a) return null;
  const m = managers.find((x) => x.id === a.managerId);
  return (
    <Dialog open={!!a} onOpenChange={(o) => !o && onClose()} width={720} title={`Block #${a.masterTicket ?? "—"} · ${a.symbol} ${a.side} ${lots(a.block)}`} description={`${m?.name ?? `Programme #${a.managerId}`} · ${METHOD[a.method]} · ${when(a.at, true)}`}>
      <div className="mb-3 grid grid-cols-3 gap-2">
        <MiniStat label="Block" value={lots(a.block)} />
        <MiniStat label="Executed" value={lots(a.allocated)} tone="up" />
        <MiniStat label="Accounts" value={`${a.accounts} / ${a.details.length}`} />
      </div>
      <DataTable
        columns={[
          { key: "l", header: "Account", cell: (d: Detail) => <span className="font-mono text-[12px]">{d.login ?? "—"}</span> },
          { key: "e", header: a.method === "balance" ? "Balance" : "Equity", align: "right", cell: (d: Detail) => <span className="k-num text-fg-2">{usd(a.method === "balance" ? d.balance : d.equity)}</span> },
          { key: "b", header: a.method === "equity" || a.method === "balance" ? "Share" : "Value", align: "right", cell: (d: Detail) => <span className="k-num text-fg-2">{a.method === "equity" || a.method === "balance" ? `${(d.basis * 100).toFixed(2)}%` : valueText(a.method, d.value)}</span> },
          { key: "r", header: "Exact", align: "right", hideOn: "sm", cell: (d: Detail) => <span className="k-num text-fg-3">{d.raw.toFixed(4)}</span> },
          { key: "v", header: "Lots", align: "right", cell: (d: Detail) => <span className="k-num font-medium">{lots(d.volume)}</span> },
          { key: "t", header: "Ticket", align: "right", hideOn: "sm", cell: (d: Detail) => <span className="font-mono text-[12px] text-fg-2">{d.ticket ? `#${d.ticket}` : "—"}</span> },
          { key: "s", header: "Result", cell: (d: Detail) => <span className="flex flex-col items-start"><Chip size="sm" tone={d.status === "done" ? "up" : d.status === "failed" ? "down" : "neutral"}>{d.status}</Chip>{d.status !== "done" && <span className="mt-0.5 max-w-48 truncate text-[11px] text-fg-3">{d.message || d.reason}</span>}</span> },
        ]}
        rows={a.details}
        dense
        pageSize={20}
        rowKey={(d) => String(d.linkId)}
      />
    </Dialog>
  );
}

export function LiveMamPage() {
  const now = useNow();
  const canWrite = useSocialCan("social.write");
  const [tab, setTab] = React.useState<"managers" | "links" | "allocations">("managers");
  const [managerFilter, setManagerFilter] = React.useState<number | null>(null);
  const [alloc, setAlloc] = React.useState<Allocation | null>(null);
  const mgrs = useApi<{ items: Manager[]; feesPending: { count: number; amount: number } }>("/api/social/admin/mam/managers", { refreshMs: 30_000 });
  const links = useApi<{ items: LinkRow[] }>(tab === "links" ? `/api/social/admin/mam/links?status=all${managerFilter ? `&managerId=${managerFilter}` : ""}` : null, { refreshMs: 30_000 });
  const allocs = useApi<{ items: Allocation[] }>(tab === "allocations" ? `/api/social/admin/mam/allocations?limit=300${managerFilter ? `&managerId=${managerFilter}` : ""}` : null, { refreshMs: 30_000 });
  const act = useNoteAction();
  const managers = mgrs.data?.items ?? [];
  const active = managers.filter((m) => m.status === "active").length;
  const frozen = managers.filter((m) => m.status === "frozen").length;
  const accounts = managers.reduce((s, m) => s + (m.totals?.accounts ?? m.accounts), 0);
  const equity = managers.reduce((s, m) => s + (m.totals?.equity ?? m.aum), 0);

  const emergency = (m: Manager) => {
    const close = { current: false };
    const freeze = m.status !== "frozen";
    act.ask({
      title: freeze ? `Emergency stop · ${m.name}` : `Lift the stop · ${m.name}`,
      description: freeze
        ? "No new block is allocated to any linked account from now on. Closes on the master account still close the MAM trades on the linked accounts."
        : "New blocks on the master account are allocated to the linked accounts again.",
      confirmLabel: freeze ? "Freeze programme" : "Unfreeze",
      confirmVariant: freeze ? "sell" : "buy",
      body: freeze ? (
        <>
          <div className="grid grid-cols-3 gap-2">
            <MiniStat label="Linked accounts" value={int(m.totals?.accounts ?? m.accounts)} />
            <MiniStat label="Equity" value={usdK(m.totals?.equity ?? m.aum)} />
            <MiniStat label="MAM result" value={usd(m.totals?.mamResult ?? 0)} tone={(m.totals?.mamResult ?? 0) < 0 ? "down" : "up"} />
          </div>
          <CloseToggle state={close} label="Also close every MAM trade on the linked accounts" detail="At market, now. Clients' own trades are never touched." />
        </>
      ) : undefined,
      run: (note) => socialWrite(`admin/mam/managers/${m.id}/emergency`, { freeze, closePositions: close.current, note }),
      success: freeze ? `${m.name} frozen` : `${m.name} unfrozen`,
      onDone: () => {
        mgrs.reload();
        links.reload();
      },
    });
  };

  const stopLink = (l: LinkRow) => {
    const close = { current: false };
    act.ask({
      title: `Stop link #${l.id} · account ${l.login}`,
      description: `${l.manager?.name ?? "The manager"} loses trading authority over account ${l.login}. Fees due so far are settled.`,
      confirmLabel: "Stop link",
      confirmVariant: "sell",
      body: <CloseToggle state={close} label={`Close the ${l.mamPositions + l.mamOrders} open MAM trade${l.mamPositions + l.mamOrders === 1 ? "" : "s"}`} detail="Otherwise they stay open for the client to manage." />,
      run: (note) => socialWrite(`admin/mam/links/${l.id}/stop`, { closePositions: close.current, note }),
      success: `Link #${l.id} stopped`,
      onDone: () => {
        links.reload();
        mgrs.reload();
      },
    });
  };

  const mgrCols: Column<Manager>[] = [
    { key: "n", header: "Programme", sort: (m) => m.name, csv: (m) => m.name, cell: (m) => <span className="text-[13px] font-medium">{m.name}<span className="block text-[11px] font-normal text-fg-3">{m.nickname} · master #{m.masterId} · user #{m.userId}</span></span> },
    { key: "l", header: "Master account", csv: (m) => m.login ?? "", cell: (m) => <span className="font-mono text-[12px]">{m.login ?? "—"}</span> },
    { key: "s", header: "Status", csv: (m) => m.status, cell: (m) => <span className="flex flex-col items-start gap-0.5"><SocialStatus status={m.status} />{m.freezeReason && <span className="max-w-44 truncate text-[10.5px] text-fg-3">{m.freezeReason}</span>}</span> },
    { key: "m", header: "Allocation", hideOn: "md", csv: (m) => m.method, cell: (m) => <span className="text-[12.5px] text-fg-2">{METHOD[m.method]}</span> },
    { key: "f", header: "Fees", hideOn: "lg", cell: (m) => <span className="k-num whitespace-nowrap text-[12px] text-fg-2">{m.perfFeePct}%{m.mgmtFeePct ? ` + ${m.mgmtFeePct}%/y` : ""} · {PERIOD_LABEL[m.feePeriod]?.toLowerCase()}</span> },
    { key: "a", header: "Accounts", align: "right", sort: (m) => m.totals?.accounts ?? m.accounts, csv: (m) => m.totals?.accounts ?? m.accounts, cell: (m) => <span className="k-num">{int(m.totals?.accounts ?? m.accounts)}</span> },
    { key: "e", header: "Equity", align: "right", sort: (m) => m.totals?.equity ?? 0, csv: (m) => m.totals?.equity ?? 0, cell: (m) => <span className="k-num">{usdK(m.totals?.equity ?? m.aum)}</span> },
    { key: "r", header: "MAM result", align: "right", hideOn: "md", sort: (m) => m.totals?.mamResult ?? 0, cell: (m) => <span className={`k-num ${(m.totals?.mamResult ?? 0) < 0 ? "text-down" : (m.totals?.mamResult ?? 0) > 0 ? "text-up" : "text-fg-2"}`}>{usd(m.totals?.mamResult ?? 0)}</span> },
    { key: "p", header: "Fees pending", align: "right", hideOn: "xl", cell: (m) => <span className="k-num text-fg-2">{usd(m.totals?.feesPending ?? 0)}</span> },
    { key: "c", header: "Since", align: "right", hideOn: "xl", sort: (m) => Date.parse(m.createdAt), cell: (m) => <span className="whitespace-nowrap text-[11.5px] text-fg-3">{day(m.createdAt)}</span> },
    {
      key: "x",
      header: "",
      align: "right",
      cell: (m) => (
        <span className="flex justify-end gap-1.5" onClick={(e) => e.stopPropagation()}>
          <Button size="xs" variant="surface" onClick={() => { setManagerFilter(m.id); setTab("links"); }}>
            <Users /> Links
          </Button>
          {canWrite && m.status !== "closed" && (
            <Button size="xs" variant={m.status === "frozen" ? "up-outline" : "down-outline"} onClick={() => emergency(m)}>
              {m.status === "frozen" ? <PlayCircle /> : <OctagonAlert />} {m.status === "frozen" ? "Unfreeze" : "Stop"}
            </Button>
          )}
        </span>
      ),
    },
  ];

  const linkCols: Column<LinkRow>[] = [
    { key: "id", header: "Link", sort: (l) => l.id, csv: (l) => l.id, cell: (l) => <span className="font-mono text-[12px]">#{l.id}<span className="block text-[11px] text-fg-3">{l.manager?.name}</span></span> },
    { key: "c", header: "Client", csv: (l) => `${l.userId} ${l.login}`, cell: (l) => <span className="font-mono text-[12px]">{l.login}<span className="block text-[11px] text-fg-3">user #{l.userId}</span></span> },
    { key: "s", header: "Status", csv: (l) => l.status, cell: (l) => <span className="flex flex-col items-start gap-0.5"><SocialStatus status={l.status === "revoked" ? "stopped" : l.status} />{l.status !== "active" && <span className="text-[10.5px] text-fg-3">{STOP[l.stopReason ?? ""] ?? l.stopReason} {l.endedAt ? `· ${day(l.endedAt)}` : ""}</span>}</span> },
    { key: "e", header: "Equity", align: "right", sort: (l) => l.equity, csv: (l) => l.equity, cell: (l) => <span className="k-num">{usd(l.equity)}</span> },
    { key: "r", header: "MAM result", align: "right", sort: (l) => l.mamResult, csv: (l) => l.mamResult, cell: (l) => <span className={`k-num ${l.mamResult < 0 ? "text-down" : l.mamResult > 0 ? "text-up" : "text-fg-2"}`}>{usd(l.mamResult)}</span> },
    { key: "o", header: "Open", align: "right", hideOn: "md", cell: (l) => <span className="k-num">{l.mamPositions}{l.mamOrders ? ` + ${l.mamOrders}` : ""}</span> },
    { key: "v", header: "Value", align: "right", hideOn: "lg", cell: (l) => <span className="k-num text-fg-2">{valueText(l.manager?.method, l.allocValue)}</span> },
    { key: "lim", header: "Max lot · stop", align: "right", hideOn: "lg", cell: (l) => <span className="k-num whitespace-nowrap text-[12px] text-fg-2">{l.maxLot ?? "—"} · {l.equityStop ? usd(l.equityStop, 0) : "—"}</span> },
    { key: "f", header: "Fees paid", align: "right", hideOn: "xl", cell: (l) => <span className="k-num text-fg-2">{usd(l.feesPaid)}</span> },
    { key: "cs", header: "Consent", hideOn: "lg", csv: (l) => `${l.consent?.at ?? ""} ${l.consent?.ip ?? ""}`, cell: (l) => <span className="whitespace-nowrap text-[11.5px] text-fg-3" title={l.consent ? `${l.consent.userAgent ?? ""}\nterms ${l.consent.hash}` : undefined}>{l.consent ? `${when(l.consent.at)} · ${l.consent.ip ?? "—"}` : "—"}</span> },
    {
      key: "x",
      header: "",
      align: "right",
      cell: (l) =>
        canWrite && l.status === "active" ? (
          <span onClick={(e) => e.stopPropagation()}>
            <Button size="xs" variant="down-outline" onClick={() => stopLink(l)}>
              <Unlink /> Stop
            </Button>
          </span>
        ) : null,
    },
  ];

  const allocCols: Column<Allocation>[] = [
    { key: "at", header: "Time", sort: (a) => Date.parse(a.at), csv: (a) => a.at, cell: (a) => <span className="whitespace-nowrap text-[12px] text-fg-2" title={when(a.at, true)}>{ago(a.at, now)}</span> },
    { key: "m", header: "Programme", csv: (a) => a.managerId, cell: (a) => <span className="text-[12.5px]">{managers.find((m) => m.id === a.managerId)?.name ?? `#${a.managerId}`}</span> },
    { key: "t", header: "Block", csv: (a) => `${a.masterTicket} ${a.symbol} ${a.side}`, cell: (a) => <span className="text-[12.5px]"><span className="font-mono text-fg-3">#{a.masterTicket}</span> <span className="font-medium">{a.symbol}</span> <span className={a.side === "buy" ? "text-up" : "text-down"}>{a.side}</span>{a.action !== "open" && <span className="text-fg-3"> · {a.action}</span>}</span> },
    { key: "b", header: "Lots", align: "right", sort: (a) => a.block, csv: (a) => a.block, cell: (a) => <span className="k-num">{lots(a.block)}</span> },
    { key: "al", header: "Executed", align: "right", sort: (a) => a.allocated, csv: (a) => a.allocated, cell: (a) => <span className="k-num font-medium">{lots(a.allocated)}</span> },
    { key: "n", header: "Accounts", align: "right", cell: (a) => <span className="k-num text-fg-2">{a.accounts}/{a.details.length}</span> },
    { key: "me", header: "Method", hideOn: "md", cell: (a) => <span className="text-[12px] text-fg-3">{METHOD[a.method]}</span> },
    { key: "f", header: "Issues", align: "right", hideOn: "sm", cell: (a) => { const f = a.details.filter((d) => d.status === "failed").length; return f ? <Chip size="sm" tone="down">{f} failed</Chip> : <span className="text-fg-3">—</span>; } },
  ];

  const filterName = managerFilter ? managers.find((m) => m.id === managerFilter)?.name : null;

  return (
    <div className="pb-16">
      <PageHeader
        title="MAM"
        subtitle="Multi-account managers: one master account, trades allocated across linked client accounts. Fees are approved under Fee payouts."
        actions={
          <>
            {!canWrite && <ReadOnlyNote what="stop programmes or links" />}
            <Button variant="surface" onClick={() => { mgrs.reload(); links.reload(); allocs.reload(); }}>
              <RefreshCw /> Refresh
            </Button>
          </>
        }
      />
      {mgrs.error && !mgrs.data ? (
        <SocialError error={mgrs.error} onRetry={mgrs.reload} />
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <KpiCard label="Programmes" icon={<Briefcase />} value={<span className="k-num">{mgrs.data ? int(managers.length) : "—"}</span>} chip={`${active} active · ${frozen} frozen`} chipTone={frozen ? "down" : "neutral"} />
            <KpiCard label="Linked accounts" icon={<Users />} value={<span className="k-num">{mgrs.data ? int(accounts) : "—"}</span>} chip="Client accounts under management" />
            <KpiCard label="Equity under management" icon={<Wallet />} value={<span className="k-num">{mgrs.data ? usdK(equity) : "—"}</span>} chip="Across active links" />
            <KpiCard label="MAM fees pending" icon={<Layers />} value={<span className="k-num">{mgrs.data ? usd(mgrs.data.feesPending.amount) : "—"}</span>} chip={mgrs.data ? `${mgrs.data.feesPending.count} awaiting approval` : "—"} chipTone={mgrs.data?.feesPending.count ? "warn" : "neutral"} href="/social/payouts" />
          </div>

          <Card className="mt-4 p-4 sm:p-6">
            <div className="mb-4 flex flex-wrap items-center gap-2">
              <Segmented size="xs" value={tab} onChange={setTab} options={[{ value: "managers", label: "Programmes" }, { value: "links", label: "Linked accounts" }, { value: "allocations", label: "Allocation audit" }]} />
              {filterName && tab !== "managers" && (
                <Chip size="sm">
                  {filterName}
                  <button type="button" className="ml-1 text-fg-3 hover:text-fg" onClick={() => setManagerFilter(null)} aria-label="Clear programme filter">
                    ×
                  </button>
                </Chip>
              )}
            </div>
            {tab === "managers" &&
              (!mgrs.data ? (
                <TableSkeleton />
              ) : (
                <DataTable columns={mgrCols} rows={managers} dense pageSize={20} rowKey={(m) => String(m.id)} search={(m) => `${m.name} ${m.nickname} ${m.login} ${m.userId}`} searchPlaceholder="Programme, manager, login…" exportName="mam-programmes" empty={<EmptyState illustration="briefcase" title="No MAM programmes" text="Approved masters open programmes from the Client Area." />} />
              ))}
            {tab === "links" &&
              (links.error && !links.data ? (
                <SocialError error={links.error} onRetry={links.reload} />
              ) : !links.data ? (
                <TableSkeleton />
              ) : (
                <DataTable columns={linkCols} rows={links.data.items} dense pageSize={20} rowKey={(l) => String(l.id)} search={(l) => `${l.id} ${l.login} ${l.userId} ${l.manager?.name}`} searchPlaceholder="Link, login, user…" exportName="mam-links" empty={<EmptyState illustration="handshake" title="No linked accounts" />} />
              ))}
            {tab === "allocations" &&
              (allocs.error && !allocs.data ? (
                <SocialError error={allocs.error} onRetry={allocs.reload} />
              ) : !allocs.data ? (
                <TableSkeleton />
              ) : (
                <DataTable columns={allocCols} rows={allocs.data.items} dense pageSize={20} rowKey={(a) => String(a.id)} onRowClick={setAlloc} search={(a) => `${a.masterTicket} ${a.symbol} ${a.details.map((d) => d.login).join(" ")}`} searchPlaceholder="Ticket, symbol, login…" exportName="mam-allocations" empty={<EmptyState illustration="bar_chart" title="No allocations yet" />} />
              ))}
          </Card>
        </>
      )}
      <AllocationDialog a={alloc} managers={managers} onClose={() => setAlloc(null)} />
      {act.node}
    </div>
  );
}
