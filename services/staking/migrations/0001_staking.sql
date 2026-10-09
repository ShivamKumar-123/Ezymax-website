-- Ezymex staking (Earn): plans with admin-set monthly returns, client positions locked until the end of the term,
-- monthly settlements approved by a second staff member, principal returned to the wallet at maturity.
-- Every amount is NUMERIC in the plan's currency; periods are server-time calendar months "YYYY-MM".

CREATE TABLE plans (
    id                    BIGSERIAL PRIMARY KEY,
    tenant                TEXT NOT NULL DEFAULT 'ezymex',
    name                  TEXT NOT NULL,
    currency              TEXT NOT NULL DEFAULT 'USDT',
    min_amount            NUMERIC NOT NULL CHECK (min_amount > 0),
    -- per subscription
    max_amount            NUMERIC CHECK (max_amount IS NULL OR max_amount >= min_amount),
    -- a client's open principal in the plan (pending + active)
    per_user_max          NUMERIC CHECK (per_user_max IS NULL OR per_user_max >= min_amount),
    -- every client's open principal in the plan
    capacity              NUMERIC CHECK (capacity IS NULL OR capacity >= min_amount),
    term_months           INT NOT NULL CHECK (term_months BETWEEN 1 AND 60),
    status                TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'paused', 'closed')),
    -- ceiling for the rate the admin may set for a month (never shown to clients)
    max_monthly_rate_pct  NUMERIC NOT NULL CHECK (max_monthly_rate_pct > 0 AND max_monthly_rate_pct <= 100),
    description           TEXT NOT NULL DEFAULT '',
    risk_text             TEXT NOT NULL DEFAULT '',
    sort                  INT NOT NULL DEFAULT 0,
    version               INT NOT NULL DEFAULT 1,
    created_by            TEXT NOT NULL,
    created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_by            TEXT NOT NULL,
    updated_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX plans_tenant ON plans (tenant, sort, id);

-- The return of one plan for one month, set by the admin once the month is under way (never in advance).
CREATE TABLE monthly_rates (
    id          BIGSERIAL PRIMARY KEY,
    tenant      TEXT NOT NULL DEFAULT 'ezymex',
    plan_id     BIGINT NOT NULL REFERENCES plans(id),
    period      TEXT NOT NULL CHECK (period ~ '^[0-9]{4}-(0[1-9]|1[0-2])$'),
    rate_pct    NUMERIC NOT NULL CHECK (rate_pct >= 0 AND rate_pct <= 100),
    set_by      TEXT NOT NULL,
    set_by_name TEXT NOT NULL DEFAULT '',
    set_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    note        TEXT,
    UNIQUE (tenant, plan_id, period)
);

-- A client's subscription. Principal is debited from the wallet first (record-first `wallet_ops`), earns from the
-- start day to the maturity day (server time) and is credited back by the maturity worker. No early withdrawal.
CREATE TABLE positions (
    id                BIGSERIAL PRIMARY KEY,
    tenant            TEXT NOT NULL DEFAULT 'ezymex',
    user_id           BIGINT NOT NULL,
    user_name         TEXT NOT NULL DEFAULT '',
    plan_id           BIGINT NOT NULL REFERENCES plans(id),
    plan_name         TEXT NOT NULL,
    plan_version      INT NOT NULL,
    -- the plan's terms and risk text as the client accepted them
    plan_snapshot     JSONB NOT NULL,
    currency          TEXT NOT NULL,
    term_months       INT NOT NULL,
    principal         NUMERIC NOT NULL CHECK (principal > 0),
    status            TEXT NOT NULL DEFAULT 'pending_payment' CHECK (status IN ('pending_payment', 'payment_failed', 'active', 'matured')),
    -- 'u<user>:<client key>': retries of one subscribe never create a second position
    idempotency_key   TEXT NOT NULL,
    terms_accepted_at TIMESTAMPTZ NOT NULL,
    risk_ack_at       TIMESTAMPTZ NOT NULL,
    failure_reason    TEXT,
    started_at        TIMESTAMPTZ,
    matures_at        TIMESTAMPTZ,
    matured_at        TIMESTAMPTZ,
    returns_paid      NUMERIC NOT NULL DEFAULT 0,
    redeem_attempts   INT NOT NULL DEFAULT 0,
    redeem_error      TEXT,
    redeem_next_at    TIMESTAMPTZ,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (tenant, idempotency_key),
    CHECK (status NOT IN ('active', 'matured') OR (started_at IS NOT NULL AND matures_at IS NOT NULL))
);
CREATE INDEX positions_user ON positions (tenant, user_id, id DESC);
CREATE INDEX positions_plan ON positions (tenant, plan_id, status);
CREATE INDEX positions_due ON positions (matures_at) WHERE status = 'active';

