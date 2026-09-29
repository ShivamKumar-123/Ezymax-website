"use client";

import * as React from "react";
import Link from "next/link";
import { toast } from "sonner";
import { ArrowUpRight, BadgeCheck, CandlestickChart, Check, ChevronRight, Copy, IdCard, Layers, LifeBuoy, Mail, Plus, UserRound, Wallet } from "lucide-react";
import { Button, Card, CardHeader, Chip, MarketSessions, PageHeader, Progress, Reveal, Skeleton, cn, useQuotes } from "@kalks/ui";
import { INSTRUMENTS, isMarketOpen } from "@kalks/mock";
import { KYC_CHIP, useSession, type SessionUser } from "@/components/session";
import { FeedGuard } from "@/components/feed-guard";
import { SUPPORT_EMAIL, TERMINAL_URL } from "@/lib/live";
import { useAccounts, type EngineAccount } from "@/components/trading/api";
import { liveTotals } from "@/components/trading/accounts-page";
import { LiveAccountRow } from "@/components/trading/ui";
import { useWalletFunded, walletStep } from "@/components/wallet-live/onboarding";
import { BannerSlot } from "@/components/growth/banner-slot";
import { LiveCalendarCard, LiveNewsCard, LiveWorldCard } from "@/components/news-live/dashboard";
import { Trans, useFormat, useT } from "@kalks/i18n/react";

function greeting() {
  const h = new Date().getHours();
  return h < 12 ? "morning" : h < 18 ? "afternoon" : "evening";
}

export function clientId(id: number) {
  return `KL-${String(id).padStart(6, "0")}`;
}

type T = ReturnType<typeof useT>;
type F = ReturnType<typeof useFormat>;

function fmtDate(iso: string, f: F) {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "—" : f.date(d);
}

/* ------------------------------------------------------------------ */
/* Getting started: every step is driven by the real client record     */
/* ------------------------------------------------------------------ */

type StepState = "done" | "todo" | "review" | "rejected" | "soon";
type Step = { key: string; icon: React.ReactNode; title: string; text: string; state: StepState; href?: string };

function steps(me: SessionUser, accounts: EngineAccount[] | null, t: T, f: F): Step[] {
  const live = accounts?.filter((a) => a.type === "live").length ?? 0;
  const demo = accounts?.filter((a) => a.type === "demo").length ?? 0;
  const opened = live + demo > 0;
  return baseSteps(me, live, demo, opened, kycStep(me, t), t, f);
}

/** The "Verify your identity" step from the real KYC status (users.kyc_status + the latest case). */
function kycStep(me: SessionUser, t: T): { state: StepState; text: string } {
  if (me.kyc_status === "verified") return { state: "done", text: t("dashboard.steps.kyc.verified") };
  switch (me.kyc_case_status) {
    case "more_info":
      return { state: "todo", text: t("dashboard.steps.kyc.moreInfo") };
    case "submitted":
    case "in_review":
      return { state: "review", text: t("dashboard.steps.kyc.review") };
    case "draft":
      return { state: "todo", text: t("dashboard.steps.kyc.draft") };
    case "rejected":
      return { state: "rejected", text: t("dashboard.steps.kyc.rejected") };
  }
  if (me.kyc_status === "pending") return { state: "review", text: t("dashboard.steps.kyc.review") };
  if (me.kyc_status === "rejected") return { state: "rejected", text: t("dashboard.steps.kyc.rejected") };
  return { state: "todo", text: t("dashboard.steps.kyc.todo") };
}

function baseSteps(me: SessionUser, live: number, demo: number, opened: boolean, kyc: { state: StepState; text: string }, t: T, f: F): Step[] {
  return [
    { key: "account", icon: <UserRound />, title: t("dashboard.steps.account.title"), text: t("dashboard.steps.account.text", { date: fmtDate(me.created_at, f) }), state: "done" },
    {
      key: "email",
      icon: <Mail />,
      title: t("dashboard.steps.email.title"),
      text: me.email_verified ? t("dashboard.steps.email.verified", { email: me.email }) : t("dashboard.steps.email.confirm", { email: me.email }),
      state: me.email_verified ? "done" : "todo",
    },
    { key: "kyc", icon: <IdCard />, title: t("dashboard.steps.kyc.title"), ...kyc, href: "/profile/verification" },
    {
      key: "account-open",
      icon: <Layers />,
      title: t("dashboard.steps.accountOpen.title"),
      text: opened ? t("dashboard.steps.accountOpen.opened", { live, demo, count: live + demo }) : t("dashboard.steps.accountOpen.todo"),
      state: opened ? "done" : "todo",
      href: opened ? "/accounts" : "/accounts/new",
    },
    { key: "wallet", icon: <Wallet />, title: t("dashboard.steps.wallet.title"), text: t("dashboard.steps.wallet.text"), state: "soon", href: "/wallet" },
  ];
}

