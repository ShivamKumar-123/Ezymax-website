"use client";

import Link from "next/link";
import { ArrowDownToLine, ArrowUpFromLine, CandlestickChart, KeyRound, MoreHorizontal, Pencil, RefreshCcw, Archive, Gauge as GaugeIcon } from "lucide-react";
import { toast } from "sonner";
import { Button, Chip, CopyButton, IconButton, Menu, Money, cn } from "@/components/kit";
import { freeMargin, marginLevel, type TradingAccount } from "@ezymex/mock";
import { useT } from "@ezymex/i18n/react";
import type { T } from "@ezymex/i18n";
import { TERMINAL_URL } from "@/lib/live";
import { intlTag } from "@ezymex/i18n/locales";

export function AccountBadge({ a }: { a: TradingAccount }) {
  const t = useT();
  return a.type === "live" ? (
    <Chip tone="ember" size="sm" className="font-semibold tracking-wider">
      {t("accounts.badge.live")}
    </Chip>
  ) : (
    <Chip tone="gold" size="sm" className="font-semibold tracking-wider">
      {t("accounts.badge.demo")}
    </Chip>
  );
}

/** Pass `t` from useT() to translate the position mode; without it the title stays in English. */
export function accountTitle(a: TradingAccount, t?: T) {
  const mode = a.mode === "hedging" ? "Hedging" : "Netting";
  return `${a.group} · ${t ? t.dyn(`accounts.mode.${a.mode}`, mode) : mode}`;
}

export function AccountMenu({ a }: { a: TradingAccount }) {
  const t = useT();
  return (
    <Menu
      trigger={
        <IconButton size="sm" aria-label={t("accounts.menu.actions")}>
          <MoreHorizontal />
        </IconButton>
      }
      items={[
        { label: t("accounts.menu.details"), icon: <GaugeIcon />, href: `/accounts/${a.login}` },
        { label: t("accounts.menu.rename"), icon: <Pencil />, onSelect: () => toast(t("accounts.menu.renameToast"), { description: `#${a.login}` }) },
        { label: t("accounts.menu.changeLeverage"), icon: <GaugeIcon />, onSelect: () => toast(t("accounts.menu.leverageToast")) },
        { label: t("accounts.menu.passwords"), icon: <KeyRound />, href: `/accounts/${a.login}?tab=credentials` },
        ...(a.type === "demo" ? [{ label: t("accounts.menu.refill", { count: a.refillsLeft }), icon: <RefreshCcw />, onSelect: () => toast.success(t("accounts.refill.done"), { description: t("accounts.menu.refillDesc", { login: a.login, amount: `$${a.balance.toLocaleString()}` }) }) }] : []),
        "sep" as const,
        { label: t("accounts.menu.archive"), icon: <Archive />, danger: true, onSelect: () => toast(t("accounts.menu.archiveRequested")) },
      ]}
    />
  );
}

/** Rounded account sub-card used on the dashboard and accounts list. */
export function AccountRow({ a, compact }: { a: TradingAccount; compact?: boolean }) {
  const t = useT();
  const cur = a.cent ? "USC " : "$";
  const ml = marginLevel(a);
  return (
    <div className="k-row group relative overflow-hidden p-4 transition-colors hover:border-[var(--k-border-top)] sm:p-5">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <AccountBadge a={a} />
        <Link href={`/accounts/${a.login}`} className="text-[15px] font-medium text-fg hover:text-ember">
          {accountTitle(a, t)}
        </Link>
        <span className="inline-flex items-center gap-1 font-mono text-[13px] text-fg-2">
          #{a.login}
          <CopyButton value={a.login} label={t("accounts.label.login")} />
        </span>
        {a.swapFree && (
          <Chip size="sm" tone="info">
            {t("accounts.label.swapFree")}
          </Chip>
        )}
        <div className="ms-auto flex items-center gap-2 text-xs text-fg-3">
          <span className="hidden sm:inline">{a.server}</span>
          <Chip size="sm">1:{a.leverage}</Chip>
        </div>
      </div>
      <div className={cn("mt-4 grid items-end gap-4", compact ? "grid-cols-2 sm:grid-cols-3 xl:grid-cols-[1fr_1fr_1fr_auto]" : "grid-cols-2 sm:grid-cols-4 xl:grid-cols-[1fr_1fr_1fr_1fr_auto]")}>
        <div>
          <div className="text-[12px] text-fg-3">{t("common.balance")}</div>
          <Money value={a.balance} currency={cur} className="mt-1 block truncate text-[16px] font-semibold sm:text-[19px]" />
        </div>
        <div>
          <div className="text-[12px] text-fg-3">{t("common.equity")}</div>
          <Money value={a.equity} currency={cur} className="mt-1 block truncate text-[16px] font-semibold sm:text-[19px]" />
        </div>
        {!compact && (
          <div className="hidden sm:block">
            <div className="text-[12px] text-fg-3">{t("accounts.label.freeMargin")}</div>
            <Money value={freeMargin(a)} currency={cur} className="mt-1 block text-[15px] font-medium text-fg-2" />
          </div>
        )}
        <div>
          <div className="whitespace-nowrap text-[12px] text-fg-3">{t("accounts.label.marginLevel")}</div>
          <div className={cn("k-num mt-1 text-[17px] font-semibold", ml > 500 ? "text-up" : ml > 200 ? "text-warn" : "text-down")}>{Number.isFinite(ml) ? `${Math.round(ml).toLocaleString()}%` : "—"}</div>
        </div>
        <div className={cn("col-span-full flex flex-wrap items-center justify-end gap-2", "xl:col-span-1")}>
          <AccountMenu a={a} />
          {a.type === "live" ? (
            <>
              <Link href={`/wallet/withdraw?from=${a.login}`} className={compact ? "hidden 2xl:block" : "hidden sm:block"}>
                <Button size="sm" variant="surface">
                  <ArrowUpFromLine /> {t("common.withdraw")}
                </Button>
              </Link>
              <Link href={`/wallet/transfer?to=${a.login}`}>
                <Button size="sm" variant="surface">
                  <ArrowDownToLine /> {t("common.deposit")}
                </Button>
              </Link>
            </>
          ) : (
            <Button size="sm" variant="surface" onClick={() => toast.success(t("accounts.refill.done"))}>
              <RefreshCcw /> {t("accounts.row.refill")}
            </Button>
          )}
          <Link target="_blank" rel="noopener" href={`${TERMINAL_URL}/?account=${a.login}`}>
            <Button size="sm" variant="ember">
              <CandlestickChart /> {t("accounts.row.trade")}
            </Button>
          </Link>
        </div>
      </div>
      {a.type === "demo" && a.expiresAt && <div className="mt-3 text-[11.5px] text-fg-3">{t("accounts.row.demoExpires", { date: new Date(a.expiresAt).toLocaleDateString(intlTag(t.locale), { day: "2-digit", month: "short" }), count: a.refillsLeft })}</div>}
    </div>
  );
}
