-- Copy trading and PAMM (D65–D76, D125). See README "Copy trading and PAMM".
--
-- Trading state of copy accounts and fund accounts stays in the account event streams (events table):
-- mirrored trades are ordinary orders / positions / deals with source 'copy' or 'pamm'. These tables hold
-- the social layer: masters, subscriptions, funds and their unit ledger, fees, snapshots and the wallet
-- outbox. Every table carries tenant_id and the same RLS policy as the rest of the engine.

-- System groups: dedicated copy accounts (one per subscription, D71) and PAMM fund accounts (D65).
-- Disabled = never offered in the open-account wizard; the engine opens these accounts itself.
INSERT INTO groups (tenant_id, code, name, mode, cent, account_types, leverages, default_leverage, margin_call_pct, stop_out_pct, hedged_margin_pct, min_deposit, commission_per_lot, route, spread_group, max_accounts_per_user, enabled) VALUES
 (1, 'copy',         'Copy',         'hedging', false, 'live', '{50,100,200,500}', 500, 100, 50, 50, 0, 0, 'B', 'standard', 50, false),
 (1, 'copy-netting', 'Copy Netting', 'netting', false, 'live', '{50,100,200,500}', 500, 100, 50, 0,  0, 0, 'B', 'standard', 50, false),
 (1, 'pamm',         'PAMM',         'hedging', false, 'live', '{50,100,200,500}', 200, 100, 50, 50, 0, 0, 'B', 'standard', 10, false)
ON CONFLICT DO NOTHING;

CREATE TABLE social_settings (
    tenant_id            BIGINT PRIMARY KEY REFERENCES tenants(id),
    fee_min_pct          NUMERIC NOT NULL DEFAULT 0  CHECK (fee_min_pct >= 0),
    fee_max_pct          NUMERIC NOT NULL DEFAULT 50 CHECK (fee_max_pct <= 90),
    platform_cut_pct     NUMERIC NOT NULL DEFAULT 20 CHECK (platform_cut_pct BETWEEN 0 AND 100),
    min_track_days       INT NOT NULL DEFAULT 30 CHECK (min_track_days >= 0),
    min_own_capital_pct  NUMERIC NOT NULL DEFAULT 5 CHECK (min_own_capital_pct BETWEEN 0 AND 100),
    min_master_equity    NUMERIC NOT NULL DEFAULT 100 CHECK (min_master_equity >= 0),
    min_allocation       NUMERIC NOT NULL DEFAULT 50 CHECK (min_allocation >= 0),
    trade_delay_minutes  INT NOT NULL DEFAULT 30 CHECK (trade_delay_minutes >= 0),
    updated_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
    CHECK (fee_min_pct <= fee_max_pct)
);
INSERT INTO social_settings (tenant_id) VALUES (1);

-- D68: a master is a client's live account approved as a strategy provider.
CREATE TABLE social_masters (
    id             BIGSERIAL PRIMARY KEY,
    tenant_id      BIGINT NOT NULL REFERENCES tenants(id),
    user_id        BIGINT NOT NULL,
    login          BIGINT NOT NULL,
    nickname       TEXT NOT NULL,
    strategy       TEXT NOT NULL DEFAULT '',
    description    TEXT NOT NULL DEFAULT '',
    program        TEXT NOT NULL CHECK (program IN ('copy', 'pamm', 'both')),
    perf_fee_pct   NUMERIC NOT NULL CHECK (perf_fee_pct >= 0 AND perf_fee_pct <= 90),
    fee_period     TEXT NOT NULL CHECK (fee_period IN ('daily', 'weekly', 'monthly')),
    min_allocation NUMERIC NOT NULL DEFAULT 0,
    status         TEXT NOT NULL CHECK (status IN ('pending', 'approved', 'rejected', 'suspended')),
    hidden         BOOLEAN NOT NULL DEFAULT false,
    frozen         BOOLEAN NOT NULL DEFAULT false,
    kyc_verified   BOOLEAN NOT NULL DEFAULT false,
    checks         JSONB NOT NULL DEFAULT '[]',
    review_note    TEXT,
    reviewed_by    TEXT,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    approved_at    TIMESTAMPTZ,
    updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);
