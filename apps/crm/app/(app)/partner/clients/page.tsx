"use client";

import * as React from "react";
import { Bell, ChevronDown, Filter, Mail, MessageSquare, Phone, ShieldCheck, UserPlus, Check } from "lucide-react";
import { toast } from "sonner";
import {
  Avatar,
  Button,
  Card,
  Chip,
  CopyButton,
  DataTable,
  Dialog,
  Flag,
  Menu,
  MiniBars,
  Money,
  PageHeader,
  Reveal,
  Segmented,
  StatusChip,
  SymbolAvatar,
  cn,
  formatMoney,
  type Column,
} from "@/components/kit";
import { ME } from "@kalks/mock";
import { CPA_RULES, REFERRED_CLIENTS, clientActivity, clientTrades, type KycStatus, type ReferredClient } from "@kalks/mock/partner";
import { ClientCell, TierChip, fmtDate, relTime, subIbName } from "@/components/partner/partner-bits";
import { IS_DEMO } from "@kalks/mock/mode";
import { LivePartnerClients } from "@/components/partner/live/clients";

type TierF = "all" | "1" | "2" | "3";
type StatusF = "all" | "active" | "dormant" | "registered";
type KycF = "all" | KycStatus;

const STATUS_TONE: Record<ReferredClient["status"], "up" | "neutral" | "warn"> = { active: "up", dormant: "neutral", registered: "warn" };
const STATUS_LABEL: Record<ReferredClient["status"], string> = { active: "Active", dormant: "Dormant", registered: "No deposit" };

function MiniStat({ label, value, sub }: { label: string; value: React.ReactNode; sub?: React.ReactNode }) {
  return (
    <div className="k-card px-5 py-4">
      <div className="k-label">{label}</div>
      <div className="k-num mt-2 text-[22px] font-semibold leading-none tracking-tight">{value}</div>
      {sub && <div className="mt-1.5 text-[12px] text-fg-3">{sub}</div>}
    </div>
  );
}

function fmtDuration(s: number) {
  if (s < 60) return `${s}s`;
  if (s < 3600) return `${Math.round(s / 60)}m`;
  const h = Math.floor(s / 3600);
  return h < 24 ? `${h}h ${Math.round((s % 3600) / 60)}m` : `${Math.floor(h / 24)}d ${h % 24}h`;
}

/* ------------------------------------------------------------------ */

