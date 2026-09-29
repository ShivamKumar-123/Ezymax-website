"use client";

import { IS_DEMO } from "@kalks/mock/mode";
import { LiveTenants } from "@/components/owner/tenants";

import * as React from "react";
import { toast } from "sonner";
import { Building2, Coins, Eye, KeyRound, MoreHorizontal, Plus, Receipt, Users, Ban, Globe2 } from "lucide-react";
import {
  Avatar,
  Button,
  Card,
  CardHeader,
  Chip,
  DataTable,
  Donut,
  IconButton,
  KpiCard,
  Menu,
  Money,
  PageHeader,
  Progress,
  Reveal,
  Segmented,
  Sparkline,
  Starfield,
  formatNumber,
  type Column,
} from "@kalks/ui";
import { BRK_ACTIVITY, BRK_MRR_HISTORY, BRK_TENANTS, BRK_TOTALS, brkTenant, type BrkTenant } from "@kalks/mock/admin-platform-brokers";
import { PlanChip, TenantCell, TenantLogo, TenantStatus, compactUsd, timeAgo } from "@/components/brokers/kit";
import { CreateTenantWizard, type NewTenant } from "@/components/brokers/create-tenant-wizard";
import { TenantDrawer } from "@/components/brokers/tenant-drawer";

type Filter = "all" | BrkTenant["status"];

const TONE_BG: Record<string, string> = { up: "bg-up", down: "bg-down", ember: "bg-ember", gold: "bg-gold", info: "bg-info", warn: "bg-warn" };
const ONBOARD_STEPS = ["Company", "DNS", "Branding", "Modules", "Billing", "Go-live"];

