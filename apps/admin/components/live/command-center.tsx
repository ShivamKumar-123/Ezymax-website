"use client";

import * as React from "react";
import Link from "next/link";
import { Activity, ArrowUpRight, CandlestickChart, Download, KeyRound, Layers, MailCheck, Receipt, RefreshCw, Scale, ShieldAlert, UserPlus, Users, Wallet } from "lucide-react";
import { Avatar, Button, Card, CardHeader, Chip, EmptyState, Flag, KpiCard, PageHeader, Reveal, Skeleton, cn } from "@kalks/ui";
import { useServerClock } from "@/components/command/kit";
import { ColumnChart } from "@/components/config/kit";
import { useCan } from "@/components/staff-session";
import { EmailChip, ErrorState, actionLabel, actionTone, ago, downloadCsv, useApi, useNow, when } from "./kit";
import type { AuditPage, HealthResp, Stats, UsersPage } from "./types";

function Num({ v }: { v: number | undefined }) {
  return v === undefined ? <Skeleton className="h-8 w-20" /> : <span className="k-num">{v.toLocaleString("en-US")}</span>;
}

function pct(a: number, b: number) {
  return b > 0 ? Math.round((a / b) * 100) : 0;
}

function HealthCard({ health, loading, onRefresh }: { health: HealthResp | null; loading: boolean; onRefresh: () => void }) {
  const now = useNow(10_000);
  return (
    <Card className="h-full">
      <CardHeader
        title="System health"
        subtitle={health ? `Checked ${ago(health.checked_at, now)}` : "Checking services…"}
        icon={<Activity />}
        action={
          <Button size="xs" variant="ghost" onClick={onRefresh} disabled={loading} aria-label="Re-check services">
            <RefreshCw className={cn(loading && "animate-spin")} /> Re-check
          </Button>
        }
      />
      <div className="space-y-2.5 px-4 pb-5 pt-4 sm:px-6">
        {!health &&
          Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-[92px] w-full rounded-[16px]" />
          ))}
        {health?.services.map((s) => (
          <div key={s.key} className="k-row px-4 py-3">
            <div className="flex items-center justify-between gap-3">
              <div className="flex min-w-0 items-center gap-2.5">
                <span className={cn("size-2 shrink-0 rounded-full", s.ok ? "bg-up" : "bg-down")} />
                <div className="min-w-0">
                  <div className="text-[13.5px] font-medium">{s.name}</div>
                  <div className="truncate text-[11.5px] text-fg-3">{s.detail}</div>
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <span className="k-num font-mono text-[12px] text-fg-2">{s.latency_ms} ms</span>
                <Chip size="sm" tone={s.ok ? "up" : "down"}>
                  {s.ok ? "Operational" : s.reachable ? "Degraded" : "Unreachable"}
                </Chip>
              </div>
            </div>
            {Object.keys(s.facts).length > 0 && (
              <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 pl-[18px] text-[11.5px] text-fg-3">
                {Object.entries(s.facts).map(([k, v]) => (
                  <span key={k}>
                    {k} <span className="text-fg-2">{v}</span>
                  </span>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </Card>
  );
}

type TradingSummary = {
  accounts: { live: number; demo: number };
  positions: { total: number; demo: number; A: { positions: number; lots: number; floating: number }; B: { positions: number; lots: number; floating: number } };
  deals: { today: number; clientRealised: number; brokerBRealised: number; since: string };
};

const usd0 = (v: number) => `${v < 0 ? "−" : v > 0 ? "+" : ""}$${Math.abs(v).toLocaleString("en-US", { maximumFractionDigits: 0 })}`;

/** Trading engine KPIs: accounts, open positions, floating P&L by book, today's closing deals. */
function TradingKpis() {
  const { data: t, error, reload } = useApi<TradingSummary>("/api/trading/summary", { refreshMs: 10_000 });
  if (error)
    return (
      <Card className="mt-4">
        <ErrorState error={error} onRetry={reload} className="py-6" />
      </Card>
    );
  const brokerB = t ? -t.positions.B.floating : 0;
  return (
    <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
      <KpiCard label="Trading accounts" icon={<Wallet />} value={<Num v={t?.accounts.live} />} chip={t ? `${t.accounts.demo.toLocaleString("en-US")} demo` : "—"} chipTone="info" href="/trading/accounts" />
      <KpiCard label="Open positions" icon={<Layers />} value={<Num v={t?.positions.total} />} chip={t ? `${t.positions.A.positions} A · ${t.positions.B.positions} B · ${t.positions.demo} demo` : "—"} href="/trading" delay={0.04} />
      <KpiCard
        label="Client floating"
        icon={<CandlestickChart />}
        value={t ? <span className={cn("k-num", t.positions.A.floating + t.positions.B.floating >= 0 ? "text-up" : "text-down")}>{usd0(t.positions.A.floating + t.positions.B.floating)}</span> : <Skeleton className="h-8 w-20" />}
        chip={t ? `A ${usd0(t.positions.A.floating)} · B ${usd0(t.positions.B.floating)}` : "—"}
        href="/trading"
        delay={0.08}
      />
      <KpiCard label="Broker B-book floating" icon={<Scale />} value={t ? <span className={cn("k-num", brokerB >= 0 ? "text-up" : "text-down")}>{usd0(brokerB)}</span> : <Skeleton className="h-8 w-20" />} chip={t ? `${t.positions.B.lots.toLocaleString("en-US", { maximumFractionDigits: 2 })} lots on B` : "—"} chipTone="ember" href="/trading/exposure" delay={0.12} hot />
      <KpiCard label="Deals today" icon={<Receipt />} value={<Num v={t?.deals.today} />} chip={t ? `B-book realised ${usd0(t.deals.brokerBRealised)}` : "—"} href="/trading/dealer?tab=audit" className="sm:col-span-2 xl:col-span-1" delay={0.16} />
    </div>
  );
}

function RecentAudit() {
  const now = useNow();
  const { data, error, reload } = useApi<AuditPage>("/api/admin/audit?per_page=8", { refreshMs: 30_000 });
  return (
    <Card className="h-full">
      <CardHeader
        title="Recent activity"
        subtitle="Latest entries in the audit log"
        icon={<ShieldAlert />}
        action={
          <Link href="/security" className="inline-flex items-center gap-1 text-[12.5px] text-fg-3 hover:text-fg">
            Audit log <ArrowUpRight className="size-3.5" />
          </Link>
        }
      />
      <div className="px-4 pb-5 pt-3 sm:px-6">
        {error && <ErrorState error={error} onRetry={reload} className="py-8" />}
        {!data && !error && Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="mb-2 h-12 w-full" />)}
        {data && data.items.length === 0 && <EmptyState title="No activity yet" text="Sign-ins and staff actions will appear here." illustration="shield" className="py-8" />}
        <div className="divide-y divide-line">
          {data?.items.map((e) => (
            <Link key={e.id} href={`/security?q=${encodeURIComponent(e.action)}`} className="flex items-center justify-between gap-3 py-2.5 hover:opacity-90">
              <div className="flex min-w-0 items-center gap-3">
                <Avatar name={e.actor.name ?? e.actor.kind} size={30} />
                <div className="min-w-0">
                  <div className="truncate text-[13px] font-medium">{actionLabel(e.action)}</div>
                  <div className="truncate text-[11.5px] text-fg-3">
                    {e.actor.name ?? (e.actor.kind === "anonymous" ? String((e.meta as { email?: string }).email ?? "Unknown") : e.actor.kind)}
                    {e.ip ? <span className="font-mono"> · {e.ip}</span> : null}
                  </div>
                </div>
              </div>
              <div className="flex shrink-0 flex-col items-end gap-1">
                <Chip size="sm" tone={actionTone(e.action)}>
                  <span className="font-mono">{e.action}</span>
                </Chip>
                <span className="text-[11px] text-fg-3" title={when(e.created_at, true)}>
                  {ago(e.created_at, now)}
                </span>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </Card>
  );
}

function NewestClients() {
  const now = useNow();
  const { data, error, reload } = useApi<UsersPage>("/api/admin/users?per_page=6", { refreshMs: 60_000 });
  return (
    <Card className="h-full">
      <CardHeader
        title="Newest clients"
        subtitle="Most recent registrations"
        icon={<UserPlus />}
        action={
          <Link href="/clients" className="inline-flex items-center gap-1 text-[12.5px] text-fg-3 hover:text-fg">
            All clients <ArrowUpRight className="size-3.5" />
          </Link>
        }
      />
      <div className="px-4 pb-5 pt-3 sm:px-6">
        {error && <ErrorState error={error} onRetry={reload} className="py-8" />}
        {!data && !error && Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="mb-2 h-12 w-full" />)}
        {data && data.items.length === 0 && <EmptyState title="No clients yet" text="Registrations from the Client Area will appear here." illustration="busts_in_silhouette" className="py-8" />}
        <div className="divide-y divide-line">
          {data?.items.map((u) => (
            <Link key={u.id} href={`/clients/${u.id}`} className="flex items-center justify-between gap-3 py-2.5 hover:opacity-90">
              <div className="flex min-w-0 items-center gap-3">
                <Avatar name={u.name} size={32} />
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5 truncate text-[13px] font-medium">
                    {u.name}
                    <Flag country={u.country} className="size-3.5" />
                  </div>
                  <div className="truncate text-[11.5px] text-fg-3">{u.email}</div>
                </div>
              </div>
              <div className="flex shrink-0 flex-col items-end gap-1">
                <EmailChip verified={u.email_verified} />
                <span className="text-[11px] text-fg-3" title={when(u.created_at)}>
                  {ago(u.created_at, now)}
                </span>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </Card>
  );
}

export function LiveCommandCenter() {
  const clock = useServerClock();
  const canAudit = useCan("audit.read");
  const canClients = useCan("clients.read");
  const canTrading = useCan("dealing.read");
  const { data: s, error, reload } = useApi<Stats>("/api/admin/stats", { refreshMs: 30_000 });
  const health = useApi<HealthResp>("/api/admin/health", { refreshMs: 30_000 });
  const c = s?.clients;
  const allOk = health.data?.services.every((x) => x.ok);

  const chart = (s?.registrations ?? []).map((d) => ({ label: new Date(d.day + "T00:00:00Z").toLocaleDateString("en-GB", { day: "2-digit", month: "short", timeZone: "UTC" }).replace("Sept", "Sep"), values: [d.count] }));

  function exportSnapshot() {
    if (!s) return;
    const rows: (string | number)[][] = [
      ["Clients total", s.clients.total],
      ["Registered today (GMT+3)", s.clients.registered_today],
      ["Registered 7 days", s.clients.registered_7d],
      ["Registered 30 days", s.clients.registered_30d],
      ["Email verified", s.clients.email_verified],
      ["KYC verified", s.clients.kyc_verified],
      ["Active client sessions", s.sessions.clients],
      ["Active staff sessions", s.sessions.staff],
      ["Client sign-ins 24h", s.security.logins_24h],
      ["Failed sign-ins 24h", s.security.failed_logins_24h],
      ...s.registrations.map((d) => [`Registrations ${d.day}`, d.count]),
    ];
    downloadCsv(`command-center-${s.generated_at.slice(0, 10)}`, ["Metric", "Value"], rows);
  }

  return (
    <div className="pb-10">
      <PageHeader
        title="Command Center"
        subtitle={
          <span className="flex flex-wrap items-center gap-x-2">
            {clock ? clock.date : "—"}
            <span className="text-fg-3">·</span>
            Server time <span className="k-num font-mono text-fg">{clock?.time ?? "--:--:--"}</span> GMT+3
            {health.data && (
              <Chip size="sm" tone={allOk ? "up" : "down"} dot className="ml-1">
                {allOk ? "All services operational" : "Service issue"}
              </Chip>
            )}
          </span>
        }
        actions={
          <>
            <Button variant="surface" size="lg" onClick={() => (reload(), health.reload())}>
              <RefreshCw /> Refresh
            </Button>
            <Button variant="ember" size="lg" onClick={exportSnapshot} disabled={!s}>
              <Download /> Export snapshot
            </Button>
          </>
        }
      />

      {error ? (
        <Card>
          <ErrorState error={error} onRetry={reload} />
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
          <KpiCard label="Clients" icon={<Users />} value={<Num v={c?.total} />} chip={c ? `${c.registered_30d.toLocaleString("en-US")} in 30 days` : "—"} chipTone="neutral" href={canClients ? "/clients" : undefined} />
          <KpiCard label="New today" icon={<UserPlus />} value={<Num v={c?.registered_today} />} chip={c ? `${c.registered_7d.toLocaleString("en-US")} in 7 days` : "—"} chipTone="up" href={canClients ? "/clients" : undefined} delay={0.04} />
          <KpiCard label="Verified emails" icon={<MailCheck />} value={<Num v={c?.email_verified} />} chip={c ? `${pct(c.email_verified, c.total)}% of clients` : "—"} chipTone="info" href={canClients ? "/clients?verified=true" : undefined} delay={0.08} />
          <KpiCard
            label="Active sessions"
            icon={<Activity />}
            value={<Num v={s?.sessions.clients} />}
            chip={
              s ? (
                <>
                  <span className="size-1.5 rounded-full bg-up" /> {s.sessions.staff} staff signed in
                </>
              ) : (
                "—"
              )
            }
            chipTone="up"
            href={canAudit ? "/security/sessions" : undefined}
            delay={0.12}
          />
          <KpiCard
            label="Sign-ins · 24h"
            icon={<KeyRound />}
            value={<Num v={s?.security.logins_24h} />}
            chip={s ? `${s.security.failed_logins_24h} failed` : "—"}
            chipTone={s && s.security.failed_logins_24h > 0 ? "warn" : "neutral"}
            href={canAudit ? "/security?action=user.login" : undefined}
            className="sm:col-span-2 xl:col-span-1"
            delay={0.16}
            hot
          />
        </div>
      )}

      {canTrading && <TradingKpis />}

      <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-12">
        <Reveal delay={0.05} className="xl:col-span-8">
          <Card className="h-full">
            <CardHeader title="Registrations" subtitle="New client accounts per day · last 14 days · GMT+3" icon={<UserPlus />} action={c ? <Chip tone="up">{c.registered_7d} this week</Chip> : undefined} />
            <div className="px-4 pb-5 pt-4 sm:px-6">{s ? <ColumnChart data={chart} series={[{ label: "Registrations", tone: "ember" }]} height={240} labelEvery={2} format={(v) => (Number.isInteger(v) ? v.toLocaleString("en-US") : "")} /> : <Skeleton className="h-[270px] w-full" />}</div>
          </Card>
        </Reveal>
        <Reveal delay={0.1} className="xl:col-span-4">
          <HealthCard health={health.data} loading={health.loading} onRefresh={health.reload} />
        </Reveal>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-2">
        {canAudit && (
          <Reveal delay={0.05}>
            <RecentAudit />
          </Reveal>
        )}
        {canClients && (
          <Reveal delay={0.1}>
            <NewestClients />
          </Reveal>
        )}
      </div>

    </div>
  );
}
