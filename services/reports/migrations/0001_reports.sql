-- Ezymex reports service (D48, D50, D91, D120, D145). Read models mirrored from the engine, wallet, gateway and IB
-- service, plus the service's own daily equity snapshots, schedules and audit log. Every row carries `tenant`
-- (gateway tenant slug). Money is NUMERIC in the account currency unless a column says usd.

-- Clients (gateway referral feed: /v1/internal/referrals/users)
CREATE TABLE clients (
    tenant          TEXT        NOT NULL,
    user_id         BIGINT      NOT NULL,
    email           TEXT        NOT NULL DEFAULT '',
    first_name      TEXT        NOT NULL DEFAULT '',
    last_name       TEXT        NOT NULL DEFAULT '',
    country         TEXT        NOT NULL DEFAULT '',
    referral_code   TEXT,
    referred_by     BIGINT,
    campaign        TEXT,
    kyc_status      TEXT        NOT NULL DEFAULT 'unverified',
    status          TEXT        NOT NULL DEFAULT 'active',
    email_verified  BOOLEAN     NOT NULL DEFAULT false,
    created_at      TIMESTAMPTZ NOT NULL,
    changed_at      TIMESTAMPTZ NOT NULL,
    PRIMARY KEY (tenant, user_id)
);
CREATE INDEX clients_created ON clients (tenant, created_at);
CREATE INDEX clients_referred ON clients (tenant, referred_by);

-- Trading accounts (engine /v1/admin/accounts): dimension + latest live metrics + sync state
CREATE TABLE accounts (
    tenant          TEXT        NOT NULL,
    login           BIGINT      NOT NULL,
    user_id         BIGINT      NOT NULL,
    kind            TEXT        NOT NULL,           -- live | demo
    group_code      TEXT        NOT NULL,
    group_name      TEXT        NOT NULL DEFAULT '',
    mode            TEXT        NOT NULL DEFAULT '',
    cent            BOOLEAN     NOT NULL DEFAULT false,
    currency        TEXT        NOT NULL DEFAULT 'USD',
    leverage        INT         NOT NULL DEFAULT 0,
    status          TEXT        NOT NULL DEFAULT 'active',
    name            TEXT        NOT NULL DEFAULT '',
    created_at      TIMESTAMPTZ NOT NULL,
    balance         NUMERIC     NOT NULL DEFAULT 0,
    credit          NUMERIC     NOT NULL DEFAULT 0,
    bonus           NUMERIC     NOT NULL DEFAULT 0,
    equity          NUMERIC     NOT NULL DEFAULT 0,
    margin          NUMERIC     NOT NULL DEFAULT 0,
    profit          NUMERIC     NOT NULL DEFAULT 0,
    positions       INT         NOT NULL DEFAULT 0,
    version         BIGINT      NOT NULL DEFAULT 0,
    synced_version  BIGINT      NOT NULL DEFAULT -1,  -- engine version whose deals + ledger are mirrored
    deals_until     TIMESTAMPTZ,                      -- newest deal time mirrored
    ledger_until    TIMESTAMPTZ,                      -- newest ledger time mirrored
    backfilled      BOOLEAN     NOT NULL DEFAULT false,
    seen_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (tenant, login)
);
CREATE INDEX accounts_user ON accounts (tenant, user_id);

