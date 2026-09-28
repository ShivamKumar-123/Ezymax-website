"use client";

import * as React from "react";
import { toast } from "sonner";
import { ArrowDownLeft, ArrowUpRight, Clock, Gauge as GaugeIcon, Lock, Plus, ShieldCheck, Timer } from "lucide-react";
import {
  Button,
  Card,
  CardHeader,
  Chip,
  CoinIcon,
  DataTable,
  Field,
  Icon3D,
  Input,
  KpiCard,
  Money,
  PageHeader,
  Reveal,
  Starfield,
  Toggle,
  cn,
  formatCompact,
  formatNumber,
  type Column,
} from "@kalks/ui";
import { SET_GROUP_LIMITS, SET_PAYMENT_METHODS, type SetPaymentMethod } from "@kalks/mock/admin-platform-settings";
import { SaveBar } from "@/components/settings/kit";

function MethodIcon({ icon, size = 36 }: { icon: string; size?: number }) {
  if (icon.startsWith("3d:")) return <Icon3D name={icon.slice(3)} size={size} />;
  return <CoinIcon coin={icon} size={size} />;
}

const LIMIT_FIELDS: { key: keyof SetPaymentMethod; label: string; suffix: string }[] = [
  { key: "minDeposit", label: "Min deposit", suffix: "USDT" },
  { key: "maxDeposit", label: "Max deposit", suffix: "USDT" },
  { key: "minWithdrawal", label: "Min withdrawal", suffix: "USDT" },
  { key: "maxWithdrawal", label: "Max withdrawal", suffix: "USDT" },
  { key: "dailyLimit", label: "Daily limit / client", suffix: "USDT" },
];

const RULES = [
  { id: "fourEyes", label: "Four-eyes approval above $10,000", desc: "A second Finance approver is required", on: true },
  { id: "twofa", label: "Require 2FA / OTP on every withdrawal", desc: "WhatsApp OTP with SMS fallback", on: true },
  { id: "lock", label: "Lock withdrawals 24h after password or 2FA change", desc: "Account-takeover protection", on: true },
  { id: "credit", label: "Bonus credit is non-withdrawable", desc: "Only released credit can be withdrawn", on: true },
  { id: "travel", label: "Travel-rule screening on addresses", desc: "Chainalysis risk score < 50 required", on: false },
] as const;

