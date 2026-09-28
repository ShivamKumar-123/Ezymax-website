"use client";

import * as React from "react";
import Link from "next/link";
import { motion } from "motion/react";
import { ArrowDownToLine, ArrowLeftRight, ArrowUpFromLine, ArrowUpRight, ChevronRight, History, ShieldCheck } from "lucide-react";
import { Button, Card, CardHeader, Chip, CoinIcon, Delta, Icon3D, Money, PageHeader, Reveal, Starfield, cn, formatNumber } from "@kalks/ui";
import { ME, WALLET, WALLET_TXS, accountUsd, type WalletTx } from "@kalks/mock";
import { PENDING_WITHDRAWALS, liveAccounts, walletAvailableUsdt, walletTotalUsd } from "@kalks/mock/wallet-extra";
import { DepositAddressCard, KycBanner, LimitsCard, TxDetailDrawer, TxRow } from "@/components/wallet/wallet-ui";
import { IS_DEMO } from "@kalks/mock/mode";
import { LiveWalletPage } from "@/components/wallet-live/wallet-page";

const COIN_COLOR: Record<string, string> = { usdt: "#26a17b", trx: "#ff5a1f", btc: "#e9b949" };
const NAMES: Record<string, string> = { USDT: "Tether USD", TRX: "TRON", BTC: "Bitcoin" };

function Hero() {
  const total = walletTotalUsd();
  const change = WALLET.assets.reduce((s, a) => s + a.usd * (a.change / 100), 0);
  const pending = PENDING_WITHDRAWALS.reduce((s, w) => s + w.amount + w.fee, 0);
  return (
    <Card hot className="h-full overflow-hidden">
      <Starfield density={70} />
      <div className="relative p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="k-label">Total wallet value</div>
            <div className="mt-3 flex flex-wrap items-baseline gap-3">
              <Money value={total} className="text-[40px] font-semibold leading-none tracking-[-0.02em] sm:text-[48px]" />
              <Chip tone="up">
                +${formatNumber(change)} · 24h
              </Chip>
            </div>
            <div className="mt-2 text-[13px] text-fg-2">
              Available <span className="k-num text-fg">${formatNumber(walletAvailableUsdt())}</span> · In withdrawal <span className="k-num text-fg">${formatNumber(pending)}</span>
            </div>
          </div>
          <Icon3D name="coin" size={72} className="hidden sm:block" />
        </div>

        <div className="mt-6 flex h-2.5 overflow-hidden rounded-full bg-black/30">
          {WALLET.assets.map((a, i) => (
            <motion.div key={a.asset} className="h-full first:rounded-l-full last:rounded-r-full" style={{ background: COIN_COLOR[a.icon] }} initial={{ width: 0 }} animate={{ width: `${(a.usd / total) * 100}%` }} transition={{ duration: 0.9, delay: 0.2 + i * 0.1, ease: [0.16, 1, 0.3, 1] }} />
          ))}
        </div>

        <div className="mt-5 grid grid-cols-1 gap-2 md:grid-cols-3">
          {WALLET.assets.map((a) => (
            <div key={a.asset} className="flex items-center gap-3 rounded-[14px] border border-white/10 bg-black/25 light:border-black/5 light:bg-white/70 px-4 py-3 backdrop-blur-sm">
              <CoinIcon coin={a.icon} size={34} />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5 text-[13.5px] font-medium">
                  {a.asset}
                  <span className="rounded-md bg-white/10 px-1.5 py-px text-[10px] font-medium text-fg-2">{a.network}</span>
                </div>
                <div className="k-num truncate text-[12px] text-fg-3">
                  {formatNumber(a.balance, a.asset === "BTC" ? 4 : 2)} {a.asset}
                </div>
              </div>
              <div className="text-right">
                <Money value={a.usd} className="block text-[14px] font-semibold" />
                {a.change ? <Delta value={a.change} className="text-[11px]" /> : <span className="text-[11px] text-fg-3">{NAMES[a.asset] === "Tether USD" ? "Stable 1:1" : ""}</span>}
              </div>
            </div>
          ))}
        </div>
      </div>
    </Card>
  );
}

