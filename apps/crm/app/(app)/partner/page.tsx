"use client";

import * as React from "react";
import Link from "next/link";
import { QRCodeSVG } from "qrcode.react";
import { ArrowUpRight, BadgeCheck, Banknote, ChevronRight, Coins, Download, Layers, Link2, Mail, QrCode, Sparkles, Target, Users, UserPlus } from "lucide-react";
import { toast } from "sonner";
import {
  Avatar,
  Button,
  CapsuleBars,
  Card,
  CardHeader,
  Chip,
  CopyButton,
  Dialog,
  EquityChart,
  Icon3D,
  KpiCard,
  ListRow,
  Money,
  PageHeader,
  Progress,
  Reveal,
  Segmented,
  Starfield,
  Tooltip,
  cn,
  formatMoney,
  IconGlyph,
} from "@/components/kit";
import type { SeriesPoint } from "@/components/kit";
import { ME } from "@kalks/mock";
import {
  CAMPAIGNS,
  COMMISSION_LEDGER,
  CPA_RULES,
  IB_LEVELS,
  PARTNER,
  REFERRED_CLIENTS,
  WEEKLY_COMMISSION,
  commissionSeries,
} from "@kalks/mock/partner";
import { ClientCell, CommissionStatusChip, TierChip, relTime } from "@/components/partner/partner-bits";
import { ShareButtons } from "@/components/partner/share-buttons";
import { IS_DEMO } from "@kalks/mock/mode";
import { LivePartnerDashboard } from "@/components/partner/live/dashboard";

/* ------------------------------------------------------------------ */

function LevelHero() {
  const cur = IB_LEVELS.findIndex((l) => l.key === PARTNER.level);
  const next = IB_LEVELS[cur + 1]!;
  const clientsPct = (PARTNER.activeClients / PARTNER.activeTarget) * 100;
  const lotsPct = (PARTNER.monthlyLots / PARTNER.lotsTarget) * 100;
  return (
    <Card hot className="h-full overflow-hidden">
      <Starfield density={70} />
      <div className="relative flex h-full flex-col gap-6 p-6 sm:p-7">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="relative">
              <Icon3D name="crown" size={76} />
            </div>
            <div>
              <div className="k-label text-ember">Partner level · 2 of 5</div>
              <h2 className="mt-1 text-[30px] font-semibold leading-none tracking-tight">{ME.ibLevelName}</h2>
              <div className="mt-2 flex flex-wrap items-center gap-2 text-[12.5px] text-fg-2">
                <span>Partner since Mar 2024</span>
                <span className="text-fg-3">·</span>
                <span>
                  Code <span className="font-mono text-fg">{PARTNER.code}</span>
                </span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Chip tone="gold">
              <BadgeCheck className="size-3.5" /> Weekly payouts
            </Chip>
            <Link href="/partner/commissions">
              <Button size="sm" variant="surface">
                Rate card <ChevronRight />
              </Button>
            </Link>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <ProgressBlock
            icon={<Users className="size-4" />}
            label="Active clients"
            value={PARTNER.activeClients}
            target={PARTNER.activeTarget}
            pct={clientsPct}
            hint={`${PARTNER.activeTarget - PARTNER.activeClients} more clients trading this month`}
            fmt={(v) => String(v)}
          />
          <ProgressBlock
            icon={<Layers className="size-4" />}
            label="Monthly network lots"
            value={PARTNER.monthlyLots}
            target={PARTNER.lotsTarget}
            pct={lotsPct}
            hint={`${(PARTNER.lotsTarget - PARTNER.monthlyLots).toFixed(1)} lots to go · resets 1 Oct`}
            fmt={(v) => v.toLocaleString("en-US", { maximumFractionDigits: 1 })}
          />
        </div>

        {/* Level ladder */}
        <div className="mt-auto">
          <div className="relative grid grid-cols-5 gap-1">
            <div className="absolute left-[10%] right-[10%] top-[19px] h-px bg-white/10" />
            <div className="absolute left-[10%] top-[19px] h-px bg-gradient-to-r from-ember to-gold" style={{ width: `${(cur / 4) * 80 + (lotsPct / 100) * 20 * 0.6}%` }} />
            {IB_LEVELS.map((l, i) => {
              const done = i < cur;
              const on = i === cur;
              return (
                <Tooltip key={l.key} content={`${l.name}: ${l.minActiveClients} active clients · ${l.minMonthlyLots.toLocaleString()} lots/month`}>
                  <div className="relative flex flex-col items-center gap-1.5 text-center">
                    <span
                      className={cn(
                        "grid size-10 place-items-center rounded-full border",
                        on ? "border-ember/60 bg-ember/15 text-ember" : done ? "border-gold/40 bg-gold-soft text-gold" : "border-white/10 light:border-line bg-black/30 light:bg-white/70 text-fg-3",
                      )}
                    >
                      <IconGlyph name={l.icon} className="size-[18px]" />
                    </span>
                    <span className={cn("text-[11.5px] font-medium", on ? "text-fg" : done ? "text-gold" : "text-fg-3")}>{l.name}</span>
                  </div>
                </Tooltip>
              );
            })}
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-2 rounded-[14px] border border-white/10 light:border-line bg-black/25 light:bg-white/70 px-4 py-2.5 text-[12.5px]">
            <span className="text-fg-2">Unlock at {next.name}:</span>
            {next.perks.map((p) => (
              <Chip key={p} size="sm" tone="gold">
                {p}
              </Chip>
            ))}
          </div>
        </div>
      </div>
    </Card>
  );
}

