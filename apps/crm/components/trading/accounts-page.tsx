"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowRight, FlaskConical, Layers, Plus, RotateCw, ShieldCheck, TrendingUp } from "lucide-react";
import { Button, Card, CardHeader, Chip, EmptyState, KpiCard, Money, PageHeader, Reveal, Segmented, Skeleton } from "@kalks/ui";
import { useT } from "@kalks/i18n/react";
import { toUsd, useAccounts, useGroups, type EngineAccount } from "./api";
import { EngineGroupCard } from "./group-card";
import { LiveAccountRow, isPropAccount, refillsLeft } from "./ui";
import { useReadOnly } from "@/components/session";

export function AccountsError({ onRetry, message }: { onRetry: () => void; message?: string }) {
  const tt = useT();
  return (
    <Card>
      <EmptyState
        art="connectionLost"
        title={tt("accounts.error.unavailableTitle")}
        text={message ?? tt("accounts.error.unavailableText")}
        action={
          <Button variant="surface" onClick={onRetry}>
            <RotateCw /> {tt("common.retry")}
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
/** Totals of the client's own live money: prop-challenge accounts (simulated capital) are left out. */
export function liveTotals(accounts: EngineAccount[]) {
  const live = accounts.filter((a) => a.type === "live" && !isPropAccount(a));
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
  const tt = useT();
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
  const readOnly = useReadOnly();

  return (
    <div className="pb-16">
      <PageHeader
        title={tt("accounts.list.title")}
        subtitle={tt("accounts.list.subtitle")}
        actions={
          !readOnly && <Link href={`/accounts/new${active === "demo" ? "?type=demo" : ""}`}>
            <Button variant="ember" size="lg">
              <Plus /> {tt("accounts.list.openAccount")}
            </Button>
          </Link>
        }
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          label={tt("accounts.kpi.liveEquity")}
          icon={<TrendingUp />}
          value={loading ? <Skeleton className="h-8 w-32" /> : <Money value={t.equity} countUp={false} />}
          chip={t.live.length ? tt("accounts.kpi.balanceChip", { amount: `$${t.balance.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` }) : tt("accounts.empty.noLive")}
          chipTone="neutral"
          href="/portfolio"
        />
        <KpiCard
          label={tt("accounts.label.freeMargin")}
          icon={<ShieldCheck />}
          value={loading ? <Skeleton className="h-8 w-32" /> : <Money value={t.free} countUp={false} />}
          chip={t.equity > 0 ? tt("accounts.kpi.ofEquity", { pct: ((t.free / t.equity) * 100).toFixed(1) }) : tt("accounts.kpi.liveUsd")}
          chipTone="neutral"
          delay={0.05}
        />
        <KpiCard
          label={tt("common.accounts")}
          icon={<Layers />}
          value={<span className="k-num">{loading ? "—" : accounts.length}</span>}
          footer={
            <div className="flex flex-wrap items-center gap-1.5">
              <Chip size="sm" tone="ember">
                {tt("accounts.kpi.liveCount", { count: t.live.length })}
              </Chip>
              <Chip size="sm" tone="gold">
                {tt("accounts.kpi.demoCount", { count: t.demo.length })}
              </Chip>
              <Chip size="sm">{tt("accounts.kpi.openPositions", { count: t.positions })}</Chip>
            </div>
          }
          delay={0.1}
        />
        <KpiCard
          label={tt("accounts.kpi.demoAccounts")}
          icon={<FlaskConical />}
          value={<span className="k-num">{loading ? "—" : t.demo.length}</span>}
          footer={<span className="text-[11.5px] text-fg-2">{t.demo.length ? tt("accounts.kpi.refillsLeftToday", { count: refills }) : tt("accounts.kpi.practise")}</span>}
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
                title={tt("accounts.list.myAccounts")}
                subtitle={tt("accounts.list.liveHint")}
                action={
                  <Segmented
                    size="xs"
                    value={active}
                    onChange={setTab}
                    options={[
                      { value: "live", label: <>{tt("common.live")} <span className="text-fg-3">{t.live.length}</span></> },
                      { value: "demo", label: <>{tt("common.demo")} <span className="text-fg-3">{t.demo.length}</span></> },
                    ]}
                  />
                }
              />
              <div className="mt-4 space-y-3 px-4 pb-5 sm:px-6">
                {loading && <RowsSkeleton />}
                {!loading && list.length === 0 && (
                  <EmptyState
                    art="welcome"
                    title={active === "live" ? tt("accounts.empty.noLive") : tt("accounts.empty.noDemo")}
                    text={
                      active === "live"
                        ? tt("accounts.empty.liveText")
                        : tt("accounts.empty.demoText")
                    }
                  />
                )}
                {list.map((a) => (
                  <LiveAccountRow key={a.login} a={a} onChanged={reload} />
                ))}
                {!readOnly && <Link
                  href={`/accounts/new?type=${active}`}
                  className="flex items-center justify-center gap-2 rounded-[14px] border border-dashed border-line py-4 text-[13.5px] text-fg-3 transition-colors hover:border-ember/40 hover:bg-ember-soft hover:text-ember"
                >
                  <Plus className="size-4" /> {active === "demo" ? tt("accounts.list.openNewDemo") : tt("accounts.list.openNewLive")}
                </Link>}
              </div>
            </Card>
          )}
        </Reveal>
      </div>

      {!readOnly && groups.data && groups.data.groups.length > 0 && (
        <Reveal delay={0.1} className="mt-4 block">
          <Card>
            <CardHeader
              title={tt("accounts.types.title")}
              subtitle={tt("accounts.types.subtitle")}
              action={
                <Link href="/accounts/new" className="hidden sm:block">
                  <Button size="sm" variant="surface">
                    {tt("accounts.list.openAccount")} <ArrowRight className="rtl:-scale-x-100" />
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
              {tt("accounts.types.footer")}
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
