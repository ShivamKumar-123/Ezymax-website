"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowDownToLine, ArrowLeftRight, ArrowUpFromLine, ArrowUpRight, Bell, ChevronRight, History, Lock } from "lucide-react";
import { Button, Card, CardHeader, Chip, EmptyState, PageHeader, Skeleton, formatDateTime } from "@kalks/ui";
import { useSession } from "@/components/session";
import { toUsd, useAccounts } from "@/components/trading/api";
import { CHAIN_LABEL, fmt, usdtAvailable, useWallet, walletApi, type ActivityItem, type Notification, type Overview, type Page } from "./api";
import { ActivityRow, Confirmations, DEPOSIT_STATUS, HashLink, KycNotice, StatusTag, WITHDRAWAL_STATUS, WalletUnavailable } from "./ui";

function BalanceCard({ o, loading }: { o: Overview | null; loading: boolean }) {
  const b = usdtAvailable(o);
  const total = Number(b.available) + Number(b.locked);
  return (
    <Card className="h-full">
      <div className="p-6">
        <div className="k-label">Wallet balance</div>
        <div className="mt-3 flex flex-wrap items-baseline gap-2">
          {loading ? (
            <Skeleton className="h-11 w-48" />
          ) : (
            <span className="k-num text-[40px] font-semibold leading-none tracking-[-0.02em]">
              {fmt(b.available)} <span className="text-[18px] font-medium text-fg-3">USDT</span>
            </span>
          )}
        </div>
        <div className="mt-2 text-[13px] text-fg-2">Available to transfer or withdraw · USDT is credited 1:1 in USD</div>
        <div className="mt-6 grid grid-cols-2 gap-2 sm:grid-cols-3">
          <div className="k-row px-4 py-3">
            <div className="text-[11px] uppercase tracking-wider text-fg-3">Available</div>
            <div className="k-num mt-1 text-[16px] font-semibold">{fmt(b.available)}</div>
          </div>
          <div className="k-row px-4 py-3">
            <div className="flex items-center gap-1 text-[11px] uppercase tracking-wider text-fg-3">
              <Lock className="size-3" /> In progress
            </div>
            <div className="k-num mt-1 text-[16px] font-semibold">{fmt(b.locked)}</div>
          </div>
          <div className="k-row col-span-2 px-4 py-3 sm:col-span-1">
            <div className="text-[11px] uppercase tracking-wider text-fg-3">Total</div>
            <div className="k-num mt-1 text-[16px] font-semibold">{fmt(total)}</div>
          </div>
        </div>
      </div>
    </Card>
  );
}

function QuickActions({ kyc }: { kyc: string }) {
  const items = [
    { href: "/wallet/deposit", title: "Deposit", sub: "USDT on BNB Chain or TRON", icon: <ArrowDownToLine />, primary: true },
    { href: "/wallet/withdraw", title: "Withdraw", sub: kyc === "verified" ? "To your own USDT address" : "Needs identity verification", icon: <ArrowUpFromLine /> },
    { href: "/wallet/transfer", title: "Transfer", sub: "Wallet ↔ your trading accounts", icon: <ArrowLeftRight /> },
  ];
  return (
    <div className="grid h-full grid-cols-1 gap-3 sm:grid-cols-3 xl:grid-cols-1">
      {items.map((it) => (
        <Link key={it.href} href={it.href} className="k-card group flex h-full items-center gap-4 px-5 py-4 transition-colors hover:border-[var(--k-border-top)]">
          <span className={it.primary ? "k-ember-btn grid size-11 shrink-0 place-items-center rounded-full [&_svg]:size-[18px]" : "grid size-11 shrink-0 place-items-center rounded-full border border-line bg-surface-2 text-fg-2 group-hover:text-fg [&_svg]:size-[18px]"}>{it.icon}</span>
          <div className="min-w-0 flex-1">
            <div className="text-[15px] font-medium">{it.title}</div>
            <div className="truncate text-[12px] text-fg-3">{it.sub}</div>
          </div>
          <ChevronRight className="size-4 text-fg-3 group-hover:text-fg" />
        </Link>
      ))}
    </div>
  );
}

