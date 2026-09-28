"use client";

import * as React from "react";
import Link from "next/link";
import { toast } from "sonner";
import { AlertTriangle, ArrowDownToLine, Blocks, Clock3, Download, Gauge as GaugeIcon, HandCoins, Radio, Settings2, Zap } from "lucide-react";
import { Button, Card, CardHeader, Chip, DataTable, Donut, KpiCard, Money, PageHeader, Reveal, Segmented, StatusChip, type Column } from "@kalks/ui";
import {
  FIN_CHAINS,
  FIN_DEPOSITS,
  FIN_DEPOSITS_30D,
  FIN_DEPOSIT_KPIS,
  finAgo,
  finTime,
  type FinChainConfig,
  type FinClient,
  type FinDeposit,
} from "@kalks/mock/admin-finance";
import { ColumnChart, PersonCell, TxHash, auditToast } from "@/components/config/kit";
import { ChainRulesCard, ChainRulesDialog } from "@/components/finance/chain-rules";
import { UnmatchedDialog, type ResolveAction } from "@/components/finance/unmatched-dialog";
import { CoinAmount, ConfProgress, LiveDot, NetworkChip, fmtDuration, usd } from "@/components/finance/shared";

type Dep = Omit<FinDeposit, "status"> & { status: FinDeposit["status"] | "refunded" | "held" };
type Filter = "all" | "confirming" | "unmatched" | "credited";

const STATUS_CHIP: Record<Dep["status"], React.ReactNode> = {
  credited: <StatusChip status="completed" label="Auto-credited" />,
  confirming: <StatusChip status="running" label="Confirming" />,
  unmatched: <StatusChip status="pending" label="Unmatched" />,
  refunded: <StatusChip status="expired" label="Refund queued" />,
  held: <StatusChip status="review" label="On hold" />,
};

const CHART_30D = FIN_DEPOSITS_30D.map((d) => ({ ...d, label: d.label.split(" ")[0]! }));

function chainOf(d: Dep) {
  return d.network === "BTC" ? "btc" : d.network === "TRC20" ? "tron" : "eth";
}

