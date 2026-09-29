-- MAM: multi-account manager. See README "MAM (multi-account manager)".
--
-- A manager (an approved social master) trades one dedicated MAM master account. Every opening trade on it
-- (the block) is allocated across the client accounts linked to the manager; each client keeps their own
-- live trading account and grants the manager trading authority (never money movement) by an explicit,
-- signed-in consent in the Client Area, revocable at any time. Allocated trades are ordinary orders /
-- positions / deals on the client's account with source 'mam'. These tables hold the MAM layer only.

-- System group of MAM master accounts: disabled = never offered in the open-account wizard. The IB service
-- never pays commission on it: the same volume is traded again on the linked client accounts (and counted there).
INSERT INTO groups (tenant_id, code, name, mode, cent, account_types, leverages, default_leverage, margin_call_pct, stop_out_pct, hedged_margin_pct, min_deposit, commission_per_lot, route, spread_group, max_accounts_per_user, enabled) VALUES
 (1, 'mam', 'MAM Master', 'hedging', false, 'live', '{50,100,200,500}', 500, 100, 50, 50, 0, 0, 'B', 'standard', 5, false)
ON CONFLICT DO NOTHING;

CREATE TABLE mam_managers (
    id              BIGSERIAL PRIMARY KEY,
    tenant_id       BIGINT NOT NULL REFERENCES tenants(id),
    master_id       BIGINT NOT NULL REFERENCES social_masters(id),
    user_id         BIGINT NOT NULL,
    login           BIGINT NOT NULL UNIQUE,
    name            TEXT NOT NULL,
    description     TEXT NOT NULL DEFAULT '',
    -- equity | balance: the block is split by the linked accounts' equity / balance share;
    -- multiplier: block × the link's multiplier; percent: block × the link's percent / 100
    method          TEXT NOT NULL CHECK (method IN ('equity', 'balance', 'multiplier', 'percent')),
    perf_fee_pct    NUMERIC NOT NULL CHECK (perf_fee_pct >= 0 AND perf_fee_pct <= 90),
    mgmt_fee_pct    NUMERIC NOT NULL DEFAULT 0 CHECK (mgmt_fee_pct >= 0 AND mgmt_fee_pct <= 10),
    fee_period      TEXT NOT NULL CHECK (fee_period IN ('daily', 'weekly', 'monthly')),
    min_equity      NUMERIC NOT NULL DEFAULT 0 CHECK (min_equity >= 0),
    status          TEXT NOT NULL CHECK (status IN ('active', 'frozen', 'closed')),
    freeze_reason   TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX mam_managers_master_idx ON mam_managers (master_id) WHERE status <> 'closed';
CREATE UNIQUE INDEX mam_managers_name_idx ON mam_managers (tenant_id, lower(name)) WHERE status <> 'closed';

-- One link = one client account under one manager. The fee terms are the ones the client consented to.
CREATE TABLE mam_links (
    id               BIGSERIAL PRIMARY KEY,
    tenant_id        BIGINT NOT NULL REFERENCES tenants(id),
    manager_id       BIGINT NOT NULL REFERENCES mam_managers(id),
    user_id          BIGINT NOT NULL,
    login            BIGINT NOT NULL,
    status           TEXT NOT NULL CHECK (status IN ('active', 'revoked', 'stopped')),
    stop_reason      TEXT,
    -- multiplier (× block) or percent (% of block) for those methods; ignored for equity / balance
    alloc_value      NUMERIC NOT NULL DEFAULT 1 CHECK (alloc_value > 0),
    max_lot          NUMERIC CHECK (max_lot IS NULL OR max_lot > 0),
    equity_stop      NUMERIC CHECK (equity_stop IS NULL OR equity_stop > 0),
    perf_fee_pct     NUMERIC NOT NULL,
    mgmt_fee_pct     NUMERIC NOT NULL,
    fee_period       TEXT NOT NULL,
    -- performance fee base: cumulative result of MAM trades on the account (closed + floating, USD)
    hwm              NUMERIC NOT NULL DEFAULT 0,
    fees_paid        NUMERIC NOT NULL DEFAULT 0,
    start_equity     NUMERIC NOT NULL DEFAULT 0,
    start_version    BIGINT NOT NULL,
    consent_terms    TEXT NOT NULL,
    consent_hash     TEXT NOT NULL,
    consent_ip       TEXT,
    consent_ua       TEXT,
    consent_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
    ended_at         TIMESTAMPTZ,
    ended_by         TEXT,
    last_fee_at      TIMESTAMPTZ,
    next_fee_at      TIMESTAMPTZ NOT NULL,
    updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX mam_links_login_idx ON mam_links (login) WHERE status = 'active';
CREATE INDEX mam_links_manager_idx ON mam_links (manager_id, status);
CREATE INDEX mam_links_user_idx ON mam_links (tenant_id, user_id);

-- Allocation audit: one row per allocated block (open, add, pending order) with the per-account split and
-- what was executed. Append-only.
CREATE TABLE mam_allocations (
    id               BIGSERIAL PRIMARY KEY,
    tenant_id        BIGINT NOT NULL REFERENCES tenants(id),
    manager_id       BIGINT NOT NULL REFERENCES mam_managers(id),
    master_login     BIGINT NOT NULL,
    master_version   BIGINT NOT NULL,
    master_ticket    BIGINT,
    action           TEXT NOT NULL,
    symbol           TEXT NOT NULL,
    side             TEXT NOT NULL,
    block_volume     NUMERIC NOT NULL,
    method           TEXT NOT NULL,
    allocated        NUMERIC NOT NULL,
    accounts         INT NOT NULL,
    details          JSONB NOT NULL DEFAULT '[]',
    at               TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX mam_allocations_manager_idx ON mam_allocations (manager_id, id DESC);

-- Every step taken on a linked account (opens, closes, SL/TP, cancels). Append-only.
CREATE TABLE mam_log (
    id               BIGSERIAL PRIMARY KEY,
    tenant_id        BIGINT NOT NULL REFERENCES tenants(id),
    link_id          BIGINT NOT NULL,
    master_login     BIGINT NOT NULL,
    master_version   BIGINT NOT NULL,
    action           TEXT NOT NULL,
    master_ticket    BIGINT,
    client_ticket    BIGINT,
    volume           NUMERIC,
    status           TEXT NOT NULL CHECK (status IN ('done', 'skipped', 'failed')),
    message          TEXT NOT NULL DEFAULT '',
    at               TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX mam_log_link_idx ON mam_log (link_id, id DESC);

-- Fees: MAM fees go through the same approval and payout flow as copy / PAMM fees.
ALTER TABLE social_fees DROP CONSTRAINT IF EXISTS social_fees_source_check;
ALTER TABLE social_fees ADD CONSTRAINT social_fees_source_check CHECK (source IN ('copy', 'pamm', 'mam'));
ALTER TABLE social_fees ADD COLUMN link_id BIGINT;
ALTER TABLE social_fees ADD COLUMN perf_amount NUMERIC;
ALTER TABLE social_fees ADD COLUMN mgmt_amount NUMERIC;

CREATE TRIGGER mam_allocations_append_only BEFORE UPDATE OR DELETE ON mam_allocations FOR EACH ROW EXECUTE FUNCTION reject_mutation();
CREATE TRIGGER mam_log_append_only BEFORE UPDATE OR DELETE ON mam_log FOR EACH ROW EXECUTE FUNCTION reject_mutation();

DO $$
DECLARE t TEXT;
BEGIN
    FOREACH t IN ARRAY ARRAY['mam_managers','mam_links','mam_allocations','mam_log'] LOOP
        EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
        EXECUTE format('CREATE POLICY tenant_isolation ON %I USING (tenant_id = NULLIF(current_setting(''kalks.tenant_id'', true), '''')::bigint)', t);
    END LOOP;
END $$;
