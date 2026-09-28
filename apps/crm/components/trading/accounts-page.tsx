"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowRight, FlaskConical, Layers, Plus, RotateCw, ShieldCheck, TrendingUp } from "lucide-react";
import { Button, Card, CardHeader, Chip, EmptyState, KpiCard, Money, PageHeader, Reveal, Segmented, Skeleton } from "@kalks/ui";
import { toUsd, useAccounts, useGroups, type EngineAccount } from "./api";
import { EngineGroupCard } from "./group-card";
import { LiveAccountRow, refillsLeft } from "./ui";

export function AccountsError({ onRetry, message }: { onRetry: () => void; message?: string }) {
  return (
    <Card>
      <EmptyState
        illustration="satellite_antenna"
        title="Trading accounts are unavailable"
        text={message ?? "We couldn't reach the trading service. Your accounts and balances are safe; please try again in a moment."}
        action={
          <Button variant="surface" onClick={onRetry}>
            <RotateCw /> Try again
          </Button>
        }
      />
    </Card>
  );
}

export function RowsSkeleton({ n = 2 }: { n?: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: n }, (_, i) => (
        <Skeleton key={i} className="h-[138px] w-full rounded-[18px]" />
      ))}
    </div>
  );
}

/** Totals over live accounts in USD (cent accounts converted from USC). */
export function liveTotals(accounts: EngineAccount[]) {
  const live = accounts.filter((a) => a.type === "live");
  return {
    live,
    demo: accounts.filter((a) => a.type === "demo"),
    equity: live.reduce((s, a) => s + toUsd(a, a.equity), 0),
    balance: live.reduce((s, a) => s + toUsd(a, a.balance), 0),
    free: live.reduce((s, a) => s + toUsd(a, a.freeMargin), 0),
    profit: live.reduce((s, a) => s + toUsd(a, a.profit), 0),
    positions: accounts.reduce((s, a) => s + a.positions, 0),
  };
}

