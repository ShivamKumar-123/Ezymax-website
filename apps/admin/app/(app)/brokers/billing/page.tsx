"use client";

import { IS_DEMO } from "@ezymex/mock/mode";
import { LiveBilling } from "@/components/owner/billing";

import * as React from "react";
import { toast } from "sonner";
import { AlertTriangle, Ban, Calculator, CalendarClock, Coins, Download, FileText, Mail, Plus, Receipt, Send, TrendingUp, Wallet } from "lucide-react";
import {
  Button,
  Card,
  CardHeader,
  Chip,
  CopyButton,
  DataTable,
  Dialog,
  Field,
  Input,
  KpiCard,
  Money,
  PageHeader,
  Reveal,
  Segmented,
  Toggle,
  formatDateTime,
  formatNumber,
  type Column,
} from "@ezymex/ui";
import { BRK_INVOICES, BRK_MRR_HISTORY, BRK_TENANTS, BRK_TOTALS, brkTenant, type BrkInvoice } from "@ezymex/mock/admin-platform-brokers";
import { ConfirmDialog, SectionLabel, Select, TenantCell, TenantLogo, TenantMini, compactUsd } from "@/components/brokers/kit";
import { MrrChart } from "@/components/brokers/mrr-chart";

type Filter = "all" | BrkInvoice["status"];
const STATUS_TONE = { paid: "up", pending: "warn", overdue: "down" } as const;
const d = (iso: string) => formatDateTime(iso, { day: "2-digit", month: "short", year: "numeric" });