function InProgress({ o }: { o: Overview }) {
  if (!o.pending_deposits.length && !o.open_withdrawals.length) return null;
  return (
    <Card>
      <CardHeader title="In progress" subtitle="Deposits being confirmed and withdrawals being processed. This updates on its own." />
      <div className="mt-4 space-y-2 px-4 pb-5 sm:px-6">
        {o.pending_deposits.map((d) => (
          <Link key={`d${d.id}`} href={d.intent_id ? `/wallet/deposit?intent=${d.intent_id}` : "/wallet/history?type=deposit"} className="k-row block px-4 py-3 hover:border-[var(--k-border-top)]">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[13.5px] font-medium">Deposit · USDT {CHAIN_LABEL[d.chain].short}</span>
              <StatusTag {...DEPOSIT_STATUS[d.status]} />
              <span className="k-num ml-auto text-[14px] font-semibold text-up">+{fmt(d.amount ?? d.expected_amount)} USDT</span>
            </div>
            <div className="mt-1 text-[11.5px] text-fg-3">
              {formatDateTime(d.created_at)} · <HashLink hash={d.tx_hash} url={d.explorer_url} className="text-[11.5px]" />
            </div>
            {d.status !== "review" && (
              <div className="mt-2.5">
                <Confirmations d={d} />
              </div>
            )}
          </Link>
        ))}
        {o.open_withdrawals.map((w) => (
          <Link key={`w${w.id}`} href="/wallet/withdraw" className="k-row flex flex-wrap items-center gap-2 px-4 py-3 hover:border-[var(--k-border-top)]">
            <span className="text-[13.5px] font-medium">Withdrawal · USDT {CHAIN_LABEL[w.chain].short}</span>
            <StatusTag {...WITHDRAWAL_STATUS[w.status]} />
            <span className="k-num ml-auto text-[14px] font-semibold">−{fmt(w.amount)} USDT</span>
            <div className="w-full text-[11.5px] text-fg-3">
              {formatDateTime(w.created_at)} · you receive {fmt(w.net_amount)} USDT after the {fmt(w.fee)} USDT fee
            </div>
          </Link>
        ))}
      </div>
    </Card>
  );
}

function FundAccounts() {
  const { data } = useAccounts(15000);
  const live = (data?.accounts ?? []).filter((a) => a.type === "live");
  return (
    <Card className="h-full">
      <CardHeader
        title="Fund a trading account"
        subtitle="Instant and free between your wallet and your own live accounts"
        action={
          <Link href="/wallet/transfer">
            <Button size="xs" variant="surface">
              Transfer
            </Button>
          </Link>
        }
      />
      <div className="mt-4 space-y-2 px-4 pb-5 sm:px-6">
        {data && live.length === 0 && (
          <div className="k-row px-4 py-4 text-[13px] text-fg-2">
            You have no live account yet.{" "}
            <Link href="/accounts/new?type=live" className="text-ember hover:underline">
              Open one
            </Link>{" "}
            and fund it from your wallet.
          </div>
        )}
        {!data && <Skeleton className="h-16 w-full rounded-[14px]" />}
        {live.map((a) => (
          <Link key={a.login} href={`/wallet/transfer?to=${a.login}`} className="k-row group flex items-center gap-3 px-4 py-3 hover:border-[var(--k-border-top)]">
            <Chip size="sm" tone="ember" className="font-semibold tracking-wider">
              LIVE
            </Chip>
            <div className="min-w-0 flex-1">
              <div className="truncate text-[13.5px] font-medium">
                {a.groupName} <span className="font-mono text-[12px] text-fg-3">#{a.login}</span>
              </div>
              <div className="k-num text-[11.5px] text-fg-3">
                Balance {a.cent ? "USC " : "$"}
                {fmt(a.balance)}
                {a.cent && <> · ≈ ${fmt(toUsd(a, a.balance))}</>}
              </div>
            </div>
            <span className="inline-flex items-center gap-1 text-[12.5px] font-medium text-fg-3 group-hover:text-ember">
              Top up <ChevronRight className="size-4" />
            </span>
          </Link>
        ))}
      </div>
    </Card>
  );
}

