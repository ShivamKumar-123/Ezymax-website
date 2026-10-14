"use client";

// "My Accounts" blocks of the dashboard, after the reference: one wide gradient card for the selected account, the
// three money actions under it, the two promo cards, the Portfolio panel, and the "Account details" figures of the
// right column.
//
// The hero is a sibling of `AccountVisual` rather than a `wide` variant of it: the reference card is not the tall
// card re-proportioned — it carries a different set of fields (currency pill, account switcher, badge row, a 34px
// balance with the hide-balances eye, floating P/L), so folding both into one component would mean two layouts behind
// a flag. It shares the gradient (`k-acct-live` / `k-acct-demo`) and the decorative ribbon, so a brand colour change
// still drives both.
//
// Every block takes a plain presentational shape, like `accounts-panel.tsx`: the live dashboard maps the engine
// account onto it, so these stay free of the trading client and the demo dashboard can reuse them.

import * as React from "react";
import Link from "next/link";
import { ArrowDownToLine, ArrowUpRight, ChevronDown, Eye, EyeOff, Gift, Plus, UserPlus } from "lucide-react";
import { MASK, setBalancesHidden, useBalancesHidden } from "./hide-balances";
import { Ribbon } from "./accounts-panel";
import { Button, Card, Chip, Menu, Skeleton, cn } from "@/components/kit";
import { useT } from "@ezymex/i18n/react";

/** How often the Portfolio panel's data is refetched; also the figure its sub-line quotes. */
export const PORTFOLIO_REFRESH_SECONDS = 60;

const DASH = "—";

