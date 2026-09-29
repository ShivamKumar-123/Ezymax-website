"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, Building2, Check, Globe2, LayoutDashboard, Plus, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { Button, Card, CardHeader, Chip, DataTable, Dialog, EmptyState, Field, Input, KpiCard, PageHeader, Segmented, Stepper, Toggle, cn, formatNumber, type Column } from "@kalks/ui";
import { ErrorState, TableSkeleton, day, useApi } from "@/components/live/kit";
import { InviteLink, STATUS_TONE, call, cap } from "@/components/rbac/kit";
import type { FeatureCatalogue, TenantRow } from "./types";

type Filter = "all" | "active" | "suspended";

function Mark({ name, color }: { name: string; color?: string }) {
  return (
    <span className="grid size-9 shrink-0 place-items-center rounded-[11px] text-[15px] font-semibold text-white" style={{ background: color || "var(--k-surface-3)" }}>
      {name.charAt(0).toUpperCase()}
    </span>
  );
}

const PLANS = [
  { key: "starter", label: "Starter", setup: 5000, licence: 1500, share: 15, clients: 2000, staff: 10 },
  { key: "growth", label: "Growth", setup: 10000, licence: 3500, share: 12, clients: 10000, staff: 30 },
  { key: "enterprise", label: "Enterprise", setup: 25000, licence: 8000, share: 10, clients: 0, staff: 0 },
] as const;

type Draft = {
  name: string;
  slug: string;
  legal_name: string;
  country: string;
  contact_email: string;
  domains: string;
  primary: string;
  accent: string;
  logo_url: string;
  plan: (typeof PLANS)[number]["key"];
  modules: Record<string, boolean>;
  max_clients: string;
  max_staff: string;
  setup_fee: string;
  monthly_licence: string;
  revenue_share_pct: string;
  billing_email: string;
  admin_email: string;
  admin_name: string;
};

const STEPS = ["Company", "Domains & brand", "Modules", "Plan & billing", "Super Admin"];
const slugify = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 32);

function blank(): Draft {
  const p = PLANS[1];
  return {
    name: "", slug: "", legal_name: "", country: "", contact_email: "", domains: "", primary: "#22c55e", accent: "#e9b949", logo_url: "", plan: p.key, modules: {},
    max_clients: String(p.clients), max_staff: String(p.staff), setup_fee: String(p.setup), monthly_licence: String(p.licence), revenue_share_pct: String(p.share),
    billing_email: "", admin_email: "", admin_name: "",
  };
}

