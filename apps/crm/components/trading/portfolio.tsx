"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { BookText, Download, FileText, History, Layers, Plus, ShieldCheck, TrendingUp, Wallet } from "lucide-react";
import { Button, CHART_COLORS, Card, CardHeader, Chip, Donut, EmptyState, KpiCard, Money, PageHeader, Reveal, Skeleton, SymbolAvatar, cn } from "@kalks/ui";
import { accountTitle, curOf, downloadExport, fmtAmount, fmtPrice, isoDay, toUsd, tradingApi, useAccounts, type AccountDetail, type EngineAccount, type EnginePosition } from "./api";
import { AccountsError, liveTotals } from "./accounts-page";
import { HistoryPanel, LedgerPanel, RangePicker, rangeQuery, type Range } from "./activity";
import { KindBadge, TradeButton } from "./ui";

/* ------------------------------------------------------------------ */
/* Account picker (history / ledger / statements)                      */
/* ------------------------------------------------------------------ */

function AccountPicker({ accounts, value, onChange }: { accounts: EngineAccount[]; value: number; onChange: (login: number) => void }) {
  return (
    <div className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
      <div className="flex min-w-max gap-2">
        {accounts.map((a) => {
          const on = a.login === value;
          return (
            <button
              key={a.login}
              type="button"
              aria-pressed={on}
              onClick={() => onChange(a.login)}
              className={cn("k-row flex items-center gap-2.5 px-3.5 py-2.5 text-left transition-colors", on ? "border-ember/50 bg-ember-soft" : "hover:border-[var(--k-border-top)]")}
            >
              <KindBadge type={a.type} />
              <span>
                <span className="block font-mono text-[13px] font-medium">#{a.login}</span>
                <span className="block text-[11px] text-fg-3">{accountTitle(a)}</span>
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function useSelectedAccount(base: string) {
  const sp = useSearchParams();
  const router = useRouter();
  const { data, error, loading, reload } = useAccounts(10000);
  const accounts = data?.accounts ?? [];
  const wanted = Number(sp.get("account"));
  const a = accounts.find((x) => x.login === wanted) ?? accounts.find((x) => x.type === "live") ?? accounts[0];
  const select = (login: number) => router.replace(`${base}?account=${login}`, { scroll: false });
  return { accounts, a, select, error: error && !data ? error : null, loading, reload };
}

function NoAccounts() {
  return (
    <Card>
      <EmptyState
        illustration="bar_chart"
        title="No trading accounts yet"
        text="Open a live or demo account; its trades, ledger and statements appear here."
        action={
          <Link href="/accounts/new">
            <Button variant="ember">
              <Plus /> Open account
            </Button>
          </Link>
        }
      />
    </Card>
  );
}

function PickerPage({ base, title, subtitle, children }: { base: string; title: string; subtitle: string; children: (a: EngineAccount) => React.ReactNode }) {
  const { accounts, a, select, error, loading, reload } = useSelectedAccount(base);
  return (
    <div className="pb-16">
      <PageHeader title={title} subtitle={subtitle} />
      {loading && <Skeleton className="h-[360px] w-full rounded-[20px]" />}
      {error && <AccountsError onRetry={reload} />}
      {!loading && !error && accounts.length === 0 && <NoAccounts />}
      {a && (
        <div className="space-y-4">
          <AccountPicker accounts={accounts} value={a.login} onChange={select} />
          <div key={a.login}>{children(a)}</div>
        </div>
      )}
    </div>
  );
}

function Wrap({ children }: { children: React.ReactNode }) {
  return <React.Suspense fallback={null}>{children}</React.Suspense>;
}

export function LiveHistoryPage() {
  return (
    <Wrap>
      <PickerPage base="/portfolio/history" title="Trade history" subtitle="Entry and exit deals per account, with CSV export.">
        {(a) => <HistoryPanel a={a} title={`Trade history · #${a.login}`} />}
      </PickerPage>
    </Wrap>
  );
}

export function LiveLedgerPage() {
  return (
    <Wrap>
      <PickerPage base="/portfolio/ledger" title="Ledger" subtitle="Every balance, credit and bonus movement per account.">
        {(a) => <LedgerPanel a={a} title={`Balance ledger · #${a.login}`} />}
      </PickerPage>
    </Wrap>
  );
}

/* ------------------------------------------------------------------ */
/* Statements (D48)                                                    */
/* ------------------------------------------------------------------ */

function monthsBack(n: number) {
  const out: { label: string; from: string; to: string }[] = [];
  const now = new Date();
  for (let i = 0; i < n; i++) {
    const start = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const end = new Date(now.getFullYear(), now.getMonth() - i + 1, 1);
    out.push({ label: start.toLocaleDateString("en-GB", { month: "long", year: "numeric" }), from: isoDay(start), to: isoDay(end) });
  }
  return out;
}

function Statements({ a }: { a: EngineAccount }) {
  const [range, setRange] = React.useState<Range>({ preset: "30d" });
  const q = rangeQuery(range);
  const invalid = range.preset === "custom" && (!range.from || !range.to || range.from > range.to);
  const created = new Date(a.createdAt);
  const months = monthsBack(6).filter((m) => new Date(`${m.to}T00:00:00`) > new Date(created.getFullYear(), created.getMonth(), 1));
  return (
    <div className="grid grid-cols-1 gap-4 xl:grid-cols-12">
      <Reveal className="xl:col-span-7">
        <Card className="h-full">
          <CardHeader title="Custom statement" subtitle={`#${a.login} · ${accountTitle(a)} · CSV, times in UTC`} icon={<FileText />} />
          <div className="space-y-5 px-4 pb-6 pt-4 sm:px-6">
            <RangePicker value={range} onChange={setRange} />
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <button type="button" disabled={invalid} onClick={() => downloadExport(a.login, "history", q.from, q.to)} className="k-row flex items-center gap-3 p-4 text-left transition-colors hover:border-[var(--k-border-top)] disabled:opacity-50">
                <span className="grid size-10 shrink-0 place-items-center rounded-full border border-line bg-surface-3 text-fg-2">
                  <History className="size-4" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[14px] font-medium">Trades</span>
                  <span className="block text-[12px] text-fg-3">Every deal with price, commission, swap and profit</span>
                </span>
                <Download className="size-4 text-fg-3" />
              </button>
              <button type="button" disabled={invalid} onClick={() => downloadExport(a.login, "ledger", q.from, q.to)} className="k-row flex items-center gap-3 p-4 text-left transition-colors hover:border-[var(--k-border-top)] disabled:opacity-50">
                <span className="grid size-10 shrink-0 place-items-center rounded-full border border-line bg-surface-3 text-fg-2">
                  <BookText className="size-4" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[14px] font-medium">Ledger</span>
                  <span className="block text-[12px] text-fg-3">Deposits, trade results, commissions, refills</span>
                </span>
                <Download className="size-4 text-fg-3" />
              </button>
            </div>
          </div>
        </Card>
      </Reveal>
      <Reveal delay={0.05} className="xl:col-span-5">
        <Card className="h-full">
          <CardHeader title="Monthly statements" subtitle="Calendar months since the account was opened" />
          <div className="space-y-2 px-4 pb-6 pt-4 sm:px-6">
            {months.map((m) => (
              <div key={m.from} className="k-row flex items-center gap-3 px-4 py-2.5">
                <FileText className="size-4 shrink-0 text-fg-3" />
                <span className="flex-1 text-[13.5px] font-medium">{m.label}</span>
                <Button size="xs" variant="surface" onClick={() => downloadExport(a.login, "history", m.from, m.to)}>
                  Trades
                </Button>
                <Button size="xs" variant="surface" onClick={() => downloadExport(a.login, "ledger", m.from, m.to)}>
                  Ledger
                </Button>
              </div>
            ))}
          </div>
        </Card>
      </Reveal>
    </div>
  );
}

export function LiveStatementsPage() {
  return (
    <Wrap>
      <PickerPage base="/portfolio/statements" title="Statements" subtitle="Download trade and ledger statements for any account and period.">
        {(a) => <Statements a={a} />}
      </PickerPage>
    </Wrap>
  );
}

/* ------------------------------------------------------------------ */
/* Overview                                                            */
/* ------------------------------------------------------------------ */

/** Open positions of every account that has some (refreshed every 10 s). */
function useOpenPositions(accounts: EngineAccount[]) {
  const withPos = accounts.filter((a) => a.positions > 0).map((a) => a.login);
  const key = withPos.join(",");
  const [rows, setRows] = React.useState<{ a: EngineAccount; p: EnginePosition }[] | null>(null);
  const accRef = React.useRef(accounts);
  accRef.current = accounts;
  React.useEffect(() => {
    if (!key) {
      setRows([]);
      return;
    }
    let stop = false;
    const load = async () => {
      const logins = key.split(",");
      const res = await Promise.allSettled(logins.map((l) => tradingApi<AccountDetail>(`accounts/${l}`)));
      if (stop) return;
      setRows(res.flatMap((r) => (r.status === "fulfilled" ? r.value.positions.map((p) => ({ a: r.value.account, p })) : [])));
    };
    load();
    const t = setInterval(() => document.visibilityState === "visible" && load(), 10000);
    return () => {
      stop = true;
      clearInterval(t);
    };
  }, [key]);
  return rows;
}

export function LivePortfolio() {
  const { data, error, loading, reload } = useAccounts(5000);
  const accounts = data?.accounts ?? [];
  const t = liveTotals(accounts);
  const positions = useOpenPositions(accounts);
  const alloc = t.live.filter((a) => a.equity > 0).map((a, i) => ({ label: `#${a.login}`, value: toUsd(a, a.equity), color: CHART_COLORS[i % CHART_COLORS.length]! }));
  const allocTotal = alloc.reduce((s, d) => s + d.value, 0);

  return (
    <div className="pb-16">
      <PageHeader
        title="Portfolio"
        subtitle="Your trading accounts in one view. Totals are live accounts in USD (cent accounts converted from USC)."
        actions={
          <>
            <Link href="/portfolio/statements">
              <Button variant="surface">
                <FileText /> Statements
              </Button>
            </Link>
            <Link href="/accounts/new">
              <Button variant="ember">
                <Plus /> Open account
              </Button>
            </Link>
          </>
        }
      />

      {error && !data ? (
        <AccountsError onRetry={reload} />
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <KpiCard label="Live equity" icon={<TrendingUp />} value={loading ? <Skeleton className="h-8 w-32" /> : <Money value={t.equity} countUp={false} />} chip={`${t.live.length} live account${t.live.length === 1 ? "" : "s"}`} href="/accounts" />
            <KpiCard label="Live balance" icon={<Wallet />} value={loading ? <Skeleton className="h-8 w-32" /> : <Money value={t.balance} countUp={false} />} chip="Excludes floating P&L" delay={0.05} />
            <KpiCard
              label="Floating P&L"
              icon={<ShieldCheck />}
              value={loading ? <Skeleton className="h-8 w-32" /> : <Money value={t.profit} signed tone="auto" countUp={false} />}
              chip={`Free margin $${t.free.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
              delay={0.1}
            />
            <KpiCard
              label="Open positions"
              icon={<Layers />}
              value={<span className="k-num">{loading ? "—" : t.positions}</span>}
              footer={
                <div className="flex items-center gap-1.5">
                  <Chip size="sm" tone="ember">
                    {t.live.length} live
                  </Chip>
                  <Chip size="sm" tone="gold">
                    {t.demo.length} demo
                  </Chip>
                </div>
              }
              delay={0.15}
            />
          </div>

          {!loading && accounts.length === 0 && (
            <div className="mt-4">
              <NoAccounts />
            </div>
          )}

          {accounts.length > 0 && (
            <>
              <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-12">
                <Reveal delay={0.05} className="xl:col-span-5">
                  <Card className="h-full">
                    <CardHeader title="Equity allocation" subtitle="Live accounts, USD equivalent" />
                    {allocTotal > 0 ? (
                      <div className="flex flex-col items-center gap-6 px-6 pb-6 pt-4 sm:flex-row">
                        <Donut
                          data={alloc}
                          size={160}
                          thickness={18}
                          center={
                            <div className="text-center">
                              <div className="text-[11px] uppercase tracking-wider text-fg-3">Total</div>
                              <Money value={allocTotal} decimals={0} countUp={false} className="text-[17px] font-semibold" />
                            </div>
                          }
                        />
                        <div className="w-full flex-1 space-y-1.5">
                          {alloc.map((d) => (
                            <div key={d.label} className="flex items-center gap-2.5 text-[12.5px]">
                              <span className="size-2.5 shrink-0 rounded-full" style={{ background: d.color }} />
                              <span className="flex-1 font-mono text-fg-2">{d.label}</span>
                              <span className="k-num font-medium">{((d.value / allocTotal) * 100).toFixed(1)}%</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <div className="px-6 pb-6 pt-4 text-[13px] text-fg-3">
                        {t.live.length ? "Your live accounts have no equity yet. Deposits open with the Kalks wallet." : "Open a live account to see your equity split here."}
                      </div>
                    )}
                  </Card>
                </Reveal>
                <Reveal delay={0.1} className="xl:col-span-7">
                  <Card className="h-full">
                    <CardHeader
                      title="Accounts"
                      subtitle="Equity and margin per account"
                      action={
                        <Link href="/accounts">
                          <Button size="sm" variant="surface">
                            Manage
                          </Button>
                        </Link>
                      }
                    />
                    <div className="mt-3 overflow-x-auto px-4 pb-5 sm:px-6">
                      <table className="w-full min-w-[560px] border-separate border-spacing-y-1.5 text-[13px]">
                        <thead>
                          <tr className="text-[11px] uppercase tracking-wider text-fg-3">
                            <th className="px-3 text-left font-medium">Account</th>
                            <th className="px-3 text-right font-medium">Balance</th>
                            <th className="px-3 text-right font-medium">Equity</th>
                            <th className="px-3 text-right font-medium">Floating</th>
                            <th className="px-3 text-right font-medium">Positions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {accounts.map((a) => {
                            const cur = curOf(a);
                            return (
                              <tr key={a.login} className="bg-surface-2">
                                <td className="rounded-l-[12px] border-y border-l border-line px-3 py-2.5">
                                  <Link href={`/accounts/${a.login}`} className="flex items-center gap-2 hover:text-ember">
                                    <KindBadge type={a.type} />
                                    <span className="font-mono">#{a.login}</span>
                                    <span className="hidden text-[12px] text-fg-3 sm:inline">{a.groupName}</span>
                                  </Link>
                                </td>
                                <td className="k-num border-y border-line px-3 text-right">{fmtAmount(a.balance, cur)}</td>
                                <td className="k-num border-y border-line px-3 text-right font-medium">{fmtAmount(a.equity, cur)}</td>
                                <td className={cn("k-num border-y border-line px-3 text-right", a.profit > 0 ? "text-up" : a.profit < 0 ? "text-down" : "text-fg-3")}>{fmtAmount(a.profit, cur, true)}</td>
                                <td className="k-num rounded-r-[12px] border-y border-r border-line px-3 text-right text-fg-2">{a.positions}</td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </Card>
                </Reveal>
              </div>

              <Reveal delay={0.1} className="mt-4 block">
                <Card>
                  <CardHeader title="Open positions" subtitle="Across all accounts, refreshed every 10 seconds" />
                  <div className="mt-3 space-y-2 px-4 pb-5 sm:px-6">
                    {positions === null && <Skeleton className="h-24 w-full rounded-[14px]" />}
                    {positions && positions.length === 0 && <div className="py-8 text-center text-[13px] text-fg-3">No open positions right now.</div>}
                    {positions?.map(({ a, p }) => (
                      <div key={`${a.login}-${p.ticket}`} className="k-row flex flex-wrap items-center gap-3 px-4 py-2.5">
                        <SymbolAvatar symbol={p.symbol} size={24} />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 text-[13.5px] font-medium">
                            {p.symbol}
                            <Chip size="sm" tone={p.side === "buy" ? "up" : "down"}>
                              {p.side.toUpperCase()} {p.volume}
                            </Chip>
                            <KindBadge type={a.type} />
                          </div>
                          <div className="k-num mt-0.5 truncate font-mono text-[11px] text-fg-3">
                            #{a.login} · {fmtPrice(p.openPrice)} → {fmtPrice(p.currentPrice)}
                          </div>
                        </div>
                        <span className={cn("k-num text-[14px] font-semibold", p.profit > 0 ? "text-up" : p.profit < 0 ? "text-down" : "")}>{fmtAmount(p.profit, curOf(a), true)}</span>
                        <TradeButton a={a} label="Trader" />
                      </div>
                    ))}
                  </div>
                </Card>
              </Reveal>

              <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
                {[
                  { href: "/portfolio/history", icon: <History />, title: "Trade history", text: "Every deal, per account" },
                  { href: "/portfolio/ledger", icon: <BookText />, title: "Ledger", text: "Balance movements, per account" },
                  { href: "/portfolio/statements", icon: <FileText />, title: "Statements", text: "Monthly and custom CSV exports" },
                ].map((l) => (
                  <Link key={l.href} href={l.href} className="k-card flex items-center gap-3 rounded-[20px] px-5 py-4 transition-colors hover:border-[var(--k-border-top)]">
                    <span className="grid size-10 shrink-0 place-items-center rounded-full border border-line bg-surface-2 text-fg-2 [&_svg]:size-4">{l.icon}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-[14px] font-medium">{l.title}</span>
                      <span className="block text-[12px] text-fg-3">{l.text}</span>
                    </span>
                  </Link>
                ))}
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}
