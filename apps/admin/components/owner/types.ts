// Shapes of the gateway's Platform Owner API (services/gateway/src/owner.rs) via /api/owner/*.

export type TenantRow = {
  id: number;
  slug: string;
  name: string;
  legal_name: string | null;
  status: "active" | "suspended";
  plan: string;
  domains: string[];
  brand: { primary?: string; accent?: string; logo_url?: string };
  limits: { max_clients?: number; max_staff?: number; max_accounts?: number };
  country: string | null;
  contact_email: string | null;
  created_at: string;
  suspended_at: string | null;
  suspended_reason: string | null;
  clients: number;
  staff: number;
  modules_enabled: number;
  modules_total: number;
};

export type DomainKind = "website" | "app" | "trade" | "admin";

export type DomainRecord = {
  id: number;
  domain: string;
  kind: DomainKind;
  status: "active" | "disabled";
  verified_at: string | null;
  dns_checked_at: string | null;
  dns_addresses: string[];
  created_at: string;
};

export type Billing = {
  currency: string;
  setup_fee_cents: number;
  monthly_licence_cents: number;
  revenue_share_bps: number;
  billing_email: string | null;
  starts_on: string | null;
  payment_terms_days: number;
  notes: string;
  configured: boolean;
};

export type Invoice = {
  id: number;
  number: string;
  tenant: { id: number; slug: string; name: string };
  period_start: string;
  period_end: string;
  currency: string;
  setup_fee_cents: number;
  licence_cents: number;
  revenue_base_cents: number;
  revenue_share_bps: number;
  revenue_share_cents: number;
  adjustment_cents: number;
  total_cents: number;
  status: "draft" | "issued" | "paid" | "overdue" | "void";
  issued_at: string | null;
  due_at: string | null;
  paid_at: string | null;
  notes: string;
  created_at: string;
};

export type TenantDetail = {
  tenant: TenantRow & { clients_30d: number; kyc_verified: number; maintenance: boolean; ip_allowlist: boolean; is_owner_tenant: boolean; domain_records?: DomainRecord[] };
  modules: { key: string; name: string; description: string; enabled: boolean; overridden: boolean; default: boolean }[];
  flags: { key: string; name: string; enabled: boolean; overridden: boolean }[];
  billing: Billing;
  admins: { id: number; email: string; name: string; status: string; last_login_at: string | null }[];
  invoices: Invoice[];
};

export type Dashboard = {
  totals: {
    tenants: number;
    active: number;
    suspended: number;
    clients: number;
    clients_30d: number;
    staff: number;
    live_sessions: number;
    mrr_cents: number;
    outstanding_cents: number;
    overdue_invoices: number;
    paid_30d_cents: number;
  };
  tenants: {
    id: number;
    slug: string;
    name: string;
    status: string;
    plan: string;
    created_at: string;
    maintenance: boolean;
    clients: number;
    clients_30d: number;
    kyc_verified: number;
    staff: number;
    live_sessions: number;
    licence_cents: number;
    revenue_share_bps: number;
    currency: string;
    outstanding_cents: number;
    overdue: number;
  }[];
  registrations: { day: string; count: number }[];
  activity: { id: number; action: string; target_id: number | null; meta: Record<string, unknown>; created_at: string; actor: string | null }[];
  generated_at: string;
};

export type FeatureCatalogue = {
  features: { key: string; kind: "module" | "flag"; name: string; description: string; default: boolean; builtin: boolean; created_at: string; tenants_on: number }[];
  tenants: { id: number; slug: string; name: string; status: string }[];
  matrix: Record<string, Record<string, { enabled: boolean; overridden: boolean }>>;
};

export type Probe = {
  key: string;
  name: string;
  detail: string;
  optional: boolean;
  status: "up" | "degraded" | "down";
  http: number | null;
  latency_ms: number;
  facts: Record<string, string>;
};