/** Create-tenant wizard: company → domains & branding → modules → plan & billing → first Super Admin (invite). */
function CreateTenant({ open, onOpenChange, onCreated }: { open: boolean; onOpenChange: (o: boolean) => void; onCreated: () => void }) {
  const router = useRouter();
  const { data: cat } = useApi<FeatureCatalogue>(open ? "/api/owner/features" : null);
  const [step, setStep] = React.useState(0);
  const [d, setD] = React.useState<Draft>(blank);
  const [err, setErr] = React.useState<{ field?: string; message: string } | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [done, setDone] = React.useState<{ id: number; name: string; invite?: string } | null>(null);
  const modules = cat?.features.filter((f) => f.kind === "module") ?? [];
  React.useEffect(() => {
    if (open) {
      setStep(0);
      setD(blank());
      setErr(null);
      setDone(null);
    }
  }, [open]);
  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setD((x) => ({ ...x, [k]: v }));
  const fe = (f: string) => (err?.field === f || err?.field?.startsWith(f + ".") ? err.message : undefined);
  const canNext = [d.name.trim() && d.slug.trim(), true, true, true, true][step];

  async function submit() {
    setBusy(true);
    setErr(null);
    const body = {
      slug: d.slug,
      name: d.name,
      legal_name: d.legal_name || undefined,
      country: d.country || undefined,
      contact_email: d.contact_email || undefined,
      domains: d.domains.split(/[\s,]+/).filter(Boolean),
      brand: { primary: d.primary, accent: d.accent, logo_url: d.logo_url || undefined },
      plan: d.plan,
      limits: { max_clients: Number(d.max_clients) || 0, max_staff: Number(d.max_staff) || 0 },
      modules: d.modules,
      billing: { setup_fee: Number(d.setup_fee) || 0, monthly_licence: Number(d.monthly_licence) || 0, revenue_share_pct: Number(d.revenue_share_pct) || 0, billing_email: d.billing_email || undefined },
      admin: d.admin_email ? { email: d.admin_email, name: d.admin_name } : undefined,
    };
    const r = await call<{ tenant: { id: number; name: string }; admin_invite: { dev_invite_url?: string } | null }>("POST", "/api/owner/tenants", body);
    setBusy(false);
    if (!r.ok) {
      setErr(r.error);
      const f = r.error.field ?? "";
      setStep(f.startsWith("billing") || f === "plan" || f === "limits" ? 3 : f.startsWith("admin") ? 4 : f === "domains" || f.startsWith("brand") ? 1 : f === "modules" ? 2 : 0);
      return;
    }
    toast.success("Tenant created", { description: r.data.tenant.name });
    onCreated();
    setDone({ id: r.data.tenant.id, name: r.data.tenant.name, invite: r.data.admin_invite?.dev_invite_url });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange} width={720} title="New tenant" description="A white-label brokerage with its own domains, branding, modules, limits and billing.">
      {done ? (
        <div>
          <div className="flex items-center gap-3">
            <span className="grid size-10 place-items-center rounded-full bg-up text-white">
              <Check className="size-5" />
            </span>
            <div>
              <div className="font-medium">{done.name} is set up</div>
              <div className="text-[13px] text-fg-3">Roles are seeded; point the domains at the platform to go live.</div>
            </div>
          </div>
          <InviteLink url={done.invite} />
          <div className="mt-6 flex justify-end gap-2">
            <Button variant="surface" onClick={() => onOpenChange(false)}>
              Close
            </Button>
            <Button variant="ember" onClick={() => router.push(`/brokers/${done.id}`)}>
              Open tenant <ArrowRight />
            </Button>
          </div>
        </div>
      ) : (
        <div>
          <Stepper steps={STEPS} current={step} className="mb-6" />
          {err && !err.field && <div className="mb-4 rounded-[14px] border border-down/25 bg-down-soft px-4 py-3 text-[13px] text-down">{err.message}</div>}
          {step === 0 && (
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Brand name" error={fe("name")}>
                <Input value={d.name} onChange={(e) => setD((x) => ({ ...x, name: e.target.value, slug: x.slug && x.slug !== slugify(x.name) ? x.slug : slugify(e.target.value) }))} placeholder="Acme Markets" name="tenant-name" />
              </Field>
              <Field label="Identifier" hint="Lowercase, used internally" error={fe("slug")}>
                <Input value={d.slug} onChange={(e) => set("slug", e.target.value.toLowerCase())} placeholder="acme-markets" name="tenant-slug" className="font-mono" />
              </Field>
              <Field label="Legal entity">
                <Input value={d.legal_name} onChange={(e) => set("legal_name", e.target.value)} placeholder="Acme Markets Ltd" />
              </Field>
              <Field label="Country (ISO code)" error={fe("country")}>
                <Input value={d.country} onChange={(e) => set("country", e.target.value.toUpperCase().slice(0, 2))} placeholder="AE" />
              </Field>
              <Field label="Contact email" error={fe("contact_email")} className="sm:col-span-2">
                <Input type="email" value={d.contact_email} onChange={(e) => set("contact_email", e.target.value)} placeholder="ops@acme.com" />
              </Field>
            </div>
          )}
          {step === 1 && (
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Domains" hint="Comma or space separated" error={fe("domains")} className="sm:col-span-2">
                <Input value={d.domains} onChange={(e) => set("domains", e.target.value)} placeholder="acme.com, app.acme.com, admin.acme.com" name="tenant-domains" />
              </Field>
              <Field label="Primary colour" error={fe("brand")}>
                <div className="flex items-center gap-2">
                  <input type="color" value={d.primary} onChange={(e) => set("primary", e.target.value)} className="h-11 w-14 rounded-[12px] border border-line bg-surface-2" />
                  <Input value={d.primary} onChange={(e) => set("primary", e.target.value)} className="flex-1 font-mono" />
                </div>
              </Field>
              <Field label="Accent colour">
                <div className="flex items-center gap-2">
                  <input type="color" value={d.accent} onChange={(e) => set("accent", e.target.value)} className="h-11 w-14 rounded-[12px] border border-line bg-surface-2" />
                  <Input value={d.accent} onChange={(e) => set("accent", e.target.value)} className="flex-1 font-mono" />
                </div>
              </Field>
              <Field label="Logo URL (https)" className="sm:col-span-2">
                <Input value={d.logo_url} onChange={(e) => set("logo_url", e.target.value)} placeholder="https://cdn.acme.com/logo.svg" />
              </Field>
              <div className="flex items-center gap-3 rounded-[14px] border border-line bg-surface-2 px-4 py-3 sm:col-span-2">
                <Mark name={d.name || "A"} color={d.primary} />
                <span className="font-medium">{d.name || "Brand name"}</span>
                <span className="ml-auto rounded-full px-3 py-1 text-[12px] font-medium text-black" style={{ background: d.accent }}>
                  Accent
                </span>
              </div>
            </div>
          )}
          {step === 2 && (
            <div className="grid gap-2 sm:grid-cols-2">
              {modules.map((m) => {
                const on = d.modules[m.key] ?? m.default;
                return (
                  <div key={m.key} className="flex items-start justify-between gap-3 rounded-[14px] border border-line px-4 py-3">
                    <div>
                      <div className="font-medium">{m.name}</div>
                      <div className="text-[12px] text-fg-3">{m.description}</div>
                    </div>
                    <Toggle checked={on} onChange={(v) => set("modules", { ...d.modules, [m.key]: v })} />
                  </div>
                );
              })}
              {!cat && <TableSkeleton rows={3} className="sm:col-span-2" />}
            </div>
          )}
          {step === 3 && (
            <div className="space-y-4">
              <Segmented
                value={d.plan}
                onChange={(k) => {
                  const p = PLANS.find((x) => x.key === k)!;
                  setD((x) => ({ ...x, plan: p.key, max_clients: String(p.clients), max_staff: String(p.staff), setup_fee: String(p.setup), monthly_licence: String(p.licence), revenue_share_pct: String(p.share) }));
                }}
                options={PLANS.map((p) => ({ value: p.key, label: p.label }))}
              />
              <div className="grid gap-4 sm:grid-cols-3">
                <Field label="Setup fee (USD)" error={fe("billing.setup_fee")}>
                  <Input inputMode="decimal" value={d.setup_fee} onChange={(e) => set("setup_fee", e.target.value)} />
                </Field>
                <Field label="Monthly licence (USD)" error={fe("billing.monthly_licence")}>
                  <Input inputMode="decimal" value={d.monthly_licence} onChange={(e) => set("monthly_licence", e.target.value)} />
                </Field>
                <Field label="Revenue share %" error={fe("billing.revenue_share_pct")}>
                  <Input inputMode="decimal" value={d.revenue_share_pct} onChange={(e) => set("revenue_share_pct", e.target.value)} />
                </Field>
                <Field label="Max clients" hint="0 = unlimited" error={fe("limits")}>
                  <Input inputMode="numeric" value={d.max_clients} onChange={(e) => set("max_clients", e.target.value)} />
                </Field>
                <Field label="Max staff" hint="0 = unlimited">
                  <Input inputMode="numeric" value={d.max_staff} onChange={(e) => set("max_staff", e.target.value)} />
                </Field>
                <Field label="Billing email" error={fe("billing.billing_email")}>
                  <Input type="email" value={d.billing_email} onChange={(e) => set("billing_email", e.target.value)} placeholder="finance@acme.com" />
                </Field>
              </div>
              <p className="text-[12.5px] text-fg-3">Billing is recorded for invoicing only; no payment is taken by the platform.</p>
            </div>
          )}
          {step === 4 && (
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Super Admin email" hint="Gets an invite link to set a password" error={fe("admin.email")}>
                <Input type="email" value={d.admin_email} onChange={(e) => set("admin_email", e.target.value)} placeholder="ceo@acme.com" name="admin-email" />
              </Field>
              <Field label="Super Admin name" error={fe("admin.name")}>
                <Input value={d.admin_name} onChange={(e) => set("admin_name", e.target.value)} placeholder="Jane Doe" name="admin-name" />
              </Field>
              <div className="rounded-[14px] border border-line bg-surface-2 px-4 py-3 text-[13px] sm:col-span-2">
                <div className="font-medium">{d.name || "New tenant"}</div>
                <div className="mt-1 text-fg-3">
                  {d.slug || "identifier"} · {cap(d.plan)} · {d.domains.split(/[\s,]+/).filter(Boolean).length} domain(s) · {modules.filter((m) => d.modules[m.key] ?? m.default).length}/{modules.length} modules · ${d.monthly_licence}/mo + {d.revenue_share_pct}%
                </div>
              </div>
            </div>
          )}
          <div className="mt-6 flex items-center justify-between">
            <Button variant="ghost" onClick={() => (step ? setStep(step - 1) : onOpenChange(false))}>
              <ArrowLeft /> {step ? "Back" : "Cancel"}
            </Button>
            {step < STEPS.length - 1 ? (
              <Button variant="ember" disabled={!canNext} onClick={() => setStep(step + 1)}>
                Next <ArrowRight />
              </Button>
            ) : (
              <Button variant="ember" disabled={busy} onClick={submit} data-testid="create-tenant">
                {busy ? "Creating…" : "Create tenant"}
              </Button>
            )}
          </div>
        </div>
      )}
    </Dialog>
  );
}