-- one live application / master per account; a rejected one can re-apply (new row)
CREATE UNIQUE INDEX social_masters_login_idx ON social_masters (tenant_id, login) WHERE status IN ('pending', 'approved', 'suspended');
CREATE UNIQUE INDEX social_masters_nickname_idx ON social_masters (tenant_id, lower(nickname)) WHERE status IN ('pending', 'approved', 'suspended');
CREATE INDEX social_masters_user_idx ON social_masters (tenant_id, user_id);

-- D69–D71: one subscription = one dedicated copy account.
CREATE TABLE copy_subscriptions (
    id               BIGSERIAL PRIMARY KEY,
    tenant_id        BIGINT NOT NULL REFERENCES tenants(id),
    master_id        BIGINT NOT NULL REFERENCES social_masters(id),
    user_id          BIGINT NOT NULL,
    login            BIGINT NOT NULL UNIQUE,
    sizing_mode      TEXT NOT NULL CHECK (sizing_mode IN ('equity', 'allocation', 'multiplier', 'fixed_lot')),
    sizing_value     NUMERIC NOT NULL,
    max_lot          NUMERIC,
    equity_stop      NUMERIC,
    max_dd_pct       NUMERIC,
    excluded_symbols TEXT[] NOT NULL DEFAULT '{}',
    status           TEXT NOT NULL CHECK (status IN ('active', 'paused', 'stopped')),
    stop_reason      TEXT,
    perf_fee_pct     NUMERIC NOT NULL,
    fee_period       TEXT NOT NULL,
    allocation       NUMERIC NOT NULL DEFAULT 0,
    net_deposits     NUMERIC NOT NULL DEFAULT 0,
    flows_since_fee  NUMERIC NOT NULL DEFAULT 0,
    hwm              NUMERIC NOT NULL DEFAULT 0,
    peak_equity      NUMERIC NOT NULL DEFAULT 0,
    fees_paid        NUMERIC NOT NULL DEFAULT 0,
    start_version    BIGINT NOT NULL,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
    stopped_at       TIMESTAMPTZ,
    last_fee_at      TIMESTAMPTZ,
    next_fee_at      TIMESTAMPTZ NOT NULL,
    updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX copy_subscriptions_master_idx ON copy_subscriptions (master_id, status);
CREATE INDEX copy_subscriptions_user_idx ON copy_subscriptions (tenant_id, user_id);

-- Last event version of a watched stream (master or copy account) the copier has processed.
CREATE TABLE copy_cursors (
    login       BIGINT PRIMARY KEY,
    tenant_id   BIGINT NOT NULL REFERENCES tenants(id),
    version     BIGINT NOT NULL,
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- What the copier did for each subscription (shown to the follower; append-only).
CREATE TABLE copy_log (
    id               BIGSERIAL PRIMARY KEY,
    tenant_id        BIGINT NOT NULL REFERENCES tenants(id),
    sub_id           BIGINT NOT NULL,
    master_login     BIGINT NOT NULL,
    master_version   BIGINT NOT NULL,
    action           TEXT NOT NULL,
    master_ticket    BIGINT,
    follower_ticket  BIGINT,
    volume           NUMERIC,
    status           TEXT NOT NULL CHECK (status IN ('done', 'skipped', 'failed')),
    message          TEXT NOT NULL DEFAULT '',
    at               TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX copy_log_sub_idx ON copy_log (sub_id, id DESC);

-- D65: PAMM fund = a pooled trading account valued by NAV per unit.
CREATE TABLE pamm_funds (
    id                BIGSERIAL PRIMARY KEY,
    tenant_id         BIGINT NOT NULL REFERENCES tenants(id),
    master_id         BIGINT NOT NULL REFERENCES social_masters(id),
    user_id           BIGINT NOT NULL,
    login             BIGINT NOT NULL UNIQUE,
    name              TEXT NOT NULL,
    period            TEXT NOT NULL CHECK (period IN ('daily', 'weekly', 'monthly')),
    perf_fee_pct      NUMERIC NOT NULL,
    lock_in_days      INT NOT NULL DEFAULT 0 CHECK (lock_in_days >= 0),
    min_investment    NUMERIC NOT NULL DEFAULT 0,
    max_dd_pct        NUMERIC,
    min_own_pct       NUMERIC NOT NULL,
    status            TEXT NOT NULL CHECK (status IN ('active', 'frozen', 'closed')),
    units             NUMERIC NOT NULL DEFAULT 0,
    nav_peak          NUMERIC NOT NULL DEFAULT 1,
    freeze_reason     TEXT,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
    last_rollover_at  TIMESTAMPTZ,
    next_rollover_at  TIMESTAMPTZ NOT NULL,
    updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Holdings (projection of pamm_unit_ledger, written in the same transaction).
CREATE TABLE pamm_investors (
    id             BIGSERIAL PRIMARY KEY,
    tenant_id      BIGINT NOT NULL REFERENCES tenants(id),
    fund_id        BIGINT NOT NULL REFERENCES pamm_funds(id),
    user_id        BIGINT NOT NULL,
    is_master      BOOLEAN NOT NULL DEFAULT false,
    units          NUMERIC NOT NULL DEFAULT 0 CHECK (units >= 0),
    hwm_nav        NUMERIC NOT NULL DEFAULT 1,
    net_invested   NUMERIC NOT NULL DEFAULT 0,
    fees_paid      NUMERIC NOT NULL DEFAULT 0,
    stop_loss_pct  NUMERIC CHECK (stop_loss_pct IS NULL OR (stop_loss_pct > 0 AND stop_loss_pct < 100)),
    first_at       TIMESTAMPTZ,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (fund_id, user_id)
);

-- D67: invest / redeem requests queue until the fund's rollover.
CREATE TABLE pamm_requests (
    id           BIGSERIAL PRIMARY KEY,
    tenant_id    BIGINT NOT NULL REFERENCES tenants(id),
    fund_id      BIGINT NOT NULL REFERENCES pamm_funds(id),
    user_id      BIGINT NOT NULL,
    kind         TEXT NOT NULL CHECK (kind IN ('invest', 'redeem')),
    amount       NUMERIC,
    units        NUMERIC,
    redeem_all   BOOLEAN NOT NULL DEFAULT false,
    stop_loss_pct NUMERIC,
    status       TEXT NOT NULL CHECK (status IN ('funding', 'pending', 'done', 'rejected', 'cancelled')),
    reason       TEXT,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    executed_at  TIMESTAMPTZ,
    nav          NUMERIC,
    units_delta  NUMERIC,
    amount_out   NUMERIC,
    fee          NUMERIC,
    updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX pamm_requests_fund_idx ON pamm_requests (fund_id, status);
CREATE INDEX pamm_requests_user_idx ON pamm_requests (tenant_id, user_id, created_at DESC);

CREATE TABLE pamm_rollovers (
    id            BIGSERIAL PRIMARY KEY,
    tenant_id     BIGINT NOT NULL REFERENCES tenants(id),
    fund_id       BIGINT NOT NULL REFERENCES pamm_funds(id),
    at            TIMESTAMPTZ NOT NULL,
    kind          TEXT NOT NULL DEFAULT 'scheduled',
    nav           NUMERIC NOT NULL,
    equity_before NUMERIC NOT NULL,
    equity_after  NUMERIC NOT NULL,
    units_before  NUMERIC NOT NULL,
    units_after   NUMERIC NOT NULL,
    fees          NUMERIC NOT NULL DEFAULT 0,
    invested      NUMERIC NOT NULL DEFAULT 0,
    redeemed      NUMERIC NOT NULL DEFAULT 0
);
CREATE INDEX pamm_rollovers_fund_idx ON pamm_rollovers (fund_id, at DESC);

-- Append-only unit ledger; pamm_investors.units = Σ units per investor.
CREATE TABLE pamm_unit_ledger (
    id           BIGSERIAL PRIMARY KEY,
    tenant_id    BIGINT NOT NULL REFERENCES tenants(id),
    fund_id      BIGINT NOT NULL REFERENCES pamm_funds(id),
    investor_id  BIGINT NOT NULL REFERENCES pamm_investors(id),
    kind         TEXT NOT NULL CHECK (kind IN ('seed', 'invest', 'redeem', 'fee', 'stop_loss')),
    units        NUMERIC NOT NULL CHECK (units <> 0),
    nav          NUMERIC NOT NULL,
    amount       NUMERIC NOT NULL,
    request_id   BIGINT,
    rollover_id  BIGINT,
    at           TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX pamm_unit_ledger_investor_idx ON pamm_unit_ledger (investor_id, id);

-- D66/D76: performance fees, pending until an admin approves the payout to the master's wallet.
CREATE TABLE social_fees (
    id               BIGSERIAL PRIMARY KEY,
    tenant_id        BIGINT NOT NULL REFERENCES tenants(id),
    source           TEXT NOT NULL CHECK (source IN ('copy', 'pamm')),
    master_id        BIGINT NOT NULL REFERENCES social_masters(id),
    sub_id           BIGINT,
    fund_id          BIGINT,
    payer_user_id    BIGINT NOT NULL,
    login            BIGINT NOT NULL,
    ledger_key       TEXT NOT NULL,
    amount           NUMERIC NOT NULL CHECK (amount > 0),
    platform_cut     NUMERIC NOT NULL,
    master_amount    NUMERIC NOT NULL,
    period_start     TIMESTAMPTZ,
    period_end       TIMESTAMPTZ NOT NULL,
    hwm_before       NUMERIC NOT NULL,
    hwm_after        NUMERIC NOT NULL,
    equity           NUMERIC NOT NULL,
    status           TEXT NOT NULL CHECK (status IN ('pending', 'approved', 'paid', 'rejected', 'failed')),
    reviewed_by      TEXT,
    note             TEXT,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
    paid_at          TIMESTAMPTZ,
    updated_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (tenant_id, ledger_key, payer_user_id)
);
CREATE INDEX social_fees_status_idx ON social_fees (tenant_id, status);

-- D72: end-of-day equity (USD) and external flows of master and fund accounts.
CREATE TABLE social_snapshots (
    login       BIGINT NOT NULL,
    day         DATE NOT NULL,
    tenant_id   BIGINT NOT NULL REFERENCES tenants(id),
    equity      NUMERIC NOT NULL,
    flow        NUMERIC NOT NULL DEFAULT 0,
    nav         NUMERIC,
    followers   INT NOT NULL DEFAULT 0,
    aum         NUMERIC NOT NULL DEFAULT 0,
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (login, day)
);

-- Wallet calls the engine must make (credits after redemptions, refunds, fee payouts). Retried until done.
CREATE TABLE wallet_outbox (
    id               BIGSERIAL PRIMARY KEY,
    tenant_id        BIGINT NOT NULL REFERENCES tenants(id),
    idempotency_key  TEXT NOT NULL UNIQUE,
    user_id          BIGINT NOT NULL,
    amount           NUMERIC NOT NULL CHECK (amount > 0),
    direction        TEXT NOT NULL,
    kind             TEXT NOT NULL,
    reference        TEXT NOT NULL,
    note             TEXT NOT NULL DEFAULT '',
    status           TEXT NOT NULL CHECK (status IN ('pending', 'done', 'failed')),
    attempts         INT NOT NULL DEFAULT 0,
    last_error       TEXT,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
    done_at          TIMESTAMPTZ
);
CREATE INDEX wallet_outbox_pending_idx ON wallet_outbox (status) WHERE status = 'pending';

CREATE TRIGGER copy_log_append_only BEFORE UPDATE OR DELETE ON copy_log FOR EACH ROW EXECUTE FUNCTION reject_mutation();
CREATE TRIGGER pamm_unit_ledger_append_only BEFORE UPDATE OR DELETE ON pamm_unit_ledger FOR EACH ROW EXECUTE FUNCTION reject_mutation();

DO $$
DECLARE t TEXT;
BEGIN
    FOREACH t IN ARRAY ARRAY['social_settings','social_masters','copy_subscriptions','copy_cursors','copy_log','pamm_funds','pamm_investors',
                             'pamm_requests','pamm_rollovers','pamm_unit_ledger','social_fees','social_snapshots','wallet_outbox'] LOOP
        EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
        EXECUTE format('CREATE POLICY tenant_isolation ON %I USING (tenant_id = NULLIF(current_setting(''ezymex.tenant_id'', true), '''')::bigint)', t);
    END LOOP;
END $$;