function ProgressBlock({ icon, label, value, target, pct, hint, fmt }: { icon: React.ReactNode; label: string; value: number; target: number; pct: number; hint: string; fmt: (v: number) => string }) {
  return (
    <div className="rounded-[16px] border border-white/10 light:border-line bg-black/25 light:bg-white/70 px-4 py-3.5 backdrop-blur-sm">
      <div className="flex items-center justify-between text-[12.5px]">
        <span className="flex items-center gap-2 text-fg-2">
          {icon}
          {label}
        </span>
        <span className="k-num text-fg-3">{Math.round(pct)}% to Gold</span>
      </div>
      <div className="mt-2 flex items-baseline gap-1.5">
        <span className="k-num text-[26px] font-semibold leading-none">{fmt(value)}</span>
        <span className="k-num text-[14px] text-fg-3">/ {fmt(target)}</span>
      </div>
      <Progress value={pct} className="mt-3 h-2 bg-white/10" tone={pct > 70 ? "gold" : "ember"} />
      <div className="mt-2 text-[11.5px] text-fg-3">{hint}</div>
    </div>
  );
}

/* ------------------------------------------------------------------ */

function ReferralCard() {
  const [qr, setQr] = React.useState(false);
  const clicks = CAMPAIGNS.reduce((s, c) => s + c.clicks, 0);
  const signups = CAMPAIGNS.reduce((s, c) => s + c.signups, 0);
  const ftds = CAMPAIGNS.reduce((s, c) => s + c.ftds, 0);
  return (
    <Card className="flex h-full flex-col">
      <CardHeader title="Your referral link" subtitle="Attribution is permanent — clients stay linked for life" icon={<Link2 />} />
      <div className="flex flex-1 flex-col gap-4 px-4 pb-5 pt-4 sm:px-6">
        <div className="flex items-center gap-2 rounded-[14px] border border-ember/30 bg-ember-soft/60 py-1.5 pl-4 pr-1.5">
          <span className="min-w-0 flex-1 truncate font-mono text-[13px] text-fg">{ME.referralLink.replace("https://", "")}</span>
          <CopyButton value={ME.referralLink} label="Referral link" className="size-8 rounded-full" />
          <Button size="xs" variant="ember" onClick={() => setQr(true)}>
            <QrCode /> QR
          </Button>
        </div>
        <div className="flex items-center justify-between rounded-[14px] border border-line bg-surface-2 px-4 py-2.5">
          <div>
            <div className="text-[12px] text-fg-3">Referral code</div>
            <div className="font-mono text-[15px] font-semibold tracking-wider">{ME.referralCode}</div>
          </div>
          <CopyButton value={ME.referralCode} label="Referral code" />
        </div>
        <div>
          <div className="mb-2 text-[12px] text-fg-3">Share with one tap</div>
          <ShareButtons url={ME.referralLink} />
        </div>
        <div className="mt-auto grid grid-cols-3 gap-2">
          {[
            ["Clicks", clicks.toLocaleString()],
            ["Sign-ups", signups.toLocaleString()],
            ["FTDs", ftds.toLocaleString()],
          ].map(([k, v]) => (
            <div key={k} className="k-row px-3 py-2.5">
              <div className="text-[11px] text-fg-3">{k}</div>
              <div className="k-num text-[15px] font-medium">{v}</div>
            </div>
          ))}
        </div>
        <Link href="/partner/links" className="flex items-center justify-between text-[12.5px] text-fg-2 hover:text-fg">
          Campaign links, banners & landing pages <ArrowUpRight className="size-4" />
        </Link>
      </div>
      <Dialog
        open={qr}
        onOpenChange={setQr}
        width={400}
        title="Referral QR code"
        description="Print it on flyers or show it at events."
        footer={
          <>
            <Button variant="surface" size="sm" onClick={() => toast.success("QR code saved", { description: "kalks-ARJUN24-qr.svg" })}>
              <Download /> SVG
            </Button>
            <Button variant="ember" size="sm" onClick={() => toast.success("QR code saved", { description: "kalks-ARJUN24-qr.png · 1024×1024" })}>
              <Download /> PNG
            </Button>
          </>
        }
      >
        <div className="flex flex-col items-center gap-4">
          <div className="rounded-[20px] bg-white p-5 shadow-[0_20px_60px_-20px_color-mix(in_oklab,var(--k-ember)_50%,transparent)]">
            <QRCodeSVG value={ME.referralLink} size={220} level="H" fgColor="#0b0b0e" bgColor="#ffffff" imageSettings={{ src: "/assets/brand/kalks-mark.svg", height: 44, width: 44, excavate: true }} />
          </div>
          <div className="font-mono text-[13px] text-fg-2">{ME.referralLink.replace("https://", "")}</div>
        </div>
      </Dialog>
    </Card>
  );
}

