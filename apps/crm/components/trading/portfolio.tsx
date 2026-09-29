"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { BookText, Check, Download, FileSpreadsheet, FileText, History, Layers, Plus, Sheet, ShieldCheck, TrendingUp, Wallet } from "lucide-react";
import { toast } from "sonner";
import { Button, CHART_COLORS, Card, CardHeader, Chip, Donut, EmptyState, Field, Input, KpiCard, Money, PageHeader, Reveal, Segmented, Skeleton, SymbolAvatar, Toggle, cn } from "@kalks/ui";
import { accountTitle, curOf, fmtAmount, fmtPrice, isoDay, toUsd, tradingApi, useAccounts, type AccountDetail, type EngineAccount, type EnginePosition } from "./api";
import { AccountsError, liveTotals } from "./accounts-page";
import { HistoryPanel, LedgerPanel } from "./activity";
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
/* Statements (D48, D50): reports service                              */
/* ------------------------------------------------------------------ */

type StPeriod = "day" | "month" | "year" | "custom";
type StFormat = "pdf" | "csv" | "xlsx";
type MonthRow = { month: string; from: string; to: string; net: number; deposits: number; withdrawals: number; trades: number };

const ST_FORMATS: Record<StFormat, { label: string; icon: React.ReactNode; note: string }> = {
  pdf: { label: "PDF", icon: <FileText />, note: "Branded statement: summary, trades, positions, ledger" },
  xlsx: { label: "Excel", icon: <FileSpreadsheet />, note: "One sheet per section" },
  csv: { label: "CSV", icon: <Sheet />, note: "All sections in one file" },
};

const addDays = (d: string, n: number) => {
  const x = new Date(`${d}T00:00:00Z`);
  x.setUTCDate(x.getUTCDate() + n);
  return x.toISOString().slice(0, 10);
};