function BillingPage() {
  const [invoices, setInvoices] = React.useState(BRK_INVOICES);
  const [filter, setFilter] = React.useState<Filter>("all");
  const [openInv, setOpenInv] = React.useState<BrkInvoice | null>(null);
  const [suspendId, setSuspendId] = React.useState<string | null>(null);
  const [suspended, setSuspended] = React.useState<string[]>(["tnt_007"]);
  const [autoSuspend, setAutoSuspend] = React.useState(true);
  const [graceDays, setGraceDays] = React.useState<"7" | "14" | "30">("14");

  const overdue = invoices.filter((i) => i.status === "overdue");
  const overdueTotal = overdue.reduce((s, i) => s + i.total, 0);
  const pendingTotal = invoices.filter((i) => i.status === "pending").reduce((s, i) => s + i.total, 0);
  const overdueTenants = [...new Set(overdue.map((i) => i.tenantId))];
  const rows = filter === "all" ? invoices : invoices.filter((i) => i.status === filter);
  const cnt = (f: Filter) => (f === "all" ? invoices.length : invoices.filter((i) => i.status === f).length);
  const prev = BRK_MRR_HISTORY[10]!;
  const prevMrr = prev.licence + prev.revShare;

  const markPaid = (n: string) => {
    setInvoices((xs) => xs.map((i) => (i.number === n ? { ...i, status: "paid", daysOverdue: undefined, paidAt: "2026-09-24T09:00:00Z" } : i)));
    toast.success(`${n} marked as paid`, { description: "Receipt emailed to tenant billing contact" });
  };

  const columns: Column<BrkInvoice>[] = [
    { key: "no", header: "Invoice", cell: (i) => <span className="font-mono text-[12.5px] text-fg">{i.number}</span>, sort: (i) => i.number },
    { key: "tenant", header: "Tenant", cell: (i) => <TenantMini id={i.tenantId} size={24} />, sort: (i) => brkTenant(i.tenantId).name },
    { key: "period", header: "Period", cell: (i) => <span className="text-fg-2">{i.period}</span>, hideOn: "md" },
    { key: "setup", header: "Setup", align: "right", cell: (i) => (i.setup ? <Money value={i.setup} decimals={0} countUp={false} /> : <span className="text-fg-3">—</span>), hideOn: "lg" },
    { key: "lic", header: "Licence", align: "right", cell: (i) => (i.licence ? <Money value={i.licence} decimals={0} countUp={false} /> : <span className="text-fg-3">—</span>), hideOn: "lg" },
    { key: "rs", header: "Rev-share", align: "right", cell: (i) => (i.revShare ? <Money value={i.revShare} decimals={0} countUp={false} className="text-gold" /> : <span className="text-fg-3">—</span>), hideOn: "md" },
    { key: "total", header: "Total", align: "right", sort: (i) => i.total, cell: (i) => <Money value={i.total} decimals={2} countUp={false} className="font-medium text-fg" /> },
    {
      key: "due",
      header: "Due",
      sort: (i) => i.due,
      cell: (i) => (
        <div>
          <div className="k-num text-fg-2">{d(i.due)}</div>
          {i.daysOverdue ? <div className="k-num text-[11.5px] text-down">{i.daysOverdue} days late</div> : i.paidAt ? <div className="k-num text-[11.5px] text-fg-3">paid {formatDateTime(i.paidAt, { day: "2-digit", month: "short" })}</div> : <div className="text-[11.5px] text-fg-3">awaiting</div>}
        </div>
      ),
    },
    {
      key: "status",
      header: "Status",
      sort: (i) => i.status,
      cell: (i) => (
        <Chip tone={STATUS_TONE[i.status]} dot>
          {i.status[0]!.toUpperCase() + i.status.slice(1)}
        </Chip>
      ),
    },
  ];

  const overdueFirst = overdueTenants[0] ? brkTenant(overdueTenants[0]) : null;
  const target = suspendId ? brkTenant(suspendId) : null;

  return (
    <div className="pb-16">
      <PageHeader
        title="Billing"
        subtitle="Setup fees, monthly licences and revenue share across all tenants · invoices issued 1st of month, 09:00 GMT+3"
        actions={
          <>
            <Button variant="surface" onClick={() => toast.success("Billing export queued", { description: "Q3 2026 · CSV + PDF bundle" })}>
              <Download /> Export
            </Button>
            <Button variant="ember" onClick={() => toast.success("Draft invoice created", { description: "INV-2026-09-0152 · add line items to send" })}>
              <Plus /> New invoice
            </Button>
          </>
        }
      />

      {overdue.length > 0 && overdueFirst && (
        <Reveal>
          <div className="relative mb-4 overflow-hidden rounded-[20px] border border-down/30 bg-[linear-gradient(100deg,rgba(240,68,56,.16),rgba(240,68,56,.04)_55%,transparent)] px-5 py-4">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center">
              <div className="flex min-w-0 flex-1 items-center gap-4">
                <span className="grid size-11 shrink-0 place-items-center rounded-full border border-down/30 bg-down-soft text-down">
                  <AlertTriangle className="size-5" />
                </span>
                <div className="min-w-0">
                  <div className="text-[15px] font-medium">
                    {overdue.length} overdue invoices · <Money value={overdueTotal} decimals={0} countUp={false} className="text-down" /> outstanding
                  </div>
                  <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px] text-fg-2">
                    {overdueTenants.map((id) => {
                      const t = brkTenant(id);
                      const late = Math.max(...overdue.filter((i) => i.tenantId === id).map((i) => i.daysOverdue ?? 0));
                      return (
                        <span key={id} className="inline-flex items-center gap-1.5">
                          <TenantLogo color={t.color} mark={t.mark} size={18} /> {t.name} <span className="k-num text-down">{late}d</span>
                          {suspended.includes(id) && <Chip size="sm" tone="down">Suspended</Chip>}
                        </span>
                      );
                    })}
                  </div>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <div className="flex items-center gap-2.5 rounded-full border border-line bg-surface/70 py-1.5 pl-3.5 pr-1.5">
                  <span className="text-[12.5px] text-fg-2">Auto-suspend after</span>
                  <Segmented size="xs" value={graceDays} onChange={(v) => { setGraceDays(v); toast.success(`Grace period set to ${v} days`); }} options={[{ value: "7", label: "7d" }, { value: "14", label: "14d" }, { value: "30", label: "30d" }]} />
                  <Toggle checked={autoSuspend} onChange={(v) => { setAutoSuspend(v); toast[v ? "success" : "warning"](v ? `Auto-suspend on · ${graceDays} days after due date` : "Auto-suspend disabled"); }} label="Auto-suspend" />
                </div>
                <Button size="sm" variant="surface" onClick={() => toast.success("Payment reminders sent", { description: overdueTenants.map((i) => brkTenant(i).billingEmail).join(", ") })}>
                  <Send /> Remind
                </Button>
                <Button size="sm" variant="sell" onClick={() => setSuspendId(overdueTenants.find((i) => !suspended.includes(i)) ?? overdueTenants[0]!)}>
                  <Ban /> Suspend tenant
                </Button>
              </div>
            </div>
          </div>
        </Reveal>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard label="MRR" icon={<Coins />} hot illustration="money_bag" value={<Money value={BRK_TOTALS.mrr} decimals={0} />} chip={`+${(((BRK_TOTALS.mrr - prevMrr) / prevMrr) * 100).toFixed(1)}% vs Aug`} chipTone="up" delay={0} />
        <KpiCard label="ARR run-rate" icon={<TrendingUp />} value={<Money value={BRK_TOTALS.mrr * 12} decimals={0} />} footer={<div className="flex gap-1.5"><Chip size="sm" tone="gold">Licence ${formatNumber(BRK_TOTALS.licence, 0)}/mo</Chip></div>} delay={0.05} />
        <KpiCard label="Rev-share 30d" icon={<Wallet />} value={<Money value={BRK_TOTALS.revShare} decimals={0} />} chip={`${Math.round((BRK_TOTALS.revShare / BRK_TOTALS.mrr) * 100)}% of MRR`} chipTone="ember" illustration="coin" delay={0.1} />
        <KpiCard
          label="Outstanding"
          icon={<Receipt />}
          value={<Money value={overdueTotal + pendingTotal} decimals={0} />}
          footer={
            <div className="flex gap-1.5">
              <Chip size="sm" tone="down">{compactUsd(overdueTotal)} overdue</Chip>
              <Chip size="sm" tone="warn">{compactUsd(pendingTotal)} pending</Chip>
            </div>
          }
          delay={0.15}
        />
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-12">
        <Reveal delay={0.1} className="xl:col-span-8">
          <Card className="flex h-full flex-col">
            <CardHeader
              title="MRR trend"
              subtitle="Licence + revenue share, trailing 12 months"
              action={
                <div className="hidden items-center gap-3 text-[12px] text-fg-3 sm:flex">
                  <span className="inline-flex items-center gap-1.5"><span className="size-2 rounded-full bg-gold" /> Licence</span>
                  <span className="inline-flex items-center gap-1.5"><span className="size-2 rounded-full bg-ember" /> Rev-share</span>
                </div>
              }
            />
            <div className="mt-4 grid grid-cols-3 gap-3 px-4 sm:px-6">
              {[
                ["12-mo growth", `+${(((BRK_TOTALS.mrr - (BRK_MRR_HISTORY[0]!.licence + BRK_MRR_HISTORY[0]!.revShare)) / (BRK_MRR_HISTORY[0]!.licence + BRK_MRR_HISTORY[0]!.revShare)) * 100).toFixed(1)}%`, "text-up"],
                ["Paying tenants", String(BRK_TENANTS.filter((t) => t.mrr > 0).length), "text-fg"],
                ["Net revenue retention", "118%", "text-gold"],
              ].map(([l, v, c]) => (
                <div key={l} className="k-row px-4 py-3">
                  <div className="k-label">{l}</div>
                  <div className={`k-num mt-1 text-lg font-semibold ${c}`}>{v}</div>
                </div>
              ))}
            </div>
            <div className="mt-16 flex-1 px-4 pb-5 sm:px-6">
              <MrrChart data={BRK_MRR_HISTORY} height={272} />
            </div>
          </Card>
        </Reveal>
        <Reveal delay={0.15} className="xl:col-span-4">
          <RevShareCalculator />
        </Reveal>
      </div>

      <Reveal delay={0.1} className="mt-4">
        <Card>
          <CardHeader title="Invoices" subtitle={`${invoices.length} invoices · Jun – Sep 2026`} />
          <div className="mt-4 px-4 pb-5 sm:px-6">
            <DataTable
              columns={columns}
              rows={rows}
              rowKey={(i) => i.number}
              pageSize={10}
              search={(i) => `${i.number} ${brkTenant(i.tenantId).name} ${i.period}`}
              searchPlaceholder="Invoice or tenant…"
              exportName="invoices"
              onRowClick={setOpenInv}
              toolbar={
                <Segmented
                  size="xs"
                  value={filter}
                  onChange={setFilter}
                  options={(["all", "paid", "pending", "overdue"] as Filter[]).map((f) => ({
                    value: f,
                    label: (
                      <>
                        {f === "all" ? "All" : f[0]!.toUpperCase() + f.slice(1)} <span className={f === "overdue" ? "text-down" : "text-fg-3"}>{cnt(f)}</span>
                      </>
                    ),
                  }))}
                />
              }
            />
          </div>
        </Card>
      </Reveal>

      <InvoiceDrawer inv={openInv} onClose={() => setOpenInv(null)} onPaid={(n) => { markPaid(n); setOpenInv(null); }} />

      <ConfirmDialog
        open={!!target}
        onOpenChange={(o) => !o && setSuspendId(null)}
        danger
        title={target ? `Suspend ${target.name}?` : ""}
        description="Suspension for non-payment. Client Area and Back Office logins are blocked; open positions keep running and stop-outs still apply."
        confirmLabel="Suspend tenant"
        onConfirm={() => {
          if (!target) return;
          setSuspended((s) => [...new Set([...s, target.id])]);
          toast.warning(`${target.name} suspended`, { description: "Tenant admins and billing contact notified · reactivates automatically on payment" });
        }}
      >
        {target && (
          <div className="space-y-3">
            <div className="k-row flex items-center gap-3 p-4">
              <TenantCell t={target} />
              <span className="ml-auto text-right">
                <Money value={overdue.filter((i) => i.tenantId === target.id).reduce((s, i) => s + i.total, 0)} decimals={2} countUp={false} className="font-medium text-down" />
                <span className="block text-[11.5px] text-fg-3">{overdue.filter((i) => i.tenantId === target.id).length} overdue invoices</span>
              </span>
            </div>
            <Field label="Select tenant">
              <Select value={target.id} onChange={setSuspendId} options={overdueTenants.map((id) => ({ value: id, label: brkTenant(id).name }))} />
            </Field>
            <ul className="space-y-1.5 text-[13px] text-fg-2">
              <li>· {formatNumber(target.clients, 0)} clients will see a maintenance notice</li>
              <li>· Deposits paused; withdrawals remain available</li>
              <li>· Reactivates automatically when the balance is settled</li>
            </ul>
          </div>
        )}
      </ConfirmDialog>
    </div>
  );
}

/* ------------------------------------------------------------------ */

function RevShareCalculator() {
  const paying = BRK_TENANTS.filter((t) => t.plan !== "owner");
  const [tid, setTid] = React.useState(paying[0]!.id);
  const t = brkTenant(tid);
  const [net, setNet] = React.useState(String(t.netRevenue30d));
  const [pct, setPct] = React.useState(String(t.revSharePct));
  const netN = Number(net.replace(/[^0-9.]/g, "")) || 0;
  const pctN = Math.min(100, Number(pct) || 0);
  const payout = (netN * pctN) / 100;
  const total = payout + t.mrr;
  return (
    <Card className="flex h-full flex-col">
      <CardHeader title="Revenue share calculator" subtitle="Estimate this month's rev-share line" icon={<Calculator />} />
      <div className="mt-4 flex flex-1 flex-col gap-4 px-4 pb-6 sm:px-6">
        <Field label="Tenant">
          <Select
            value={tid}
            onChange={(v) => {
              setTid(v);
              const n = brkTenant(v);
              setNet(String(n.netRevenue30d));
              setPct(String(n.revSharePct));
            }}
            options={paying.map((p) => ({ value: p.id, label: p.name }))}
            leading={<TenantLogo color={t.color} mark={t.mark} size={18} />}
          />
        </Field>
        <div className="grid grid-cols-[1fr_110px] gap-3">
          <Field label="Net broker revenue" hint="30d">
            <Input value={net} onChange={(e) => setNet(e.target.value)} leading={<span className="text-fg-3">$</span>} inputClassName="k-num" />
          </Field>
          <Field label="Share">
            <Input value={pct} onChange={(e) => setPct(e.target.value)} trailing={<span className="text-[12px]">%</span>} inputClassName="k-num" />
          </Field>
        </div>
        <div className="relative overflow-hidden rounded-[16px] border border-gold/25 bg-[radial-gradient(120%_120%_at_100%_0%,rgba(233,185,73,.16),transparent_60%)] p-5">
          <div className="k-label">Rev-share payout to Ezymex</div>
          <div className="mt-2 text-[32px] font-semibold leading-none tracking-tight text-gold">
            <Money value={payout} decimals={2} countUp={false} />
          </div>
          <div className="k-num mt-2 text-[12.5px] text-fg-3">
            ${formatNumber(netN, 0)} × {pctN}% · plan default {t.revSharePct}%
          </div>
        </div>
        <div className="space-y-2 text-[13px]">
          <div className="flex justify-between"><span className="text-fg-3">Licence</span><span className="k-num">${formatNumber(t.mrr, 0)}</span></div>
          <div className="flex justify-between"><span className="text-fg-3">Revenue share</span><span className="k-num">${formatNumber(payout, 2)}</span></div>
          <div className="flex justify-between border-t border-line pt-2 font-medium"><span>Next invoice estimate</span><span className="k-num">${formatNumber(total, 2)}</span></div>
        </div>
        <Button variant="surface" className="mt-auto" onClick={() => toast.success("Added to October invoice draft", { description: `${t.name} · rev-share $${formatNumber(payout, 2)}` })}>
          <FileText /> Add to next invoice
        </Button>
      </div>
    </Card>
  );
}

/* ------------------------------------------------------------------ */

function InvoiceDrawer({ inv, onClose, onPaid }: { inv: BrkInvoice | null; onClose: () => void; onPaid: (n: string) => void }) {
  if (!inv) return null;
  const t = brkTenant(inv.tenantId);
  const lines: [string, string, number][] = [
    ["Setup fee", "One-off onboarding & provisioning", inv.setup],
    ["Platform licence", `${inv.period} · ${t.plan[0]!.toUpperCase() + t.plan.slice(1)} plan`, inv.licence],
    ["Revenue share", `${t.revSharePct}% of net broker revenue`, inv.revShare],
  ];
  return (
    <Dialog
      open
      onOpenChange={(o) => !o && onClose()}
      side="right"
      title={<span className="font-mono">{inv.number}</span>}
      description={`${t.legalName} · issued ${d(inv.issued)}`}
      footer={
        <>
          <Button size="sm" variant="ghost" onClick={() => toast.success(`${inv.number}.pdf downloaded`)}>
            <Download /> PDF
          </Button>
          {inv.status !== "paid" && (
            <Button size="sm" variant="surface" onClick={() => toast.success("Reminder sent", { description: t.billingEmail })}>
              <Mail /> Send reminder
            </Button>
          )}
          {inv.status !== "paid" && (
            <Button size="sm" variant="ember" onClick={() => onPaid(inv.number)}>
              Mark as paid
            </Button>
          )}
        </>
      }
    >
      <div className="space-y-6">
        <div className="flex items-center justify-between gap-3">
          <TenantCell t={t} sub={t.billingEmail} />
          <Chip tone={STATUS_TONE[inv.status]} dot>
            {inv.status[0]!.toUpperCase() + inv.status.slice(1)}
          </Chip>
        </div>
        <div className="k-row p-5">
          <div className="k-label">Amount due</div>
          <div className="mt-2 text-[34px] font-semibold leading-none tracking-tight">
            <Money value={inv.total} decimals={2} />
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-2 text-[12.5px] text-fg-3">
            <CalendarClock className="size-3.5" /> Due {d(inv.due)}
            {inv.daysOverdue ? <Chip size="sm" tone="down">{inv.daysOverdue} days overdue</Chip> : null}
          </div>
        </div>
        <div>
          <SectionLabel>Line items</SectionLabel>
          <div className="divide-y divide-line rounded-[14px] border border-line">
            {lines.map(([l, s, v]) => (
              <div key={l} className="flex items-center justify-between gap-3 px-4 py-3">
                <div>
                  <div className="text-[13.5px]">{l}</div>
                  <div className="text-[12px] text-fg-3">{s}</div>
                </div>
                {v ? <Money value={v} decimals={2} countUp={false} /> : <span className="text-fg-3">—</span>}
              </div>
            ))}
            <div className="flex items-center justify-between bg-surface-2 px-4 py-3 font-medium">
              <span>Total (USD)</span>
              <Money value={inv.total} decimals={2} countUp={false} />
            </div>
          </div>
        </div>
        <div>
          <SectionLabel>Payment</SectionLabel>
          {inv.status === "paid" && inv.txHash ? (
            <div className="k-row space-y-2 p-4 text-[13px]">
              <div className="flex justify-between"><span className="text-fg-3">Method</span><span>USDT · TRC20</span></div>
              <div className="flex justify-between"><span className="text-fg-3">Paid</span><span className="k-num">{inv.paidAt ? d(inv.paidAt) : "—"}</span></div>
              <div className="flex items-center justify-between"><span className="text-fg-3">Tx hash</span><span className="inline-flex items-center gap-1 font-mono text-fg-2">{inv.txHash.slice(0, 10)}…{inv.txHash.slice(-6)}<CopyButton value={inv.txHash} label="Tx hash" /></span></div>
            </div>
          ) : (
            <div className="k-row space-y-2 p-4 text-[13px]">
              <div className="flex justify-between"><span className="text-fg-3">Pay to (USDT TRC20)</span><span className="inline-flex items-center gap-1 font-mono">TQ7xEzymex…9KfE<CopyButton value="TQ7xR4mEzymexBilling2m8vJp9KfE" label="Address" /></span></div>
              <div className="flex justify-between"><span className="text-fg-3">Wire reference</span><span className="font-mono">{inv.number}</span></div>
              <div className="flex justify-between"><span className="text-fg-3">Terms</span><span>Net 15</span></div>
            </div>
          )}
        </div>
      </div>
    </Dialog>
  );
}

export default function Page() {
  return IS_DEMO ? <BillingPage /> : <LiveBilling />;
}
