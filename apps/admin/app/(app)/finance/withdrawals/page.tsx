"use client";

import * as React from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "motion/react";
import { toast } from "sonner";
import { ArrowUpFromLine, Check, Clock3, Download, Flame, ListChecks, Send, ShieldAlert, Timer, Wallet, X } from "lucide-react";
import { Button, Card, CardHeader, Chip, DataTable, KpiCard, Money, PageHeader, Reveal, Segmented, StatusChip, Tabs, Tooltip, type Column } from "@ezymex/ui";
import { hashString, seeded } from "@ezymex/mock";
import { FIN_HOT_WALLET, FIN_SWEEP_HISTORY, FIN_WITHDRAWALS, FIN_WITHDRAW_REASONS, finAgo, finHex, finTime, type FinWithdrawal, type FinWithdrawalStatus } from "@ezymex/mock/admin-finance";
import { Addr, Checkbox, PersonCell, RiskScore, TxHash, auditToast, useReason } from "@/components/config/kit";
import { BatchSendDialog } from "@/components/finance/batch-send";
import { WithdrawalReview } from "@/components/finance/withdrawal-review";
import { CheckRow, num, usd } from "@/components/finance/shared";
import { IS_DEMO } from "@ezymex/mock/mode";
import { LiveWithdrawalsPage } from "@/components/finance-live/withdrawals";

type RiskFilter = "all" | "high" | "clean";
const ME = "Priya Nair";

const RULES = [
  { label: "Every withdrawal is admin-approved", hint: "No auto-payouts, including IB & copy balances", on: true },
  { label: "Dual approval above $10,000", hint: "Second approver from Finance lead group", on: true },
  { label: "24h cooldown for new addresses", hint: "First withdrawal to an unseen address", on: true },
  { label: "Hold if deposit < 24h with no trading", hint: "Anti-money-mule rule", on: true },
  { label: "Block address shared across accounts", hint: "Auto-flag, manual override allowed", on: false },
];

