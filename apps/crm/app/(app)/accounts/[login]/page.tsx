"use client";

import * as React from "react";
import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import { ArrowDownToLine, ArrowLeft, ArrowUpFromLine, CandlestickChart, RefreshCcw, Server } from "lucide-react";
import { toast } from "sonner";
import { Button, Card, Chip, CopyButton, EmptyState, Money, Starfield, Tabs, cn, formatNumber, useQuotes } from "@/components/kit";
import { freeMargin, marginLevel, positionProfit } from "@ezymex/mock";
import { accountPositions, accountTrades, findAccount, isArchived } from "@ezymex/mock/accounts-extra";
import { AccountBadge, AccountMenu, accountTitle } from "@/components/account-row";
import { OverviewTab, PortfolioTab, curOf, multOf } from "@/components/accounts/detail-overview";
import { ChargesTab, HistoryTab, LedgerTab, PositionsTab } from "@/components/accounts/detail-activity";
import { CredentialsTab, SettingsTab } from "@/components/accounts/detail-manage";
import { IS_DEMO as DEMO_BUILD } from "@ezymex/mock/mode";
import { LiveAccountDetail } from "@/components/trading/account-detail";
import { useT } from "@ezymex/i18n/react";
import { TERMINAL_URL } from "@/lib/live";

const TAB_KEYS = ["overview", "portfolio", "positions", "history", "charges", "ledger", "credentials", "settings"] as const;
type TabKey = (typeof TAB_KEYS)[number];

