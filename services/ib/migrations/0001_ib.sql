-- Ezymex IB / referral programme (services/ib). Money is NUMERIC (USD), never float.
-- `tenant` is the gateway tenant slug (white-label); every query filters by it.

CREATE TABLE settings (
    tenant      TEXT PRIMARY KEY,
    data        JSONB NOT NULL,
    version     INT NOT NULL DEFAULT 1,
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_by  TEXT
);

CREATE TABLE levels (
    tenant              TEXT NOT NULL,
    key                 TEXT NOT NULL,
    name                TEXT NOT NULL,
    rank                INT NOT NULL,
    rates               JSONB NOT NULL,           -- {symbol group key: USD per standard lot}
    cpa_amount          NUMERIC NOT NULL DEFAULT 0,
    min_active_clients  INT NOT NULL DEFAULT 0,
    min_monthly_lots    NUMERIC NOT NULL DEFAULT 0,
    perks               JSONB NOT NULL DEFAULT '[]'::jsonb,
    icon                TEXT NOT NULL DEFAULT 'coin',
    PRIMARY KEY (tenant, key)
);

-- Every client is a member (and an IB from day one, D53). parent_id is the client's direct IB.
CREATE TABLE members (
    user_id               BIGINT PRIMARY KEY,           -- gateway users.id
    tenant                TEXT NOT NULL,
    email                 TEXT NOT NULL,
    first_name            TEXT NOT NULL,
    last_name             TEXT NOT NULL,
    country               TEXT NOT NULL DEFAULT '',
    referral_code         TEXT NOT NULL,
    parent_id             BIGINT,                       -- current upline (permanent from sign-up; admin may reassign, D63)
    parent_source         TEXT NOT NULL DEFAULT 'signup' CHECK (parent_source IN ('signup', 'admin')),
    signup_parent_id      BIGINT,                       -- gateway referred_by as recorded at sign-up
    campaign_id           BIGINT,
    campaign_raw          TEXT,
    level_key             TEXT NOT NULL,
    level_locked          BOOLEAN NOT NULL DEFAULT false,
    level_since           TIMESTAMPTZ NOT NULL DEFAULT now(),
    rebate_pct            NUMERIC NOT NULL DEFAULT 0,
    split_pct             NUMERIC NOT NULL DEFAULT 0,
    status                TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'suspended')),
    gateway_status        TEXT NOT NULL DEFAULT 'active',
    kyc_status            TEXT NOT NULL DEFAULT 'unverified',
    email_verified        BOOLEAN NOT NULL DEFAULT false,
    identity              TEXT[] NOT NULL DEFAULT '{}', -- keyed hashes from the gateway (name+DOB, phone)
    ips                   TEXT[] NOT NULL DEFAULT '{}',
    devices               TEXT[] NOT NULL DEFAULT '{}',
    self_referral         TEXT,                         -- signal that matched the upline: ip | device | identity
    abuse_cleared         BOOLEAN NOT NULL DEFAULT false, -- an admin dismissed the self-referral flag
    first_deposit_at      TIMESTAMPTZ,
    first_deposit_amount  NUMERIC,
    deposits_checked_at   TIMESTAMPTZ,
    first_trade_at        TIMESTAMPTZ,
    joined_at             TIMESTAMPTZ NOT NULL,
    changed_at            TIMESTAMPTZ NOT NULL,
    synced_at             TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX members_parent_idx ON members (tenant, parent_id);
CREATE UNIQUE INDEX members_code_idx ON members (tenant, referral_code);
CREATE INDEX members_campaign_idx ON members (campaign_id) WHERE campaign_id IS NOT NULL;

CREATE TABLE campaigns (
    id            BIGSERIAL PRIMARY KEY,
    tenant        TEXT NOT NULL,
    user_id       BIGINT NOT NULL,
    slug          TEXT NOT NULL,
    name          TEXT NOT NULL,
    landing       TEXT NOT NULL DEFAULT '/register',
    utm_source    TEXT,
    utm_medium    TEXT,
    utm_campaign  TEXT,
    active        BOOLEAN NOT NULL DEFAULT true,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (tenant, user_id, slug)
);