function num(v: number) {
  return v.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/** "$1,200.00" / "USC 1,200.00", signed for a P/L figure. `cur` is the prefix from `curOf`. */
function amount(v: number, cur: string, signed = false) {
  return `${signed && v > 0 ? "+" : v < 0 ? "-" : ""}${cur}${num(Math.abs(v))}`;
}

function pnlTone(v: number) {
  return v < 0 ? "text-down" : "text-up";
}

/* ------------------------------------------------------------------ */
/* The wide account card                                               */
/* ------------------------------------------------------------------ */

export type HeroAccount = {
  login: string;
  type: "live" | "demo";
  prop?: boolean;
  /** Currency code next to the balance, e.g. "USD" / "USC". */
  code: string;
  /** Money prefix of the amounts, e.g. "$" / "USC ". */
  cur: string;
  /** The account's plan, e.g. "Standard". */
  plan: string;
  server: string;
  balance: number;
  /** Floating P/L. */
  profit: number;
};

/** A translucent badge of the card's lower-start row. */
function HeroBadge({ children }: { children: React.ReactNode }) {
  return <span className="rounded-full bg-white/20 px-2.5 py-1 text-[10.5px] font-bold uppercase tracking-[0.07em] backdrop-blur-sm">{children}</span>;
}

export function AccountHero({ a, accounts, onSelect, canOpen = true }: { a: HeroAccount; accounts: HeroAccount[]; onSelect: (login: string) => void; canOpen?: boolean }) {
  const t = useT();
  const hidden = useBalancesHidden();
  const live = a.type === "live" && !a.prop;
  const kind = a.prop ? t("accounts.badge.prop") : a.type === "live" ? t("dashboard.home.real") : t("accounts.badge.demo");
  return (
    <div className={cn("k-acct-card relative w-full overflow-hidden rounded-[24px] p-5 text-white sm:p-7", "min-h-[232px] md:aspect-[3.3/1] md:min-h-[196px]", live ? "k-acct-live" : "k-acct-demo")}>
      <Ribbon />
      <div className="relative flex h-full flex-col">
        <div className="flex items-start justify-between gap-3">
          <span className="k-acct-pill rounded-full px-2.5 py-1 text-[11px] font-bold tracking-[0.06em]">{a.code}</span>
          <div className="flex items-center gap-1.5">
            <div className="min-w-0 text-end">
              <div className="text-[10.5px] font-semibold uppercase tracking-[0.08em] text-white/65">{t("dashboard.home.accountNumber")}</div>
              <div dir="ltr" className="k-num truncate font-mono text-[15px] font-bold tracking-[0.08em] sm:text-[17px]">
                {a.login}
              </div>
            </div>
            {accounts.length > 1 && (
              <Menu
                align="end"
                width={260}
                header={<span className="text-[12px] font-semibold text-fg-3">{t("dashboard.home.switchAccount")}</span>}
                trigger={
                  <button type="button" aria-label={t("dashboard.home.switchAccount")} className="grid size-8 shrink-0 place-items-center rounded-full text-white/80 transition-colors hover:bg-white/15 hover:text-white">
                    <ChevronDown className="size-[18px]" />
                  </button>
                }
                items={accounts.map((x) => ({
                  label: (
                    <span className="flex min-w-0 items-center gap-2">
                      <span dir="ltr" className="k-num font-mono">
                        #{x.login}
                      </span>
                      <span className="truncate text-fg-3">{x.plan}</span>
                    </span>
                  ),
                  onSelect: () => onSelect(x.login),
                }))}
              />
            )}
            {canOpen && (
              <Link href="/accounts/new" aria-label={t("dashboard.accounts.open")} className="grid size-9 shrink-0 place-items-center rounded-full bg-white/20 backdrop-blur-sm transition-colors hover:bg-white/30">
                <Plus className="size-[18px]" />
              </Link>
            )}
          </div>
        </div>

        <div className="mt-auto pt-6">
          <div className="flex flex-wrap items-center gap-1.5">
            <HeroBadge>{kind}</HeroBadge>
            <HeroBadge>{a.server}</HeroBadge>
            <HeroBadge>{a.plan}</HeroBadge>
          </div>
          <div className="mt-3 flex flex-wrap items-end gap-x-2.5 gap-y-1">
            <span dir="ltr" className="k-display k-num text-[30px] font-bold leading-none tracking-[-0.02em] sm:text-[34px]">
              {hidden ? MASK : num(a.balance)}
            </span>
            <span className="text-[15px] font-medium text-white/80">{a.code}</span>
            <button
              type="button"
              onClick={() => setBalancesHidden(!hidden)}
              aria-pressed={hidden}
              aria-label={hidden ? t("dashboard.home.showBalances") : t("dashboard.home.hideBalances")}
              className="ms-1 grid size-8 place-items-center rounded-full text-white/70 transition-colors hover:bg-white/15 hover:text-white"
            >
              {hidden ? <Eye className="size-[17px]" /> : <EyeOff className="size-[17px]" />}
            </button>
          </div>
          <div className="mt-2 flex items-center gap-2 text-[12.5px]">
            <span className="text-white/70">{t("dashboard.home.floating")}</span>
            <span dir="ltr" className={cn("k-num font-semibold", pnlTone(a.profit))}>
              {hidden ? MASK : amount(a.profit, a.cur, true)}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

export function AccountHeroSkeleton() {
  return <Skeleton className="min-h-[232px] w-full rounded-[24px] md:aspect-[3.3/1] md:min-h-[196px]" />;
}

/** The hero's place when the trading service is unreachable, or the client has no account yet. */
export function AccountHeroFallback({ failed, onRetry }: { failed?: boolean; onRetry?: () => void }) {
  const t = useT();
  if (failed)
    return (
      <div className="k-card grid min-h-[232px] place-items-center p-6 text-center text-[13px] text-fg-2 md:aspect-[3.3/1] md:min-h-[196px]">
        <div>
          <p>{t("dashboard.accounts.unavailable")}</p>
          {onRetry && (
            <Button size="sm" className="mt-3" onClick={onRetry}>
              {t("common.retry")}
            </Button>
          )}
        </div>
      </div>
    );
  return (
    <Link href="/accounts/new" className="k-acct-empty grid min-h-[232px] w-full place-items-center rounded-[24px] p-6 text-center md:aspect-[3.3/1] md:min-h-[196px]">
      <span>
        <span className="mx-auto grid size-12 place-items-center rounded-full bg-ember text-[var(--k-on-ember)] shadow-[0_10px_24px_-10px_var(--k-ember)]">
          <Plus className="size-5" />
        </span>
        <span className="mt-3 block text-[15px] font-bold text-fg">{t("dashboard.accounts.openLive.title")}</span>
        <span className="mt-1 block text-[12.5px] text-fg-3">{t("dashboard.accounts.openLive.text")}</span>
      </span>
    </Link>
  );
}

/* ------------------------------------------------------------------ */
/* Trade / Deposit / Withdraw                                          */
/* ------------------------------------------------------------------ */

/** Class list of one cell of the action row; the caller's trade button takes it too. */
export const ACTION_BUTTON_CLASS = "h-14 w-full rounded-[14px] text-[15px]";

/** The row under the hero. `trade` is the caller's trade button (it needs the engine account for SSO); the money
 *  actions are left out when the broker switched the wallet off. */
export function AccountActionRow({ trade, wallet }: { trade: React.ReactNode; wallet?: boolean }) {
  const t = useT();
  return (
    <div className={cn("grid gap-3", wallet ? "grid-cols-3" : "grid-cols-1")}>
      {trade}
      {wallet && (
        <>
          <Link href="/wallet/deposit" className="block">
            <Button variant="surface" className={ACTION_BUTTON_CLASS}>
              <ArrowDownToLine /> {t("common.deposit")}
            </Button>
          </Link>
          <Link href="/wallet/withdraw" className="block">
            <Button variant="outline" className={cn(ACTION_BUTTON_CLASS, "border-line text-fg-2 hover:border-fg-3 hover:bg-surface-2 hover:text-fg")}>
              <ArrowUpRight className="rtl:-scale-x-100" /> {t("common.withdraw")}
            </Button>
          </Link>
        </>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Promo cards                                                         */
/* ------------------------------------------------------------------ */

export type Promo = { key: "refer" | "rewards"; href: string; title: string; text: React.ReactNode };

const PROMO_ART: Record<Promo["key"], React.ReactNode> = {
  refer: <UserPlus />,
  rewards: <Gift />,
};

/** The two gradient teasers. Their own gradients carry white text in both themes, so they don't follow the surface. */
export function PromoCards({ items }: { items: Promo[] }) {
  if (!items.length) return null;
  return (
    <div className={cn("grid gap-4", items.length > 1 && "sm:grid-cols-2")}>
      {items.map((p) => (
        <Link
          key={p.key}
          href={p.href}
          className={cn(
            "k-promo relative flex min-h-[130px] flex-col justify-center overflow-hidden rounded-[20px] p-5 transition-transform hover:-translate-y-0.5",
            p.key === "refer" ? "k-promo-refer" : "k-promo-rewards",
          )}
        >
          <span aria-hidden className="pointer-events-none absolute -bottom-5 -end-4 opacity-20 [&_svg]:size-32">
            {PROMO_ART[p.key]}
          </span>
          <span className="k-display relative text-[18px] font-bold tracking-[-0.015em]">{p.title}</span>
          <span className="relative mt-1 max-w-[80%] text-[12.5px] leading-snug text-white/80">{p.text}</span>
        </Link>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Portfolio                                                           */
/* ------------------------------------------------------------------ */

export type PositionRow = {
  key: string;
  icon: React.ReactNode;
  title: React.ReactNode;
  sub?: React.ReactNode;
  side: { label: string; buy: boolean };
  /** The position's floating P/L, already formatted in the account currency. */
  value: string;
  profit: number;
};

/** Section heading with a muted note at the end, shared by Portfolio and Watchlists. */
export function SectionBar({ title, note, action }: { title: string; note?: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="mb-3 flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
      <h2 className="k-display text-[20px] font-semibold tracking-[-0.015em]">{title}</h2>
      {note && <span className="text-[12px] text-fg-3">{note}</span>}
      {action}
    </div>
  );
}

/** `rows` null = still loading (never a fake empty list), [] = really no open positions. */
export function PortfolioPanel({ rows, failed, onRetry }: { rows: PositionRow[] | null; failed?: boolean; onRetry?: () => void }) {
  const t = useT();
  const hidden = useBalancesHidden();
  return (
    <section className="min-w-0">
      <SectionBar title={t("dashboard.home.portfolio")} note={t("dashboard.home.updatesEvery", { seconds: PORTFOLIO_REFRESH_SECONDS })} />
      <Card className="min-h-[180px] p-2.5 sm:p-3">
        {failed && !rows ? (
          <div className="grid min-h-[156px] place-items-center p-4 text-center text-[13px] text-fg-2">
            <div>
              <p>{t("common.errorRetry")}</p>
              {onRetry && (
                <Button size="sm" className="mt-3" onClick={onRetry}>
                  {t("common.retry")}
                </Button>
              )}
            </div>
          </div>
        ) : rows === null ? (
          <div className="space-y-2 p-1.5">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="h-12 w-full rounded-[14px]" />
            ))}
          </div>
        ) : rows.length === 0 ? (
          <div className="grid min-h-[156px] place-items-center p-4 text-center text-[13px] text-fg-3">{t("accountDetail.positions.none")}</div>
        ) : (
          <div className="space-y-2">
            {rows.map((p) => (
              <div key={p.key} className="k-row flex items-center gap-3 px-3.5 py-2.5">
                {p.icon}
                <div className="min-w-0 flex-1">
                  <div className="flex min-w-0 flex-wrap items-center gap-2">
                    <span className="truncate text-[13.5px] font-semibold text-fg">{p.title}</span>
                    <Chip size="sm" tone={p.side.buy ? "up" : "down"}>
                      {p.side.label}
                    </Chip>
                  </div>
                  {p.sub && (
                    <div dir="ltr" className="k-num mt-0.5 truncate text-start font-mono text-[11px] text-fg-3">
                      {p.sub}
                    </div>
                  )}
                </div>
                <span dir="ltr" className={cn("k-num shrink-0 text-[14px] font-semibold", pnlTone(p.profit))}>
                  {hidden ? MASK : p.value}
                </span>
              </div>
            ))}
          </div>
        )}
      </Card>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Account details (right column)                                      */
/* ------------------------------------------------------------------ */

export type AccountFigures = {
  /** Money prefix of the amounts, e.g. "$" / "USC ". */
  cur: string;
  profit: number;
  balance: number;
  margin: number;
  freeMargin: number;
  marginLevel: number | null;
  credit: number;
  leverage: number;
};

export function AccountDetailsPanel({ figures, loading, failed, onRetry, menu }: { figures: AccountFigures | null; loading?: boolean; failed?: boolean; onRetry?: () => void; menu?: React.ReactNode }) {
  const t = useT();
  const hidden = useBalancesHidden();
  const f = figures;
  // a figure we don't have reads as a dash (a client without an account sees seven of them); a zero is only ever
  // shown when the engine really reported zero
  const money = (v: number | undefined) => (v === undefined || !Number.isFinite(v) ? DASH : hidden ? MASK : amount(v, f!.cur));
  const level = f?.marginLevel;
  const rows: [string, React.ReactNode][] = [
    [
      t("dashboard.home.unrealizedPnl"),
      <span key="p" dir="ltr" className={cn("k-num", f && !hidden && pnlTone(f.profit))}>
        {f ? (hidden ? MASK : amount(f.profit, f.cur, true)) : DASH}
      </span>,
    ],
    [t("common.balance"), <span key="b" dir="ltr" className="k-num">{money(f?.balance)}</span>],
    [t("accountDetail.stat.margin"), <span key="m" dir="ltr" className="k-num">{money(f?.margin)}</span>],
    [t("accounts.label.freeMargin"), <span key="fm" dir="ltr" className="k-num">{money(f?.freeMargin)}</span>],
    [
      t("accounts.label.marginLevel"),
      <span key="ml" dir="ltr" className="k-num">
        {level === null || level === undefined || !Number.isFinite(level) || level <= 0 ? DASH : `${Math.round(level).toLocaleString("en-US")}%`}
      </span>,
    ],
    [t("accountDetail.stat.credit"), <span key="c" dir="ltr" className="k-num">{money(f?.credit)}</span>],
    [t("dashboard.home.leverage"), <span key="l" dir="ltr" className="k-num">{f && f.leverage > 0 ? `1:${f.leverage.toLocaleString("en-US")}` : DASH}</span>],
  ];

  return (
    <section className="min-w-0">
      <div className="flex items-center justify-between gap-3">
        <h2 className="k-display text-[18px] font-semibold tracking-[-0.015em] text-ember">{t("accountDetail.details.title")}</h2>
        {menu}
      </div>
      {!f && failed ? (
        <div className="mt-4 text-[13px] text-fg-2">
          <p>{t("common.errorRetry")}</p>
          {onRetry && (
            <Button size="sm" className="mt-3" onClick={onRetry}>
              {t("common.retry")}
            </Button>
          )}
        </div>
      ) : !f && loading ? (
        <div className="mt-4 space-y-3.5">
          {rows.map(([k]) => (
            <Skeleton key={k} className="h-4 w-full rounded" />
          ))}
        </div>
      ) : (
        <div className="mt-2 divide-y divide-line">
          {rows.map(([k, v]) => (
            <div key={k} className="flex items-center justify-between gap-4 py-3 text-[13px]">
              <span className="shrink-0 text-fg-3">{k}</span>
              <span className="min-w-0 truncate text-end font-medium text-fg">{v}</span>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