function Notifications() {
  const { data, reload } = useWallet<{ items: Notification[]; unread: number }>("notifications", 30000);
  const items = data?.items.slice(0, 5) ?? [];
  if (!items.length) return null;
  return (
    <Card>
      <CardHeader
        title="Updates"
        icon={<Bell />}
        subtitle={data?.unread ? `${data.unread} new` : "Everything read"}
        action={
          data?.unread ? (
            <Button
              size="xs"
              variant="ghost"
              onClick={async () => {
                await walletApi("notifications/read", { body: {} }).catch(() => {});
                reload();
              }}
            >
              Mark all read
            </Button>
          ) : undefined
        }
      />
      <div className="mt-3 space-y-1 px-4 pb-4 sm:px-6">
        {items.map((n) => (
          <div key={n.id} className="flex gap-3 rounded-[12px] px-2 py-2">
            <span className={n.read ? "mt-1.5 size-1.5 shrink-0 rounded-full bg-transparent" : "mt-1.5 size-1.5 shrink-0 rounded-full bg-ember"} />
            <div className="min-w-0">
              <div className="text-[13px] font-medium">{n.title}</div>
              <div className="text-[12px] text-fg-3">{n.body}</div>
              <div className="mt-0.5 text-[11px] text-fg-3">{formatDateTime(n.created_at)}</div>
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}

export function LiveWalletPage() {
  const me = useSession();
  const { data: o, error, loading, reload } = useWallet<Overview>("overview", 10000);
  const act = useWallet<Page<ActivityItem>>("activity?limit=8", 15000);

  return (
    <div className="pb-16">
      <PageHeader
        title="Wallet"
        subtitle="Your USDT wallet on BNB Chain and TRON. Deposit, withdraw and fund your trading accounts."
        actions={
          <>
            <Link href="/wallet/history">
              <Button variant="surface" size="lg">
                <History /> History
              </Button>
            </Link>
            <Link href="/wallet/deposit">
              <Button variant="ember" size="lg">
                <ArrowDownToLine /> Deposit USDT
              </Button>
            </Link>
          </>
        }
      />

      {error && !o ? (
        <WalletUnavailable onRetry={reload} message={error.status > 0 && error.status < 500 ? error.message : undefined} />
      ) : (
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-4 xl:grid-cols-12">
            <div className="xl:col-span-8">
              <BalanceCard o={o} loading={loading} />
            </div>
            <div className="xl:col-span-4">
              <QuickActions kyc={me.kyc_status} />
            </div>
          </div>
          <KycNotice status={me.kyc_status} />
          {o && <InProgress o={o} />}
          <div className="grid grid-cols-1 gap-4 xl:grid-cols-12">
            <Card className="xl:col-span-7">
              <CardHeader
                title="Recent activity"
                subtitle={act.data ? `${act.data.total} transaction${act.data.total === 1 ? "" : "s"}` : undefined}
                action={
                  <Link href="/wallet/history">
                    <Button size="sm" variant="surface">
                      View all <ArrowUpRight />
                    </Button>
                  </Link>
                }
              />
              <div className="mt-4 space-y-2 px-4 pb-5 sm:px-6">
                {act.loading && <Skeleton className="h-16 w-full rounded-[14px]" />}
                {act.data && act.data.items.length === 0 && (
                  <EmptyState illustration="money_bag" title="No transactions yet" text="Your deposits, withdrawals and transfers will appear here." action={<Link href="/wallet/deposit"><Button variant="ember">Make your first deposit</Button></Link>} />
                )}
                {act.data?.items.map((a) => <ActivityRow key={`${a.type}${a.id}`} a={a} />)}
              </div>
            </Card>
            <div className="space-y-4 xl:col-span-5">
              <FundAccounts />
              <Notifications />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
