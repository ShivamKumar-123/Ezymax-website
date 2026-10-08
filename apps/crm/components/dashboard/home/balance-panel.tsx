"use client";

// Right column of the dashboard: total balance in large type with a change chip, the two main money actions
// (Deposit / Withdraw, near-black) with Transfer next to them, and the quick actions row. Actions whose module the broker
// switched off (wallet, copy trading, support…) aren't offered.

import * as React from "react";
import Link from "next/link";
import { ArrowDownToLine, ArrowLeftRight, ArrowUpFromLine, Plus } from "lucide-react";
import { Button, ChangeChip, IconTile, Money, Skeleton, cn, type ChipTone, type TileTone } from "@/components/kit";
import { useT } from "@ezymex/i18n/react";
import { useModule, usePageOn } from "@/components/tenant-config";

export function BalancePanel({ total, chip, chipTone = "up", sub, loading, readOnly }: { total: number | null; chip?: React.ReactNode; chipTone?: ChipTone; sub?: React.ReactNode; loading?: boolean; readOnly?: boolean }) {
  const t = useT();
  const wallet = useModule("wallet");
  return (
    <section className="text-center">
      <div className="text-[15px] font-medium text-fg-2">{t("dashboard.home.totalBalance")}</div>
      <div className="k-display mt-3 text-[36px] font-bold leading-none tracking-[-0.03em] text-fg sm:text-[40px]">
        {total === null ? loading ? <Skeleton className="mx-auto h-10 w-56 rounded-xl" /> : "—" : <Money value={total} />}
      </div>
      {chip && (
        <div className="mt-4 flex justify-center">
          <ChangeChip tone={chipTone}>{chip}</ChangeChip>
        </div>
      )}
      {sub && <div className="mt-2 text-[12px] text-fg-3">{sub}</div>}
      {!readOnly && wallet && (
        <>
          <div className="mt-6 grid grid-cols-2 gap-2.5">
            <Link href="/wallet/deposit" className="block">
              <Button variant="ink" size="xl" className="w-full">
                {t("common.deposit")} <ArrowDownToLine />
              </Button>
            </Link>
            <Link href="/wallet/withdraw" className="block">
              <Button variant="ink" size="xl" className="w-full">
                {t("common.withdraw")} <ArrowUpFromLine />
              </Button>
            </Link>
          </div>
          <Link href="/wallet/transfer" className="mt-2.5 block">
            <Button variant="surface" size="md" className="w-full">
              <ArrowLeftRight className="rtl:-scale-x-100" /> {t("dashboard.home.transferFunds")}
            </Button>
          </Link>
        </>
      )}
    </section>
  );
}

export type QuickAction = { key: string; label: string; href: string; icon: React.ReactNode; tone: TileTone; external?: boolean };

/** Round pastel shortcuts (the reference's "Quick transfer" avatars), plus a dashed "+" to open an account. */
export function QuickActions({ items, title }: { items: QuickAction[]; title: string }) {
  const t = useT();
  const pageOn = usePageOn();
  const shown = items.filter((q) => q.external || pageOn(q.href)).slice(0, 4);
  return (
    <section>
      <h3 className="k-display text-[17px] font-semibold tracking-[-0.01em]">{title}</h3>
      {/* one column per shortcut plus "Open account" (five at most), so a hidden one leaves no hole */}
      <div className="mt-4 grid gap-2" style={{ gridTemplateColumns: `repeat(${shown.length + 1}, minmax(0, 1fr))` }}>
        {shown.map((q) => {
          const body = (
            <>
              <IconTile tone={q.tone} size={52} className="!rounded-full transition-transform group-hover:-translate-y-0.5 [&_svg]:size-[21px]">
                {q.icon}
              </IconTile>
              <span className="line-clamp-2 text-center text-[11.5px] font-semibold leading-tight text-fg-2 group-hover:text-fg">{q.label}</span>
            </>
          );
          const cls = "group flex min-w-0 flex-col items-center gap-2 rounded-2xl py-1 outline-none focus-visible:ring-4 focus-visible:ring-ember/20";
          return q.external ? (
            <a key={q.key} href={q.href} target="_blank" rel="noopener" className={cls}>
              {body}
            </a>
          ) : (
            <Link key={q.key} href={q.href} className={cls}>
              {body}
            </Link>
          );
        })}
        <Link href="/accounts/new" className="group flex min-w-0 flex-col items-center gap-2 rounded-2xl py-1 outline-none focus-visible:ring-4 focus-visible:ring-ember/20">
          <span className={cn("grid size-[52px] place-items-center rounded-full border-2 border-dashed border-fg-3/40 text-fg-3 transition-colors group-hover:border-ember group-hover:text-ember")}>
            <Plus className="size-5" />
          </span>
          <span className="line-clamp-2 text-center text-[11.5px] font-semibold leading-tight text-fg-2">{t("dashboard.accounts.open")}</span>
        </Link>
      </div>
    </section>
  );
}