function Detail() {
  const { login } = useParams<{ login: string }>();
  const sp = useSearchParams();
  const router = useRouter();
  const t = useT();
  const base = findAccount(login);
  const initial = (TAB_KEYS as readonly string[]).includes(sp.get("tab") ?? "") ? (sp.get("tab") as TabKey) : "overview";
  const [tab, setTabState] = React.useState<TabKey>(initial);
  const [closed, setClosed] = React.useState<string[]>([]);
  const [nickname, setNickname] = React.useState(base?.nickname);
  const positions = React.useMemo(() => (base ? accountPositions(base.login).filter((p) => !closed.includes(p.ticket)) : []), [base, closed]);
  const trades = React.useMemo(() => (base ? accountTrades(base.login) : []), [base]);
  const qs = useQuotes(positions.length ? positions.map((p) => p.symbol) : ["EURUSD"]);

  const setTab = (k: string) => {
    setTabState(k as TabKey);
    router.replace(`/accounts/${login}${k === "overview" ? "" : `?tab=${k}`}`, { scroll: false });
  };

  if (!base)
    return (
      <div className="pb-16">
        <Card className="mt-10">
          <EmptyState
            illustration="magnifying_glass_tilted_left"
            title={t("accountDetail.notFound.title", { login })}
            text={t("accountDetail.notFound.textDeleted")}
            action={
              <div className="flex gap-2">
                <Link href="/accounts">
                  <Button variant="surface">
                    <ArrowLeft className="rtl:-scale-x-100" /> {t("accountDetail.notFound.myAccounts")}
                  </Button>
                </Link>
                <Link href="/accounts/new">
                  <Button variant="ember">{t("accountDetail.notFound.openAccount")}</Button>
                </Link>
              </div>
            }
          />
        </Card>
      </div>
    );

  const a = { ...base, nickname };
  const mult = multOf(a);
  const cur = curOf(a);
  const openPnl = positions.reduce((s, p) => s + positionProfit(p, qs[p.symbol]!.bid, qs[p.symbol]!.ask), 0) * mult;
  const archived = isArchived(a.login);
  const ml = marginLevel(a);
  const dayChange = a.equity * (a.type === "demo" ? 0.0112 : 0.0252);

  return (
    <div className="pb-16">
      <div className="mb-4 flex items-center gap-2 text-[13px] text-fg-3">
        <Link href="/accounts" className="inline-flex items-center gap-1.5 hover:text-fg">
          <ArrowLeft className="size-3.5 rtl:-scale-x-100" /> {t("accountDetail.breadcrumb.accounts")}
        </Link>
        <span>/</span>
        <span className="font-mono text-fg-2">#{a.login}</span>
      </div>

      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}>
        <Card hot={a.type === "live" && !archived} className="overflow-hidden">
          {a.type === "live" && !archived && <Starfield density={50} />}
          <div className="relative flex flex-col gap-6 p-6 lg:flex-row lg:items-end lg:justify-between">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <AccountBadge a={a} />
                <h1 className="text-[20px] font-medium tracking-tight">{accountTitle(a)}</h1>
                {a.nickname && <span className="text-[14px] text-fg-3">“{a.nickname}”</span>}
                {a.swapFree && (
                  <Chip size="sm" tone="info">
                    {t("accountDetail.header.swapFree")}
                  </Chip>
                )}
                {archived && <Chip size="sm">{t("accountDetail.header.archived")}</Chip>}
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[13px] text-fg-2">
                <span className="inline-flex items-center gap-1 font-mono">
                  #{a.login}
                  <CopyButton value={a.login} label={t("accountDetail.info.login")} />
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <Server className="size-3.5 text-fg-3" />
                  <span className="font-mono">{a.server}</span>
                </span>
                <Chip size="sm">1:{a.leverage.toLocaleString()}</Chip>
                <span className="text-fg-3">{a.currency}</span>
              </div>
              <div className="mt-5 k-label">{t("common.equity")}</div>
              <div className="mt-1 flex flex-wrap items-baseline gap-3">
                <Money value={a.equity} currency={cur} className="text-[40px] font-semibold leading-none tracking-[-0.02em] sm:text-[48px]" />
                {!archived && (
                  <Chip tone="up">
                    {t("accountDetail.header.today", { amount: `+${cur}${formatNumber(dayChange)}` })}
                  </Chip>
                )}
              </div>
              <div className="mt-4 flex flex-wrap gap-x-6 gap-y-2 text-[13px]">
                <span className="text-fg-3">
                  {t("common.balance")} <Money value={a.balance} currency={cur} countUp={false} className="ms-1 font-medium text-fg" />
                </span>
                <span className="text-fg-3">
                  {t("accountDetail.stat.freeMargin")} <Money value={freeMargin(a)} currency={cur} countUp={false} className="ms-1 font-medium text-fg" />
                </span>
                <span className="text-fg-3">
                  {t("accountDetail.stat.marginLevel")} <span className={cn("k-num ms-1 font-medium", ml > 500 ? "text-up" : ml > 200 ? "text-warn" : "text-down")}>{Number.isFinite(ml) ? `${Math.round(ml).toLocaleString()}%` : "—"}</span>
                </span>
                <span className="text-fg-3">
                  {t("accountDetail.stat.openPnl")} <span className={cn("k-num ms-1 font-medium", openPnl >= 0 ? "text-up" : "text-down")}>{openPnl >= 0 ? "+" : "-"}{cur}{formatNumber(Math.abs(openPnl))}</span>
                </span>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {!archived && <AccountMenu a={a} />}
              {a.type === "live" ? (
                <>
                  <Link href={`/wallet/withdraw?from=${a.login}`}>
                    <Button variant="surface" disabled={archived}>
                      <ArrowUpFromLine /> {t("common.withdraw")}
                    </Button>
                  </Link>
                  <Link href={`/wallet/transfer?to=${a.login}`}>
                    <Button variant="surface" disabled={archived}>
                      <ArrowDownToLine /> {t("common.deposit")}
                    </Button>
                  </Link>
                </>
              ) : (
                <Button variant="surface" disabled={archived} onClick={() => setTab("settings")}>
                  <RefreshCcw /> {t("accountDetail.header.refill")}
                </Button>
              )}
              <Link target="_blank" rel="noopener" href={`${TERMINAL_URL}/?account=${a.login}`}>
                <Button variant="ember" size="lg" shimmer disabled={archived} onClick={() => archived && toast(t("accountDetail.toast.archived"))}>
                  <CandlestickChart /> {t("accountDetail.header.trade")}
                </Button>
              </Link>
            </div>
          </div>
        </Card>
      </motion.div>

      <div className="-mx-4 mt-6 overflow-x-auto px-4 sm:mx-0 sm:px-0">
        <Tabs
          className="min-w-max"
          value={tab}
          onChange={setTab}
          tabs={[
            { value: "overview", label: t("accountDetail.tab.overview") },
            { value: "portfolio", label: t("accountDetail.tab.portfolio") },
            { value: "positions", label: t("accountDetail.tab.positions"), count: positions.length },
            { value: "history", label: t("accountDetail.tab.history"), count: trades.length },
            { value: "charges", label: t("accountDetail.tab.charges") },
            { value: "ledger", label: t("accountDetail.tab.ledger") },
            { value: "credentials", label: t("accountDetail.tab.credentials") },
            { value: "settings", label: t("accountDetail.tab.settings") },
          ]}
        />
      </div>

      <div className="mt-5">
        <AnimatePresence mode="wait">
          <motion.div key={tab} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.22 }}>
            {tab === "overview" && <OverviewTab a={a} openPnl={openPnl} trades={trades} onTab={setTab} />}
            {tab === "portfolio" && <PortfolioTab a={a} trades={trades} />}
            {tab === "positions" && <PositionsTab a={a} positions={positions} onClose={(t) => setClosed((c) => [...c, ...t])} />}
            {tab === "history" && <HistoryTab a={a} trades={trades} />}
            {tab === "charges" && <ChargesTab a={a} trades={trades} />}
            {tab === "ledger" && <LedgerTab a={a} />}
            {tab === "credentials" && <CredentialsTab a={a} />}
            {tab === "settings" && <SettingsTab a={a} openPositions={positions.length} onRename={(n) => setNickname(n || undefined)} />}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}

function DemoAccountDetailPage() {
  return (
    <React.Suspense fallback={null}>
      <Detail />
    </React.Suspense>
  );
}

/** Live builds: real accounts from the trading engine (via /api/trading). Demo builds: mock data. */
export default function AccountDetailPage() {
  return DEMO_BUILD ? <DemoAccountDetailPage /> : <LiveAccountDetail />;
}