-- Wallet calls with their idempotency keys (retried with the same key when the outcome is unknown).
CREATE TABLE wallet_ops (
    key         TEXT PRIMARY KEY,
    tenant      TEXT NOT NULL DEFAULT 'ezymex',
    user_id     BIGINT NOT NULL,
    direction   TEXT NOT NULL CHECK (direction IN ('debit', 'credit')),
    kind        TEXT NOT NULL,
    currency    TEXT NOT NULL,
    amount      NUMERIC NOT NULL CHECK (amount > 0),
    ref         TEXT NOT NULL,
    status      TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'done', 'rejected')),
    response    JSONB,
    attempts    INT NOT NULL DEFAULT 0,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- One month's returns, created from the rates and approved by a different staff member (four-eyes).
CREATE TABLE settlements (
    id               BIGSERIAL PRIMARY KEY,
    tenant           TEXT NOT NULL DEFAULT 'ezymex',
    period           TEXT NOT NULL CHECK (period ~ '^[0-9]{4}-(0[1-9]|1[0-2])$'),
    status           TEXT NOT NULL DEFAULT 'pending_approval' CHECK (status IN ('pending_approval', 'approved', 'paid', 'partially_paid', 'rejected')),
    total            NUMERIC NOT NULL,
    lines            INT NOT NULL,
    investors        INT NOT NULL,
    principal        NUMERIC NOT NULL,
    -- {"<plan id>": {"name": …, "ratePct": …}} as settled
    rates            JSONB NOT NULL,
    created_by       TEXT NOT NULL,
    created_by_name  TEXT NOT NULL DEFAULT '',
    create_reason    TEXT NOT NULL,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
    decided_by       TEXT,
    decided_by_name  TEXT,
    decided_at       TIMESTAMPTZ,
    decision_reason  TEXT,
    completed_at     TIMESTAMPTZ,
    -- the approver is never the creator
    CHECK (status IN ('pending_approval', 'rejected') OR (decided_by IS NOT NULL AND decided_by <> created_by))
);
CREATE UNIQUE INDEX settlements_one_per_period ON settlements (tenant, period) WHERE status <> 'rejected';
CREATE INDEX settlements_tenant ON settlements (tenant, id DESC);

-- One position's return for one month. Paid at most once: one live line per (tenant, period, position) and the
-- wallet key `staking:reward:<tenant>:<period>:<position>`.
CREATE TABLE settlement_lines (
    id               BIGSERIAL PRIMARY KEY,
    tenant           TEXT NOT NULL DEFAULT 'ezymex',
    settlement_id    BIGINT NOT NULL REFERENCES settlements(id),
    period           TEXT NOT NULL,
    position_id      BIGINT NOT NULL REFERENCES positions(id),
    user_id          BIGINT NOT NULL,
    plan_id          BIGINT NOT NULL REFERENCES plans(id),
    currency         TEXT NOT NULL,
    principal        NUMERIC NOT NULL,
    rate_pct         NUMERIC NOT NULL,
    days_active      INT NOT NULL CHECK (days_active > 0),
    days_in_month    INT NOT NULL,
    amount           NUMERIC NOT NULL CHECK (amount > 0),
    status           TEXT NOT NULL DEFAULT 'pending_approval' CHECK (status IN ('pending_approval', 'transfer_pending', 'paid', 'failed', 'rejected')),
    idempotency_key  TEXT NOT NULL,
    attempts         INT NOT NULL DEFAULT 0,
    last_error       TEXT,
    next_attempt_at  TIMESTAMPTZ,
    wallet_txn       TEXT,
    paid_at          TIMESTAMPTZ,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX settlement_lines_once ON settlement_lines (tenant, period, position_id) WHERE status <> 'rejected';
CREATE INDEX settlement_lines_settlement ON settlement_lines (settlement_id, id);
CREATE INDEX settlement_lines_due ON settlement_lines (next_attempt_at) WHERE status = 'transfer_pending';
CREATE INDEX settlement_lines_position ON settlement_lines (position_id, period);
CREATE INDEX settlement_lines_user ON settlement_lines (tenant, user_id, id DESC);

-- Worker bookkeeping (last runs).
CREATE TABLE cursors (
    name        TEXT PRIMARY KEY,
    value       TEXT NOT NULL,
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Append-only audit of every staff, client and system decision.
CREATE TABLE audit_log (
    id          BIGSERIAL PRIMARY KEY,
    tenant      TEXT NOT NULL,
    actor       TEXT NOT NULL,
    actor_name  TEXT,
    action      TEXT NOT NULL,
    target      TEXT,
    before      JSONB,
    after       JSONB,
    reason      TEXT,
    at          TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX audit_log_tenant ON audit_log (tenant, id DESC);

CREATE FUNCTION staking_append_only() RETURNS trigger AS $$
BEGIN
    RAISE EXCEPTION '% is append-only', TG_TABLE_NAME;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER audit_log_no_update BEFORE UPDATE OR DELETE ON audit_log FOR EACH ROW EXECUTE FUNCTION staking_append_only();
