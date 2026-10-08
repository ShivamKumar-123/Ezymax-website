-- Super Admin + unified RBAC + staff security (D108-D113, D122, D146).
--
-- * roles: tenant-scoped roles. 'system' roles (platform_owner, super_admin) always hold the full catalogue from
--   the gateway code; 'preset' roles follow the code defaults until a tenant edits them (customised = true);
--   'custom' roles are built in the Back Office role builder. Permission keys are validated by the gateway.
-- * staff.role_id is the source of truth; staff.role mirrors roles.key for reporting.
-- * staff invites, IP allow-list, maintenance mode, module toggles / feature flags, tenant billing + invoices.

CREATE TABLE roles (
    id           BIGSERIAL PRIMARY KEY,
    tenant_id    BIGINT NOT NULL REFERENCES tenants(id),
    key          TEXT NOT NULL CHECK (key ~ '^[a-z][a-z0-9_-]{1,47}$'),
    name         TEXT NOT NULL,
    description  TEXT NOT NULL DEFAULT '',
    kind         TEXT NOT NULL CHECK (kind IN ('system', 'preset', 'custom')),
    customised   BOOLEAN NOT NULL DEFAULT false,
    permissions  TEXT[] NOT NULL DEFAULT '{}',
    created_by   BIGINT,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (tenant_id, key)
);
CREATE UNIQUE INDEX roles_tenant_name_idx ON roles (tenant_id, lower(name));

ALTER TABLE staff DROP CONSTRAINT IF EXISTS staff_role_check;
ALTER TABLE staff DROP CONSTRAINT IF EXISTS staff_status_check;
ALTER TABLE staff ADD CONSTRAINT staff_status_check CHECK (status IN ('active', 'disabled', 'invited'));
ALTER TABLE staff
    ADD COLUMN role_id          BIGINT REFERENCES roles(id),
    ADD COLUMN invited_by       BIGINT REFERENCES staff(id) ON DELETE SET NULL,
    ADD COLUMN invited_at       TIMESTAMPTZ,
    ADD COLUMN disabled_at      TIMESTAMPTZ,
    ADD COLUMN disabled_reason  TEXT;
CREATE INDEX staff_role_idx ON staff (role_id);

-- One-time invite links (only the HMAC of the token is stored). Accepting sets the password, then the normal
-- email-code sign-in follows.
CREATE TABLE staff_invites (
    id           BIGSERIAL PRIMARY KEY,
    tenant_id    BIGINT NOT NULL REFERENCES tenants(id),
    staff_id     BIGINT NOT NULL REFERENCES staff(id) ON DELETE CASCADE,
    token_hash   BYTEA NOT NULL UNIQUE,
    created_by   BIGINT REFERENCES staff(id) ON DELETE SET NULL,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    expires_at   TIMESTAMPTZ NOT NULL,
    accepted_at  TIMESTAMPTZ,
    revoked_at   TIMESTAMPTZ
);
CREATE INDEX staff_invites_staff_idx ON staff_invites (staff_id);

-- Tenant profile, branding, limits, maintenance mode and the staff IP allow-list switch.
ALTER TABLE tenants
    ADD COLUMN legal_name            TEXT,
    ADD COLUMN domains               TEXT[] NOT NULL DEFAULT '{}',
    ADD COLUMN brand                 JSONB NOT NULL DEFAULT '{}'::jsonb,
    ADD COLUMN limits                JSONB NOT NULL DEFAULT '{}'::jsonb,
    ADD COLUMN plan                  TEXT NOT NULL DEFAULT 'standard',
    ADD COLUMN country               TEXT,
    ADD COLUMN contact_email         TEXT,
    ADD COLUMN suspended_at          TIMESTAMPTZ,
    ADD COLUMN suspended_reason      TEXT,
    ADD COLUMN updated_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
    ADD COLUMN maintenance_enabled   BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN maintenance_message   TEXT,
    ADD COLUMN maintenance_until     TIMESTAMPTZ,
    ADD COLUMN maintenance_since     TIMESTAMPTZ,
    ADD COLUMN ip_allowlist_enabled  BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN ip_owner_bypass       BOOLEAN NOT NULL DEFAULT true;

