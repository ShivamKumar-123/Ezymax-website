-- Tenant domains + row-level security (D1, D113).
--
-- * tenant_domains: every host a broker is served on, with the app it serves (website / app = Client Area /
--   trade = Ezymex Trader / admin = Back Office). The gateway resolves the tenant of a request from the browser
--   host the app BFFs forward (X-Ezymex-Host), and Caddy's on-demand TLS asks /v1/public/domain-check before it
--   issues a certificate for a new broker domain. tenants.domains (TEXT[]) is kept as a read-only mirror of
--   the active rows so older readers keep working; the gateway rewrites it after every change.
-- * Row-level security on the tenant-scoped tables. The gateway pool connects as the schema owner (or a
--   superuser in development), so nothing changes for existing queries: with `app.tenant_id` unset every row
--   is visible to it. Tenant-scoped request paths run inside a transaction that calls ezymex_enter_tenant(id):
--   it sets `app.tenant_id` and switches to the NOLOGIN, NOBYPASSRLS role `ezymex_tenant`, which only ever
--   sees (and may only write) rows of that tenant. With app.tenant_id unset ezymex_tenant sees nothing.

CREATE TABLE tenant_domains (
    id           BIGSERIAL PRIMARY KEY,
    tenant_id    BIGINT NOT NULL REFERENCES tenants(id),
    domain       TEXT NOT NULL UNIQUE CHECK (domain = lower(domain) AND domain ~ '^[a-z0-9.-]{3,253}$'),
    kind         TEXT NOT NULL CHECK (kind IN ('website', 'app', 'trade', 'admin')),
    status       TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'disabled')),
    verified_at  TIMESTAMPTZ,
    dns_checked_at TIMESTAMPTZ,
    dns_addresses TEXT[] NOT NULL DEFAULT '{}',
    created_by   BIGINT REFERENCES staff(id) ON DELETE SET NULL,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX tenant_domains_tenant_idx ON tenant_domains (tenant_id, kind);

-- existing tenants.domains values: the leading label picks the app (app. / trade. / admin.), anything else is
-- the website. Ezymex: ezymex.com = website, app. = app, trade. = trade, admin. = admin.
INSERT INTO tenant_domains (tenant_id, domain, kind, verified_at)
SELECT t.id, d,
       CASE WHEN d LIKE 'app.%' THEN 'app' WHEN d LIKE 'trade.%' THEN 'trade' WHEN d LIKE 'admin.%' THEN 'admin' ELSE 'website' END,
       now()
FROM tenants t, unnest(t.domains) AS d
ON CONFLICT (domain) DO NOTHING;

-- ---------- row-level security ----------

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'ezymex_tenant') THEN
        CREATE ROLE ezymex_tenant NOLOGIN NOBYPASSRLS;
    END IF;
EXCEPTION
    -- another database on the same server created it concurrently (tests)
    WHEN duplicate_object OR unique_violation THEN NULL;
    WHEN insufficient_privilege THEN
    RAISE NOTICE 'ezymex_tenant role not created (no CREATEROLE); tenant scoping falls back to app.tenant_id only';
END $$;

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'ezymex_tenant') THEN
        -- the gateway's own login must be able to SET ROLE ezymex_tenant
        BEGIN
            EXECUTE format('GRANT ezymex_tenant TO %I', current_user);
        EXCEPTION WHEN OTHERS THEN
            RAISE NOTICE 'could not grant ezymex_tenant to %', current_user;
        END;
        EXECUTE 'GRANT USAGE ON SCHEMA public TO ezymex_tenant';
        EXECUTE 'GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO ezymex_tenant';
        EXECUTE 'GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO ezymex_tenant';
        EXECUTE 'ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO ezymex_tenant';
        EXECUTE 'ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO ezymex_tenant';
    END IF;
END $$;

-- Row visibility for a tenant_id: with app.tenant_id set, only that tenant; unset, everything for the pool's
-- own login and nothing for ezymex_tenant (fail closed).
CREATE FUNCTION ezymex_tenant_row(t BIGINT) RETURNS BOOLEAN LANGUAGE sql STABLE AS $$
    SELECT CASE
        WHEN NULLIF(current_setting('app.tenant_id', true), '') IS NULL THEN current_user::text <> 'ezymex_tenant'
        ELSE t = current_setting('app.tenant_id', true)::bigint
    END
$$;

-- Enters a tenant scope for the rest of the current transaction (SET LOCAL semantics).
CREATE FUNCTION ezymex_enter_tenant(t BIGINT) RETURNS VOID LANGUAGE plpgsql AS $$
BEGIN
    IF t IS NULL OR t <= 0 THEN
        RAISE EXCEPTION 'ezymex_enter_tenant: invalid tenant id';
    END IF;
    PERFORM set_config('app.tenant_id', t::text, true);
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'ezymex_tenant') THEN
        IF pg_has_role('ezymex_tenant', 'MEMBER') THEN
            SET LOCAL ROLE ezymex_tenant;
        END IF;
    END IF;
END $$;

DO $$
DECLARE
    tbl TEXT;
BEGIN
    FOREACH tbl IN ARRAY ARRAY[
        'users', 'staff', 'sessions', 'email_otps', 'trusted_devices', 'audit_log', 'roles', 'staff_invites',
        'tenant_ip_allowlist', 'tenant_features', 'tenant_domains', 'kyc_cases', 'kyc_documents', 'stepup_tokens',
        'trade_shares', 'client_viewers', 'client_requests'
    ] LOOP
        IF to_regclass('public.' || tbl) IS NOT NULL THEN
            EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', tbl);
            EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', tbl);
            EXECUTE format('DROP POLICY IF EXISTS tenant_isolation ON %I', tbl);
            EXECUTE format('CREATE POLICY tenant_isolation ON %I USING (ezymex_tenant_row(tenant_id)) WITH CHECK (ezymex_tenant_row(tenant_id))', tbl);
        END IF;
    END LOOP;
    -- KYC timeline and reviewer notes follow their case
    FOREACH tbl IN ARRAY ARRAY['kyc_events', 'kyc_notes'] LOOP
        IF to_regclass('public.' || tbl) IS NOT NULL THEN
            EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', tbl);
            EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', tbl);
            EXECUTE format('DROP POLICY IF EXISTS tenant_isolation ON %I', tbl);
            EXECUTE format('CREATE POLICY tenant_isolation ON %I USING (EXISTS (SELECT 1 FROM kyc_cases c WHERE c.id = %I.case_id)) WITH CHECK (EXISTS (SELECT 1 FROM kyc_cases c WHERE c.id = %I.case_id))', tbl, tbl, tbl);
        END IF;
    END LOOP;
END $$;