/** [from, to) in server days for the chosen period; null when the input is incomplete. */
function stRange(p: StPeriod, day: string, month: string, year: string, from: string, to: string): { from: string; to: string; label: string } | null {
  if (p === "day") return day ? { from: day, to: addDays(day, 1), label: new Date(`${day}T00:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }) } : null;
  if (p === "month") {
    if (!/^\d{4}-\d{2}$/.test(month)) return null;
    const [y, m] = month.split("-").map(Number) as [number, number];
    const next = m === 12 ? `${y + 1}-01-01` : `${y}-${String(m + 1).padStart(2, "0")}-01`;
    return { from: `${month}-01`, to: next, label: new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString("en-GB", { month: "long", year: "numeric", timeZone: "UTC" }) };
  }
  if (p === "year") return { from: `${year}-01-01`, to: `${+year + 1}-01-01`, label: `Year ${year}` };
  if (!from || !to || from > to) return null;
  return { from, to: addDays(to, 1), label: `${from} to ${to}` };
}

function stUrl(login: number, from: string, to: string, f: StFormat, opts?: { open: boolean; charges: boolean; deals: boolean }) {
  const q = new URLSearchParams({ from, to, format: f });
  if (opts && !opts.open) q.set("open", "0");
  if (opts && !opts.charges) q.set("charges", "0");
  if (opts && !opts.deals) q.set("deals", "0");
  return `/api/reports/accounts/${login}/statement?${q}`;
}

function download(url: string, what: string) {
  const a = document.createElement("a");
  a.href = url;
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();
  toast.success("Statement download started", { description: what });
}

function Statements({ a }: { a: EngineAccount }) {
  const today = isoDay(new Date());
  const [period, setPeriod] = React.useState<StPeriod>("month");
  const [day, setDay] = React.useState(today);
  const [month, setMonth] = React.useState(today.slice(0, 7));
  const [year, setYear] = React.useState(today.slice(0, 4));
  const [from, setFrom] = React.useState(`${today.slice(0, 7)}-01`);
  const [to, setTo] = React.useState(today);
  const [format, setFormat] = React.useState<StFormat>("pdf");
  const [withOpen, setWithOpen] = React.useState(true);
  const [withCharges, setWithCharges] = React.useState(true);
  const [withDeals, setWithDeals] = React.useState(true);
  const [months, setMonths] = React.useState<MonthRow[] | null>(null);
  const [monthsError, setMonthsError] = React.useState(false);
  const range = stRange(period, day, month, year, from, to);
  const created = new Date(a.createdAt);
  const firstYear = created.getFullYear();
  const years = Array.from({ length: new Date().getFullYear() - firstYear + 1 }, (_, i) => String(new Date().getFullYear() - i));

  React.useEffect(() => {
    let stop = false;
    fetch(`/api/reports/accounts/${a.login}/months`, { cache: "no-store" })
      .then(async (r) => {
        const j = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error();
        if (!stop) setMonths((j.months ?? []) as MonthRow[]);
      })
      .catch(() => !stop && setMonthsError(true));
    return () => {
      stop = true;
    };
  }, [a.login]);

  const cur = curOf(a);
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-12">
        <Reveal className="xl:col-span-8">
          <Card className="h-full">
            <CardHeader title="Generate a statement" subtitle={`#${a.login} · ${accountTitle(a)} · server time (GMT+2/+3)`} icon={<FileText />} />
            <div className="space-y-5 px-4 pb-6 pt-5 sm:px-6">
              <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
                <div>
                  <div className="mb-2 text-[12.5px] font-medium text-fg-2">Period</div>
                  <Segmented
                    value={period}
                    onChange={setPeriod}
                    options={[
                      { value: "day", label: "Day" },
                      { value: "month", label: "Month" },
                      { value: "year", label: "Year" },
                      { value: "custom", label: "Custom" },
                    ]}
                  />
                  <div className="mt-3">
                    {period === "day" && (
                      <Field label="Date">
                        <Input type="date" value={day} max={today} onChange={(e) => setDay(e.target.value)} />
                      </Field>
                    )}
                    {period === "month" && (
                      <Field label="Month">
                        <Input type="month" value={month} max={today.slice(0, 7)} onChange={(e) => setMonth(e.target.value)} />
                      </Field>
                    )}
                    {period === "year" && (
                      <div className="flex flex-wrap gap-2">
                        {years.map((y) => (
                          <button key={y} type="button" onClick={() => setYear(y)} className={cn("k-num h-10 rounded-full border px-5 text-[13px] font-medium transition-colors", y === year ? "border-ember/40 bg-ember-soft text-ember" : "border-line bg-surface-2 text-fg-2 hover:text-fg")}>
                            {y}
                            {y === today.slice(0, 4) && <span className="ml-1 text-fg-3">YTD</span>}
                          </button>
                        ))}
                      </div>
                    )}
                    {period === "custom" && (
                      <div className="grid grid-cols-2 gap-2">
                        <Field label="From">
                          <Input type="date" value={from} max={today} onChange={(e) => setFrom(e.target.value)} />
                        </Field>
                        <Field label="To">
                          <Input type="date" value={to} max={today} onChange={(e) => setTo(e.target.value)} />
                        </Field>
                      </div>
                    )}
                  </div>
                </div>
                <div>
                  <div className="mb-2 text-[12.5px] font-medium text-fg-2">Format</div>
                  <div className="grid grid-cols-3 gap-2">
                    {(Object.keys(ST_FORMATS) as StFormat[]).map((f) => (
                      <button
                        key={f}
                        type="button"
                        aria-pressed={f === format}
                        onClick={() => setFormat(f)}
                        className={cn("k-row flex flex-col items-start gap-1.5 px-3 py-3 text-left transition-colors [&_svg]:size-4", f === format ? "border-ember/40 bg-ember-soft text-ember" : "text-fg-2 hover:bg-surface-3/60")}
                      >
                        {ST_FORMATS[f].icon}
                        <span className="text-[13px] font-semibold text-fg">{ST_FORMATS[f].label}</span>
                        <span className="text-[10.5px] leading-tight text-fg-3">{ST_FORMATS[f].note}</span>
                      </button>
                    ))}
                  </div>
                  <div className="mt-3 space-y-2.5 rounded-[14px] border border-line bg-surface-2 px-4 py-3">
                    {(
                      [
                        ["Open positions and pending orders", withOpen, setWithOpen],
                        ["Charges breakdown", withCharges, setWithCharges],
                        ["Every deal (entries and exits)", withDeals, setWithDeals],
                      ] as const
                    ).map(([l, v, set]) => (
                      <div key={l} className="flex items-center justify-between text-[13px] text-fg-2">
                        {l}
                        <Toggle checked={v} onChange={set} label={l} />
                      </div>
                    ))}
                  </div>
                </div>
              </div>
              <div className="flex flex-col gap-3 border-t border-line pt-5 sm:flex-row sm:items-center sm:justify-between">
                <div className="text-[12.5px] text-fg-3">
                  {range ? (
                    <>
                      <span className="text-fg-2">{range.label}</span> · {ST_FORMATS[format].label}
                    </>
                  ) : (
                    "Choose a valid period"
                  )}
                </div>
                <Button
                  variant="ember"
                  disabled={!range}
                  onClick={() => range && download(stUrl(a.login, range.from, range.to, format, { open: withOpen, charges: withCharges, deals: withDeals }), `#${a.login} · ${range.label} · ${ST_FORMATS[format].label}`)}
                >
                  <Download /> Download statement
                </Button>
              </div>
            </div>
          </Card>
        </Reveal>
        <Reveal delay={0.05} className="xl:col-span-4">
          <Card className="h-full">
            <CardHeader title="What's in your statement" />
            <ul className="space-y-2.5 px-6 pb-6 pt-4 text-[13px] text-fg-2">
              {[
                "Account details, opening and closing balance",
                "Every closed trade with commission, swap and profit",
                "Open positions and pending orders at generation time",
                "Deposits, withdrawals, transfers, credit and bonus",
                "Charges: commission, swap, fees and the spread cost",
                "Totals reconciled to the ledger",
              ].map((x) => (
                <li key={x} className="flex gap-2.5">
                  <Check className="mt-0.5 size-4 shrink-0 text-ember" />
                  {x}
                </li>
              ))}
            </ul>
          </Card>
        </Reveal>
      </div>

      <Reveal delay={0.08}>
        <Card>
          <CardHeader title="Monthly statements" subtitle={`Calendar months since the account was opened · ${cur.trim()}`} />
          <div className="space-y-2 px-4 pb-6 pt-4 sm:px-6">
            {months === null && !monthsError && <Skeleton className="h-[120px] w-full rounded-[14px]" />}
            {monthsError && <div className="py-4 text-[13px] text-fg-3">Monthly statements are unavailable right now.</div>}
            {months?.map((m) => {
              const label = new Date(`${m.from}T00:00:00Z`).toLocaleDateString("en-GB", { month: "long", year: "numeric", timeZone: "UTC" });
              return (
                <div key={m.month} className="k-row flex flex-col gap-3 px-4 py-3 md:flex-row md:items-center">
                  <div className="flex min-w-0 flex-1 items-center gap-3">
                    <span className="grid size-10 shrink-0 place-items-center rounded-xl border border-line bg-surface-3 text-fg-2">
                      <FileText className="size-4" />
                    </span>
                    <div className="min-w-0">
                      <div className="text-[14px] font-medium">{label}</div>
                      <div className="truncate text-[11.5px] text-fg-3">
                        {m.trades} closed trade{m.trades === 1 ? "" : "s"}
                      </div>
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-4 text-right md:w-[360px]">
                    {(
                      [
                        ["Net P&L", m.net, true],
                        ["Deposits", m.deposits, false],
                        ["Withdrawn", m.withdrawals, false],
                      ] as const
                    ).map(([k, v, signed]) => (
                      <div key={k}>
                        <div className="text-[10.5px] uppercase tracking-wider text-fg-3">{k}</div>
                        <div className={cn("k-num text-[13px] font-medium", signed ? (v > 0 ? "text-up" : v < 0 ? "text-down" : "text-fg-3") : v ? "text-fg" : "text-fg-3")}>{fmtAmount(v, cur, signed)}</div>
                      </div>
                    ))}
                  </div>
                  <div className="flex items-center gap-1.5 md:justify-end">
                    {(["pdf", "xlsx", "csv"] as const).map((f) => (
                      <Button key={f} size="xs" variant="surface" onClick={() => download(stUrl(a.login, m.from, m.to, f), `#${a.login} · ${label} · ${ST_FORMATS[f].label}`)}>
                        {f === "pdf" && <Download />} {f === "xlsx" ? "XLSX" : f.toUpperCase()}
                      </Button>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      </Reveal>
    </div>
  );
}

export function LiveStatementsPage() {
  return (
    <Wrap>
      <PickerPage base="/portfolio/statements" title="Statements" subtitle="Branded PDF statements and Excel / CSV exports of trades, ledger and charges for any period.">
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