/* ------------------------------------------------------------------ */

const RANGES = { "1M": 30, "3M": 90, "6M": 180 } as const;

function EarningsCard() {
  const all = React.useMemo(() => commissionSeries(180), []);
  const [range, setRange] = React.useState<keyof typeof RANGES>("3M");
  const data = React.useMemo(() => all.slice(-RANGES[range]), [all, range]);
  const [hover, setHover] = React.useState<SeriesPoint | null>(null);
  const onHover = React.useCallback((p: SeriesPoint | null) => setHover(p), []);
  const earned = data.reduce((s, d) => s + d.volume, 0);
  const shown = hover ?? data[data.length - 1]!;
  return (
    <Card className="h-full">
      <div className="flex flex-col gap-4 px-6 pt-6 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="k-label">Lifetime commission</div>
          <div className="mt-2 flex flex-wrap items-baseline gap-3">
            <Money value={shown.value} countUp={!hover} className="text-[34px] font-semibold tracking-tight" />
            <Chip tone="up">+{formatMoney(earned)} in {range}</Chip>
          </div>
          <div className="mt-1 text-xs text-fg-3">
            {hover ? (
              <>
                {new Date(hover.time * 1000).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })} · earned {formatMoney(hover.volume ?? 0)}
              </>
            ) : (
              "Paid + approved + pending · bars show daily commission"
            )}
          </div>
        </div>
        <Segmented size="xs" value={range} onChange={setRange} options={["1M", "3M", "6M"] as const} />
      </div>
      <div className="px-3 pb-4 pt-2">
        <EquityChart data={data} height={280} onHover={onHover} />
      </div>
    </Card>
  );
}

function WeeklyCard() {
  const data = WEEKLY_COMMISSION.slice(-8);
  const last = data[data.length - 1]!.value;
  const prev = data[data.length - 2]!.value;
  const ch = ((last - prev) / prev) * 100;
  return (
    <Card className="flex h-full flex-col">
      <CardHeader title="Commission by week" subtitle="Closed live trades · all tiers" action={<Chip tone={ch >= 0 ? "up" : "down"}>{ch >= 0 ? "+" : ""}{ch.toFixed(1)}% w/w</Chip>} />
      <div className="px-6 pt-4">
        <Money value={last} className="text-[26px] font-semibold" />
        <div className="text-[12px] text-fg-3">Week of Sep 21 · batch pays Mon 28 Sep</div>
      </div>
      <div className="flex-1 px-4 pb-5 pt-6 sm:px-6">
        <CapsuleBars data={data.map((d) => ({ label: d.label.split(" ")[1]!, value: d.value }))} height={210} format={(v) => formatMoney(v, "USD", 0)} />
      </div>
    </Card>
  );
}

/* ------------------------------------------------------------------ */

