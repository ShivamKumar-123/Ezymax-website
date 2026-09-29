"use client";

import * as React from "react";
import Link from "next/link";
import { Activity, Building2, Coins, Receipt, RefreshCw, Users } from "lucide-react";
import { Button, Card, CardHeader, Chip, DataTable, EmptyState, KpiCard, MiniBars, PageHeader, formatNumber, type Column } from "@kalks/ui";
import { ErrorState, TableSkeleton, ago, day, useApi, useNow } from "@/components/live/kit";
import { STATUS_TONE, cap, money, pct } from "@/components/rbac/kit";
import type { Dashboard } from "./types";

type Row = Dashboard["tenants"][number];

const ACTION: Record<string, string> = {
  "owner.tenant_created": "Tenant created",
  "owner.tenant_updated": "Tenant updated",
  "owner.tenant_suspended": "Tenant suspended",
  "owner.tenant_activated": "Tenant re-activated",
  "owner.billing_updated": "Billing plan changed",
  "owner.invoice_created": "Invoice created",
  "owner.invoice_status": "Invoice status changed",
  "owner.admin_invited": "Super Admin invited",
  "owner.flag_created": "Feature flag created",
  "owner.flag_updated": "Feature flag updated",
  "owner.flag_deleted": "Feature flag deleted",
};

/** Cross-tenant dashboard for the Platform Owner (D122). */
export function LiveOwnerDashboard() {
  const now = useNow();
  const { data, error, reload } = useApi<Dashboard>("/api/owner/dashboard", { refreshMs: 60_000 });
  const t = data?.totals;
  const columns: Column<Row>[] = [
    {
      key: "t",
      header: "Tenant",
      cell: (r) => (
        <Link href={`/brokers/${r.id}`} className="min-w-0 hover:text-ember">
          <span className="block truncate font-medium">{r.name}</span>
          <span className="block text-[12px] text-fg-3">
            {r.slug} · {r.plan}
          </span>
        </Link>
      ),
      sort: (r) => r.name,
    },
    {
      key: "s",
      header: "Status",
      cell: (r) => (
        <span className="flex gap-1.5">
          <Chip size="sm" tone={STATUS_TONE[r.status] ?? "neutral"} dot>
            {cap(r.status)}
          </Chip>
          {r.maintenance && (
            <Chip size="sm" tone="warn">
              Maintenance
            </Chip>
          )}
        </span>
      ),
    },
    { key: "c", header: "Clients", align: "right", cell: (r) => <span className="k-num">{formatNumber(r.clients, 0)}</span>, sort: (r) => r.clients },
    { key: "n", header: "New 30d", align: "right", hideOn: "md", cell: (r) => <span className="k-num text-up">+{r.clients_30d}</span>, sort: (r) => r.clients_30d },
    { key: "k", header: "KYC verified", align: "right", hideOn: "lg", cell: (r) => <span className="k-num">{r.kyc_verified}</span> },
    { key: "st", header: "Staff", align: "right", hideOn: "lg", cell: (r) => <span className="k-num">{r.staff}</span> },
    { key: "l", header: "Online", align: "right", hideOn: "md", cell: (r) => <span className="k-num">{r.live_sessions}</span> },
    { key: "m", header: "Licence / mo", align: "right", cell: (r) => <span className="k-num">{money(r.licence_cents, r.currency)}</span>, sort: (r) => r.licence_cents },
    { key: "rs", header: "Rev share", align: "right", hideOn: "xl", cell: (r) => <span className="k-num">{pct(r.revenue_share_bps)}</span> },
    { key: "o", header: "Outstanding", align: "right", cell: (r) => <span className={r.overdue ? "k-num text-down" : "k-num"}>{money(r.outstanding_cents, r.currency)}</span>, sort: (r) => r.outstanding_cents },
  ];
  return (
    <div className="pb-10">
      <PageHeader
        title="Cross-tenant dashboard"
        subtitle="Every brokerage on the platform at a glance"
        actions={
          <>
            <Button variant="surface" onClick={reload}>
              <RefreshCw /> Refresh
            </Button>
            <Link href="/brokers">
              <Button variant="ember">
                <Building2 /> Tenants
              </Button>
            </Link>
          </>
        }
      />
      {error ? (
        <ErrorState error={error} onRetry={reload} />
      ) : !data || !t ? (
        <TableSkeleton rows={6} />
      ) : (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <KpiCard label="Tenants" value={t.tenants} icon={<Building2 />} chip={`${t.active} active${t.suspended ? ` · ${t.suspended} suspended` : ""}`} chipTone={t.suspended ? "warn" : "up"} />
            <KpiCard label="Clients (all tenants)" value={formatNumber(t.clients, 0)} icon={<Users />} chip={`+${t.clients_30d} in 30d`} chipTone="up" />
            <KpiCard label="Licence MRR" value={money(t.mrr_cents)} icon={<Coins />} chip={`${money(t.paid_30d_cents)} paid in 30d`} chipTone="up" />
            <KpiCard label="Outstanding invoices" value={money(t.outstanding_cents)} icon={<Receipt />} chip={t.overdue_invoices ? `${t.overdue_invoices} overdue` : "none overdue"} chipTone={t.overdue_invoices ? "down" : "up"} />
          </div>
          <div className="grid grid-cols-1 gap-4 xl:grid-cols-12">
            <Card className="xl:col-span-8">
              <CardHeader title="Tenants" subtitle={`${t.staff} staff · ${t.live_sessions} live sessions right now`} />
              <div className="px-4 pb-5 pt-4 sm:px-6">
                <DataTable rows={data.tenants} columns={columns} rowKey={(r) => String(r.id)} pageSize={25} exportName="tenants" />
              </div>
            </Card>
            <div className="grid gap-4 xl:col-span-4">
              <Card>
                <CardHeader title="Sign-ups, all tenants" subtitle="Last 30 days" icon={<Activity />} />
                <div className="px-4 pb-5 pt-4 sm:px-6">
                  <MiniBars data={data.registrations.map((r) => r.count)} className="h-24" />
                  <div className="mt-2 flex justify-between text-[11.5px] text-fg-3">
                    <span>{day(data.registrations[0]?.day)}</span>
                    <span>{data.registrations.reduce((a, r) => a + r.count, 0)} total</span>
                  </div>
                </div>
              </Card>
              <Card>
                <CardHeader title="Owner activity" subtitle="Audited platform changes" />
                <div className="px-4 pb-4 pt-3 sm:px-6">
                  {data.activity.length === 0 ? (
                    <EmptyState title="Nothing yet" illustration="calendar" />
                  ) : (
                    <ul className="space-y-2.5 text-[13px]">
                      {data.activity.map((a) => (
                        <li key={a.id} className="flex justify-between gap-3">
                          <span className="min-w-0">
                            <span className="block truncate">{ACTION[a.action] ?? a.action}</span>
                            <span className="block truncate text-[12px] text-fg-3">
                              {a.actor ?? "system"}
                              {typeof a.meta?.name === "string" ? ` · ${a.meta.name}` : typeof a.meta?.number === "string" ? ` · ${a.meta.number}` : ""}
                            </span>
                          </span>
                          <span className="shrink-0 text-[12px] text-fg-3">{ago(a.created_at, now)}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </Card>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