function Inner() {
  const sp = useSearchParams();
  const router = useRouter();
  const { data, error, loading, reload } = useAccounts();
  const groups = useGroups();
  const accounts = data?.accounts ?? [];
  const t = liveTotals(accounts);
  const initialTab = sp.get("tab") === "demo" ? "demo" : sp.get("tab") === "live" ? "live" : null;
  const [tab, setTabState] = React.useState<"live" | "demo" | null>(initialTab);
  // default to the tab that has accounts (live first)
  const active: "live" | "demo" = tab ?? (t.live.length === 0 && t.demo.length > 0 ? "demo" : "live");
  const setTab = (v: "live" | "demo") => {
    setTabState(v);
    router.replace(`/accounts?tab=${v}`, { scroll: false });
  };
  const list = active === "live" ? t.live : t.demo;
  const refills = t.demo.reduce((s, a) => s + refillsLeft(a), 0);

  return (
    <div className="pb-16">
      <PageHeader
        title="Trading accounts"
        subtitle="Your live and demo accounts, balances, credentials and leverage."
        actions={
          <Link href={`/accounts/new${active === "demo" ? "?type=demo" : ""}`}>
            <Button variant="ember" size="lg">
              <Plus /> Open account
            </Button>
          </Link>
        }
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          label="Live equity"
          icon={<TrendingUp />}
          value={loading ? <Skeleton className="h-8 w-32" /> : <Money value={t.equity} countUp={false} />}
          chip={t.live.length ? `Balance $${t.balance.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : "No live accounts yet"}
          chipTone="neutral"
          href="/portfolio"
        />
        <KpiCard
          label="Free margin"
          icon={<ShieldCheck />}
          value={loading ? <Skeleton className="h-8 w-32" /> : <Money value={t.free} countUp={false} />}
          chip={t.equity > 0 ? `${((t.free / t.equity) * 100).toFixed(1)}% of equity` : "Live accounts, USD"}
          chipTone="neutral"
          delay={0.05}
        />
        <KpiCard
          label="Accounts"
          icon={<Layers />}
          value={<span className="k-num">{loading ? "—" : accounts.length}</span>}
          footer={
            <div className="flex flex-wrap items-center gap-1.5">
              <Chip size="sm" tone="ember">
                {t.live.length} live
              </Chip>
              <Chip size="sm" tone="gold">
                {t.demo.length} demo
              </Chip>
              <Chip size="sm">{t.positions} open positions</Chip>
            </div>
          }
          delay={0.1}
        />
        <KpiCard
          label="Demo accounts"
          icon={<FlaskConical />}
          value={<span className="k-num">{loading ? "—" : t.demo.length}</span>}
          footer={<span className="text-[11.5px] text-fg-2">{t.demo.length ? `${refills} refill${refills === 1 ? "" : "s"} left today across demo accounts` : "Practise with virtual funds on live prices"}</span>}
          delay={0.15}
        />
      </div>

      <div className="mt-4">
        <Reveal delay={0.05}>
          {error && !data ? (
            <AccountsError onRetry={reload} message={error.status === 0 || error.status >= 500 ? undefined : error.message} />
          ) : (
            <Card>
              <CardHeader
                title="My accounts"
                subtitle="Equity and margin update every few seconds. Open an account for statements, credentials and settings."
                action={
                  <Segmented
                    size="xs"
                    value={active}
                    onChange={setTab}
                    options={[
                      { value: "live", label: <>Live <span className="text-fg-3">{t.live.length}</span></> },
                      { value: "demo", label: <>Demo <span className="text-fg-3">{t.demo.length}</span></> },
                    ]}
                  />
                }
              />
              <div className="mt-4 space-y-3 px-4 pb-5 sm:px-6">
                {loading && <RowsSkeleton />}
                {!loading && list.length === 0 && (
                  <EmptyState
                    illustration={active === "live" ? "money_bag" : "rocket"}
                    title={active === "live" ? "No live accounts yet" : "No demo accounts yet"}
                    text={
                      active === "live"
                        ? "Open a live account now and get your login and passwords instantly. Funding opens with the Kalks wallet."
                        : "A demo account comes with virtual funds on real-time prices, so you can practise without risk."
                    }
                  />
                )}
                {list.map((a) => (
                  <LiveAccountRow key={a.login} a={a} onChanged={reload} />
                ))}
                <Link
                  href={`/accounts/new?type=${active}`}
                  className="flex items-center justify-center gap-2 rounded-[14px] border border-dashed border-line py-4 text-[13.5px] text-fg-3 transition-colors hover:border-ember/40 hover:bg-ember-soft hover:text-ember"
                >
                  <Plus className="size-4" /> Open a new {active} account
                </Link>
              </div>
            </Card>
          )}
        </Reveal>
      </div>

      {groups.data && groups.data.groups.length > 0 && (
        <Reveal delay={0.1} className="mt-4 block">
          <Card>
            <CardHeader
              title="Account types"
              subtitle="Same instruments and Kalks Trader on every type. Pick the pricing and position mode that suit you."
              action={
                <Link href="/accounts/new" className="hidden sm:block">
                  <Button size="sm" variant="surface">
                    Open account <ArrowRight />
                  </Button>
                </Link>
              }
            />
            <div className="grid grid-cols-1 gap-4 px-4 pb-6 pt-4 sm:grid-cols-2 sm:px-6 xl:grid-cols-4">
              {groups.data.groups.map((g) => (
                <Link key={g.code} href={`/accounts/new?group=${encodeURIComponent(g.code)}`} className="block">
                  <EngineGroupCard g={g} compact />
                </Link>
              ))}
            </div>
            <div className="border-t border-line px-6 py-4 text-[12.5px] text-fg-3">
              Negative balance protection on every account · Leverage can be changed only with no open positions · Demo balances can be refilled a few times per day.
            </div>
          </Card>
        </Reveal>
      )}
    </div>
  );
}

export function LiveAccountsPage() {
  return (
    <React.Suspense fallback={null}>
      <Inner />
    </React.Suspense>
  );
}