function QuickActions() {
  const items = [
    { href: "/wallet/deposit", title: "Deposit", sub: "USDT TRC20 · auto-credit after 20 conf.", icon: <ArrowDownToLine />, art: "money_bag", tone: "ember" },
    { href: "/wallet/withdraw", title: "Withdraw", sub: "To any TRC20 address · $1 fee", icon: <ArrowUpFromLine />, art: "money_with_wings", tone: "neutral", badge: "KYC" },
    { href: "/wallet/transfer", title: "Transfer", sub: "Wallet ↔ trading accounts, instant", icon: <ArrowLeftRight />, art: "dollar_banknote", tone: "neutral" },
  ];
  return (
    <div className="grid h-full grid-cols-1 gap-3 sm:grid-cols-3 xl:grid-cols-1">
      {items.map((it, i) => (
        <Reveal key={it.href} delay={0.05 + i * 0.05}>
          <Link href={it.href} className="k-card group relative flex h-full items-center gap-4 overflow-hidden px-5 py-4 transition-all hover:-translate-y-0.5 hover:border-[var(--k-border-top)]">
            <span className={cn("grid size-11 shrink-0 place-items-center rounded-full border [&_svg]:size-[18px]", it.tone === "ember" ? "k-ember-btn border-transparent" : "border-line bg-surface-2 text-fg-2 group-hover:text-fg")}>{it.icon}</span>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 text-[15px] font-medium">
                {it.title}
                {it.badge && (
                  <Chip size="sm" tone="warn">
                    {it.badge}
                  </Chip>
                )}
              </div>
              <div className="truncate text-[12px] text-fg-3">{it.sub}</div>
            </div>
            <Icon3D name={it.art} size={46} />
          </Link>
        </Reveal>
      ))}
    </div>
  );
}

function FundAccounts() {
  const list = liveAccounts();
  return (
    <Card className="h-full">
      <CardHeader title="Fund a trading account" subtitle="USDT → USD 1:1 · cent accounts receive USC" action={<Link href="/accounts"><Button size="xs" variant="surface">All accounts</Button></Link>} />
      <div className="mt-4 space-y-2 px-4 pb-5 sm:px-6">
        {list.map((a) => (
          <Link key={a.login} href={`/wallet/transfer?to=${a.login}`} className="k-row group flex items-center gap-3 px-4 py-3 transition-colors hover:border-[var(--k-border-top)] hover:bg-surface-3/60">
            <Chip size="sm" tone="ember" className="font-semibold tracking-wider">
              LIVE
            </Chip>
            <div className="min-w-0 flex-1">
              <div className="truncate text-[13.5px] font-medium">
                {a.group} · {a.mode === "hedging" ? "Hedging" : "Netting"} <span className="font-mono text-[12px] text-fg-3">#{a.login}</span>
              </div>
              <div className="k-num text-[11.5px] text-fg-3">
                Balance {a.cent ? "USC " : "$"}
                {formatNumber(a.balance)}
                {a.cent && <> · ≈ ${formatNumber(accountUsd(a, "balance"))}</>}
              </div>
            </div>
            <span className="inline-flex items-center gap-1 text-[12.5px] font-medium text-fg-3 group-hover:text-ember">
              Top up <ChevronRight className="size-4" />
            </span>
          </Link>
        ))}
        <div className="flex items-center gap-3 pt-2 text-[12px] text-fg-3">
          <ShieldCheck className="size-4 text-up" /> Transfers between your wallet and your own accounts are instant and free.
        </div>
      </div>
    </Card>
  );
}

function DemoWalletPage() {
  const [tx, setTx] = React.useState<WalletTx | null>(null);
  return (
    <div className="pb-16">
      <PageHeader
        title="Wallet"
        subtitle={`Your central USDT wallet on TRON · ${ME.firstName}'s HD address`}
        actions={
          <>
            <Link href="/wallet/history">
              <Button variant="surface" size="lg">
                <History /> History
              </Button>
            </Link>
            <Link href="/wallet/deposit">
              <Button variant="ember" size="lg" shimmer>
                <ArrowDownToLine /> Deposit USDT
              </Button>
            </Link>
          </>
        }
      />

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-12">
        <Reveal className="xl:col-span-8">
          <Hero />
        </Reveal>
        <div className="xl:col-span-4">
          <QuickActions />
        </div>
      </div>

      <Reveal delay={0.1} className="mt-4 block">
        <KycBanner compact />
      </Reveal>

      <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-12">
        <Reveal delay={0.1} className="xl:col-span-7">
          <DepositAddressCard />
        </Reveal>
        <Reveal delay={0.15} className="xl:col-span-5">
          <LimitsCard />
        </Reveal>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-12">
        <Reveal delay={0.1} className="xl:col-span-7">
          <Card className="h-full">
            <CardHeader
              title="Recent transactions"
              subtitle={`${WALLET_TXS.length} this quarter`}
              action={
                <Link href="/wallet/history">
                  <Button size="sm" variant="surface">
                    View all <ArrowUpRight />
                  </Button>
                </Link>
              }
            />
            <div className="k-fade-bottom mt-4 space-y-2 px-4 pb-5 sm:px-6">
              {WALLET_TXS.slice(0, 7).map((t) => (
                <TxRow key={t.id} tx={t} onClick={() => setTx(t)} />
              ))}
            </div>
          </Card>
        </Reveal>
        <Reveal delay={0.15} className="xl:col-span-5">
          <FundAccounts />
        </Reveal>
      </div>

      <TxDetailDrawer tx={tx} onOpenChange={(o) => !o && setTx(null)} />
    </div>
  );
}

/** Live builds: the real wallet (services/wallet). Demo builds: the mock showcase above. */
export default function WalletPage() {
  return IS_DEMO ? <DemoWalletPage /> : <LiveWalletPage />;
}