export function LiveTenants() {
  const { data, error, reload } = useApi<{ items: TenantRow[]; total: number }>("/api/owner/tenants");
  const [filter, setFilter] = React.useState<Filter>("all");
  const [wizard, setWizard] = React.useState(false);
  const items = data?.items ?? [];
  const rows = filter === "all" ? items : items.filter((t) => t.status === filter);
  const columns: Column<TenantRow>[] = [
    {
      key: "t",
      header: "Tenant",
      cell: (t) => (
        <Link href={`/brokers/${t.id}`} className="flex min-w-0 items-center gap-3 hover:text-ember">
          <Mark name={t.name} color={t.brand.primary} />
          <span className="min-w-0">
            <span className="block truncate font-medium">{t.name}</span>
            <span className="block truncate text-[12px] text-fg-3">{t.legal_name ?? t.slug}</span>
          </span>
        </Link>
      ),
      sort: (t) => t.name,
    },
    { key: "s", header: "Status", cell: (t) => <Chip size="sm" tone={STATUS_TONE[t.status] ?? "neutral"} dot>{cap(t.status)}</Chip> },
    { key: "p", header: "Plan", hideOn: "sm", cell: (t) => <Chip size="sm">{cap(t.plan)}</Chip> },
    { key: "d", header: "Domains", hideOn: "lg", cell: (t) => <span className="text-[12.5px] text-fg-2">{t.domains[0] ?? "—"}{t.domains.length > 1 ? ` +${t.domains.length - 1}` : ""}</span> },
    { key: "c", header: "Clients", align: "right", cell: (t) => <span className="k-num">{formatNumber(t.clients, 0)}{t.limits.max_clients ? <span className="text-fg-3"> / {formatNumber(t.limits.max_clients, 0)}</span> : null}</span>, sort: (t) => t.clients },
    { key: "st", header: "Staff", align: "right", hideOn: "md", cell: (t) => <span className="k-num">{t.staff}</span> },
    { key: "m", header: "Modules", align: "right", hideOn: "md", cell: (t) => <span className="k-num">{t.modules_enabled}/{t.modules_total}</span> },
    { key: "a", header: "Since", align: "right", hideOn: "xl", cell: (t) => <span className="text-fg-3">{day(t.created_at)}</span> },
  ];
  return (
    <div className="pb-10">
      <PageHeader
        title="Tenants"
        subtitle="White-label brokerages on the platform"
        actions={
          <>
            <Button variant="surface" onClick={reload}>
              <RefreshCw /> Refresh
            </Button>
            <Link href="/brokers/overview">
              <Button variant="surface">
                <LayoutDashboard /> Dashboard
              </Button>
            </Link>
            <Button variant="ember" onClick={() => setWizard(true)} data-testid="new-tenant">
              <Plus /> New tenant
            </Button>
          </>
        }
      />
      {error ? (
        <ErrorState error={error} onRetry={reload} />
      ) : !data ? (
        <TableSkeleton rows={4} />
      ) : (
        <>
          <div className="mb-4 grid grid-cols-2 gap-4 lg:grid-cols-4">
            <KpiCard label="Tenants" value={items.length} icon={<Building2 />} />
            <KpiCard label="Active" value={items.filter((t) => t.status === "active").length} chipTone="up" />
            <KpiCard label="Suspended" value={items.filter((t) => t.status === "suspended").length} />
            <KpiCard label="Domains" value={items.reduce((a, t) => a + t.domains.length, 0)} icon={<Globe2 />} />
          </div>
          <Card>
            <CardHeader
              title="All tenants"
              subtitle="Open a tenant for domains, branding, modules, billing and suspension"
              action={<Segmented size="xs" value={filter} onChange={setFilter} options={(["all", "active", "suspended"] as Filter[]).map((f) => ({ value: f, label: cap(f) }))} />}
            />
            <div className={cn("px-4 pb-5 pt-4 sm:px-6")}>
              <DataTable rows={rows} columns={columns} rowKey={(t) => String(t.id)} pageSize={25} search={(t) => `${t.name} ${t.slug} ${t.domains.join(" ")}`} searchPlaceholder="Search tenants" empty={<EmptyState title="No tenants" illustration="package" />} />
            </div>
          </Card>
        </>
      )}
      <CreateTenant open={wizard} onOpenChange={setWizard} onCreated={reload} />
    </div>
  );
}

export { Mark as TenantMark };