-- Deals (engine /v1/accounts/{login}/history). Idempotent by (tenant, id).
CREATE TABLE deals (
    tenant          TEXT        NOT NULL,
    id              BIGINT      NOT NULL,
    login           BIGINT      NOT NULL,
    position_ticket BIGINT      NOT NULL,
    order_ticket    BIGINT,
    symbol          TEXT        NOT NULL,
    side            TEXT        NOT NULL,           -- buy | sell (deal direction)
    position_side   TEXT        NOT NULL,
    entry           TEXT        NOT NULL,           -- in | out | out_by
    volume          NUMERIC     NOT NULL,
    price           NUMERIC     NOT NULL,
    profit          NUMERIC     NOT NULL DEFAULT 0, -- price P&L (account currency)
    swap            NUMERIC     NOT NULL DEFAULT 0,
    commission      NUMERIC     NOT NULL DEFAULT 0, -- positive = charged; entry deals are the booked charge
    reason          TEXT        NOT NULL DEFAULT 'client',
    book            TEXT        NOT NULL DEFAULT 'B',
    time            TIMESTAMPTZ NOT NULL,
    open_price      NUMERIC,
    open_time       TIMESTAMPTZ,
    source          TEXT        NOT NULL DEFAULT 'manual',
    comment         TEXT        NOT NULL DEFAULT '',
    price_correction BOOLEAN    NOT NULL DEFAULT false,
    reversed        BOOLEAN     NOT NULL DEFAULT false,
    PRIMARY KEY (tenant, id)
);
CREATE INDEX deals_login_time ON deals (tenant, login, time);
CREATE INDEX deals_time ON deals (tenant, time);

-- Ledger postings on the account's sub-ledgers (engine /v1/accounts/{login}/ledger)
CREATE TABLE ledger (
    tenant          TEXT        NOT NULL,
    login           BIGINT      NOT NULL,
    txn             BIGINT      NOT NULL,
    sub_ledger      TEXT        NOT NULL,           -- balance | credit | bonus
    kind            TEXT        NOT NULL,
    amount          NUMERIC     NOT NULL,
    currency        TEXT        NOT NULL,
    reference       TEXT,
    reason_code     TEXT,
    note            TEXT,
    at              TIMESTAMPTZ NOT NULL,
    PRIMARY KEY (tenant, login, txn, sub_ledger)
);
CREATE INDEX ledger_login_at ON ledger (tenant, login, at);
CREATE INDEX ledger_kind_at ON ledger (tenant, kind, at);

-- End-of-day snapshots per account (server day, GMT+2/+3). `source` = live (engine metrics at the time) or
-- backfill (rebuilt from the ledger: equity = balance + credit + bonus, floating unknown).
CREATE TABLE snapshots (
    tenant          TEXT        NOT NULL,
    login           BIGINT      NOT NULL,
    day             DATE        NOT NULL,
    balance         NUMERIC     NOT NULL,
    credit          NUMERIC     NOT NULL DEFAULT 0,
    equity          NUMERIC     NOT NULL,
    margin          NUMERIC     NOT NULL DEFAULT 0,
    flow            NUMERIC     NOT NULL DEFAULT 0, -- net external money in that day (deposits − withdrawals, demo funding)
    source          TEXT        NOT NULL DEFAULT 'live',
    taken_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (tenant, login, day)
);

-- Wallet money movements (wallet /v1/admin/deposits, /v1/admin/withdrawals)
CREATE TABLE wallet_deposits (
    tenant          TEXT        NOT NULL,
    id              BIGINT      NOT NULL,
    user_id         BIGINT,
    chain           TEXT        NOT NULL DEFAULT '',
    currency        TEXT        NOT NULL DEFAULT 'USDT',
    amount          NUMERIC     NOT NULL DEFAULT 0,
    status          TEXT        NOT NULL,
    credited_at     TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL,
    PRIMARY KEY (tenant, id)
);
CREATE INDEX wallet_deposits_user ON wallet_deposits (tenant, user_id, credited_at);

CREATE TABLE wallet_withdrawals (
    tenant          TEXT        NOT NULL,
    id              BIGINT      NOT NULL,
    user_id         BIGINT      NOT NULL,
    chain           TEXT        NOT NULL DEFAULT '',
    currency        TEXT        NOT NULL DEFAULT 'USDT',
    amount          NUMERIC     NOT NULL DEFAULT 0,
    fee             NUMERIC     NOT NULL DEFAULT 0,
    net_amount      NUMERIC     NOT NULL DEFAULT 0,
    status          TEXT        NOT NULL,
    completed_at    TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL,
    PRIMARY KEY (tenant, id)
);
CREATE INDEX wallet_withdrawals_user ON wallet_withdrawals (tenant, user_id, completed_at);