UPDATE tenants SET legal_name = name, domains = ARRAY['ezymex.com', 'app.ezymex.com', 'admin.ezymex.com', 'trade.ezymex.com'],
                   brand = '{"primary": "#ff5a1f", "accent": "#e9b949"}'::jsonb, plan = 'owner'
 WHERE slug = 'ezymex';

CREATE TABLE tenant_ip_allowlist (
    id          BIGSERIAL PRIMARY KEY,
    tenant_id   BIGINT NOT NULL REFERENCES tenants(id),
    cidr        TEXT NOT NULL,
    label       TEXT NOT NULL DEFAULT '',
    created_by  BIGINT REFERENCES staff(id) ON DELETE SET NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (tenant_id, cidr)
);

-- Feature catalogue: modules (owner-controlled per tenant, D112) and feature flags (D146). Built-in rows are
-- upserted by the gateway on start; the Platform Owner can add flags. tenant_features holds per-tenant overrides.
CREATE TABLE feature_flags (
    key              TEXT PRIMARY KEY CHECK (key ~ '^[a-z][a-z0-9_]{1,47}$'),
    kind             TEXT NOT NULL CHECK (kind IN ('module', 'flag')),
    name             TEXT NOT NULL,
    description      TEXT NOT NULL DEFAULT '',
    default_enabled  BOOLEAN NOT NULL DEFAULT true,
    builtin          BOOLEAN NOT NULL DEFAULT false,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE tenant_features (
    tenant_id   BIGINT NOT NULL REFERENCES tenants(id),
    key         TEXT NOT NULL REFERENCES feature_flags(key) ON DELETE CASCADE,
    enabled     BOOLEAN NOT NULL,
    updated_by  BIGINT REFERENCES staff(id) ON DELETE SET NULL,
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (tenant_id, key)
);

-- Tenant billing (D110): setup fee + monthly licence + revenue share. Amounts in cents, share in basis points.
-- Tracking only: no payment processing.
CREATE TABLE tenant_billing (
    tenant_id              BIGINT PRIMARY KEY REFERENCES tenants(id),
    currency               TEXT NOT NULL DEFAULT 'USD',
    setup_fee_cents        BIGINT NOT NULL DEFAULT 0 CHECK (setup_fee_cents >= 0),
    monthly_licence_cents  BIGINT NOT NULL DEFAULT 0 CHECK (monthly_licence_cents >= 0),
    revenue_share_bps      INT NOT NULL DEFAULT 0 CHECK (revenue_share_bps BETWEEN 0 AND 10000),
    billing_email          TEXT,
    starts_on              DATE,
    payment_terms_days     INT NOT NULL DEFAULT 14 CHECK (payment_terms_days BETWEEN 0 AND 120),
    notes                  TEXT NOT NULL DEFAULT '',
    updated_at             TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE tenant_invoices (
    id                    BIGSERIAL PRIMARY KEY,
    tenant_id             BIGINT NOT NULL REFERENCES tenants(id),
    number                TEXT NOT NULL UNIQUE,
    period_start          DATE NOT NULL,
    period_end            DATE NOT NULL,
    currency              TEXT NOT NULL DEFAULT 'USD',
    setup_fee_cents       BIGINT NOT NULL DEFAULT 0,
    licence_cents         BIGINT NOT NULL DEFAULT 0,
    revenue_base_cents    BIGINT NOT NULL DEFAULT 0,
    revenue_share_bps     INT NOT NULL DEFAULT 0,
    revenue_share_cents   BIGINT NOT NULL DEFAULT 0,
    adjustment_cents      BIGINT NOT NULL DEFAULT 0,
    total_cents           BIGINT NOT NULL,
    status                TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'issued', 'paid', 'overdue', 'void')),
    issued_at             TIMESTAMPTZ,
    due_at                DATE,
    paid_at               TIMESTAMPTZ,
    notes                 TEXT NOT NULL DEFAULT '',
    created_by            BIGINT REFERENCES staff(id) ON DELETE SET NULL,
    created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
    CHECK (period_end >= period_start)
);
CREATE INDEX tenant_invoices_tenant_idx ON tenant_invoices (tenant_id, period_start DESC);