function TopClientsCard() {
  const top = [...REFERRED_CLIENTS].filter((c) => c.status === "active").sort((a, b) => b.lotsMonth - a.lotsMonth).slice(0, 6);
  const max = top[0]!.lotsMonth;
  return (
    <Card className="flex h-full flex-col">
      <CardHeader
        title="Top clients"
        subtitle="By lots this month"
        action={
          <Link href="/partner/clients">
            <Button size="sm" variant="surface">
              All clients
            </Button>
          </Link>
        }
      />
      <div className="mt-4 flex-1 space-y-2 px-4 pb-5 sm:px-6">
        {top.map((c, i) => (
          <ListRow key={c.id} href="/partner/clients" className="py-2.5">
            <span className="w-4 text-center font-mono text-[11px] text-fg-3">{i + 1}</span>
            <div className="min-w-0 flex-1">
              <ClientCell c={c} size={32} sub={<span className="flex items-center gap-1.5">{c.countryName}</span>} />
            </div>
            <TierChip tier={c.tier} />
            <div className="w-24 text-right">
              <div className="k-num text-[13px] font-medium">{c.lotsMonth.toFixed(2)} lots</div>
              <div className="mt-1 h-1 overflow-hidden rounded-full bg-surface-3">
                <div className="h-full rounded-full bg-gold" style={{ width: `${(c.lotsMonth / max) * 100}%` }} />
              </div>
            </div>
          </ListRow>
        ))}
      </div>
    </Card>
  );
}