-- Link clicks. No raw IP is stored: `visitor` is a keyed hash of IP + user agent.
CREATE TABLE clicks (
    id           BIGSERIAL PRIMARY KEY,
    tenant       TEXT NOT NULL,
    user_id      BIGINT NOT NULL,        -- the IB who owns the code
    campaign_id  BIGINT,
    visitor      TEXT NOT NULL,
    unique_click BOOLEAN NOT NULL,
    landing      TEXT,
    referer      TEXT,
    at           TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX clicks_ib_idx ON clicks (tenant, user_id, at);
CREATE INDEX clicks_visitor_idx ON clicks (tenant, user_id, visitor, at);

-- Trading accounts seen in deals (from the engine admin API).
CREATE TABLE accounts (
    login       BIGINT PRIMARY KEY,
    tenant      TEXT NOT NULL,
    user_id     BIGINT NOT NULL,
    kind        TEXT NOT NULL,
    grp         TEXT NOT NULL,
    cent        BOOLEAN NOT NULL DEFAULT false,
    fetched_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX accounts_user_idx ON accounts (user_id);

-- Every closed deal the programme has processed, qualified or not (idempotency per deal).
CREATE TABLE deals (
    source        TEXT NOT NULL,           -- engine | pamm | copy
    deal_id       BIGINT NOT NULL,
    user_id       BIGINT NOT NULL,
    tenant        TEXT NOT NULL,
    login         BIGINT,
    symbol        TEXT NOT NULL,
    symbol_group  TEXT,
    side          TEXT NOT NULL,
    volume        NUMERIC NOT NULL,
    lots          NUMERIC NOT NULL,
    open_time     TIMESTAMPTZ NOT NULL,
    close_time    TIMESTAMPTZ NOT NULL,
    qualified     BOOLEAN NOT NULL,
    reason        TEXT,
    reversed      BOOLEAN NOT NULL DEFAULT false,
    processed_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (source, deal_id, user_id)
);
CREATE INDEX deals_user_time_idx ON deals (tenant, user_id, close_time);
CREATE INDEX deals_close_idx ON deals (tenant, close_time);
CREATE INDEX deals_symbol_time_idx ON deals (tenant, symbol, close_time);

CREATE TABLE commissions (
    id              BIGSERIAL PRIMARY KEY,
    tenant          TEXT NOT NULL,
    beneficiary_id  BIGINT NOT NULL,
    kind            TEXT NOT NULL CHECK (kind IN ('lot', 'split', 'rebate', 'cpa', 'clawback', 'adjustment')),
    deal_source     TEXT,
    deal_id         BIGINT,
    client_id       BIGINT NOT NULL,
    login           BIGINT,
    symbol          TEXT,
    symbol_group    TEXT,
    lots            NUMERIC NOT NULL DEFAULT 0,
    tier            INT NOT NULL DEFAULT 1,
    level_key       TEXT,
    rate            NUMERIC NOT NULL DEFAULT 0,
    share_pct       NUMERIC NOT NULL DEFAULT 100,
    amount          NUMERIC NOT NULL,
    status          TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'paid', 'rejected', 'void')),
    available_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    batch_id        BIGINT,
    payout_id       BIGINT,
    note            TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
-- one line per (deal, client, beneficiary, kind): re-processing a deal can never pay twice
CREATE UNIQUE INDEX commissions_deal_uq ON commissions (deal_source, deal_id, client_id, beneficiary_id, kind) WHERE deal_id IS NOT NULL;
-- one CPA per referred client, ever
CREATE UNIQUE INDEX commissions_cpa_uq ON commissions (tenant, client_id) WHERE kind = 'cpa';
CREATE INDEX commissions_beneficiary_idx ON commissions (tenant, beneficiary_id, created_at DESC);
CREATE INDEX commissions_open_idx ON commissions (tenant, status, batch_id) WHERE status = 'pending';

CREATE TABLE payout_batches (
    id             BIGSERIAL PRIMARY KEY,
    tenant         TEXT NOT NULL,
    schedule       TEXT NOT NULL,
    period_start   TIMESTAMPTZ,
    period_end     TIMESTAMPTZ NOT NULL,
    status         TEXT NOT NULL DEFAULT 'pending_approval'
                   CHECK (status IN ('pending_approval', 'approved', 'paid', 'partially_paid', 'rejected')),
    total          NUMERIC NOT NULL DEFAULT 0,
    lines          INT NOT NULL DEFAULT 0,
    payees         INT NOT NULL DEFAULT 0,
    created_by     TEXT NOT NULL,          -- 'system' (schedule) or staff:<id>
    created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    decided_by     TEXT,
    decided_at     TIMESTAMPTZ,
    decision_note  TEXT,
    completed_at   TIMESTAMPTZ
);
-- the scheduler creates at most one batch per period
CREATE UNIQUE INDEX batches_auto_uq ON payout_batches (tenant, schedule, period_end) WHERE created_by = 'system';

CREATE TABLE payouts (
    id               BIGSERIAL PRIMARY KEY,
    tenant           TEXT NOT NULL,
    batch_id         BIGINT NOT NULL REFERENCES payout_batches(id),
    user_id          BIGINT NOT NULL,
    amount           NUMERIC NOT NULL CHECK (amount > 0),
    lines            INT NOT NULL,
    status           TEXT NOT NULL DEFAULT 'pending_approval'
                     CHECK (status IN ('pending_approval', 'transfer_pending', 'paid', 'rejected', 'failed')),
    idempotency_key  TEXT NOT NULL UNIQUE,  -- sent to the wallet: a retry never credits twice
    attempts         INT NOT NULL DEFAULT 0,
    last_error       TEXT,
    next_attempt_at  TIMESTAMPTZ,
    wallet_txn       TEXT,
    paid_at          TIMESTAMPTZ,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (batch_id, user_id)
);
CREATE INDEX payouts_due_idx ON payouts (next_attempt_at) WHERE status = 'transfer_pending';

CREATE TABLE fraud_flags (
    id           BIGSERIAL PRIMARY KEY,
    tenant       TEXT NOT NULL,
    kind         TEXT NOT NULL,       -- self_referral_ip | self_referral_device | self_referral_identity | wash_trading | short_trades
    severity     TEXT NOT NULL DEFAULT 'medium' CHECK (severity IN ('low', 'medium', 'high')),
    client_id    BIGINT,
    ib_id        BIGINT,
    dedup        TEXT NOT NULL,
    details      JSONB NOT NULL DEFAULT '{}'::jsonb,
    status       TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'confirmed', 'dismissed')),
    resolved_by  TEXT,
    resolved_at  TIMESTAMPTZ,
    note         TEXT,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (tenant, dedup)
);
CREATE INDEX fraud_flags_status_idx ON fraud_flags (tenant, status, created_at DESC);

