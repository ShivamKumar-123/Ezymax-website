"use client";

import Link from "next/link";
import { ArrowDownToLine, ArrowUpFromLine, CandlestickChart, KeyRound, MoreHorizontal, Pencil, RefreshCcw, Archive, Gauge as GaugeIcon } from "lucide-react";
import { toast } from "sonner";
import { Button, Chip, CopyButton, IconButton, Menu, Money, cn } from "@kalks/ui";
import { freeMargin, marginLevel, type TradingAccount } from "@kalks/mock";

export function AccountBadge({ a }: { a: TradingAccount }) {
  return a.type === "live" ? (
    <Chip tone="ember" size="sm" className="font-semibold tracking-wider">
      LIVE
    </Chip>
  ) : (
    <Chip tone="gold" size="sm" className="font-semibold tracking-wider">
      DEMO
    </Chip>
  );
}

export function accountTitle(a: TradingAccount) {
  return `${a.group} · ${a.mode === "hedging" ? "Hedging" : "Netting"}`;
}

export function AccountMenu({ a }: { a: TradingAccount }) {
  return (
    <Menu
      trigger={
        <IconButton size="sm" aria-label="Account actions">
          <MoreHorizontal />
        </IconButton>
      }
      items={[
        { label: "Account details", icon: <GaugeIcon />, href: `/accounts/${a.login}` },
        { label: "Rename", icon: <Pencil />, onSelect: () => toast("Rename account", { description: `#${a.login}` }) },
        { label: "Change leverage", icon: <GaugeIcon />, onSelect: () => toast("Leverage can be changed only with no open positions") },
        { label: "Trading & investor passwords", icon: <KeyRound />, href: `/accounts/${a.login}?tab=credentials` },
        ...(a.type === "demo" ? [{ label: `Refill balance (${a.refillsLeft} left today)`, icon: <RefreshCcw />, onSelect: () => toast.success("Demo balance refilled", { description: `#${a.login} reset to $${a.balance.toLocaleString()}` }) }] : []),
        "sep" as const,
        { label: "Archive account", icon: <Archive />, danger: true, onSelect: () => toast("Archive requested") },
      ]}
    />
  );
}

/** Rounded account sub-card used on the dashboard and accounts list. */
export function AccountRow({ a, compact }: { a: TradingAccount; compact?: boolean }) {
  const cur = a.cent ? "USC " : "$";
  const ml = marginLevel(a);
  return (
    <div className="k-row group relative overflow-hidden p-4 transition-colors hover:border-[var(--k-border-top)] sm:p-5">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <AccountBadge a={a} />
        <Link href={`/accounts/${a.login}`} className="text-[15px] font-medium text-fg hover:text-ember">
          {accountTitle(a)}
        </Link>
        <span className="inline-flex items-center gap-1 font-mono text-[13px] text-fg-2">
          #{a.login}
          <CopyButton value={a.login} label="Login" />
        </span>
        {a.swapFree && (
          <Chip size="sm" tone="info">
            Swap-free
          </Chip>
        )}
        <div className="ml-auto flex items-center gap-2 text-xs text-fg-3">
          <span className="hidden sm:inline">{a.server}</span>
          <Chip size="sm">1:{a.leverage}</Chip>
        </div>
      </div>
      <div className={cn("mt-4 grid items-end gap-4", compact ? "grid-cols-2 sm:grid-cols-3 xl:grid-cols-[1fr_1fr_1fr_auto]" : "grid-cols-2 sm:grid-cols-4 xl:grid-cols-[1fr_1fr_1fr_1fr_auto]")}>
        <div>
          <div className="text-[11px] uppercase tracking-wider text-fg-3">Balance</div>
          <Money value={a.balance} currency={cur} className="mt-1 block truncate text-[16px] font-semibold sm:text-[19px]" />
        </div>
        <div>
          <div className="text-[11px] uppercase tracking-wider text-fg-3">Equity</div>
          <Money value={a.equity} currency={cur} className="mt-1 block truncate text-[16px] font-semibold sm:text-[19px]" />
        </div>
        {!compact && (
          <div className="hidden sm:block">
            <div className="text-[11px] uppercase tracking-wider text-fg-3">Free margin</div>
            <Money value={freeMargin(a)} currency={cur} className="mt-1 block text-[15px] font-medium text-fg-2" />
          </div>
        )}
        <div>
          <div className="whitespace-nowrap text-[11px] uppercase tracking-wider text-fg-3">Margin level</div>
          <div className={cn("k-num mt-1 text-[17px] font-semibold", ml > 500 ? "text-up" : ml > 200 ? "text-warn" : "text-down")}>{Number.isFinite(ml) ? `${Math.round(ml).toLocaleString()}%` : "—"}</div>
        </div>
        <div className={cn("col-span-full flex flex-wrap items-center justify-end gap-2", "xl:col-span-1")}>
          <AccountMenu a={a} />
          {a.type === "live" ? (
            <>
              <Link href={`/wallet/withdraw?from=${a.login}`} className={compact ? "hidden 2xl:block" : "hidden sm:block"}>
                <Button size="sm" variant="surface">
                  <ArrowUpFromLine /> Withdraw
                </Button>
              </Link>
              <Link href={`/wallet/transfer?to=${a.login}`}>
                <Button size="sm" variant="surface">
                  <ArrowDownToLine /> Deposit
                </Button>
              </Link>
            </>
          ) : (
            <Button size="sm" variant="surface" onClick={() => toast.success("Demo balance refilled")}>
              <RefreshCcw /> Refill
            </Button>
          )}
          <Link target="_blank" rel="noopener" href={`/trade?account=${a.login}`}>
            <Button size="sm" variant="ember">
              <CandlestickChart /> Trade
            </Button>
          </Link>
        </div>
      </div>
      {a.type === "demo" && a.expiresAt && <div className="mt-3 text-[11.5px] text-fg-3">Demo expires on {new Date(a.expiresAt).toLocaleDateString("en-GB", { day: "2-digit", month: "short" })} · {a.refillsLeft} refills left today</div>}
    </div>
  );
}
