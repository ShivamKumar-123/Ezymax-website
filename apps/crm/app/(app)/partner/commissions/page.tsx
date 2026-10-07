"use client";

import * as React from "react";
import { motion } from "motion/react";
import { Ban, Clock, Download, Infinity as InfinityIcon, Info, RotateCcw, Save, ShieldAlert, Sparkles, Target, Timer, UserX } from "lucide-react";
import { toast } from "sonner";
import {
  Button,
  Card,
  CardHeader,
  Chip,
  DataTable,
  Icon3D,
  Money,
  PageHeader,
  Reveal,
  Segmented,
  SymbolAvatar,
  SymbolCell,
  cn,
  formatDateTime,
  formatMoney,
  type Column,
  AnimIcon,
} from "@/components/kit";
import {
  ANTI_ABUSE,
  COMMISSION_LEDGER,
  CPA_RULES,
  IB_LEVELS,
  PARTNER,
  RATE_CARD,
  SYMBOL_GROUPS,
  TIERS,
  rateFor,
  type CommissionEvent,
  type CommissionStatus,
} from "@kalks/mock/partner";
import { RangeSlider } from "@/components/social/controls";
import { ClientCell, CommissionStatusChip, TierChip, fmtDT } from "@/components/partner/partner-bits";
import { IS_DEMO } from "@kalks/mock/mode";
import { LivePartnerCommissions } from "@/components/partner/live/commissions";

/* ------------------------------------------------------------------ */