function TenantsPage() {
  const [tenants, setTenants] = React.useState<BrkTenant[]>(BRK_TENANTS);
  const [filter, setFilter] = React.useState<Filter>("all");
  const [wizard, setWizard] = React.useState(false);
  const [openId, setOpenId] = React.useState<string | null>(null);
  const open = tenants.find((t) => t.id === openId) ?? null;

  const rows = filter === "all" ? tenants : tenants.filter((t) => t.status === filter);
  const count = (s: Filter) => (s === "all" ? tenants.length : tenants.filter((t) => t.status === s).length);

  const setStatus = (id: string, status: BrkTenant["status"]) => setTenants((ts) => ts.map((t) => (t.id === id ? { ...t, status } : t)));

  const create = (n: NewTenant) => {
    const id = `tnt_${String(tenants.length + 1).padStart(3, "0")}`;
    setTenants((ts) => [
      ...ts,
      {
        ...BRK_TENANTS[7]!,
        id,
        name: n.brand,
        legalName: n.legalName,
        regNo: n.regNo,
        mark: n.brand[0]!.toUpperCase(),
        color: n.primary,
        accent: n.accent,
        domain: n.domain,
        country: n.country,
        regulator: `${n.regulator} ${n.licenceNo}`,
        plan: n.plan,
        status: "onboarding",
        revSharePct: n.revShare,
        setupFee: n.setupFee,
        maxClients: n.maxClients,
        maxStaff: n.maxStaff,
        maxSymbols: n.maxSymbols,
        billingEmail: n.billingEmail,
        modules: n.modules,
        createdAt: "2026-09-24T09:00:00Z",
        onboardingStep: 1,
      },
    ]);
  };

  const columns: Column<BrkTenant>[] = [
    { key: "name", header: "Tenant", cell: (t) => <TenantCell t={t} />, sort: (t) => t.name, width: "24%" },
    {
      key: "domain",
      header: "Domain",
      cell: (t) => (
        <span className="font-mono text-[12.5px] text-fg-2">
          {t.domain}
        </span>
      ),
      hideOn: "md",
    },
    { key: "plan", header: "Plan", cell: (t) => <PlanChip plan={t.plan} />, sort: (t) => ["owner", "enterprise", "growth", "starter"].indexOf(t.plan) },
    {
      key: "clients",
      header: "Clients",
      align: "right",
      sort: (t) => t.clients,
      cell: (t) => (
        <div className="k-num">
          <div className="text-fg">{formatNumber(t.clients, 0)}</div>
          <div className="text-[11.5px] text-fg-3">{t.maxClients ? `${Math.round((t.clients / t.maxClients) * 100)}% of cap` : "—"}</div>
        </div>
      ),
    },
    {
      key: "vol",
      header: "30d volume",
      align: "right",
      sort: (t) => t.volume30d,
      cell: (t) =>
        t.volume30d ? (
          <div className="flex items-center justify-end gap-3">
            <Sparkline data={t.trend} width={64} height={22} tone="gold" className="hidden xl:block" />
            <span className="k-num w-16">{compactUsd(t.volume30d)}</span>
          </div>
        ) : (
          <span className="text-fg-3">—</span>
        ),
    },
    { key: "rs", header: "Rev share", align: "right", sort: (t) => t.revSharePct, cell: (t) => (t.plan === "owner" ? <span className="text-fg-3">—</span> : <span className="k-num">{t.revSharePct}%</span>), hideOn: "lg" },
    {
      key: "mrr",
      header: "MRR",
      align: "right",
      sort: (t) => t.mrr + t.revShare30d,
      cell: (t) =>
        t.plan === "owner" ? (
          <Chip size="sm" tone="ember">Owner</Chip>
        ) : (
          <div>
            <Money value={t.status === "suspended" ? 0 : t.mrr + t.revShare30d} decimals={0} countUp={false} className="text-fg" />
            <div className="k-num text-[11.5px] text-fg-3">lic ${formatNumber(t.mrr, 0)}</div>
          </div>
        ),
    },
    { key: "status", header: "Status", cell: (t) => <TenantStatus status={t.status} />, sort: (t) => t.status },
    {
      key: "act",
      header: "",
      align: "right",
      width: "48px",
      cell: (t) => (
        <span onClick={(e) => e.stopPropagation()}>
          <Menu
            trigger={
              <IconButton size="sm" aria-label="Actions">
                <MoreHorizontal />
              </IconButton>
            }
            items={[
              { label: "View details", icon: <Eye />, onSelect: () => setOpenId(t.id) },
              { label: "Open tenant admin", icon: <KeyRound />, onSelect: () => toast.success("Impersonation session started", { description: `admin.${t.domain} · audited` }) },
              { label: "Invoices", icon: <Receipt />, href: "/brokers/billing" },
              { label: "Modules", icon: <Globe2 />, href: "/brokers/modules" },
              "sep",
              t.status === "suspended"
                ? { label: "Reactivate", icon: <Ban />, onSelect: () => {
                    setStatus(t.id, "active");
                    toast.success(`${t.name} reactivated`);
                  } }
                : { label: "Suspend tenant", icon: <Ban />, danger: true, onSelect: () => setOpenId(t.id) },
            ]}
          />
        </span>
      ),
    },
  ];

  const paying = tenants.filter((t) => t.plan !== "owner" && t.volume30d > 0);
  const volDonut = [...tenants]
    .filter((t) => t.volume30d > 0)
    .sort((a, b) => b.volume30d - a.volume30d)
    .map((t) => ({ label: t.name, value: t.volume30d, color: t.color }));
  const mrrSeries = BRK_MRR_HISTORY.map((m) => m.licence + m.revShare);
  const prevMrr = mrrSeries[mrrSeries.length - 2]!;

  return (
    <div className="pb-16">
      <PageHeader
        title="Tenants"
        subtitle="White-label brokers running on the Kalks platform · platform owner view"
        actions={
          <>
            <Button variant="surface" onClick={() => toast.success("tenants.csv exported", { description: `${tenants.length} tenants` })}>
              Export
            </Button>
            <Button variant="ember" shimmer onClick={() => setWizard(true)}>
              <Plus /> Create tenant
            </Button>
          </>
        }
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          label="Tenants"
          icon={<Building2 />}
          value={<span className="k-num">{tenants.length}</span>}
          footer={
            <div className="flex flex-wrap items-center gap-1.5">
              <Chip size="sm" tone="up">{count("active")} active</Chip>
              <Chip size="sm" tone="gold">{count("trial")} trial</Chip>
              <Chip size="sm" tone="info">{count("onboarding")} onboarding</Chip>
              <Chip size="sm" tone="down">{count("suspended")} susp.</Chip>
            </div>
          }
          delay={0}
        />
        <KpiCard
          label="Total clients"
          icon={<Users />}
          value={<span className="k-num">{formatNumber(BRK_TOTALS.clients, 0)}</span>}
          chip={`${formatNumber(BRK_TOTALS.whiteLabelClients, 0)} on white-label`}
          chipTone="neutral"
          illustration="busts_in_silhouette"
          delay={0.05}
        />
        <KpiCard
          label="Platform MRR"
          icon={<Coins />}
          hot
          value={<Money value={BRK_TOTALS.mrr} decimals={0} />}
          chip={`+${(((BRK_TOTALS.mrr - prevMrr) / prevMrr) * 100).toFixed(1)}% vs Aug`}
          chipTone="up"
          href="/brokers/billing"
          illustration="money_bag"
          delay={0.1}
        />
        <KpiCard
          label="Rev-share 30d"
          icon={<Receipt />}
          value={<Money value={BRK_TOTALS.revShare} decimals={0} />}
          footer={
            <div className="flex items-center gap-2 text-[12px] text-fg-3">
              <Chip size="sm" tone="gold">15–25% of net</Chip>
              <span className="k-num">on {compactUsd(BRK_TOTALS.volume30d)} volume</span>
            </div>
          }
          href="/brokers/billing"
          delay={0.15}
        />
      </div>

      <Reveal delay={0.1} className="mt-4">
        <Card>
          <CardHeader title="All tenants" subtitle="Click a row for limits, modules, domains and invoices" />
          <div className="mt-4 px-4 pb-5 sm:px-6">
            <DataTable
              columns={columns}
              rows={rows}
              rowKey={(t) => t.id}
              pageSize={12}
              search={(t) => `${t.name} ${t.domain} ${t.legalName} ${t.countryName}`}
              searchPlaceholder="Search tenant, domain…"
              exportName="tenants"
              onRowClick={(t) => setOpenId(t.id)}
              toolbar={
                <Segmented
                  size="xs"
                  value={filter}
                  onChange={setFilter}
                  options={(["all", "active", "trial", "onboarding", "suspended"] as Filter[]).map((f) => ({
                    value: f,
                    label: (
                      <>
                        {f === "all" ? "All" : f[0]!.toUpperCase() + f.slice(1)} <span className="text-fg-3">{count(f)}</span>
                      </>
                    ),
                  }))}
                />
              }
            />
          </div>
        </Card>
      </Reveal>

      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2 xl:grid-cols-12">
        <Reveal delay={0.05} className="xl:col-span-4">
          <Card className="flex h-full flex-col">
            <CardHeader title="Volume share" subtitle="30-day notional by tenant" />
            <div className="mt-4 flex flex-1 flex-col items-center gap-5 px-4 pb-6 sm:flex-row sm:px-6">
              <Donut
                data={volDonut}
                size={168}
                thickness={18}
                center={
                  <div>
                    <div className="k-num text-xl font-semibold">{compactUsd(BRK_TOTALS.volume30d)}</div>
                    <div className="text-[11px] text-fg-3">total 30d</div>
                  </div>
                }
              />
              <div className="w-full min-w-0 flex-1 space-y-2">
                {volDonut.slice(0, 6).map((d) => (
                  <div key={d.label} className="flex items-center gap-2 text-[12.5px]">
                    <span className="size-2 shrink-0 rounded-full" style={{ background: d.color }} />
                    <span className="min-w-0 flex-1 truncate text-fg-2">{d.label}</span>
                    <span className="k-num text-fg">{((d.value / BRK_TOTALS.volume30d) * 100).toFixed(1)}%</span>
                  </div>
                ))}
                <div className="flex items-center gap-2 text-[12.5px] text-fg-3">
                  <span className="size-2 rounded-full bg-surface-3" /> <span className="flex-1">{volDonut.length - 6} others</span>
                  <span className="k-num">{((volDonut.slice(6).reduce((s, d) => s + d.value, 0) / BRK_TOTALS.volume30d) * 100).toFixed(1)}%</span>
                </div>
              </div>
            </div>
          </Card>
        </Reveal>

        <Reveal delay={0.1} className="xl:col-span-4">
          <Card hot className="relative flex h-full flex-col overflow-hidden">
            <Starfield density={30} />
            <CardHeader title="Onboarding pipeline" subtitle="Tenants not yet fully live" />
            <div className="relative mt-4 flex-1 space-y-3 px-4 pb-6 sm:px-6">
              {tenants
                .filter((t) => t.status === "onboarding" || t.status === "trial")
                .map((t) => {
                  const s = t.onboardingStep ?? 1;
                  return (
                    <div key={t.id} className="k-row cursor-pointer p-4 transition-colors hover:bg-surface-3/60" onClick={() => setOpenId(t.id)}>
                      <div className="flex items-center gap-3">
                        <TenantLogo color={t.color} mark={t.mark} size={32} />
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-[13.5px] font-medium">{t.name}</div>
                          <div className="text-[12px] text-fg-3">
                            Next: <span className="text-fg-2">{ONBOARD_STEPS[Math.min(s + 1, 5)]}</span>
                          </div>
                        </div>
                        <TenantStatus status={t.status} />
                      </div>
                      <div className="mt-3 flex gap-1">
                        {ONBOARD_STEPS.map((st, i) => (
                          <span key={st} title={st} className={i <= s ? "h-1.5 flex-1 rounded-full bg-gradient-to-r from-ember to-ember-2" : "h-1.5 flex-1 rounded-full bg-surface-3"} />
                        ))}
                      </div>
                    </div>
                  );
                })}
              <div className="k-row flex items-center justify-between p-4">
                <div>
                  <div className="text-[13px] font-medium">Avg. time to go-live</div>
                  <div className="text-[12px] text-fg-3">Last 5 tenants</div>
                </div>
                <span className="k-num text-xl font-semibold">
                  11.4 <span className="text-sm font-normal text-fg-3">days</span>
                </span>
              </div>
            </div>
          </Card>
        </Reveal>

        <Reveal delay={0.15} className="lg:col-span-2 xl:col-span-4">
          <Card className="flex h-full flex-col">
            <CardHeader title="Platform activity" subtitle="Owner-level changes" action={<Button size="xs" variant="ghost" onClick={() => toast.message("Opening audit log")}>Audit log</Button>} />
            <div className="relative mt-4 flex-1 space-y-2.5 px-4 pb-6 sm:px-6">
              {BRK_ACTIVITY.map((a, i) => {
                const t = brkTenant(a.tenantId);
                return (
                  <div key={i} className="flex items-start gap-3">
                    <TenantLogo color={t.color} mark={t.mark} size={28} className="mt-0.5" />
                    <div className="min-w-0 flex-1">
                      <div className="text-[13px] leading-snug text-fg">{a.text}</div>
                      <div className="mt-0.5 flex items-center gap-1.5 text-[11.5px] text-fg-3">
                        <Avatar src={a.by.photo} name={a.by.name} size={14} /> {a.by.name} · {timeAgo(a.at)}
                      </div>
                    </div>
                    <span className={`mt-1.5 size-1.5 shrink-0 rounded-full ${TONE_BG[a.tone]}`} />
                  </div>
                );
              })}
            </div>
          </Card>
        </Reveal>
      </div>

      <Reveal delay={0.1} className="mt-4">
        <Card>
          <CardHeader title="Capacity by tenant" subtitle="Client seats used against plan limits" />
          <div className="mt-4 grid grid-cols-1 gap-x-8 gap-y-4 px-4 pb-6 sm:grid-cols-2 sm:px-6 xl:grid-cols-3">
            {paying.map((t) => {
              const pct = (t.clients / t.maxClients) * 100;
              return (
                <div key={t.id} className="flex items-center gap-3">
                  <TenantLogo color={t.color} mark={t.mark} size={26} />
                  <div className="min-w-0 flex-1">
                    <div className="mb-1.5 flex justify-between text-[12.5px]">
                      <span className="truncate text-fg-2">{t.name}</span>
                      <span className="k-num text-fg-3">
                        <span className="text-fg">{formatNumber(t.clients, 0)}</span> / {formatNumber(t.maxClients, 0)}
                      </span>
                    </div>
                    <Progress value={pct} tone={pct > 85 ? "down" : pct > 60 ? "warn" : "up"} />
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      </Reveal>

      <CreateTenantWizard open={wizard} onOpenChange={setWizard} onCreate={create} />
      <TenantDrawer tenant={open} onOpenChange={(o) => !o && setOpenId(null)} onStatus={setStatus} />
    </div>
  );
}

export default function Page() {
  return IS_DEMO ? <TenantsPage /> : <LiveTenants />;
}