function RecentEventsCard() {
  const events = COMMISSION_LEDGER.slice(0, 7);
  return (
    <Card className="flex h-full flex-col">
      <CardHeader
        title="Recent commission"
        subtitle="Live feed of closed trades"
        action={
          <Link href="/partner/commissions">
            <Button size="sm" variant="surface">
              Ledger
            </Button>
          </Link>
        }
      />
      <div className="k-fade-bottom mt-4 flex-1 space-y-2 px-4 pb-5 sm:px-6">
        {events.map((e) => (
          <div key={e.id} className="k-row flex items-center gap-3 px-3.5 py-2.5">
            <span className="relative shrink-0">
              <Avatar src={e.clientPhoto} name={e.clientName} size={32} />
              <span className={cn("absolute -bottom-1 -right-1 grid size-4 place-items-center rounded-full ring-2 ring-surface-2", e.kind === "cpa" ? "bg-gold text-black" : "bg-surface-3 text-fg-2")}>
                {e.kind === "cpa" ? <Sparkles className="size-2.5" /> : <Coins className="size-2.5" />}
              </span>
            </span>
            <div className="min-w-0 flex-1">
              <div className="truncate text-[13px] font-medium">{e.clientName}</div>
              <div className="truncate text-[11.5px] text-fg-3">
                {e.kind === "cpa" ? "CPA bonus · first deposit + trade" : `${e.symbol} · ${e.lots.toFixed(2)} lot · L${e.tier}`} · {relTime(e.closedAt)}
              </div>
            </div>
            <div className="flex flex-col items-end gap-1">
              <span className="k-num text-[13.5px] font-semibold text-up">+{formatMoney(e.amount)}</span>
              <CommissionStatusChip status={e.status} />
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}

function CpaCard() {
  return (
    <Card className="flex h-full flex-col overflow-hidden">
      <CardHeader title="CPA earned" subtitle="One-time bonus per qualified client" action={<Chip tone="gold">{PARTNER.cpaCount} paid</Chip>} />
      <div className="relative px-6 pt-4">
        <Money value={PARTNER.cpaEarned} className="text-[30px] font-semibold" />
        <div className="text-[12px] text-fg-3">
          {PARTNER.cpaPendingCount} clients awaiting their first trade
        </div>
        <Icon3D name="money_with_wings" size={72} className="absolute right-5 top-5" />
      </div>
      <div className="mt-4 space-y-2 px-4 sm:px-6">
        {[
          [<Target key="t" className="size-3.5" />, `First live deposit ≥ ${formatMoney(CPA_RULES.minFirstDeposit, "USD", 0)}`],
          [<UserPlus key="u" className="size-3.5" />, "First qualifying live trade (≥ 2 min)"],
          [<Banknote key="b" className="size-3.5" />, `${formatMoney(CPA_RULES.amount, "USD", 0)} per client · ${formatMoney(CPA_RULES.goldAmount, "USD", 0)} at Gold`],
        ].map(([icon, text], i) => (
          <div key={i} className="flex items-center gap-2.5 text-[12.5px] text-fg-2">
            <span className="grid size-6 place-items-center rounded-full bg-surface-3 text-fg-2">{icon}</span>
            {text}
          </div>
        ))}
      </div>
      <div className="mt-5 px-4 sm:px-6">
        <div className="mb-2 text-[12px] text-fg-3">Latest qualified</div>
        <div className="space-y-2">
          {COMMISSION_LEDGER.filter((e) => e.kind === "cpa").slice(0, 3).map((e) => (
            <div key={e.id} className="k-row flex items-center gap-3 px-3.5 py-2">
              <div className="min-w-0 flex-1">
                <ClientCell c={{ name: e.clientName, photo: e.clientPhoto, country: e.clientCountry }} size={28} sub={e.note} />
              </div>
              <div className="flex flex-col items-end gap-1">
                <span className="k-num text-[13px] font-semibold text-gold">+{formatMoney(e.amount, "USD", 0)}</span>
                <CommissionStatusChip status={e.status} />
              </div>
            </div>
          ))}
        </div>
      </div>
      <div className="mt-auto px-4 pb-5 pt-4 sm:px-6">
        <div className="k-row flex items-center justify-between px-4 py-3">
          <div>
            <div className="text-[12px] text-fg-3">Rebate · sub-IB split</div>
            <div className="k-num mt-0.5 text-[14px] font-medium">
              {PARTNER.rebatePct}% <span className="text-fg-3">·</span> {PARTNER.subIbSplitPct}%
            </div>
          </div>
          <Link href="/partner/commissions">
            <Button size="xs" variant="surface">
              Adjust
            </Button>
          </Link>
        </div>
      </div>
    </Card>
  );
}

/* ------------------------------------------------------------------ */

function DemoPartnerDashboardPage() {
  const netLots = PARTNER.monthlyLots;
  return (
    <div className="pb-24">
      <PageHeader
        title="Partner dashboard"
        subtitle="Earn on every lot your network trades — paid weekly into your wallet."
        actions={
          <>
            <Link href="/partner/payouts">
              <Button variant="surface" size="lg">
                <Banknote /> Payouts
              </Button>
            </Link>
            <Button variant="ember" size="lg" shimmer onClick={() => {
              navigator.clipboard?.writeText(ME.referralLink).catch(() => {});
              toast.success("Referral link copied", { description: ME.referralLink });
            }}>
              <Mail /> Invite traders
            </Button>
          </>
        }
      />

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-12">
        <Reveal className="xl:col-span-8">
          <LevelHero />
        </Reveal>
        <Reveal delay={0.05} className="xl:col-span-4">
          <ReferralCard />
        </Reveal>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        <KpiCard label="Total referrals" icon={<UserPlus />} value={<span className="k-num">{PARTNER.totalReferrals}</span>} chip={`+${PARTNER.referralsThisMonth} this month`} chipTone="up" href="/partner/clients" />
        <KpiCard label="Active clients" icon={<Users />} value={<span className="k-num">{PARTNER.activeClients}</span>} chip={`${PARTNER.activeTarget} needed for Gold`} chipTone="gold" href="/partner/network" delay={0.04} />
        <KpiCard label="Network lots · Sep" icon={<Layers />} value={<span className="k-num">{netLots.toLocaleString("en-US", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}</span>} chip={`+${PARTNER.lotsChangePct}% vs Aug`} chipTone="up" href="/partner/network" delay={0.08} />
        <KpiCard label="Pending commission" icon={<Coins />} value={<Money value={PARTNER.pendingCommission + PARTNER.approvedCommission} />} hot chip="Pays Mon 28 Sep" chipTone="ember" href="/partner/payouts" delay={0.12} />
        <KpiCard label="Paid all-time" icon={<Banknote />} value={<Money value={PARTNER.paidAllTime} />} chip="37 weekly batches" href="/partner/payouts" delay={0.16} className="sm:col-span-2 lg:col-span-1" />
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-12">
        <Reveal delay={0.05} className="xl:col-span-8">
          <EarningsCard />
        </Reveal>
        <Reveal delay={0.1} className="xl:col-span-4">
          <WeeklyCard />
        </Reveal>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2 xl:grid-cols-3">
        <Reveal delay={0.05}>
          <TopClientsCard />
        </Reveal>
        <Reveal delay={0.1}>
          <RecentEventsCard />
        </Reveal>
        <Reveal delay={0.15} className="lg:col-span-2 xl:col-span-1">
          <CpaCard />
        </Reveal>
      </div>
    </div>
  );
}

export default function Page() {
  return IS_DEMO ? <DemoPartnerDashboardPage /> : <LivePartnerDashboard />;
}