function RateCard() {
  return (
    <Card className="h-full">
      <CardHeader title="Rate card" subtitle="USD per standard lot · closed live trades · round-turn" action={<Chip tone="gold">You: Silver</Chip>} />
      <div className="overflow-x-auto px-4 pb-5 pt-4 sm:px-6">
        <table className="w-full min-w-[620px] border-separate border-spacing-0 text-[13px]">
          <thead>
            <tr>
              <th className="rounded-l-[14px] border-y border-l border-line bg-surface-2 px-4 py-3 text-left text-[11.5px] font-medium uppercase tracking-[0.05em] text-fg-3">Symbol group</th>
              {IB_LEVELS.map((l, i) => (
                <th
                  key={l.key}
                  className={cn(
                    "border-y border-line px-3 py-2.5 text-right text-[11.5px] font-medium uppercase tracking-[0.05em]",
                    i === IB_LEVELS.length - 1 && "rounded-r-[14px] border-r",
                    l.key === "silver" ? "bg-ember-soft text-ember" : l.key === "gold" ? "bg-gold-soft text-gold" : "bg-surface-2 text-fg-3",
                  )}
                >
                  <span className="inline-flex items-center gap-1.5">
                    <AnimIcon name={l.icon} size={18} idle="hover" />
                    {l.name}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {SYMBOL_GROUPS.map((g) => (
              <tr key={g.key} className="group">
                <td className="border-b border-line px-4 py-3 group-hover:bg-surface-2/60">
                  <div className="flex items-center gap-3">
                    <div className="flex -space-x-1.5">
                      {g.examples.slice(0, 3).map((s) => (
                        <span key={s} className="rounded-full ring-2 ring-surface">
                          <SymbolAvatar symbol={s} size={20} />
                        </span>
                      ))}
                    </div>
                    <div className="min-w-0">
                      <div className="font-medium">{g.name}</div>
                      <div className="truncate text-[11px] text-fg-3">{g.examples.join(", ")}</div>
                    </div>
                  </div>
                </td>
                {IB_LEVELS.map((l) => (
                  <td
                    key={l.key}
                    className={cn(
                      "k-num border-b border-line px-3 py-3 text-right group-hover:bg-surface-2/60",
                      l.key === "silver" && "bg-ember/[0.06] font-semibold text-fg",
                      l.key === "gold" && "bg-gold/[0.05] text-gold",
                      l.key !== "silver" && l.key !== "gold" && "text-fg-2",
                    )}
                  >
                    ${RATE_CARD[g.key][l.key].toFixed(RATE_CARD[g.key][l.key] % 1 ? 2 : 0)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
        <div className="mt-3 flex items-start gap-2 text-[12px] text-fg-3">
          <Info className="mt-0.5 size-3.5 shrink-0" />
          Rates apply to your Tier 1 clients; Tier 2 and Tier 3 pay the percentage below. Lots from referred investors&apos; PAMM and copy accounts count at the same rates.
        </div>
      </div>
    </Card>
  );
}

/* ------------------------------------------------------------------ */

const EX_SYMBOLS = ["XAUUSD", "EURUSD", "NAS100", "BTCUSD"] as const;

function RebatesCard() {
  const [rebate, setRebate] = React.useState(PARTNER.rebatePct);
  const [split, setSplit] = React.useState(PARTNER.subIbSplitPct);
  const [sym, setSym] = React.useState<(typeof EX_SYMBOLS)[number]>("XAUUSD");
  const lots = 10;
  const rate = rateFor(sym);
  const gross = lots * rate;
  const toClient = (gross * rebate) / 100;
  const youDirect = gross - toClient;
  const toSub = (gross * split) / 100;
  const youSub = gross - toSub;
  const dirty = rebate !== PARTNER.rebatePct || split !== PARTNER.subIbSplitPct;

  return (
    <Card className="flex h-full flex-col">
      <CardHeader title="Rebates & splits" subtitle="Share your commission to win and keep clients" icon={<Sparkles />} action={dirty ? <Chip tone="warn" dot>Unsaved</Chip> : <Chip tone="up" dot>Live</Chip>} />
      <div className="flex-1 space-y-6 px-4 pb-2 pt-5 sm:px-6">
        <div>
          <div className="mb-2 flex items-baseline justify-between">
            <span className="text-[13px] font-medium text-fg-2">Rebate to your clients</span>
            <span className="k-num text-[18px] font-semibold text-ember">{rebate}%</span>
          </div>
          <RangeSlider value={rebate} onChange={setRebate} min={0} max={50} ticks={[0, 10, 20, 30, 40, 50]} format={(v) => `${v}%`} label="Rebate" />
          <p className="mt-1.5 text-[11.5px] text-fg-3">Credited to the client&apos;s trading account on each closed, qualifying trade.</p>
        </div>
        <div>
          <div className="mb-2 flex items-baseline justify-between">
            <span className="text-[13px] font-medium text-fg-2">Split with sub-IBs</span>
            <span className="k-num text-[18px] font-semibold text-gold">{split}%</span>
          </div>
          <RangeSlider value={split} onChange={setSplit} min={0} max={50} tone="gold" ticks={[0, 10, 20, 30, 40, 50]} format={(v) => `${v}%`} label="Sub-IB split" />
          <p className="mt-1.5 text-[11.5px] text-fg-3">Share of your per-lot rate passed to sub-IBs on their clients&apos; trades.</p>
        </div>

        <div className="rounded-[16px] border border-line bg-surface-2 p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-[12.5px] text-fg-2">
              Example · <span className="k-num text-fg">{lots} lots</span> at <span className="k-num text-fg">${rate}/lot</span>
            </span>
            <Segmented size="xs" value={sym} onChange={setSym} options={EX_SYMBOLS} />
          </div>
          <SplitRow title="Your direct client trades" gross={gross} parts={[{ label: "Client rebate", v: toClient, cls: "bg-ember/70" }, { label: "You keep", v: youDirect, cls: "bg-up" }]} />
          <SplitRow title="A sub-IB's client trades" gross={gross} parts={[{ label: "Sub-IB", v: toSub, cls: "bg-gold" }, { label: "You keep", v: youSub, cls: "bg-up" }]} />
        </div>
      </div>
      <div className="flex items-center justify-end gap-2 px-4 pb-5 pt-3 sm:px-6">
        <Button
          variant="ghost"
          size="sm"
          disabled={!dirty}
          onClick={() => {
            setRebate(PARTNER.rebatePct);
            setSplit(PARTNER.subIbSplitPct);
          }}
        >
          <RotateCcw /> Reset
        </Button>
        <Button
          variant="ember"
          size="sm"
          onClick={() => {
            PARTNER.rebatePct = rebate;
            PARTNER.subIbSplitPct = split;
            toast.success("Rebate & split settings saved", { description: `Clients get ${rebate}% back · sub-IBs get ${split}% · applies to trades closed from now on` });
          }}
        >
          <Save /> Save settings
        </Button>
      </div>
    </Card>
  );
}

function SplitRow({ title, gross, parts }: { title: string; gross: number; parts: { label: string; v: number; cls: string }[] }) {
  return (
    <div className="mt-4">
      <div className="flex items-center justify-between text-[12.5px]">
        <span className="text-fg-3">{title}</span>
        <span className="k-num font-medium">{formatMoney(gross)} gross</span>
      </div>
      <div className="mt-2 flex h-2.5 gap-0.5 overflow-hidden rounded-full bg-surface-3">
        {parts.map((p) => (
          <motion.div key={p.label} className={cn("h-full first:rounded-l-full last:rounded-r-full", p.cls)} animate={{ width: `${(p.v / gross) * 100}%` }} transition={{ type: "spring", bounce: 0.1, duration: 0.5 }} />
        ))}
      </div>
      <div className="mt-2 flex justify-between text-[12px]">
        {parts.map((p) => (
          <span key={p.label} className="flex items-center gap-1.5">
            <span className={cn("size-2 rounded-full", p.cls)} />
            <span className="text-fg-3">{p.label}</span>
            <span className="k-num font-medium">{formatMoney(p.v)}</span>
          </span>
        ))}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */

function TiersCard() {
  return (
    <Card className="h-full">
      <CardHeader title="Multi-tier rates" subtitle="Set by Kalks · share of the base rate" />
      <div className="space-y-2.5 px-4 pb-5 pt-4 sm:px-6">
        {TIERS.map((t) => (
          <div key={t.tier} className="k-row px-4 py-3">
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-2 text-[13px] font-medium">
                <TierChip tier={t.tier} />
                <span className="first-letter:uppercase">{t.label.split(" · ")[1]}</span>
              </span>
              <span className="k-num text-[16px] font-semibold">{t.pct}%</span>
            </div>
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-surface-3">
              <motion.div className={cn("h-full rounded-full", t.tier === 1 ? "bg-ember" : t.tier === 2 ? "bg-gold" : "bg-up")} initial={{ width: 0 }} animate={{ width: `${t.pct}%` }} transition={{ duration: 0.8 }} />
            </div>
            <div className="mt-1.5 text-[11.5px] text-fg-3">
              {t.note} · XAUUSD pays <span className="k-num text-fg-2">${((rateFor("XAUUSD") * t.pct) / 100).toFixed(2)}/lot</span>
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}

function CpaCard() {
  return (
    <Card className="relative h-full overflow-hidden">
      <CardHeader title="CPA bonus" subtitle="One-time, per qualified client" />
      <Icon3D name="wrapped_gift" size={64} className="absolute right-5 top-4" />
      <div className="px-6 pt-4">
        <div className="flex items-baseline gap-2">
          <Money value={CPA_RULES.amount} decimals={0} className="text-[32px] font-semibold" />
          <span className="text-[13px] text-fg-3">· {formatMoney(CPA_RULES.goldAmount, "USD", 0)} at Gold</span>
        </div>
      </div>
      <div className="space-y-2 px-4 pb-5 pt-4 sm:px-6">
        {[
          { icon: <Target />, t: "First live deposit", v: `≥ ${formatMoney(CPA_RULES.minFirstDeposit, "USD", 0)}` },
          { icon: <Timer />, t: "First live trade", v: `held ≥ ${CPA_RULES.minTradeSeconds / 60} min` },
          { icon: <Clock />, t: "Hold period", v: `${CPA_RULES.holdDays} days` },
          { icon: <Sparkles />, t: "Earned so far", v: `${formatMoney(PARTNER.cpaEarned, "USD", 0)} · ${PARTNER.cpaCount} clients` },
        ].map((r) => (
          <div key={r.t} className="k-row flex items-center gap-3 px-3.5 py-2.5 text-[12.5px]">
            <span className="grid size-7 place-items-center rounded-full bg-gold-soft text-gold [&_svg]:size-3.5">{r.icon}</span>
            <span className="flex-1 text-fg-2">{r.t}</span>
            <span className="k-num font-medium">{r.v}</span>
          </div>
        ))}
      </div>
    </Card>
  );
}

const ABUSE_ICONS = [<Timer key="a" />, <UserX key="b" />, <Ban key="c" />, <InfinityIcon key="d" />];
function RulesCard() {
  return (
    <Card className="h-full">
      <CardHeader title="Qualification rules" subtitle="Applied automatically to every trade" icon={<ShieldAlert />} />
      <div className="space-y-2 px-4 pb-5 pt-4 sm:px-6">
        {ANTI_ABUSE.map((r, i) => (
          <div key={r.title} className="k-row flex items-start gap-3 px-3.5 py-3">
            <span className="mt-0.5 grid size-7 shrink-0 place-items-center rounded-full bg-surface-3 text-fg-2 [&_svg]:size-3.5">{ABUSE_ICONS[i]}</span>
            <div>
              <div className="text-[13px] font-medium">{r.title}</div>
              <div className="mt-0.5 text-[12px] leading-snug text-fg-3">{r.text}</div>
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}

/* ------------------------------------------------------------------ */

type StatusF = "all" | CommissionStatus;
type KindF = "all" | "lot" | "cpa";

function LedgerCard() {
  const [status, setStatus] = React.useState<StatusF>("all");
  const [kind, setKind] = React.useState<KindF>("all");
  const rows = React.useMemo(() => COMMISSION_LEDGER.filter((e) => (status === "all" || e.status === status) && (kind === "all" || e.kind === kind)), [status, kind]);
  const sum = (s: CommissionStatus) => COMMISSION_LEDGER.filter((e) => e.status === s).reduce((a, e) => a + e.amount, 0);

  const columns: Column<CommissionEvent>[] = [
    {
      key: "ticket",
      header: "Ticket",
      cell: (e) => (
        <span className="block">
          <span className="font-mono text-[12.5px]">{e.ticket ? `#${e.ticket}` : e.id}</span>
          <span className="block text-[11px] text-fg-3">{fmtDT(e.closedAt)}</span>
        </span>
      ),
      sort: (e) => e.closedAt,
    },
    { key: "client", header: "Client", cell: (e) => <ClientCell c={{ name: e.clientName, photo: e.clientPhoto, country: e.clientCountry }} size={28} sub={e.source !== "manual" ? `via ${e.source === "copy" ? "copy trading" : "PAMM"}` : undefined} />, sort: (e) => e.clientName },
    {
      key: "symbol",
      header: "Symbol",
      cell: (e) =>
        e.symbol ? (
          <SymbolCell symbol={e.symbol} size={22} />
        ) : (
          <span className="flex items-center gap-2">
            <span className="grid size-[22px] place-items-center rounded-full bg-gold-soft text-gold">
              <Sparkles className="size-3" />
            </span>
            <span>
              <span className="block text-[13px] font-medium">CPA bonus</span>
              <span className="block text-[11px] text-fg-3">{e.note}</span>
            </span>
          </span>
        ),
    },
    { key: "lots", header: "Lots", align: "right", cell: (e) => <span className="k-num">{e.lots ? e.lots.toFixed(2) : "—"}</span>, sort: (e) => e.lots },
    { key: "tier", header: "Tier", align: "center", cell: (e) => <TierChip tier={e.tier} /> },
    { key: "rate", header: "Rate", align: "right", cell: (e) => <span className="k-num text-fg-2">{e.kind === "cpa" ? "fixed" : `$${e.rate}${e.tier > 1 ? ` × ${e.tier === 2 ? 20 : 10}%` : ""}`}</span>, hideOn: "md" },
    { key: "amount", header: "Amount", align: "right", cell: (e) => <Money value={e.amount} countUp={false} className={cn("font-semibold", e.status === "rejected" ? "text-fg-3 line-through" : "text-up")} />, sort: (e) => e.amount },
    { key: "status", header: "Status", align: "right", cell: (e) => <CommissionStatusChip status={e.status} /> },
  ];

  return (
    <Card>
      <CardHeader
        title="Commission ledger"
        subtitle="Every qualifying trade and CPA, as it accrues"
        action={
          <div className="hidden items-center gap-2 md:flex">
            <Chip tone="warn">Pending {formatMoney(sum("pending"))}</Chip>
            <Chip tone="info">Approved {formatMoney(sum("approved"))}</Chip>
            <Chip tone="up">Paid {formatMoney(sum("paid"))}</Chip>
          </div>
        }
      />
      <div className="px-4 pb-5 pt-4 sm:px-6">
        <DataTable
          columns={columns}
          rows={rows}
          pageSize={12}
          rowKey={(e) => e.id}
          search={(e) => `${e.ticket ?? ""} ${e.clientName} ${e.symbol ?? "cpa"}`}
          searchPlaceholder="Ticket, client, symbol…"
          exportName="kalks-commission-ledger"
          toolbar={
            <div className="flex flex-wrap items-center gap-2">
              <Segmented
                size="xs"
                value={status}
                onChange={setStatus}
                options={[
                  { value: "all", label: "All" },
                  { value: "pending", label: "Pending" },
                  { value: "approved", label: "Approved" },
                  { value: "paid", label: "Paid" },
                  { value: "rejected", label: "Rejected" },
                ]}
              />
              <Segmented
                size="xs"
                value={kind}
                onChange={setKind}
                options={[
                  { value: "all", label: "All types" },
                  { value: "lot", label: "Lots" },
                  { value: "cpa", label: "CPA" },
                ]}
              />
            </div>
          }
        />
      </div>
    </Card>
  );
}

/* ------------------------------------------------------------------ */

function DemoPartnerCommissionsPage() {
  return (
    <div className="pb-24">
      <PageHeader
        title="Commissions"
        subtitle="Per-lot rates by level, multi-tier overrides, CPA and your full ledger."
        actions={
          <Button variant="surface" size="lg" onClick={() => toast.success("Statement generated", { description: "kalks-ib-statement-2026-09.pdf will download shortly" })}>
            <Download /> September statement
          </Button>
        }
      />

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-12">
        <Reveal className="xl:col-span-7">
          <RateCard />
        </Reveal>
        <Reveal delay={0.05} className="xl:col-span-5">
          <RebatesCard />
        </Reveal>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Reveal delay={0.05}>
          <TiersCard />
        </Reveal>
        <Reveal delay={0.1}>
          <CpaCard />
        </Reveal>
        <Reveal delay={0.15}>
          <RulesCard />
        </Reveal>
      </div>

      <Reveal delay={0.1} className="mt-4 block">
        <LedgerCard />
      </Reveal>
    </div>
  );
}

export default function Page() {
  return IS_DEMO ? <DemoPartnerCommissionsPage /> : <LivePartnerCommissions />;
}
