"use client";

import * as React from "react";
import { toast } from "sonner";
import { ArrowDownToLine, Building2, Fuel, History, Layers, Loader2, Lock, ShieldCheck, Wand2 } from "lucide-react";
import { Button, Card, CardHeader, Chip, DataTable, Dialog, Icon3D, Money, PageHeader, Reveal, Starfield, StatusChip, type Column } from "@ezymex/ui";
import { hashString, seeded } from "@ezymex/mock";
import { FIN_COLD_WALLETS, FIN_HD, FIN_HOT_WALLET, FIN_SWEEP_HISTORY, FIN_SWEEP_QUEUE, finAgo, finHex, finTime, type FinSweepItem } from "@ezymex/mock/admin-finance";
import { Addr, Checkbox, PersonCell, TxHash, auditToast } from "@/components/config/kit";
import { ColdWalletsCard, HdCard, HotWalletCard, TopUpGasDialog, type HotState } from "@/components/finance/wallet-cards";
import { Line, num, usd } from "@/components/finance/shared";
import { IS_DEMO } from "@ezymex/mock/mode";
import { LiveWalletsPage } from "@/components/finance-live/wallets";

type SweepRow = (typeof FIN_SWEEP_HISTORY)[number];
const SWEEP_MIN = 50;

function DemoWalletsPage() {
  const [hot, setHot] = React.useState<HotState>({ usdt: FIN_HOT_WALLET.usdt, trx: FIN_HOT_WALLET.trx, energy: FIN_HOT_WALLET.energy });
  const [queue, setQueue] = React.useState<FinSweepItem[]>(FIN_SWEEP_QUEUE);
  const [history, setHistory] = React.useState<SweepRow[]>(FIN_SWEEP_HISTORY);
  const [sel, setSel] = React.useState<Set<string>>(() => new Set(FIN_SWEEP_QUEUE.map((q) => q.id)));
  const [topUp, setTopUp] = React.useState(false);
  const [sweepOpen, setSweepOpen] = React.useState(false);
  const [busy, setBusy] = React.useState(false);

  const picked = queue.filter((q) => sel.has(q.id));
  const pickedUsdt = picked.reduce((s, q) => s + q.usdt, 0);
  const pickedTrx = picked.reduce((s, q) => s + q.trxNeeded, 0);
  const toCold = hot.usdt + pickedUsdt > FIN_HOT_WALLET.usdtCap;
  const coldUsd = FIN_COLD_WALLETS[0]!.balance + FIN_COLD_WALLETS[1]!.balance * 63_412;
  const queueUsdt = queue.reduce((s, q) => s + q.usdt, 0);
  const total = hot.usdt + coldUsd + queueUsdt;

  const runSweep = () => {
    setBusy(true);
    setTimeout(() => {
      const r = seeded(hashString(`sweep${history.length}`));
      setHistory((h) => [{ id: `SWP-${7713 + (history.length - FIN_SWEEP_HISTORY.length)}`, minutesAgo: 0, addresses: picked.length, usdt: pickedUsdt, trxFee: pickedTrx, hash: finHex(r), status: "completed", to: toCold ? "Cold vault A" : "Hot wallet" }, ...h]);
      if (!toCold) setHot((x) => ({ ...x, usdt: x.usdt + pickedUsdt }));
      setHot((x) => ({ ...x, trx: Math.max(0, x.trx - pickedTrx) }));
      setQueue((q) => q.filter((x) => !sel.has(x.id)));
      setSel(new Set());
      setBusy(false);
      setSweepOpen(false);
      auditToast(`Swept ${num(pickedUsdt)} USDT from ${picked.length} addresses`, `→ ${toCold ? "Cold vault A" : "Hot wallet"} · ${num(pickedTrx, 1)} TRX gas`);
    }, 1300);
  };

  const qCols: Column<FinSweepItem>[] = [
    {
      key: "sel",
      header: <Checkbox checked={queue.length > 0 && sel.size === queue.length} indeterminate={sel.size > 0 && sel.size < queue.length} onChange={(v) => setSel(v ? new Set(queue.map((q) => q.id)) : new Set())} label="Select all" />,
      width: "44px",
      cell: (q) => (
        <Checkbox
          checked={sel.has(q.id)}
          onChange={(v) =>
            setSel((s) => {
              const n = new Set(s);
              if (v) n.add(q.id);
              else n.delete(q.id);
              return n;
            })
          }
        />
      ),
    },
    { key: "addr", header: "Deposit address", cell: (q) => <div className="whitespace-nowrap"><Addr value={q.address} head={7} tail={5} /><div className="font-mono text-[11px] text-fg-3">…/0/{q.index}</div></div> },
    { key: "client", header: "Client", cell: (q) => <PersonCell name={q.client.person.name} photo={q.client.person.photo} sub={<span className="font-mono">{q.client.login}</span>} size={26} />, hideOn: "md" },
    { key: "usdt", header: "USDT", align: "right", cell: (q) => <span className="k-num font-medium">{num(q.usdt)}</span>, sort: (q) => q.usdt },
    { key: "gas", header: "Gas", align: "right", cell: (q) => <span className="k-num text-fg-2">{num(q.trxNeeded, 1)} TRX</span>, hideOn: "sm" },
    { key: "age", header: "Waiting", align: "right", cell: (q) => <span className={q.ageMinutes > 360 ? "text-[12px] text-warn" : "text-[12px] text-fg-3"}>{finAgo(q.ageMinutes)}</span>, sort: (q) => q.ageMinutes },
  ];

  const hCols: Column<SweepRow>[] = [
    { key: "id", header: "Sweep", cell: (h) => <div><div className="font-mono text-[12.5px] text-fg">{h.id}</div><div className="text-[11px] text-fg-3">{finTime(h.minutesAgo)}</div></div> },
    { key: "n", header: "Addresses", align: "right", cell: (h) => <span className="k-num">{h.addresses}</span> },
    { key: "usdt", header: "Swept", align: "right", cell: (h) => <span className="k-num font-medium">{num(h.usdt)} <span className="text-[11px] text-fg-3">USDT</span></span>, sort: (h) => h.usdt },
    { key: "gas", header: "Gas used", align: "right", cell: (h) => <span className="k-num text-fg-2">{num(h.trxFee, 1)} TRX</span>, hideOn: "sm" },
    { key: "to", header: "Destination", cell: (h) => <Chip size="sm" tone={h.to === "Hot wallet" ? "ember" : "gold"}>{h.to}</Chip> },
    { key: "tx", header: "Tx", cell: (h) => <TxHash hash={h.hash} />, hideOn: "md" },
    { key: "st", header: "Status", align: "right", cell: (h) => (h.status === "completed" ? <StatusChip status="completed" /> : <StatusChip status="pending" label="Partial · 3 retried" />) },
  ];

  return (
    <div className="pb-24">
      <PageHeader
        title="Wallets & custody"
        subtitle="Your tenant's own HD wallet: hot wallet for payouts, multisig cold vaults, and per-client deposit addresses"
        actions={
          <>
            <Button variant="surface" onClick={() => setTopUp(true)}>
              <Fuel /> Top up gas
            </Button>
            <Button variant="surface" onClick={() => toast.success("Proof-of-reserves snapshot generated", { description: "por-ezymex-2026-09-24.json · signed with tenant key" })}>
              <ShieldCheck /> Proof of reserves
            </Button>
            <Button variant="ember" disabled={queue.length === 0} onClick={() => setSweepOpen(true)}>
              <Wand2 /> Sweep now
            </Button>
          </>
        }
      />

      <Reveal>
        <Card hot className="relative overflow-hidden">
          <Starfield density={36} />
          <div className="relative grid grid-cols-1 gap-6 px-6 py-5 lg:grid-cols-[1.4fr_2fr] lg:items-center">
            <div className="flex items-center gap-4">
              <Icon3D name="locked" size={60} className="shrink-0" />
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-[16px] font-medium">Segregated custody · {FIN_HD.tenant}</span>
                  <Chip size="sm" tone="gold">
                    <Lock className="size-3" /> Keys in HSM
                  </Chip>
                </div>
                <p className="mt-1 max-w-xl text-[13px] text-fg-2">
                  Each broker tenant has its own HD wallet and keys held in a dedicated HSM partition. Ezymex never commingles client funds across tenants — every address, sweep and payout on this page belongs to <span className="font-mono text-fg">{FIN_HD.tenantId}</span> only.
                </p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              <div className="k-row px-4 py-3">
                <div className="text-[11px] uppercase tracking-wider text-fg-3">Total custody</div>
                <Money value={total} decimals={0} className="mt-1 block text-[17px] font-semibold" />
              </div>
              <div className="k-row px-4 py-3">
                <div className="text-[11px] uppercase tracking-wider text-fg-3">Hot</div>
                <div className="k-num mt-1 text-[17px] font-semibold">{((hot.usdt / total) * 100).toFixed(1)}%</div>
              </div>
              <div className="k-row px-4 py-3">
                <div className="text-[11px] uppercase tracking-wider text-fg-3">Cold</div>
                <div className="k-num mt-1 text-[17px] font-semibold text-gold">{((coldUsd / total) * 100).toFixed(1)}%</div>
              </div>
              <div className="k-row px-4 py-3">
                <div className="text-[11px] uppercase tracking-wider text-fg-3">Deposit addrs</div>
                <div className="k-num mt-1 text-[17px] font-semibold">{num(FIN_HD.addresses, 0)}</div>
              </div>
            </div>
          </div>
        </Card>
      </Reveal>

      <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-12">
        <Reveal delay={0.05} className="min-w-0 xl:col-span-5">
          <HotWalletCard hot={hot} onTopUp={() => setTopUp(true)} />
        </Reveal>
        <Reveal delay={0.1} className="min-w-0 xl:col-span-7">
          <ColdWalletsCard />
        </Reveal>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-12">
        <Reveal delay={0.1} className="min-w-0 xl:col-span-8">
          <Card className="h-full">
            <CardHeader
              title="Sweep queue"
              subtitle={`Deposit addresses holding ≥ ${SWEEP_MIN} USDT · ${usd(queueUsdt)} awaiting sweep`}
              icon={<Layers />}
              action={
                <Button size="sm" variant="ember" disabled={picked.length === 0} onClick={() => setSweepOpen(true)}>
                  <Wand2 /> Sweep {picked.length || ""}
                </Button>
              }
            />
            <div className="px-4 pb-5 pt-4 sm:px-6">
              <DataTable
                columns={qCols}
                rows={queue}
                rowKey={(q) => q.id}
                pageSize={8}
                dense
                empty={<div className="flex flex-col items-center py-10 text-center"><Icon3D name="check_mark_button" size={56} /><div className="mt-3 text-[14px] font-medium">Queue is empty</div><div className="text-[12.5px] text-fg-3">Next automatic sweep at 18:00 GMT+3</div></div>}
              />
            </div>
          </Card>
        </Reveal>
        <Reveal delay={0.15} className="min-w-0 xl:col-span-4">
          <HdCard />
        </Reveal>
      </div>

      <Reveal delay={0.1} className="mt-4">
        <Card>
          <CardHeader title="Sweep history" subtitle="Automatic sweeps run every 6 hours · deposit addresses → hot wallet, overflow → cold vault" icon={<History />} action={<Chip tone="neutral"><ArrowDownToLine className="size-3" /> Auto 00:00 · 06:00 · 12:00 · 18:00</Chip>} />
          <div className="px-4 pb-5 pt-4 sm:px-6">
            <DataTable columns={hCols} rows={history} rowKey={(h) => h.id} pageSize={6} dense exportName="sweep-history" />
          </div>
        </Card>
      </Reveal>

      <TopUpGasDialog
        open={topUp}
        onOpenChange={setTopUp}
        onConfirm={(trx, mode) => setHot((h) => (mode === "transfer" ? { ...h, trx: h.trx + trx } : { ...h, energy: h.energy + Math.round(trx * 11.2) }))}
      />

      <Dialog
        open={sweepOpen}
        onOpenChange={(o) => !busy && setSweepOpen(o)}
        width={500}
        title="Sweep deposit addresses"
        description="Moves USDT from client deposit addresses into custody. Gas is pre-funded per address from the hot wallet."
        footer={
          <>
            <Button variant="ghost" size="sm" disabled={busy} onClick={() => setSweepOpen(false)}>
              Cancel
            </Button>
            <Button variant="ember" size="sm" disabled={busy || picked.length === 0} onClick={runSweep}>
              {busy ? <Loader2 className="animate-spin" /> : <Wand2 />}
              {busy ? "Sweeping…" : `Sweep ${picked.length} addresses`}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-2">
            <div className="k-row px-4 py-3">
              <div className="text-[11px] uppercase tracking-wider text-fg-3">USDT to sweep</div>
              <div className="k-num mt-1 text-[20px] font-semibold">{num(pickedUsdt)}</div>
            </div>
            <div className="k-row px-4 py-3">
              <div className="text-[11px] uppercase tracking-wider text-fg-3">Gas cost</div>
              <div className="k-num mt-1 text-[20px] font-semibold text-gold">{num(pickedTrx, 1)} TRX</div>
            </div>
          </div>
          <div className="k-row divide-y divide-line px-4 py-1">
            <Line k="Addresses" v={picked.length} />
            <Line k="Destination" v={toCold ? "Cold vault A (hot wallet above cap)" : "Hot wallet"} />
            <Line k="Hot wallet after" v={`${num(toCold ? hot.usdt : hot.usdt + pickedUsdt)} USDT`} />
            <Line k="TRX gas after" v={`${num(Math.max(0, hot.trx - pickedTrx), 1)} TRX`} tone={hot.trx - pickedTrx < FIN_HOT_WALLET.trxMin ? "warn" : undefined} />
          </div>
          <div className="flex items-center gap-2 rounded-[12px] border border-line bg-surface-2 px-3 py-2.5 text-[12px] text-fg-3">
            <Building2 className="size-4 shrink-0 text-ember" />
            Sweeps are internal to {FIN_HD.tenant}&apos;s wallet tree and do not change client balances.
          </div>
        </div>
      </Dialog>
    </div>
  );
}

/** Live builds: the wallet service (services/wallet). Demo builds: the mock showcase above. */
export default function WalletsPage() {
  return IS_DEMO ? <DemoWalletsPage /> : <LiveWalletsPage />;
}
