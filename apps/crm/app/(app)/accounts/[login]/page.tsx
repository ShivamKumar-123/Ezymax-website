"use client";

import * as React from "react";
import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import { ArrowDownToLine, ArrowLeft, ArrowUpFromLine, CandlestickChart, RefreshCcw, Server } from "lucide-react";
import { toast } from "sonner";
import { Button, Card, Chip, CopyButton, EmptyState, Money, Starfield, Tabs, cn, formatNumber, useQuotes } from "@kalks/ui";
import { freeMargin, marginLevel, positionProfit } from "@kalks/mock";
import { accountPositions, accountTrades, findAccount, isArchived } from "@kalks/mock/accounts-extra";
import { AccountBadge, AccountMenu, accountTitle } from "@/components/account-row";
import { OverviewTab, PortfolioTab, curOf, multOf } from "@/components/accounts/detail-overview";
import { ChargesTab, HistoryTab, LedgerTab, PositionsTab } from "@/components/accounts/detail-activity";
import { CredentialsTab, SettingsTab } from "@/components/accounts/detail-manage";

const TAB_KEYS = ["overview", "portfolio", "positions", "history", "charges", "ledger", "credentials", "settings"] as const;
type TabKey = (typeof TAB_KEYS)[number];

function Detail() {
  const { login } = useParams<{ login: string }>();
  const sp = useSearchParams();
  const router = useRouter();
  const base = findAccount(login);
  const initial = (TAB_KEYS as readonly string[]).includes(sp.get("tab") ?? "") ? (sp.get("tab") as TabKey) : "overview";
  const [tab, setTabState] = React.useState<TabKey>(initial);
  const [closed, setClosed] = React.useState<string[]>([]);
  const [nickname, setNickname] = React.useState(base?.nickname);
  const positions = React.useMemo(() => (base ? accountPositions(base.login).filter((p) => !closed.includes(p.ticket)) : []), [base, closed]);
  const trades = React.useMemo(() => (base ? accountTrades(base.login) : []), [base]);
  const qs = useQuotes(positions.length ? positions.map((p) => p.symbol) : ["EURUSD"]);

  const setTab = (t: string) => {
    setTabState(t as TabKey);
    router.replace(`/accounts/${login}${t === "overview" ? "" : `?tab=${t}`}`, { scroll: false });
  };

  if (!base)
    return (
      <div className="pb-16">
        <Card className="mt-10">
          <EmptyState
            illustration="magnifying_glass_tilted_left"
            title={`Account #${login} not found`}
            text="It may belong to another profile, or it was deleted. Check the login number and try again."
            action={
              <div className="flex gap-2">
                <Link href="/accounts">
                  <Button variant="surface">
                    <ArrowLeft /> My accounts
                  </Button>
                </Link>
                <Link href="/accounts/new">
                  <Button variant="ember">Open account</Button>
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
          <ArrowLeft className="size-3.5" /> Accounts
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
                    Swap-free
                  </Chip>
                )}
                {archived && <Chip size="sm">Archived</Chip>}
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[13px] text-fg-2">
                <span className="inline-flex items-center gap-1 font-mono">
                  #{a.login}
                  <CopyButton value={a.login} label="Login" />
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <Server className="size-3.5 text-fg-3" />
                  <span className="font-mono">{a.server}</span>
                </span>
                <Chip size="sm">1:{a.leverage.toLocaleString()}</Chip>
                <span className="text-fg-3">{a.currency}</span>
              </div>
              <div className="mt-5 k-label">Equity</div>
              <div className="mt-1 flex flex-wrap items-baseline gap-3">
                <Money value={a.equity} currency={cur} className="text-[40px] font-semibold leading-none tracking-[-0.02em] sm:text-[48px]" />
                {!archived && (
                  <Chip tone="up">
                    +{cur}
                    {formatNumber(dayChange)} today
                  </Chip>
                )}
              </div>
              <div className="mt-4 flex flex-wrap gap-x-6 gap-y-2 text-[13px]">
                <span className="text-fg-3">
                  Balance <Money value={a.balance} currency={cur} countUp={false} className="ml-1 font-medium text-fg" />
                </span>
                <span className="text-fg-3">
                  Free margin <Money value={freeMargin(a)} currency={cur} countUp={false} className="ml-1 font-medium text-fg" />
                </span>
                <span className="text-fg-3">
                  Margin level <span className={cn("k-num ml-1 font-medium", ml > 500 ? "text-up" : ml > 200 ? "text-warn" : "text-down")}>{Number.isFinite(ml) ? `${Math.round(ml).toLocaleString()}%` : "—"}</span>
                </span>
                <span className="text-fg-3">
                  Open P&L <span className={cn("k-num ml-1 font-medium", openPnl >= 0 ? "text-up" : "text-down")}>{openPnl >= 0 ? "+" : "-"}{cur}{formatNumber(Math.abs(openPnl))}</span>
                </span>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {!archived && <AccountMenu a={a} />}
              {a.type === "live" ? (
                <>
                  <Link href={`/wallet/withdraw?from=${a.login}`}>
                    <Button variant="surface" disabled={archived}>
                      <ArrowUpFromLine /> Withdraw
                    </Button>
                  </Link>
                  <Link href={`/wallet/transfer?to=${a.login}`}>
                    <Button variant="surface" disabled={archived}>
                      <ArrowDownToLine /> Deposit
                    </Button>
                  </Link>
                </>
              ) : (
                <Button variant="surface" disabled={archived} onClick={() => setTab("settings")}>
                  <RefreshCcw /> Refill
                </Button>
              )}
              <Link target="_blank" rel="noopener" href={`/trade?account=${a.login}`}>
                <Button variant="ember" size="lg" shimmer disabled={archived} onClick={() => archived && toast("This account is archived")}>
                  <CandlestickChart /> Trade
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
            { value: "overview", label: "Overview" },
            { value: "portfolio", label: "Portfolio" },
            { value: "positions", label: "Positions", count: positions.length },
            { value: "history", label: "History", count: trades.length },
            { value: "charges", label: "Charges" },
            { value: "ledger", label: "Ledger" },
            { value: "credentials", label: "Credentials" },
            { value: "settings", label: "Settings" },
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

export default function AccountDetailPage() {
  return (
    <React.Suspense fallback={null}>
      <Detail />
    </React.Suspense>
  );
}