function DemoWithdrawalsPage() {
  const [rows, setRows] = React.useState<FinWithdrawal[]>(FIN_WITHDRAWALS);
  const [tab, setTab] = React.useState<FinWithdrawalStatus>("pending");
  const [risk, setRisk] = React.useState<RiskFilter>("all");
  const [sel, setSel] = React.useState<Set<string>>(new Set());
  const [review, setReview] = React.useState<FinWithdrawal | null>(null);
  const [batchOpen, setBatchOpen] = React.useState(false);
  const [batchIds, setBatchIds] = React.useState<string[]>([]);
  const reason = useReason();
  const [hot, setHot] = React.useState({ usdt: FIN_HOT_WALLET.usdt, trx: FIN_HOT_WALLET.trx });
  const [paid, setPaid] = React.useState({ usd: 214_806.3, batches: 3, txs: 96 });

  const count = (s: FinWithdrawalStatus) => rows.filter((r) => r.status === s).length;
  const view = rows.filter((r) => r.status === tab && (risk === "all" || (risk === "high" ? r.risk >= 40 : r.risk < 40))).sort((a, b) => (tab === "pending" ? b.minutesAgo - a.minutesAgo : a.minutesAgo - b.minutesAgo));
  const selectable = tab === "pending" || tab === "approved";
  const selected = rows.filter((r) => sel.has(r.id));
  const selTotal = selected.reduce((s, r) => s + r.amount, 0);
  const pending = rows.filter((r) => r.status === "pending");

  React.useEffect(() => setSel(new Set()), [tab, risk]);

  const toggle = (id: string, on: boolean) =>
    setSel((s) => {
      const n = new Set(s);
      if (on) n.add(id);
      else n.delete(id);
      return n;
    });
  const allOn = view.length > 0 && view.every((r) => sel.has(r.id));
  const someOn = view.some((r) => sel.has(r.id));

  const setStatus = (ids: string[], status: FinWithdrawalStatus, extra?: (r: FinWithdrawal) => Partial<FinWithdrawal>) => {
    setRows((list) => list.map((r) => (ids.includes(r.id) ? { ...r, status, minutesAgo: 0, ...(extra?.(r) ?? {}) } : r)));
    setSel(new Set());
  };

  const bulk = (d: "approved" | "rejected") =>
    reason.ask({
      title: d === "approved" ? `Approve ${selected.length} withdrawals` : `Reject ${selected.length} withdrawals`,
      description: `${usd(selTotal)} USDT in total`,
      reasons: d === "approved" ? FIN_WITHDRAW_REASONS.approve : FIN_WITHDRAW_REASONS.reject,
      confirmLabel: d === "approved" ? "Approve all" : "Reject all",
      tone: d === "approved" ? "buy" : "sell",
      onConfirm: (r) => {
        const ids = selected.map((x) => x.id);
        setStatus(ids, d, (x) => (d === "approved" ? { approvedBy: ME } : { rejectReason: r }));
        auditToast(`${ids.length} withdrawal${ids.length > 1 ? "s" : ""} ${d}`, r);
      },
    });

  const openBatch = (ids: string[]) => {
    setBatchIds(ids);
    setBatchOpen(true);
  };

  const onSent = (ids: string[], trxFee: number) => {
    const total = rows.filter((r) => ids.includes(r.id)).reduce((s, r) => s + r.amount - r.fee, 0);
    setStatus(ids, "sent", (r) => ({ hash: finHex(seeded(hashString(r.id + "sent"))), approvedBy: r.approvedBy ?? ME }));
    setHot((h) => ({ usdt: h.usdt - total, trx: h.trx - trxFee }));
    setPaid((p) => ({ usd: p.usd + total, batches: p.batches + 1, txs: p.txs + ids.length }));
    auditToast(`Batch broadcast · ${ids.length} transfers`, `${num(total)} USDT from hot wallet ${FIN_HOT_WALLET.address.slice(0, 6)}…`);
    setTab("sent");
  };

  const columns: Column<FinWithdrawal>[] = [
    ...(selectable
      ? [
          {
            key: "sel",
            header: <Checkbox checked={allOn} indeterminate={!allOn && someOn} onChange={(v) => setSel(v ? new Set(view.map((r) => r.id)) : new Set())} label="Select all" />,
            width: "44px",
            cell: (r: FinWithdrawal) => <Checkbox checked={sel.has(r.id)} onChange={(v) => toggle(r.id, v)} />,
          } satisfies Column<FinWithdrawal>,
        ]
      : []),
    {
      key: "client",
      header: "Client",
      cell: (r) => <PersonCell name={r.client.person.name} photo={r.client.person.photo} country={r.client.person.country} verified={r.client.kycLevel >= 2} sub={<span className="font-mono">{r.client.login} · {r.id}</span>} size={30} />,
      sort: (r) => r.client.person.name,
    },
    {
      key: "amount",
      header: "Amount",
      align: "right",
      cell: (r) => (
        <div className="whitespace-nowrap">
          <div className="k-num text-[13.5px] font-medium">
            {num(r.amount)} <span className="text-[11px] font-normal text-fg-3">USDT</span>
          </div>
          <div className="text-[11px] text-fg-3">{r.source}</div>
        </div>
      ),
      sort: (r) => r.amount,
    },
    { key: "addr", header: "Destination", cell: (r) => <div className="whitespace-nowrap"><Addr value={r.address} /><div className="mt-0.5">{r.addressReuse > 0 ? <Tooltip content={`Address shared with ${r.addressReuse} other account${r.addressReuse > 1 ? "s" : ""}`}><span className="inline-flex items-center gap-1 text-[11px] text-down"><ShieldAlert className="size-3" /> reused ×{r.addressReuse + 1}</span></Tooltip> : <span className="text-[11px] text-fg-3">TRC20 · {r.addressHistory[0]!.whitelisted ? "whitelisted" : "new"}</span>}</div></div>, hideOn: "md" },
    { key: "checks", header: "Risk checklist", cell: (r) => <CheckRow checks={r.checks} /> },
    { key: "risk", header: "Score", cell: (r) => <RiskScore score={r.risk} />, sort: (r) => r.risk },
    {
      key: "time",
      header: tab === "pending" ? "Waiting" : "Updated",
      cell: (r) => (
        <div className="whitespace-nowrap">
          <div className="k-num font-mono text-[12.5px]">{finTime(r.minutesAgo, "time")}</div>
          <div className={r.status === "pending" && r.minutesAgo > 120 ? "text-[11px] text-warn" : "text-[11px] text-fg-3"}>{finAgo(r.minutesAgo)}</div>
        </div>
      ),
      sort: (r) => -r.minutesAgo,
      hideOn: "lg",
    },
    {
      key: "state",
      header: tab === "sent" ? "Tx hash" : "Status",
      align: "right",
      cell: (r) =>
        r.status === "sent" && r.hash ? (
          <TxHash hash={r.hash} />
        ) : r.status === "pending" ? (
          <span className="inline-flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
            <Button size="xs" variant="surface" onClick={() => setReview(r)}>
              Review
            </Button>
          </span>
        ) : r.status === "rejected" ? (
          <span className="text-[12px] text-down">{r.rejectReason}</span>
        ) : (
          <StatusChip status="approved" label={`By ${r.approvedBy?.split(" ")[0]}`} />
        ),
    },
  ];

  return (
    <div className="pb-32">
      <PageHeader
        title="Withdrawals"
        subtitle="Every payout is approved by staff against the risk checklist, then batch-sent from the hot wallet"
        actions={
          <>
            <Button variant="surface" onClick={() => toast.success("withdrawals-2026-09-24.csv exported", { description: `${rows.length} requests` })}>
              <Download /> Export
            </Button>
            <Link href="/finance/wallets">
              <Button variant="surface">
                <Wallet /> Hot wallet
              </Button>
            </Link>
            <Button variant="ember" disabled={count("approved") === 0} onClick={() => openBatch(rows.filter((r) => r.status === "approved").map((r) => r.id))}>
              <Send /> Send approved ({count("approved")})
            </Button>
          </>
        }
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard label="Pending approval" icon={<Clock3 />} value={<Money value={pending.reduce((s, r) => s + r.amount, 0)} />} chip={`${pending.length} requests · ${pending.filter((r) => r.risk >= 40).length} flagged`} chipTone="warn" hot illustration="hourglass_not_done" />
        <KpiCard label="Avg. approval time" icon={<Timer />} value={<span className="k-num">18<span className="text-fg-3">m</span> 40<span className="text-fg-3">s</span></span>} chip="SLA 2h · 100% within SLA" chipTone="up" delay={0.05} />
        <KpiCard label="Paid out today" icon={<ArrowUpFromLine />} value={<Money value={paid.usd} />} chip={`${paid.batches} batches · ${paid.txs} transfers`} chipTone="neutral" delay={0.1} />
        <KpiCard
          label="Hot wallet · USDT"
          icon={<Wallet />}
          value={<Money value={hot.usdt} currency="" />}
          href="/finance/wallets"
          footer={
            <span className="flex items-center gap-2 text-[12px]">
              <Chip size="sm" tone="warn">
                <Flame className="size-3" /> {num(hot.trx, 0)} TRX gas · low
              </Chip>
            </span>
          }
          delay={0.15}
        />
      </div>

      <Reveal delay={0.1} className="mt-4">
        <Card>
          <div className="px-6 pt-5">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
              <div className="-mx-1 overflow-x-auto px-1">
              <Tabs
                value={tab}
                onChange={setTab}
                className="w-max border-b-0"
                tabs={[
                  { value: "pending", label: "Pending", count: count("pending") },
                  { value: "approved", label: "Approved", count: count("approved") },
                  { value: "sent", label: "Sent", count: count("sent") },
                  { value: "rejected", label: "Rejected", count: count("rejected") },
                ]}
              />
              </div>
              <div className="flex items-center gap-2 pb-2">
                <span className="hidden text-[12px] text-fg-3 sm:inline">Risk</span>
                <Segmented size="xs" value={risk} onChange={setRisk} options={[{ value: "all", label: "All" }, { value: "high", label: "Flagged ≥ 40" }, { value: "clean", label: "Clean" }]} />
              </div>
            </div>
            <div className="h-px bg-line" />
          </div>
          <div className="px-4 pb-5 pt-4 sm:px-6">
            <DataTable
              columns={columns}
              rows={view}
              rowKey={(r) => r.id}
              pageSize={12}
              dense
              search={(r) => `${r.id} ${r.client.person.name} ${r.client.login} ${r.address} ${r.hash ?? ""}`}
              searchPlaceholder="Name, login, address…"
              toolbar={
                <div className="flex items-center gap-3 text-[12px] text-fg-3">
                  <span className="inline-flex items-center gap-1.5">
                    <ListChecks className="size-3.5" /> Checks: KYC · Bonus · Recent deposit · IP/device · P&L
                  </span>
                </div>
              }
              onRowClick={(r) => setReview(r)}
            />
          </div>
        </Card>
      </Reveal>

      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Reveal delay={0.1}>
          <Card className="h-full">
            <CardHeader title="Approval policy" subtitle="Applied to every request before it reaches the queue" icon={<ShieldAlert />} action={<Link href="/config"><Button size="sm" variant="surface">Edit policy</Button></Link>} />
            <div className="mt-4 space-y-2 px-4 pb-5 sm:px-6">
              {RULES.map((r) => (
                <div key={r.label} className="k-row flex items-center gap-3 px-4 py-2.5">
                  <span className={r.on ? "grid size-6 place-items-center rounded-full bg-up-soft text-up" : "grid size-6 place-items-center rounded-full bg-surface-3 text-fg-3"}>{r.on ? <Check className="size-3.5" /> : <X className="size-3.5" />}</span>
                  <div className="min-w-0 flex-1">
                    <div className="text-[13.5px] font-medium">{r.label}</div>
                    <div className="text-[11.5px] text-fg-3">{r.hint}</div>
                  </div>
                  <Chip size="sm" tone={r.on ? "up" : "neutral"}>{r.on ? "Enforced" : "Monitor only"}</Chip>
                </div>
              ))}
            </div>
          </Card>
        </Reveal>
        <Reveal delay={0.15}>
          <Card className="h-full">
            <CardHeader title="Recent batches" subtitle="Hot wallet → client addresses" icon={<Send />} />
            <div className="mt-4 space-y-2 px-4 pb-5 sm:px-6">
              {FIN_SWEEP_HISTORY.slice(0, 5).map((b, i) => (
                <div key={b.id} className="k-row flex items-center gap-3 px-4 py-2.5">
                  <span className="grid size-8 shrink-0 place-items-center rounded-full bg-ember-soft text-ember">
                    <Send className="size-3.5" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 text-[13.5px] font-medium">
                      <span className="font-mono">WB-{3120 - i}</span>
                      <span className="text-fg-3">·</span>
                      <span className="k-num">{Math.round(b.addresses / 3)} transfers</span>
                    </div>
                    <div className="text-[11.5px] text-fg-3">
                      {finTime(b.minutesAgo)} · {num(b.trxFee / 3, 1)} TRX gas · signed by {["Priya Nair", "James Carter", "Elena Petrova"][i % 3]}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="k-num text-[13.5px] font-medium">{usd(b.usdt / 3, 0)}</div>
                    <StatusChip status="completed" label="Broadcast" />
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </Reveal>
      </div>

      <AnimatePresence>
        {selectable && selected.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 24 }}
            transition={{ duration: 0.25 }}
            className="fixed inset-x-3 bottom-20 z-40 mx-auto flex max-w-3xl flex-wrap items-center gap-3 rounded-[20px] border border-line bg-surface-3/95 px-4 py-3 shadow-[0_24px_60px_-20px_rgba(0,0,0,0.8)] backdrop-blur md:bottom-6"
          >
            <span className="grid size-8 place-items-center rounded-full bg-ember text-[13px] font-semibold text-white k-num">{selected.length}</span>
            <div className="min-w-0 flex-1">
              <div className="text-[13.5px] font-medium">selected · <span className="k-num">{num(selTotal)} USDT</span></div>
              <div className="text-[11.5px] text-fg-3">{selected.filter((r) => r.risk >= 40).length} flagged · est. gas {num(selected.length * 13.4, 1)} TRX</div>
            </div>
            <Button size="sm" variant="ghost" onClick={() => setSel(new Set())}>
              Clear
            </Button>
            {tab === "pending" && (
              <>
                <Button size="sm" variant="down-outline" onClick={() => bulk("rejected")}>
                  <X /> Reject
                </Button>
                <Button size="sm" variant="up-outline" onClick={() => bulk("approved")}>
                  <Check /> Approve
                </Button>
              </>
            )}
            <Button size="sm" variant="ember" onClick={() => openBatch(selected.map((r) => r.id))}>
              <Send /> {tab === "pending" ? "Approve & send batch" : "Send batch"}
            </Button>
          </motion.div>
        )}
      </AnimatePresence>

      <WithdrawalReview
        w={review}
        onOpenChange={(o) => !o && setReview(null)}
        onDecision={(w, d, r) => setStatus([w.id], d, () => (d === "approved" ? { approvedBy: ME } : { rejectReason: r }))}
      />
      <BatchSendDialog rows={rows.filter((r) => batchIds.includes(r.id))} open={batchOpen} onOpenChange={setBatchOpen} onSent={onSent} hot={hot} />
      {reason.node}
    </div>
  );
}

/** Live builds: the wallet service (services/wallet). Demo builds: the mock showcase above. */
export default function WithdrawalsPage() {
  return IS_DEMO ? <DemoWithdrawalsPage /> : <LiveWithdrawalsPage />;
}