export default function PaymentMethodsPage() {
  const usdt = SET_PAYMENT_METHODS[0]!;
  const initial = React.useMemo<Record<string, string>>(() => ({ ...Object.fromEntries(LIMIT_FIELDS.map((f) => [f.key, String(usdt[f.key])])), fee: "1", auto: "500", conf: "20" }), [usdt]);
  const [limits, setLimits] = React.useState<Record<string, string>>(initial);
  const [saved, setSaved] = React.useState(initial);
  const [deposits, setDeposits] = React.useState(true);
  const [withdrawals, setWithdrawals] = React.useState(true);
  const [rules, setRules] = React.useState<Record<string, boolean>>(() => Object.fromEntries(RULES.map((r) => [r.id, r.on])));
  const [waitlist, setWaitlist] = React.useState<Record<string, boolean>>({ "usdt-erc20": true });
  const dirty = JSON.stringify(limits) !== JSON.stringify(saved);

  const soon = SET_PAYMENT_METHODS.filter((m) => m.status === "soon");

  const columns: Column<SetPaymentMethod>[] = [
    {
      key: "m",
      header: "Method",
      cell: (m) => (
        <div className="flex items-center gap-3">
          <MethodIcon icon={m.icon} size={28} />
          <div>
            <div className="font-medium">{m.name}</div>
            <div className="text-[12px] text-fg-3">{m.network}</div>
          </div>
        </div>
      ),
    },
    { key: "s", header: "Status", cell: (m) => (m.status === "active" ? <Chip tone="up" dot>Active</Chip> : <Chip tone="neutral">Soon · {m.eta}</Chip>) },
    { key: "d", header: "Deposit min – max", align: "right", cell: (m) => <span className="k-num">${formatNumber(m.minDeposit, 0)} – ${formatCompact(m.maxDeposit)}</span> },
    { key: "w", header: "Withdrawal min – max", align: "right", cell: (m) => <span className="k-num">${formatNumber(m.minWithdrawal, 0)} – ${formatCompact(m.maxWithdrawal)}</span> },
    { key: "l", header: "Daily limit", align: "right", hideOn: "md", cell: (m) => <span className="k-num">${formatCompact(m.dailyLimit)}</span> },
    { key: "f", header: "Fee", hideOn: "lg", cell: (m) => <span className="text-fg-2">{m.fee}</span> },
    { key: "p", header: "Processing", hideOn: "lg", cell: (m) => <span className="text-fg-2">{m.processing}</span> },
    { key: "v", header: "Volume 30d", align: "right", sort: (m) => m.volume30d, cell: (m) => (m.volume30d ? <Money value={m.volume30d} decimals={0} countUp={false} /> : <span className="text-fg-3">—</span>) },
  ];

  return (
    <div className="pb-24">
      <PageHeader
        title="Payment methods"
        subtitle="Deposit and withdrawal rails with limits per method and per account group. USDT on TRON is live at launch."
        actions={
          <Button variant="surface" onClick={() => toast.success("Request sent to the platform team", { description: "We'll reply within 2 business days" })}>
            <Plus /> Request a method
          </Button>
        }
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard label="Deposits · 30d" icon={<ArrowDownLeft />} value={<Money value={11_284_410.52} />} chip="+12.4% vs Aug" chipTone="up" />
        <KpiCard label="Withdrawals · 30d" icon={<ArrowUpRight />} value={<Money value={7_136_470.18} />} chip="4,212 requests" delay={0.05} />
        <KpiCard label="Auto-approved" icon={<ShieldCheck />} value={<span className="k-num">78.6%</span>} chip="under threshold, verified" chipTone="up" delay={0.1} />
        <KpiCard label="Avg. credit time" icon={<Timer />} value={<span className="k-num">1m 04s</span>} chip="20 confirmations" chipTone="gold" delay={0.15} illustration="money_with_wings" />
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-12">
        <Reveal className="xl:col-span-8">
          <Card hot className="h-full overflow-hidden">
            <Starfield density={36} />
            <div className="relative flex flex-wrap items-start gap-4 px-6 pt-6">
              <div className="relative">
                <CoinIcon coin="usdt" size={52} />
                <CoinIcon coin="trx" size={22} className="absolute -bottom-1 -right-1 ring-2 ring-[#1a0d08]" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="text-[20px] font-medium tracking-tight">USDT · TRC20</h3>
                  <Chip tone="up" dot>
                    Active
                  </Chip>
                  <Chip tone="gold">Primary rail</Chip>
                </div>
                <p className="mt-1 text-[13px] text-fg-2">Unique HD deposit address per client · auto-credit after confirmations · sweeps to hot wallet over 500 USDT.</p>
              </div>
              <div className="flex gap-5">
                <label className="flex items-center gap-2 text-[12.5px] text-fg-2">
                  Deposits <Toggle checked={deposits} onChange={(v) => { setDeposits(v); toast(v ? "USDT-TRC20 deposits enabled" : "USDT-TRC20 deposits paused", { description: v ? undefined : "Clients see 'temporarily unavailable'" }); }} />
                </label>
                <label className="flex items-center gap-2 text-[12.5px] text-fg-2">
                  Withdrawals <Toggle checked={withdrawals} onChange={(v) => { setWithdrawals(v); toast(v ? "USDT-TRC20 withdrawals enabled" : "USDT-TRC20 withdrawals paused"); }} />
                </label>
              </div>
            </div>

            <div className="relative mt-6 grid grid-cols-1 gap-3 px-6 sm:grid-cols-2 lg:grid-cols-4">
              {LIMIT_FIELDS.slice(0, 4).map((f) => (
                <Field key={f.key} label={f.label}>
                  <Input value={limits[f.key]} onChange={(e) => setLimits((l) => ({ ...l, [f.key]: e.target.value.replace(/[^0-9.]/g, "") }))} inputClassName="k-num" className="bg-black/30" trailing={<span className="text-[11.5px]">{f.suffix}</span>} />
                </Field>
              ))}
              <Field label="Daily limit / client">
                <Input value={limits.dailyLimit} onChange={(e) => setLimits((l) => ({ ...l, dailyLimit: e.target.value.replace(/[^0-9.]/g, "") }))} inputClassName="k-num" className="bg-black/30" trailing={<span className="text-[11.5px]">USDT</span>} />
              </Field>
              <Field label="Withdrawal fee">
                <Input value={limits.fee} onChange={(e) => setLimits((l) => ({ ...l, fee: e.target.value.replace(/[^0-9.]/g, "") }))} inputClassName="k-num" className="bg-black/30" trailing={<span className="text-[11.5px]">USDT flat</span>} />
              </Field>
              <Field label="Auto-approve under">
                <Input value={limits.auto} onChange={(e) => setLimits((l) => ({ ...l, auto: e.target.value.replace(/[^0-9.]/g, "") }))} inputClassName="k-num" className="bg-black/30" trailing={<span className="text-[11.5px]">USDT</span>} />
              </Field>
              <Field label="Confirmations">
                <Input value={limits.conf} onChange={(e) => setLimits((l) => ({ ...l, conf: e.target.value.replace(/[^0-9]/g, "") }))} inputClassName="k-num" className="bg-black/30" trailing={<span className="text-[11.5px]">blocks</span>} />
              </Field>
            </div>

            <div className="relative mt-6 grid grid-cols-2 gap-px border-t border-white/10 bg-white/5 sm:grid-cols-4">
              {[
                ["Volume 30d", `$${formatCompact(usdt.volume30d)}`],
                ["Transactions 30d", formatNumber(usdt.txCount30d, 0)],
                ["Deposit success", "99.4%"],
                ["Hot wallet", "184,220 USDT"],
              ].map(([k, v]) => (
                <div key={k} className="bg-black/30 px-6 py-4">
                  <div className="text-[11px] uppercase tracking-wider text-fg-2">{k}</div>
                  <div className="k-num mt-1 text-[17px] font-semibold">{v}</div>
                </div>
              ))}
            </div>
          </Card>
        </Reveal>

        <Reveal delay={0.05} className="xl:col-span-4">
          <Card className="flex h-full flex-col">
            <CardHeader title="Coming soon" subtitle="Roadmap rails — join the waitlist to be notified" />
            <div className="mt-4 flex-1 space-y-2 px-4 pb-5 sm:px-6">
              {soon.map((m) => (
                <div key={m.id} className="k-row flex items-center gap-3 px-4 py-3 opacity-90">
                  <MethodIcon icon={m.icon} size={32} />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[13.5px] font-medium">{m.name}</div>
                    <div className="truncate text-[11.5px] text-fg-3">{m.network}</div>
                  </div>
                  <Chip size="sm" tone="neutral">
                    <Clock className="size-3" /> {m.eta}
                  </Chip>
                  <button
                    type="button"
                    onClick={() => {
                      setWaitlist((w) => ({ ...w, [m.id]: !w[m.id] }));
                      toast.success(waitlist[m.id] ? `Removed from ${m.name} waitlist` : `You'll be notified when ${m.name} is available`);
                    }}
                    className={cn("rounded-full border px-2.5 py-1 text-[11.5px] font-medium transition-colors", waitlist[m.id] ? "border-ember/40 bg-ember-soft text-ember" : "border-line text-fg-3 hover:text-fg")}
                  >
                    {waitlist[m.id] ? "Notifying" : "Notify me"}
                  </button>
                </div>
              ))}
            </div>
          </Card>
        </Reveal>
      </div>

      <Reveal delay={0.05}>
        <Card className="mt-4">
          <CardHeader title="Limits per method" subtitle="Defaults for all account groups · amounts in USD equivalent" />
          <div className="mt-4 px-4 pb-5 sm:px-6">
            <DataTable columns={columns} rows={SET_PAYMENT_METHODS} rowKey={(m) => m.id} exportName="payment-method-limits" pageSize={10} />
          </div>
        </Card>
      </Reveal>

      <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-12">
        <Reveal className="xl:col-span-7">
          <Card className="h-full">
            <CardHeader icon={<GaugeIcon />} title="Limits per account group" subtitle="Overrides the method defaults" action={<Button size="sm" variant="surface" onClick={() => toast("Group override editor opened in Config → Account groups")}>Edit groups</Button>} />
            <div className="mt-4 overflow-x-auto px-4 pb-6 sm:px-6">
              <table className="w-full min-w-[520px] text-[13px]">
                <thead>
                  <tr className="text-left text-[11px] uppercase tracking-wider text-fg-3">
                    <th className="pb-2 font-medium">Group</th>
                    <th className="pb-2 font-medium">Tier</th>
                    <th className="pb-2 text-right font-medium">Max deposit</th>
                    <th className="pb-2 text-right font-medium">Max withdrawal</th>
                    <th className="pb-2 text-right font-medium">Auto-approve ≤</th>
                  </tr>
                </thead>
                <tbody>
                  {SET_GROUP_LIMITS.map((g) => (
                    <tr key={g.group} className="border-t border-line">
                      <td className="py-3 font-medium">{g.group}</td>
                      <td className="py-3 text-fg-2">{g.tier}</td>
                      <td className="k-num py-3 text-right">${formatNumber(g.maxDeposit, 0)}</td>
                      <td className="k-num py-3 text-right">{g.maxWithdrawal ? `$${formatNumber(g.maxWithdrawal, 0)}` : <Chip size="sm" tone="down">Blocked</Chip>}</td>
                      <td className="k-num py-3 text-right">{g.autoApprove ? `$${formatNumber(g.autoApprove, 0)}` : <span className="text-fg-3">Manual</span>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </Reveal>
        <Reveal delay={0.05} className="xl:col-span-5">
          <Card className="h-full">
            <CardHeader icon={<Lock />} title="Withdrawal safeguards" subtitle="Apply to every method" />
            <div className="mt-3 divide-y divide-line px-6 pb-4">
              {RULES.map((r) => (
                <div key={r.id} className="flex items-center justify-between gap-4 py-3.5">
                  <div className="min-w-0">
                    <div className="text-[13.5px] font-medium">{r.label}</div>
                    <div className="text-[12px] text-fg-3">{r.desc}</div>
                  </div>
                  <Toggle
                    checked={!!rules[r.id]}
                    onChange={(v) => {
                      setRules((s) => ({ ...s, [r.id]: v }));
                      toast.success(`${r.label.split(" ").slice(0, 4).join(" ")}… ${v ? "enabled" : "disabled"}`);
                    }}
                    label={r.label}
                  />
                </div>
              ))}
            </div>
          </Card>
        </Reveal>
      </div>

      <SaveBar
        dirty={dirty}
        label="USDT-TRC20 limits changed"
        onReset={() => setLimits(saved)}
        onSave={() => {
          setSaved(limits);
          toast.success("USDT-TRC20 limits saved", { description: "Requires Finance approval · pending 4-eyes" });
        }}
      />
    </div>
  );
}