-- IB commission lines (IB /v1/ib/admin/commissions): the broker's partner cost
CREATE TABLE ib_commissions (
    tenant          TEXT        NOT NULL,
    id              BIGINT      NOT NULL,
    kind            TEXT        NOT NULL,
    status          TEXT        NOT NULL,
    amount          NUMERIC     NOT NULL,
    beneficiary_id  BIGINT      NOT NULL,
    client_id       BIGINT,
    login           BIGINT,
    symbol          TEXT,
    lots            NUMERIC     NOT NULL DEFAULT 0,
    created_at      TIMESTAMPTZ NOT NULL,
    PRIMARY KEY (tenant, id)
);
CREATE INDEX ib_commissions_at ON ib_commissions (tenant, created_at);

-- Scheduled reports (D145)
CREATE TABLE schedules (
    id              BIGSERIAL   PRIMARY KEY,
    tenant          TEXT        NOT NULL,
    name            TEXT        NOT NULL,
    report          TEXT        NOT NULL,           -- pnl | deposits | funnel | cohorts | activity | transactions | clients | partners
    format          TEXT        NOT NULL DEFAULT 'xlsx',
    frequency       TEXT        NOT NULL,           -- daily | weekly | monthly
    weekday         INT         NOT NULL DEFAULT 1, -- 1 = Monday (weekly)
    month_day       INT         NOT NULL DEFAULT 1, -- monthly
    hour            INT         NOT NULL DEFAULT 7, -- server time
    recipients      TEXT[]      NOT NULL,
    enabled         BOOLEAN     NOT NULL DEFAULT true,
    created_by      TEXT        NOT NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_by      TEXT,
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    last_run_at     TIMESTAMPTZ,
    last_status     TEXT,
    next_run_at     TIMESTAMPTZ NOT NULL
);
CREATE INDEX schedules_due ON schedules (enabled, next_run_at);

CREATE TABLE schedule_runs (
    id              BIGSERIAL   PRIMARY KEY,
    schedule_id     BIGINT      NOT NULL REFERENCES schedules (id) ON DELETE CASCADE,
    tenant          TEXT        NOT NULL,
    at              TIMESTAMPTZ NOT NULL DEFAULT now(),
    trigger         TEXT        NOT NULL,           -- schedule | manual
    status          TEXT        NOT NULL,           -- sent | logged | failed
    period_from     TIMESTAMPTZ NOT NULL,
    period_to       TIMESTAMPTZ NOT NULL,
    recipients      TEXT[]      NOT NULL,
    bytes           INT         NOT NULL DEFAULT 0,
    error           TEXT
);
CREATE INDEX schedule_runs_schedule ON schedule_runs (schedule_id, at DESC);

-- Poller cursors
CREATE TABLE cursors (
    tenant          TEXT        NOT NULL,
    name            TEXT        NOT NULL,
    value           JSONB       NOT NULL,
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (tenant, name)
);

-- Audit (append-only): exports, statement downloads, schedule changes
CREATE TABLE audit_log (
    id              BIGSERIAL   PRIMARY KEY,
    tenant          TEXT        NOT NULL,
    at              TIMESTAMPTZ NOT NULL DEFAULT now(),
    actor           TEXT        NOT NULL,
    actor_name      TEXT        NOT NULL DEFAULT '',
    actor_role      TEXT        NOT NULL DEFAULT '',
    action          TEXT        NOT NULL,
    target          TEXT,
    detail          JSONB
);
CREATE INDEX audit_log_tenant ON audit_log (tenant, id DESC);

CREATE FUNCTION audit_log_append_only() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
    RAISE EXCEPTION 'audit_log is append-only';
END $$;
CREATE TRIGGER audit_log_no_update BEFORE UPDATE OR DELETE ON audit_log FOR EACH ROW EXECUTE FUNCTION audit_log_append_only();