function ClientDrawer({ c, onClose }: { c: ReferredClient | null; onClose: () => void }) {
  const trades = React.useMemo(() => (c ? clientTrades(c.id, 10) : []), [c]);
  const activity = React.useMemo(() => (c ? clientActivity(c.id) : []), [c]);
  const parent = c ? subIbName(c.parentId) : null;
  return (
    <Dialog
      open={!!c}
      onOpenChange={(o) => !o && onClose()}
      side="right"
      title="Client details"
      description={c ? `Referred ${fmtDate(c.joinedAt)} · ${c.tier === 1 ? "your direct client" : `via ${parent}`}` : undefined}
      footer={
        c && (
          <div className="flex w-full flex-wrap justify-end gap-2">
            {c.kyc !== "verified" && (
              <Button variant="surface" size="sm" onClick={() => toast.success("KYC reminder sent", { description: `${c.name} will get an email and push notification.` })}>
                <Bell /> Send KYC reminder
              </Button>
            )}
            <Button variant="ember" size="sm" onClick={() => toast.success("Message sent", { description: `Your message to ${c.name.split(" ")[0]} was delivered to their Client Area inbox.` })}>
              <MessageSquare /> Message client
            </Button>
          </div>
        )
      }
    >
      {c && (
        <div className="space-y-5">
          <div className="flex items-center gap-4">
            <div className="relative">
              <Avatar src={c.photo} name={c.name} size={60} verified={c.kyc === "verified"} />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="truncate text-[19px] font-medium tracking-tight">{c.name}</h3>
                <TierChip tier={c.tier} />
                {c.isSubIb && <Chip size="sm" tone="gold">Sub-IB</Chip>}
              </div>
              <div className="mt-1 flex items-center gap-2 text-[12.5px] text-fg-3">
                <Flag country={c.country} className="size-4" /> {c.countryName}
                <span>·</span>
                <Chip size="sm" tone={STATUS_TONE[c.status]} dot>
                  {STATUS_LABEL[c.status]}
                </Chip>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <div className="k-row flex items-center gap-3 px-3.5 py-2.5 text-[13px]">
              <Mail className="size-4 text-fg-3" />
              <span className="min-w-0 flex-1 truncate">{c.email}</span>
              <CopyButton value={c.email} label="Email" />
            </div>
            <div className="k-row flex items-center gap-3 px-3.5 py-2.5 text-[13px]">
              <Phone className="size-4 text-fg-3" />
              <span className="k-num flex-1 truncate">{c.phone}</span>
              <CopyButton value={c.phone} label="Phone" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {[
              ["Login", c.login ? <span className="flex items-center gap-1 font-mono">{c.login}<CopyButton value={c.login} label="Login" /></span> : "—"],
              ["Account", c.login ? `${c.accountGroup} · Live` : "Not opened"],
              ["KYC", <StatusChip key="k" status={c.kyc === "unverified" ? "draft" : c.kyc} label={c.kyc === "unverified" ? "Not started" : undefined} />],
              ["Deposits", <Money key="d" value={c.deposits} countUp={false} />],
              ["Withdrawals", <Money key="w" value={c.withdrawals} countUp={false} />],
              ["Equity", <Money key="e" value={c.equity} countUp={false} />],
              ["Lots · Sep", <span key="l" className="k-num">{c.lotsMonth.toFixed(2)}</span>],
              ["Lots · lifetime", <span key="lt" className="k-num">{c.lotsTotal.toFixed(2)}</span>],
              ["Your commission", <Money key="c" value={c.commission} countUp={false} className="text-up" />],
            ].map(([k, v], i) => (
              <div key={i} className="k-row min-w-0 px-3.5 py-2.5">
                <div className="text-[12px] text-fg-3">{k}</div>
                <div className="mt-1 truncate text-[13.5px] font-medium">{v}</div>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <div className="k-row px-4 py-3">
              <div className="flex items-center justify-between text-[12px] text-fg-3">
                <span>Lots · last 16 weeks</span>
                <span className="k-num text-fg-2">{relTime(c.lastTrade)}</span>
              </div>
              <MiniBars data={activity} className="mt-2 h-10" />
            </div>
            <div className="k-row space-y-1.5 px-4 py-3 text-[12.5px]">
              <div className="flex justify-between">
                <span className="text-fg-3">Source</span>
                <span className="truncate pl-2 font-medium">{c.campaign}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-fg-3">CPA</span>
                {c.cpaPaid ? <span className="font-medium text-gold">{formatMoney(CPA_RULES.amount, "USD", 0)} paid</span> : <span className="text-fg-2">{c.deposits >= CPA_RULES.minFirstDeposit ? "Not qualified" : "Awaiting deposit"}</span>}
              </div>
              <div className="flex justify-between">
                <span className="text-fg-3">Copy / PAMM lots</span>
                <span className="k-num font-medium">{c.viaCopy ? c.viaCopy.toFixed(2) : "—"}</span>
              </div>
            </div>
          </div>

          <div>
            <div className="mb-2 flex items-center justify-between">
              <h4 className="text-[14px] font-medium">Recent trades</h4>
              <span className="text-[11.5px] text-fg-3">Trades under {CPA_RULES.minTradeSeconds}s don&apos;t qualify</span>
            </div>
            {trades.length === 0 ? (
              <div className="k-row px-4 py-6 text-center text-[13px] text-fg-3">No trades yet — this client hasn&apos;t funded an account.</div>
            ) : (
              <div className="space-y-1.5">
                {trades.map((t) => (
                  <div key={t.ticket} className={cn("k-row flex items-center gap-3 px-3 py-2", !t.qualifies && "opacity-70")}>
                    <SymbolAvatar symbol={t.symbol} size={22} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 text-[13px] font-medium">
                        {t.symbol}
                        <Chip size="sm" tone={t.side === "buy" ? "up" : "down"}>
                          {t.side.toUpperCase()} {t.lots.toFixed(2)}
                        </Chip>
                      </div>
                      <div className="truncate font-mono text-[10.5px] text-fg-3">
                        #{t.ticket} · {fmtDuration(t.durationSec)} · {relTime(t.closedAt)}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className={cn("k-num text-[13px] font-medium", t.profit >= 0 ? "text-up" : "text-down")}>
                        {t.profit >= 0 ? "+" : "-"}
                        {formatMoney(Math.abs(t.profit))}
                      </div>
                      <div className="text-[10.5px]">{t.qualifies ? <span className="k-num text-gold">+{formatMoney(t.commission)} to you</span> : <span className="text-down">Not eligible · &lt;2 min</span>}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </Dialog>
  );
}

/* ------------------------------------------------------------------ */

function DemoPartnerClientsPage() {
  const [tier, setTier] = React.useState<TierF>("all");
  const [status, setStatus] = React.useState<StatusF>("all");
  const [kyc, setKyc] = React.useState<KycF>("all");
  const [sel, setSel] = React.useState<ReferredClient | null>(null);

  const rows = React.useMemo(
    () =>
      REFERRED_CLIENTS.filter((c) => (tier === "all" || String(c.tier) === tier) && (status === "all" || c.status === status) && (kyc === "all" || c.kyc === kyc)).sort(
        (a, b) => b.lotsMonth - a.lotsMonth || b.deposits - a.deposits,
      ),
    [tier, status, kyc],
  );

  const all = REFERRED_CLIENTS;
  const deposits = all.reduce((s, c) => s + c.deposits, 0);
  const lots = all.reduce((s, c) => s + c.lotsMonth, 0);
  const comm = all.reduce((s, c) => s + c.commission, 0);

  const columns: Column<ReferredClient>[] = [
    { key: "name", header: "Client", cell: (c) => <ClientCell c={c} size={34} />, sort: (c) => c.name, width: "240px" },
    {
      key: "tier",
      header: "Tier",
      cell: (c) => (
        <span className="flex flex-col items-start gap-0.5">
          <TierChip tier={c.tier} />
          {c.tier > 1 && <span className="max-w-[110px] truncate text-[10.5px] text-fg-3">via {subIbName(c.parentId)}</span>}
        </span>
      ),
      sort: (c) => c.tier,
    },
    { key: "joined", header: "Joined", cell: (c) => <span className="k-num text-fg-2">{fmtDate(c.joinedAt)}</span>, sort: (c) => c.joinedAt, hideOn: "md" },
    { key: "kyc", header: "KYC", cell: (c) => <StatusChip status={c.kyc === "unverified" ? "draft" : c.kyc} label={c.kyc === "unverified" ? "Not started" : undefined} /> },
    { key: "dep", header: "Deposits", align: "right", cell: (c) => (c.deposits ? <Money value={c.deposits} countUp={false} decimals={0} /> : <span className="text-fg-3">—</span>), sort: (c) => c.deposits },
    {
      key: "lots",
      header: "Lots · Sep",
      align: "right",
      cell: (c) => (
        <span className="block">
          <span className="k-num font-medium">{c.lotsMonth ? c.lotsMonth.toFixed(2) : "—"}</span>
          <span className="k-num block text-[11px] text-fg-3">{c.lotsTotal.toFixed(1)} total</span>
        </span>
      ),
      sort: (c) => c.lotsMonth,
    },
    { key: "comm", header: "Commission", align: "right", cell: (c) => (c.commission ? <Money value={c.commission} countUp={false} className="font-medium text-up" /> : <span className="text-fg-3">—</span>), sort: (c) => c.commission },
    {
      key: "last",
      header: "Last trade",
      align: "right",
      cell: (c) => (
        <span className="flex flex-col items-end gap-0.5">
          <span className="k-num text-fg-2">{relTime(c.lastTrade)}</span>
          <Chip size="sm" tone={STATUS_TONE[c.status]}>
            {STATUS_LABEL[c.status]}
          </Chip>
        </span>
      ),
      sort: (c) => c.lastTrade ?? "",
    },
  ];

  const kycLabel = kyc === "all" ? "Any KYC" : kyc === "unverified" ? "Not started" : kyc[0]!.toUpperCase() + kyc.slice(1);

  return (
    <div className="pb-24">
      <PageHeader
        title="Referred clients"
        subtitle="Everyone attributed to you across three tiers — attribution is permanent."
        actions={
          <Button
            variant="ember"
            size="lg"
            onClick={() => {
              navigator.clipboard?.writeText(ME.referralLink).catch(() => {});
              toast.success("Referral link copied", { description: ME.referralLink });
            }}
          >
            <UserPlus /> Invite a client
          </Button>
        }
      />

      <Reveal>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
          <MiniStat label="Referred" value={all.length} sub={`${all.filter((c) => c.tier === 1).length} direct · ${all.filter((c) => c.tier > 1).length} via sub-IBs`} />
          <MiniStat label="Active · 30d" value={all.filter((c) => c.status === "active").length} sub={`${all.filter((c) => c.status === "dormant").length} dormant`} />
          <MiniStat label="KYC verified" value={`${Math.round((all.filter((c) => c.kyc === "verified").length / all.length) * 100)}%`} sub={`${all.filter((c) => c.kyc === "pending").length} pending review`} />
          <MiniStat label="Net deposits" value={<Money value={deposits - all.reduce((s, c) => s + c.withdrawals, 0)} decimals={0} />} sub={`${formatMoney(deposits, "USD", 0)} deposited`} />
          <MiniStat label="Lots · Sep" value={lots.toFixed(1)} sub={<span className="text-up">{formatMoney(comm, "USD", 0)} earned lifetime</span>} />
        </div>
      </Reveal>

      <Reveal delay={0.08}>
        <Card className="mt-4 px-4 py-5 sm:px-6">
          <DataTable
            columns={columns}
            rows={rows}
            pageSize={12}
            rowKey={(c) => c.id}
            onRowClick={setSel}
            search={(c) => `${c.name} ${c.email} ${c.countryName} ${c.login ?? ""}`}
            searchPlaceholder="Search name, email, login…"
            exportName="kalks-referred-clients"
            toolbar={
              <div className="flex flex-wrap items-center gap-2">
                <Segmented
                  size="xs"
                  value={tier}
                  onChange={setTier}
                  options={[
                    { value: "all", label: "All tiers" },
                    { value: "1", label: "L1" },
                    { value: "2", label: "L2" },
                    { value: "3", label: "L3" },
                  ]}
                />
                <Segmented
                  size="xs"
                  value={status}
                  onChange={setStatus}
                  options={[
                    { value: "all", label: "All" },
                    { value: "active", label: "Active" },
                    { value: "dormant", label: "Dormant" },
                    { value: "registered", label: "No deposit" },
                  ]}
                />
                <Menu
                  width={180}
                  trigger={
                    <Button size="sm" variant="surface">
                      <ShieldCheck /> {kycLabel} <ChevronDown className="opacity-60" />
                    </Button>
                  }
                  items={(["all", "verified", "pending", "unverified", "rejected"] as KycF[]).map((k) => ({
                    label: k === "all" ? "Any KYC" : k === "unverified" ? "Not started" : k[0]!.toUpperCase() + k.slice(1),
                    onSelect: () => setKyc(k),
                    hint: k === kyc ? <Check className="size-3.5 text-ember" /> : undefined,
                  }))}
                />
                {(tier !== "all" || status !== "all" || kyc !== "all") && (
                  <Button
                    size="xs"
                    variant="ghost"
                    onClick={() => {
                      setTier("all");
                      setStatus("all");
                      setKyc("all");
                    }}
                  >
                    <Filter /> Clear
                  </Button>
                )}
                <span className="k-num text-[12px] text-fg-3">{rows.length} clients</span>
              </div>
            }
          />
        </Card>
      </Reveal>

      <ClientDrawer c={sel} onClose={() => setSel(null)} />
    </div>
  );
}

export default function Page() {
  return IS_DEMO ? <DemoPartnerClientsPage /> : <LivePartnerClients />;
}