const STATE_CHIP: Record<StepState, { tone: "up" | "warn" | "down" | "neutral" | "ember"; label: string }> = {
  done: { tone: "up", label: "Done" },
  todo: { tone: "ember", label: "To do" },
  review: { tone: "warn", label: "In review" },
  rejected: { tone: "down", label: "Rejected" },
  soon: { tone: "neutral", label: "Not started" },
};

function StepRow({ s, n }: { s: Step; n: number }) {
  const t = useT();
  const chip = STATE_CHIP[s.state];
  const done = s.state === "done";
  const body = (
    <>
      <span className={cn("grid size-9 shrink-0 place-items-center rounded-full border [&_svg]:size-4", done ? "border-up/30 bg-up-soft text-up" : "border-line bg-surface-3 text-fg-2")}>
        {done ? <Check /> : s.icon}
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 text-[13.5px] font-medium">
          <span className="k-num text-fg-3">{n}.</span>
          <span className={cn(done && "text-fg-2")}>{s.title}</span>
        </div>
        <div className="mt-0.5 truncate text-[12px] text-fg-3">{s.text}</div>
      </div>
      <Chip size="sm" tone={chip.tone} dot={!done}>
        {t.dyn(`dashboard.steps.state.${s.state}`, chip.label)}
      </Chip>
      {s.href && <ChevronRight className="size-4 shrink-0 text-fg-3 rtl:-scale-x-100" />}
    </>
  );
  return s.href ? (
    <Link href={s.href} className="k-row flex items-center gap-3 px-4 py-3 transition-colors hover:border-[var(--k-border-top)]">
      {body}
    </Link>
  ) : (
    <div className="k-row flex items-center gap-3 px-4 py-3">{body}</div>
  );
}

function GettingStarted({ accounts }: { accounts: EngineAccount[] | null }) {
  const me = useSession();
  const t = useT();
  const f = useFormat();
  const wallet = useWalletFunded();
  const list = steps(me, accounts, t, f).map((s) => (s.key === "wallet" ? walletStep(wallet) : s));
  const done = list.filter((s) => s.state === "done").length;
  return (
    <Card className="flex h-full flex-col">
      <CardHeader
        title={t("dashboard.steps.title")}
        subtitle={t("dashboard.steps.subtitle")}
        action={
          <div className="w-32">
            <div className="mb-1 flex justify-between text-[11px] text-fg-3">
              <span>{t("dashboard.steps.progress", { done, total: list.length })}</span>
              <span className="k-num">{Math.round((done / list.length) * 100)}%</span>
            </div>
            <Progress value={(done / list.length) * 100} />
          </div>
        }
      />
      <div className="mt-4 flex-1 space-y-2 px-4 pb-5 sm:px-6">
        {list.map((s, i) => (
          <StepRow key={s.key} s={s} n={i + 1} />
        ))}
      </div>
    </Card>
  );
}

/* ------------------------------------------------------------------ */
/* Trading accounts: real accounts from the trading engine             */
/* ------------------------------------------------------------------ */