export default function DepositsPage() {
  const [deps, setDeps] = React.useState<Dep[]>(FIN_DEPOSITS);
  const [filter, setFilter] = React.useState<Filter>("all");
  const [resolving, setResolving] = React.useState<FinDeposit | null>(null);
  const [chains, setChains] = React.useState<FinChainConfig[]>(FIN_CHAINS);
  const [rulesOpen, setRulesOpen] = React.useState(false);
  const [block, setBlock] = React.useState(66_412_880);

  // Live confirmations: a new TRON block every ~3s.
  const depsRef = React.useRef(deps);
  depsRef.current = deps;
  React.useEffect(() => {
    const t = setInterval(() => {
      setBlock((b) => b + 1);
      const credited: Dep[] = [];
      const next = depsRef.current.map((d): Dep => {
        if (d.status !== "confirming") return d;
        const conf = d.confirmations + 1;
        if (conf >= d.required) {
          credited.push(d);
          return { ...d, confirmations: conf, status: "credited", creditSec: Math.round(conf * 3.2) };
        }
        return { ...d, confirmations: conf };
      });
      setDeps(next);
      credited.forEach((d) => toast.success(`Auto-credited ${usd(d.usd)} to ${d.client?.person.name ?? "client"}`, { description: `${d.id} · ${d.required}/${d.required} confirmations on ${d.network}` }));
    }, 3200);
    return () => clearInterval(t);
  }, []);

  const counts = {
    all: deps.length,
    confirming: deps.filter((d) => d.status === "confirming").length,
    unmatched: deps.filter((d) => d.status === "unmatched").length,
    credited: deps.filter((d) => d.status === "credited").length,
  };
  const rows = filter === "all" ? deps : deps.filter((d) => d.status === filter);
  const unmatched = deps.filter((d) => d.status === "unmatched");
  const pendingUsd = deps.filter((d) => d.status === "confirming").reduce((s, d) => s + d.usd, 0);

  const resolve = (d: FinDeposit, action: ResolveAction, client: FinClient | null, reason: string) => {
    setDeps((list) => list.map((x) => (x.id === d.id ? { ...x, status: action === "assign" ? "credited" : action === "refund" ? "refunded" : "held", client: client ?? x.client } : x)));
    auditToast(
      action === "assign" ? `${usd(d.usd)} credited to ${client?.person.name}` : action === "refund" ? `Refund of ${usd(d.usd)} queued` : `${d.id} placed on hold`,
      reason,
    );
  };

  const columns: Column<Dep>[] = [
    { key: "time", header: "Time", width: "88px", cell: (d) => <div><div className="k-num font-mono text-[12.5px] text-fg">{finTime(d.minutesAgo, "time")}</div><div className="text-[11px] text-fg-3">{finAgo(d.minutesAgo)}</div></div>, sort: (d) => -d.minutesAgo },
    {
      key: "client",
      header: "Client",
      cell: (d) =>
        d.client ? (
          <PersonCell name={d.client.person.name} photo={d.client.person.photo} country={d.client.person.country} sub={<span className="font-mono">{d.client.login}</span>} size={28} />
        ) : (
          <span className="flex items-center gap-2.5">
            <span className="grid size-7 place-items-center rounded-full border border-dashed border-warn/50 bg-warn-soft text-warn">
              <AlertTriangle className="size-3.5" />
            </span>
            <span>
              <span className="block text-[13px] font-medium text-fg">Unassigned</span>
              <span className="block max-w-44 truncate text-[11px] text-fg-3">{d.unmatchedReason}</span>
            </span>
          </span>
        ),
    },
    { key: "amount", header: "Amount", align: "right", cell: (d) => <CoinAmount amount={d.amount} asset={d.asset} usdValue={d.usd} className="whitespace-nowrap" />, sort: (d) => d.usd },
    { key: "conf", header: "Confirmations", cell: (d) => <ConfProgress conf={d.confirmations} required={d.required} /> },
    { key: "hash", header: "Network · tx", cell: (d) => <div className="whitespace-nowrap"><NetworkChip network={d.network} className="mb-1 h-5 text-[10.5px]" /><div><TxHash hash={d.hash} chain={chainOf(d)} /></div></div>, hideOn: "md" },
    { key: "status", header: "Status", cell: (d) => <div><div>{STATUS_CHIP[d.status]}</div>{d.status === "credited" && d.creditSec && <div className="mt-1 text-[11px] text-fg-3">in {fmtDuration(d.creditSec)}</div>}</div> },
    {
      key: "act",
      header: "",
      align: "right",
      width: "96px",
      cell: (d) =>
        d.status === "unmatched" ? (
          <Button size="xs" variant="ember" onClick={(e) => { e.stopPropagation(); setResolving(d as FinDeposit); }}>
            Resolve
          </Button>
        ) : null,
    },
  ];

  const byNet = chains.map((c) => ({ label: c.network, value: c.share }));

  return (
    <div className="pb-24">
      <PageHeader
        title="Deposits"
        subtitle="On-chain monitor for your HD wallet · auto-credit after N confirmations · server time GMT+3"
        actions={
          <>
            <Chip tone="up" className="h-9 px-3">
              <LiveDot /> TRON node · block <span className="font-mono">{block.toLocaleString("en-US")}</span>
            </Chip>
            <Button variant="surface" size="md" onClick={() => setRulesOpen(true)}>
              <Settings2 /> Auto-credit rules
            </Button>
            <Button variant="surface" size="md" onClick={() => toast.success("deposits-2026-09-24.csv exported", { description: `${deps.length} on-chain deposits · GMT+3` })}>
              <Download /> Export
            </Button>
            <Link href="/finance/adjustments">
              <Button variant="ember" size="md">
                <HandCoins /> Manual credit
              </Button>
            </Link>
          </>
        }
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard label="Deposits today" icon={<ArrowDownToLine />} value={<Money value={FIN_DEPOSIT_KPIS.todayUsd} />} chip={`+${FIN_DEPOSIT_KPIS.todayChangePct}% vs yesterday · ${FIN_DEPOSIT_KPIS.todayCount} txs`} chipTone="up" href="/finance/transactions" />
        <KpiCard
          label="Pending confirmations"
          icon={<Clock3 />}
          value={<span className="k-num">{counts.confirming}</span>}
          footer={<span className="text-[12px] text-fg-3"><span className="k-num font-medium text-fg">{usd(pendingUsd)}</span> in flight · ~60s to credit</span>}
          delay={0.05}
        />
        <KpiCard
          label="Unmatched"
          icon={<AlertTriangle />}
          value={<span className="k-num">{counts.unmatched}</span>}
          hot={counts.unmatched > 0}
          illustration="warning"
          footer={<Chip tone={counts.unmatched ? "warn" : "up"}>{counts.unmatched ? `${usd(unmatched.reduce((s, d) => s + d.usd, 0))} awaiting resolution` : "Queue clear"}</Chip>}
          delay={0.1}
        />
        <KpiCard
          label="Auto-credit rate"
          icon={<Zap />}
          value={<span className="k-num">{FIN_DEPOSIT_KPIS.autoCreditRate}<span className="text-fg-3">%</span></span>}
          chip={`avg ${fmtDuration(FIN_DEPOSIT_KPIS.avgCreditSec)} to credit`}
          chipTone="ember"
          delay={0.15}
        />
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-12">
        <Reveal delay={0.1} className="min-w-0 xl:col-span-9">
          <Card className="h-full">
            <CardHeader
              title="Blockchain deposit monitor"
              subtitle="Incoming transfers to client deposit addresses · live"
              icon={<Radio />}
              action={
                <Segmented
                  size="xs"
                  value={filter}
                  onChange={setFilter}
                  options={[
                    { value: "all", label: <>All <span className="text-fg-3">{counts.all}</span></> },
                    { value: "confirming", label: <>Confirming <span className="text-ember">{counts.confirming}</span></> },
                    { value: "unmatched", label: <>Unmatched <span className="text-warn">{counts.unmatched}</span></> },
                    { value: "credited", label: <>Credited <span className="text-fg-3">{counts.credited}</span></> },
                  ]}
                />
              }
            />
            <div className="px-4 pb-5 pt-4 sm:px-6">
              <DataTable
                columns={columns}
                rows={rows}
                rowKey={(d) => d.id}
                pageSize={10}
                dense
                search={(d) => `${d.id} ${d.hash} ${d.from} ${d.to} ${d.client?.person.name ?? ""} ${d.client?.login ?? ""}`}
                searchPlaceholder="Hash, address, login…"
                onRowClick={(d) => (d.status === "unmatched" ? setResolving(d as FinDeposit) : toast.message(`${d.id} · ${usd(d.usd)}`, { description: `${d.network} · ${d.confirmations.toLocaleString()} confirmations · ${d.client?.person.name ?? "unassigned"}` }))}
              />
            </div>
          </Card>
        </Reveal>

        <div className="grid min-w-0 grid-cols-1 gap-4 sm:grid-cols-2 xl:col-span-3 xl:grid-cols-1">
          <Reveal delay={0.15}>
            <Card className="h-full">
              <CardHeader title="Unmatched queue" subtitle="Needs an operator decision" action={<Chip tone={unmatched.length ? "warn" : "up"} dot>{unmatched.length}</Chip>} />
              <div className="mt-4 space-y-2 px-4 pb-5 sm:px-6">
                {unmatched.length === 0 && <div className="k-row px-4 py-6 text-center text-[13px] text-fg-3">All deposits are matched.</div>}
                {unmatched.map((d) => (
                  <button key={d.id} type="button" onClick={() => setResolving(d as FinDeposit)} className="k-row flex w-full items-center gap-3 px-3.5 py-2.5 text-left transition-colors hover:bg-surface-3/60">
                    <span className="grid size-8 shrink-0 place-items-center rounded-full bg-warn-soft text-warn">
                      <AlertTriangle className="size-4" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="k-num block text-[13.5px] font-medium">{usd(d.usd)}</span>
                      <span className="block truncate text-[11.5px] text-fg-3">{d.unmatchedReason}</span>
                    </span>
                    <span className="text-right text-[11px] text-fg-3">
                      <span className="block font-mono">{d.id}</span>
                      {finAgo(d.minutesAgo)}
                    </span>
                  </button>
                ))}
              </div>
            </Card>
          </Reveal>
          <Reveal delay={0.2}>
            <ChainRulesCard chains={chains} onEdit={() => setRulesOpen(true)} />
          </Reveal>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-12">
        <Reveal delay={0.1} className="min-w-0 xl:col-span-8">
          <Card className="h-full">
            <CardHeader title="Deposits · last 30 days" subtitle="USD value, auto-credited vs manually resolved" icon={<Blocks />} action={<Chip tone="up">{usd(FIN_DEPOSITS_30D.reduce((s, d) => s + d.values[0]! + d.values[1]!, 0), 0)} total</Chip>} />
            <div className="px-4 pb-5 pt-4 sm:px-6">
              <ColumnChart data={CHART_30D} series={[{ label: "Auto-credited", tone: "ember" }, { label: "Manual resolution", tone: "gold" }]} height={250} labelEvery={3} format={(v) => (v >= 1e6 ? `$${(v / 1e6).toFixed(1)}M` : v >= 1000 ? `$${Math.round(v / 1000)}K` : `$${Math.round(v)}`)} />
            </div>
          </Card>
        </Reveal>
        <Reveal delay={0.15} className="min-w-0 xl:col-span-4">
          <Card className="h-full">
            <CardHeader title="Volume by network" subtitle="Share of 30-day deposits" icon={<GaugeIcon />} />
            <div className="flex flex-col items-center gap-6 px-6 pb-6 pt-5 sm:flex-row xl:flex-col 2xl:flex-row">
              <Donut
                data={byNet.map((b, i) => ({ ...b, color: ["var(--k-ember)", "var(--k-gold)", "var(--k-up)", "var(--k-info)", "var(--k-fg-3)"][i] }))}
                size={160}
                thickness={18}
                center={
                  <div>
                    <div className="k-num text-[20px] font-semibold">86%</div>
                    <div className="text-[11px] text-fg-3">TRC20</div>
                  </div>
                }
              />
              <div className="w-full flex-1 space-y-2">
                {byNet.map((b, i) => (
                  <div key={b.label} className="flex items-center justify-between gap-2 text-[12.5px]">
                    <span className="flex items-center gap-2 text-fg-2">
                      <span className="size-2 rounded-full" style={{ background: ["var(--k-ember)", "var(--k-gold)", "var(--k-up)", "var(--k-info)", "var(--k-fg-3)"][i] }} />
                      {b.label}
                    </span>
                    <span className="k-num font-medium">{b.value.toFixed(1)}%</span>
                  </div>
                ))}
              </div>
            </div>
          </Card>
        </Reveal>
      </div>

      <UnmatchedDialog deposit={resolving} onOpenChange={(o) => !o && setResolving(null)} onResolve={resolve} />
      <ChainRulesDialog open={rulesOpen} onOpenChange={setRulesOpen} chains={chains} onSave={setChains} />
    </div>
  );
}