CREATE TABLE reassignments (
    id           BIGSERIAL PRIMARY KEY,
    tenant       TEXT NOT NULL,
    user_id      BIGINT NOT NULL,
    from_parent  BIGINT,
    to_parent    BIGINT,
    staff        TEXT NOT NULL,
    reason       TEXT NOT NULL,
    at           TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE level_history (
    id         BIGSERIAL PRIMARY KEY,
    tenant     TEXT NOT NULL,
    user_id    BIGINT NOT NULL,
    from_key   TEXT,
    to_key     TEXT NOT NULL,
    reason     TEXT NOT NULL,          -- monthly | admin
    month      TEXT,
    active_clients BIGINT,
    lots       NUMERIC,
    at         TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX level_history_user_idx ON level_history (user_id, at DESC);

-- Poller cursors and once-per-period markers.
CREATE TABLE cursors (
    name        TEXT PRIMARY KEY,
    value       TEXT NOT NULL,
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Append-only audit of every admin change and every money movement decision.
CREATE TABLE audit_log (
    id          BIGSERIAL PRIMARY KEY,
    tenant      TEXT NOT NULL,
    actor       TEXT NOT NULL,          -- staff:<id> | user:<id> | system
    actor_name  TEXT,
    action      TEXT NOT NULL,
    target      TEXT,
    before      JSONB,
    after       JSONB,
    note        TEXT,
    at          TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX audit_log_tenant_idx ON audit_log (tenant, at DESC);

CREATE FUNCTION ib_append_only() RETURNS trigger AS $$
BEGIN
    RAISE EXCEPTION '% is append-only', TG_TABLE_NAME;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER audit_log_no_update BEFORE UPDATE OR DELETE ON audit_log FOR EACH ROW EXECUTE FUNCTION ib_append_only();
CREATE TRIGGER audit_log_no_truncate BEFORE TRUNCATE ON audit_log FOR EACH STATEMENT EXECUTE FUNCTION ib_append_only();
CREATE TRIGGER reassignments_no_update BEFORE UPDATE OR DELETE ON reassignments FOR EACH ROW EXECUTE FUNCTION ib_append_only();