function TradingAccountsCard({ accounts, failed, reload }: { accounts: EngineAccount[] | null; failed: boolean; reload: () => void }) {
  const tr = useT();
  const t = liveTotals(accounts ?? []);
  const shown = [...t.live, ...t.demo].slice(0, 3);
  const more = (accounts?.length ?? 0) - shown.length;
  return (
    <Card>
      <CardHeader
        title={tr("dashboard.accounts.title")}
        subtitle={
          accounts && accounts.length > 0 ? (
            <span>
              <Trans
                k="dashboard.accounts.summary"
                vars={{ equity: `$${t.equity.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, live: t.live.length, demo: t.demo.length, positions: t.positions }}
                tags={{ b: (c) => <span className="k-num font-medium text-fg" dir="ltr">{c}</span> }}
              />
            </span>
          ) : (
            tr("dashboard.accounts.subtitle")
          )
        }
        action={
          <>
            {accounts && accounts.length > 0 && (
              <Link href="/accounts" className="hidden sm:block">
                <Button size="sm" variant="surface">
                  {tr("dashboard.accounts.all")}
                </Button>
              </Link>
            )}
            <Link href="/accounts/new">
              <Button size="sm" variant="ember">
                <Plus /> {tr("dashboard.accounts.open")}
              </Button>
            </Link>
          </>
        }
      />
      <div className="mt-4 space-y-3 px-4 pb-5 sm:px-6">
        {accounts === null && !failed && <Skeleton className="h-[138px] w-full rounded-[18px]" />}
        {accounts === null && failed && (
          <div className="k-row flex flex-wrap items-center gap-3 px-4 py-4 text-[13px] text-fg-2">
            <span className="flex-1">{tr("dashboard.accounts.unavailable")}</span>
            <Button size="sm" variant="surface" onClick={reload}>
              {tr("common.retry")}
            </Button>
          </div>
        )}
        {accounts && accounts.length === 0 && (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {[
              { type: "live", title: tr("dashboard.accounts.openLive.title"), text: tr("dashboard.accounts.openLive.text") },
              { type: "demo", title: tr("dashboard.accounts.openDemo.title"), text: tr("dashboard.accounts.openDemo.text") },
            ].map((o) => (
              <Link key={o.type} href={`/accounts/new?type=${o.type}`} className="k-row flex items-start gap-3 p-4 transition-colors hover:border-[var(--k-border-top)]">
                <Chip size="sm" tone={o.type === "live" ? "ember" : "gold"} className="font-semibold tracking-wider">
                  {tr(o.type === "live" ? "common.live" : "common.demo").toUpperCase()}
                </Chip>
                <span className="min-w-0 flex-1">
                  <span className="block text-[14px] font-medium">{o.title}</span>
                  <span className="mt-0.5 block text-[12.5px] text-fg-3">{o.text}</span>
                </span>
                <ChevronRight className="mt-0.5 size-4 shrink-0 text-fg-3 rtl:-scale-x-100" />
              </Link>
            ))}
          </div>
        )}
        {shown.map((a) => (
          <LiveAccountRow key={a.login} a={a} compact onChanged={reload} />
        ))}
        {more > 0 && (
          <Link href="/accounts" className="block text-center text-[12.5px] text-fg-3 hover:text-ember">
            {tr("dashboard.accounts.more", { count: more })}
          </Link>
        )}
      </div>
    </Card>
  );
}

/* ------------------------------------------------------------------ */

function AccountCard() {
  const me = useSession();
  const t = useT();
  const f = useFormat();
  const kyc = KYC_CHIP[me.kyc_status];
  const rows: [string, React.ReactNode][] = [
    [t("dashboard.account.clientId"), <span key="id" className="font-mono" dir="ltr">{clientId(me.id)}</span>],
    [t("common.email"), <span key="e" className="truncate">{me.email}</span>],
    [t("dashboard.account.emailStatus"), me.email_verified ? <Chip key="ev" size="sm" tone="up">{t("common.verified")}</Chip> : <Chip key="ev" size="sm" tone="warn">{t("dashboard.account.notVerified")}</Chip>],
    [t("dashboard.account.identity"), <Chip key="k" size="sm" tone={kyc.tone} dot>{kyc.label}</Chip>],
    [t("dashboard.account.memberSince"), <span key="m" className="k-num">{fmtDate(me.created_at, f)}</span>],
  ];
  return (
    <Card>
      <CardHeader
        title={t("dashboard.account.title")}
        action={
          <Link href="/profile">
            <Button size="sm" variant="surface">
              {t("dashboard.account.profile")}
            </Button>
          </Link>
        }
      />
      <div className="mt-1 divide-y divide-line px-6 pb-3">
        {rows.map(([k, v]) => (
          <div key={k} className="flex items-center justify-between gap-4 py-2.5 text-[13px]">
            <span className="shrink-0 text-fg-3">{k}</span>
            <span className="min-w-0 truncate text-end text-fg">{v}</span>
          </div>
        ))}
      </div>
    </Card>
  );
}

/* ------------------------------------------------------------------ */

function TraderBanner() {
  const t = useT();
  return (
    <Card className="relative overflow-hidden">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/assets/photos/trading-screen.jpg" alt="" className="absolute inset-0 size-full object-cover opacity-35" />
      <div className="absolute inset-0 bg-gradient-to-r from-bg via-bg/85 to-bg/20" />
      <div className="relative flex flex-col gap-5 p-7 md:flex-row md:items-center md:justify-between">
        <div className="max-w-xl">
          <Chip tone="ember" className="mb-3">
            <CandlestickChart className="size-3.5" /> {t("dashboard.trader.chip")}
          </Chip>
          <h3 className="text-2xl font-medium tracking-tight">Kalks Trader</h3>
          <p className="mt-2 text-sm text-fg-2">{t("dashboard.trader.text", { count: INSTRUMENTS.length })}</p>
        </div>
        <a href={TERMINAL_URL} target="_blank" rel="noopener" className="shrink-0">
          <Button variant="ember" size="lg">
            {t("dashboard.launchTrader")} <ArrowUpRight />
          </Button>
        </a>
      </div>
    </Card>
  );
}

function SessionsCard() {
  const t = useT();
  const open = INSTRUMENTS.filter((i) => isMarketOpen(i.symbol)).length;
  return (
    <Card>
      <CardHeader title={t("dashboard.sessions.title")} action={<Chip size="sm">{t("dashboard.sessions.open", { open, total: INSTRUMENTS.length })}</Chip>} />
      <div className="px-6 pb-6 pt-4">
        <MarketSessions />
      </div>
    </Card>
  );
}

function HeatmapCard() {
  const t = useT();
  const qs = useQuotes(INSTRUMENTS.map((i) => i.symbol));
  const sorted = [...INSTRUMENTS].sort((a, b) => (qs[b.symbol]?.change ?? 0) - (qs[a.symbol]?.change ?? 0));
  const up = INSTRUMENTS.filter((i) => (qs[i.symbol]?.change ?? 0) >= 0).length;
  return (
    <Card className="flex h-full flex-col">
      <CardHeader
        title={t("dashboard.heatmap.title")}
        subtitle={t("dashboard.heatmap.subtitle")}
        action={
          <>
            <Chip tone="up" className="hidden sm:inline-flex">
              {t("dashboard.heatmap.up", { count: up })}
            </Chip>
            <Chip tone="down" className="hidden sm:inline-flex">
              {t("dashboard.heatmap.down", { count: INSTRUMENTS.length - up })}
            </Chip>
            <Link href="/markets">
              <Button size="sm" variant="surface">
                {t("dashboard.heatmap.allMarkets")}
              </Button>
            </Link>
          </>
        }
      />
      <div className="grid grid-cols-3 content-start gap-2 px-4 pb-5 pt-4 sm:grid-cols-5 sm:px-6 md:grid-cols-6 lg:grid-cols-9 xl:grid-cols-5 2xl:grid-cols-6">
        {sorted.map((i) => {
          const ch = qs[i.symbol]?.change ?? 0;
          const a = Math.min(1, Math.abs(ch) / 3);
          const open = isMarketOpen(i.symbol);
          return (
            <Link
              key={i.symbol}
              href="/markets"
              title={open ? t("dashboard.heatmap.tipOpen", { symbol: i.symbol }) : t("dashboard.heatmap.tipClosed", { symbol: i.symbol })}
              className="rounded-[14px] border border-line px-3 py-2.5 transition-colors hover:border-[var(--k-border-top)]"
              style={{ background: `color-mix(in oklab, ${ch >= 0 ? "var(--k-up)" : "var(--k-down)"} ${Math.round(8 + a * 52)}%, var(--k-surface-2))` }}
            >
              <div className="flex items-center gap-1.5">
                <span className="truncate text-[12.5px] font-semibold text-fg">{i.symbol}</span>
                <span className={cn("size-1.5 shrink-0 rounded-full", open ? "bg-up" : "border border-fg-3")} />
              </div>
              <div className={cn("k-num mt-0.5 text-[12px] font-medium", a > 0.55 ? "text-fg" : ch >= 0 ? "text-up" : "text-down")}>
                <span dir="ltr">
                  {ch >= 0 ? "+" : ""}
                  {ch.toFixed(2)}%
                </span>
              </div>
            </Link>
          );
        })}
      </div>
    </Card>
  );
}

function SupportCard() {
  const t = useT();
  const copy = () => {
    navigator.clipboard?.writeText(SUPPORT_EMAIL).then(
      () => toast.success(t("dashboard.support.copied")),
      () => toast.error(t("dashboard.support.copyFailed")),
    );
  };
  return (
    <Card className="flex flex-col gap-4 px-6 py-5 md:flex-row md:items-center">
      <span className="grid size-11 shrink-0 place-items-center rounded-full border border-ember/30 bg-ember-soft text-ember">
        <LifeBuoy className="size-[18px]" />
      </span>
      <div className="min-w-0 flex-1">
        <div className="text-[15px] font-medium">{t("dashboard.support.title")}</div>
        <div className="mt-0.5 text-[13px] text-fg-2">
          <Trans k="dashboard.support.text" vars={{ email: SUPPORT_EMAIL }} tags={{ mail: (c) => <span className="font-mono text-fg" dir="ltr">{c}</span> }} />
        </div>
      </div>
      <div className="flex gap-2">
        <Button size="sm" variant="surface" onClick={copy}>
          <Copy /> {t("common.copy")}
        </Button>
        <a href={`mailto:${SUPPORT_EMAIL}`}>
          <Button size="sm" variant="ember">
            <Mail /> {t("dashboard.support.emailSupport")}
          </Button>
        </a>
      </div>
    </Card>
  );
}

/* ------------------------------------------------------------------ */

/** Live builds: only data that is real for this client — their record, live prices, real links. */
export function LiveDashboard({ movers }: { movers: React.ReactNode }) {
  const me = useSession();
  const t = useT();
  const acc = useAccounts(10000);
  const accounts = acc.data?.accounts ?? null;
  const [hour, setHour] = React.useState<string>("welcome");
  React.useEffect(() => setHour(greeting()), []);
  const verified = me.kyc_status === "verified";
  return (
    <div className="pb-16">
      <PageHeader
        title={t.dyn(`dashboard.greeting.${hour}`, undefined, { name: me.first_name })}
        subtitle={
          <span className="inline-flex flex-wrap items-center gap-2">
            {t("dashboard.subtitle.live")}
            {verified && (
              <Chip size="sm" tone="up">
                <BadgeCheck className="size-3.5" /> {t("common.verified")}
              </Chip>
            )}
          </span>
        }
        actions={
          <a href={TERMINAL_URL} target="_blank" rel="noopener">
            <Button variant="ember" size="lg">
              {t("dashboard.launchTrader")} <ArrowUpRight />
            </Button>
          </a>
        }
      />

      <BannerSlot placement="dashboard" />
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-12">
        <Reveal className="xl:col-span-8">
          <GettingStarted accounts={accounts} />
        </Reveal>
        <div className="flex flex-col gap-4 xl:col-span-4">
          <Reveal delay={0.05}>
            <AccountCard />
          </Reveal>
          <Reveal delay={0.1}>
            <SessionsCard />
          </Reveal>
        </div>
      </div>

      <Reveal delay={0.05} className="mt-4 block">
        <TradingAccountsCard accounts={accounts} failed={!!acc.error} reload={acc.reload} />
      </Reveal>

      <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-12">
        <Reveal delay={0.05} className="xl:col-span-4">
          <FeedGuard title={t("dashboard.movers.title")} minHeight={320}>
            {movers}
          </FeedGuard>
        </Reveal>
        <Reveal delay={0.1} className="xl:col-span-8">
          <FeedGuard title={t("dashboard.heatmap.title")} minHeight={320}>
            <HeatmapCard />
          </FeedGuard>
        </Reveal>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2 xl:grid-cols-3">
        <Reveal delay={0.05}>
          <LiveCalendarCard />
        </Reveal>
        <Reveal delay={0.1}>
          <LiveNewsCard />
        </Reveal>
        <Reveal delay={0.15} className="lg:col-span-2 xl:col-span-1">
          <LiveWorldCard />
        </Reveal>
      </div>

      <Reveal delay={0.05} className="mt-4 block">
        <TraderBanner />
      </Reveal>

      <Reveal delay={0.05} className="mt-4 block">
        <SupportCard />
      </Reveal>
    </div>
  );
}
