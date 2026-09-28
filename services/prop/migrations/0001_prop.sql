-- Kalks prop firm (module 15, D147–D150). Database kalks_prop.
-- Every table carries the tenant slug and an RLS policy on current_setting('kalks.tenant'). The service
-- connects as the table owner and filters by tenant itself; the policies protect every other role.
-- Money is NUMERIC (rust_decimal in the service), never floats.

-- Challenge plans (D147). Rule fields are typed columns; sizes live in plan_sizes.
CREATE TABLE plans (
    tenant             TEXT NOT NULL DEFAULT 'kalks',
    id                 TEXT NOT NULL CHECK (id ~ '^[a-z0-9][a-z0-9-]{1,47}$'),
    name               TEXT NOT NULL,
    kind               TEXT NOT NULL CHECK (kind IN ('1-step', '2-step', 'instant')),
    status             TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'paused', 'archived')),
    version            INT NOT NULL DEFAULT 0,
    engine_group       TEXT NOT NULL DEFAULT 'prop',
    -- [{name, target (%), minDays, timeLimit (days, 0 = none)}], empty for instant funding
    phases             JSONB NOT NULL DEFAULT '[]',
    daily_loss_pct     NUMERIC NOT NULL CHECK (daily_loss_pct > 0 AND daily_loss_pct <= 100),
    daily_basis        TEXT NOT NULL DEFAULT 'balance' CHECK (daily_basis IN ('balance', 'equity')),
    max_dd_pct         NUMERIC NOT NULL CHECK (max_dd_pct > 0 AND max_dd_pct <= 100),
    dd_type            TEXT NOT NULL DEFAULT 'static' CHECK (dd_type IN ('static', 'trailing')),
    trailing_lock      BOOLEAN NOT NULL DEFAULT true,
    consistency_pct    NUMERIC NOT NULL DEFAULT 0 CHECK (consistency_pct >= 0 AND consistency_pct <= 100),
    news_trading       BOOLEAN NOT NULL DEFAULT true,
    news_window_min    INT NOT NULL DEFAULT 2 CHECK (news_window_min BETWEEN 0 AND 240),
    news_breach_fails  BOOLEAN NOT NULL DEFAULT false,
    weekend_holding    BOOLEAN NOT NULL DEFAULT true,
    ea_allowed         BOOLEAN NOT NULL DEFAULT true,
    banned             TEXT[] NOT NULL DEFAULT '{}',
    split_pct          NUMERIC NOT NULL CHECK (split_pct > 0 AND split_pct <= 100),
    split_max_pct      NUMERIC NOT NULL CHECK (split_max_pct > 0 AND split_max_pct <= 100),
    scaling_every_months INT NOT NULL DEFAULT 0 CHECK (scaling_every_months >= 0),
    scaling_increase_pct NUMERIC NOT NULL DEFAULT 0 CHECK (scaling_increase_pct >= 0),
    scaling_profit_pct NUMERIC NOT NULL DEFAULT 0 CHECK (scaling_profit_pct >= 0),
    scaling_cap        NUMERIC NOT NULL DEFAULT 0 CHECK (scaling_cap >= 0),
    refund_fee         BOOLEAN NOT NULL DEFAULT false,
    payout_freq        TEXT NOT NULL DEFAULT 'bi-weekly' CHECK (payout_freq IN ('weekly', 'bi-weekly', 'monthly', 'on-demand')),
    first_payout_days  INT NOT NULL DEFAULT 14 CHECK (first_payout_days >= 0),
    min_payout         NUMERIC NOT NULL DEFAULT 0 CHECK (min_payout >= 0),
    created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_by         TEXT,
    PRIMARY KEY (tenant, id),
    CHECK (split_max_pct >= split_pct)
);

CREATE TABLE plan_sizes (
    tenant     TEXT NOT NULL DEFAULT 'kalks',
    plan_id    TEXT NOT NULL,
    size       NUMERIC NOT NULL CHECK (size > 0),
    fee        NUMERIC NOT NULL CHECK (fee >= 0),
    leverage   INT NOT NULL CHECK (leverage > 0),
    enabled    BOOLEAN NOT NULL DEFAULT true,
    PRIMARY KEY (tenant, plan_id, size),
    FOREIGN KEY (tenant, plan_id) REFERENCES plans (tenant, id) ON DELETE CASCADE
);

-- A purchase. It moves through phase accounts: phase1 → phase2 → funded, or failed (D147, D148).
CREATE TABLE challenges (
    id              BIGSERIAL PRIMARY KEY,
    tenant          TEXT NOT NULL DEFAULT 'kalks',
    user_id         BIGINT NOT NULL,
    trader_name     TEXT NOT NULL DEFAULT '',
    plan_id         TEXT NOT NULL,
    plan_version    INT NOT NULL,
    plan_name       TEXT NOT NULL,
    kind            TEXT NOT NULL,
    size            NUMERIC NOT NULL,
    fee             NUMERIC NOT NULL,
    leverage        INT NOT NULL,
    engine_group    TEXT NOT NULL,
    -- full plan snapshot at purchase: running challenges keep the rules they bought
    rules           JSONB NOT NULL,
    status          TEXT NOT NULL DEFAULT 'pending_payment'
                    CHECK (status IN ('pending_payment', 'payment_failed', 'provisioning', 'active', 'funded', 'failed', 'closed')),
    phase_index     INT NOT NULL DEFAULT 0,
    purchase_key    TEXT NOT NULL,
    wallet_ref      TEXT,
    fee_refunded    BOOLEAN NOT NULL DEFAULT false,
    split_pct       NUMERIC NOT NULL,
    failure_reason  TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (tenant, purchase_key)
);
CREATE INDEX challenges_user ON challenges (tenant, user_id, id DESC);
CREATE INDEX challenges_status ON challenges (tenant, status);

-- One engine trading account per phase (Phase 1, Phase 2, Funded). Live rule state lives here.
CREATE TABLE phase_accounts (
    id               BIGSERIAL PRIMARY KEY,
    tenant           TEXT NOT NULL DEFAULT 'kalks',
    challenge_id     BIGINT NOT NULL REFERENCES challenges (id),
    user_id          BIGINT NOT NULL,
    phase_index      INT NOT NULL,
    phase_name       TEXT NOT NULL,
    funded           BOOLEAN NOT NULL DEFAULT false,
    login            BIGINT,
    status           TEXT NOT NULL DEFAULT 'provisioning'
                     CHECK (status IN ('provisioning', 'active', 'passed', 'failed', 'closed')),
    initial_balance  NUMERIC NOT NULL,
    target_pct       NUMERIC,
    min_days         INT NOT NULL DEFAULT 0,
    time_limit_days  INT NOT NULL DEFAULT 0,
    started_at       TIMESTAMPTZ,
    ended_at         TIMESTAMPTZ,
    end_reason       TEXT,
    -- live rule state (updated by the evaluator)
    day              DATE,
    day_start_balance NUMERIC,
    day_start_equity NUMERIC,
    hwm              NUMERIC,
    min_equity       NUMERIC,
    balance          NUMERIC,
    equity           NUMERIC,
    open_positions   INT NOT NULL DEFAULT 0,
    trading_days     INT NOT NULL DEFAULT 0,
    engine_version   BIGINT NOT NULL DEFAULT 0,
    warn_level       INT NOT NULL DEFAULT 0,
    stats            JSONB NOT NULL DEFAULT '{}',
    last_eval_at     TIMESTAMPTZ,
    last_payout_at   TIMESTAMPTZ,
    scaled_at        TIMESTAMPTZ,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (challenge_id, phase_index)
);
CREATE UNIQUE INDEX phase_accounts_login ON phase_accounts (login) WHERE login IS NOT NULL;
CREATE INDEX phase_accounts_active ON phase_accounts (status) WHERE status = 'active';

-- Equity curve samples for the trader dashboard (at most one per minute per account, plus rule events).
CREATE TABLE equity_points (
    account_id BIGINT NOT NULL REFERENCES phase_accounts (id),
    tenant     TEXT NOT NULL DEFAULT 'kalks',
    at         TIMESTAMPTZ NOT NULL,
    balance    NUMERIC NOT NULL,
    equity     NUMERIC NOT NULL,
    PRIMARY KEY (account_id, at)
);

-- Rule events: breaches (auto-fail), violations (position closed / flagged), warnings, overrides.
CREATE TABLE rule_events (
    id           BIGSERIAL PRIMARY KEY,
    tenant       TEXT NOT NULL DEFAULT 'kalks',
    account_id   BIGINT NOT NULL REFERENCES phase_accounts (id),
    challenge_id BIGINT NOT NULL REFERENCES challenges (id),
    user_id      BIGINT NOT NULL,
    login        BIGINT,
    rule         TEXT NOT NULL,
    severity     TEXT NOT NULL CHECK (severity IN ('breach', 'violation', 'warning', 'info')),
    at           TIMESTAMPTZ NOT NULL DEFAULT now(),
    equity       NUMERIC,
    balance      NUMERIC,
    threshold    NUMERIC,
    message      TEXT NOT NULL,
    details      JSONB NOT NULL DEFAULT '{}',
    dedupe_key   TEXT,
    UNIQUE (account_id, dedupe_key)
);
CREATE INDEX rule_events_at ON rule_events (tenant, at DESC);

-- Banned-strategy heuristics, flagged for review (D148). Never auto-fail on their own.
CREATE TABLE strategy_flags (
    id            BIGSERIAL PRIMARY KEY,
    tenant        TEXT NOT NULL DEFAULT 'kalks',
    account_id    BIGINT NOT NULL REFERENCES phase_accounts (id),
    challenge_id  BIGINT NOT NULL REFERENCES challenges (id),
    user_id       BIGINT NOT NULL,
    login         BIGINT,
    kind          TEXT NOT NULL CHECK (kind IN ('tick_scalping', 'hft', 'latency_arbitrage', 'cross_account_hedging', 'cross_account_copying')),
    score         NUMERIC NOT NULL DEFAULT 0,
    summary       TEXT NOT NULL,
    evidence      JSONB NOT NULL DEFAULT '{}',
    related_login BIGINT NOT NULL DEFAULT 0,
    status        TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'cleared', 'confirmed')),
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    reviewed_by   TEXT,
    reviewed_at   TIMESTAMPTZ,
    review_note   TEXT,
    UNIQUE (account_id, kind, related_login)
);

-- Funded payouts (D149): request → admin approval → wallet credit.
CREATE TABLE payouts (
    id             BIGSERIAL PRIMARY KEY,
    tenant         TEXT NOT NULL DEFAULT 'kalks',
    challenge_id   BIGINT NOT NULL REFERENCES challenges (id),
    account_id     BIGINT NOT NULL REFERENCES phase_accounts (id),
    user_id        BIGINT NOT NULL,
    login          BIGINT NOT NULL,
    profit         NUMERIC NOT NULL CHECK (profit > 0),
    split_pct      NUMERIC NOT NULL,
    trader_amount  NUMERIC NOT NULL,
    firm_amount    NUMERIC NOT NULL,
    fee_refund     NUMERIC NOT NULL DEFAULT 0,
    status         TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'paid', 'rejected', 'failed')),
    kyc_status     TEXT,
    requested_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    decided_at     TIMESTAMPTZ,
    decided_by     TEXT,
    note           TEXT,
    wallet_ref     TEXT,
    error          TEXT
);
CREATE INDEX payouts_status ON payouts (tenant, status, requested_at DESC);
CREATE UNIQUE INDEX payouts_one_pending ON payouts (account_id) WHERE status IN ('pending', 'approved');

CREATE TABLE scaling_events (
    id          BIGSERIAL PRIMARY KEY,
    tenant      TEXT NOT NULL DEFAULT 'kalks',
    account_id  BIGINT NOT NULL REFERENCES phase_accounts (id),
    at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    from_size   NUMERIC NOT NULL,
    to_size     NUMERIC NOT NULL,
    split_from  NUMERIC NOT NULL,
    split_to    NUMERIC NOT NULL,
    actor       TEXT NOT NULL
);

-- Shareable certificates with a public verify link (D149, D136).
CREATE TABLE certificates (
    code         TEXT PRIMARY KEY,
    tenant       TEXT NOT NULL DEFAULT 'kalks',
    user_id      BIGINT NOT NULL,
    challenge_id BIGINT NOT NULL REFERENCES challenges (id),
    kind         TEXT NOT NULL CHECK (kind IN ('pass', 'funded', 'payout')),
    title        TEXT NOT NULL,
    trader_name  TEXT NOT NULL,
    plan_name    TEXT NOT NULL,
    size         NUMERIC NOT NULL,
    amount       NUMERIC,
    phase_name   TEXT,
    issued_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    revoked      BOOLEAN NOT NULL DEFAULT false,
    ref          TEXT NOT NULL,
    UNIQUE (tenant, ref)
);
CREATE INDEX certificates_user ON certificates (tenant, user_id, issued_at DESC);

-- Admin-managed economic calendar used by the news-window rule.
CREATE TABLE news_events (
    id          BIGSERIAL PRIMARY KEY,
    tenant      TEXT NOT NULL DEFAULT 'kalks',
    at          TIMESTAMPTZ NOT NULL,
    title       TEXT NOT NULL,
    currency    TEXT NOT NULL CHECK (currency ~ '^[A-Z]{3}$'),
    impact      TEXT NOT NULL DEFAULT 'high' CHECK (impact IN ('high', 'medium', 'low')),
    symbols     TEXT[] NOT NULL DEFAULT '{}',
    created_by  TEXT,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX news_events_at ON news_events (tenant, at);

-- In-app notifications for the trader (warnings, breach, pass, payout decisions).
CREATE TABLE notifications (
    id          BIGSERIAL PRIMARY KEY,
    tenant      TEXT NOT NULL DEFAULT 'kalks',
    user_id     BIGINT NOT NULL,
    challenge_id BIGINT,
    kind        TEXT NOT NULL,
    title       TEXT NOT NULL,
    body        TEXT NOT NULL,
    at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    read_at     TIMESTAMPTZ
);
CREATE INDEX notifications_user ON notifications (tenant, user_id, id DESC);

-- Wallet calls with their idempotency keys (retried with the same key when the outcome is unknown).
CREATE TABLE wallet_ops (
    key         TEXT PRIMARY KEY,
    tenant      TEXT NOT NULL DEFAULT 'kalks',
    user_id     BIGINT NOT NULL,
    direction   TEXT NOT NULL CHECK (direction IN ('debit', 'credit')),
    kind        TEXT NOT NULL,
    amount      NUMERIC NOT NULL CHECK (amount > 0),
    ref         TEXT NOT NULL,
    status      TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'done', 'rejected')),
    response    JSONB,
    attempts    INT NOT NULL DEFAULT 0,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Append-only audit of every staff and system decision.
CREATE TABLE audit_log (
    id          BIGSERIAL PRIMARY KEY,
    tenant      TEXT NOT NULL DEFAULT 'kalks',
    at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    actor       TEXT NOT NULL,
    actor_name  TEXT NOT NULL DEFAULT '',
    actor_role  TEXT NOT NULL DEFAULT '',
    action      TEXT NOT NULL,
    entity      TEXT NOT NULL,
    entity_id   TEXT NOT NULL,
    before      JSONB,
    after       JSONB,
    reason      TEXT,
    note        TEXT
);
CREATE INDEX audit_log_entity ON audit_log (tenant, entity, entity_id, id DESC);

CREATE FUNCTION prop_append_only() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
    RAISE EXCEPTION '% is append-only', TG_TABLE_NAME;
END $$;
CREATE TRIGGER audit_log_append_only BEFORE UPDATE OR DELETE ON audit_log FOR EACH ROW EXECUTE FUNCTION prop_append_only();

DO $$
DECLARE t TEXT;
BEGIN
    FOREACH t IN ARRAY ARRAY['plans', 'plan_sizes', 'challenges', 'phase_accounts', 'equity_points', 'rule_events', 'strategy_flags',
                             'payouts', 'scaling_events', 'certificates', 'news_events', 'notifications', 'wallet_ops', 'audit_log'] LOOP
        EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
        EXECUTE format('CREATE POLICY tenant_isolation ON %I USING (tenant = current_setting(''kalks.tenant'', true))', t);
    END LOOP;
END $$;

-- Starter catalogue (drafts are not sold; the three demo models go live as 'active').
INSERT INTO plans (id, name, kind, status, version, phases, daily_loss_pct, daily_basis, max_dd_pct, dd_type, consistency_pct,
                   news_trading, news_window_min, weekend_holding, banned, split_pct, split_max_pct,
                   scaling_every_months, scaling_increase_pct, scaling_profit_pct, scaling_cap, refund_fee, payout_freq, first_payout_days, min_payout)
VALUES
 ('classic-2-step', 'Kalks Classic 2-Step', '2-step', 'active', 1,
  '[{"name":"Phase 1","target":8,"minDays":4,"timeLimit":0},{"name":"Phase 2","target":5,"minDays":4,"timeLimit":0}]',
  5, 'balance', 10, 'static', 0, true, 2, true,
  '{hft,latency_arbitrage,tick_scalping,cross_account_copying,cross_account_hedging}', 80, 90, 4, 25, 10, 2000000, true, 'bi-weekly', 14, 50),
 ('rapid-1-step', 'Kalks Rapid 1-Step', '1-step', 'active', 1,
  '[{"name":"Evaluation","target":10,"minDays":3,"timeLimit":0}]',
  3, 'equity', 6, 'trailing', 40, false, 5, false,
  '{hft,latency_arbitrage,tick_scalping,cross_account_copying,cross_account_hedging}', 80, 90, 4, 25, 10, 1000000, true, 'bi-weekly', 14, 50),
 ('instant-funding', 'Kalks Instant Funding', 'instant', 'active', 1,
  '[]',
  3, 'equity', 6, 'trailing', 30, false, 5, false,
  '{hft,latency_arbitrage,tick_scalping,cross_account_copying,cross_account_hedging}', 70, 90, 4, 25, 10, 1000000, false, 'monthly', 30, 100);

INSERT INTO plan_sizes (plan_id, size, fee, leverage) VALUES
 ('classic-2-step', 5000, 49, 100), ('classic-2-step', 10000, 89, 100), ('classic-2-step', 25000, 189, 100),
 ('classic-2-step', 50000, 299, 100), ('classic-2-step', 100000, 499, 100), ('classic-2-step', 200000, 979, 100),
 ('rapid-1-step', 5000, 59, 50), ('rapid-1-step', 10000, 99, 50), ('rapid-1-step', 25000, 199, 50),
 ('rapid-1-step', 50000, 319, 50), ('rapid-1-step', 100000, 549, 50), ('rapid-1-step', 200000, 1049, 50),
 ('instant-funding', 5000, 129, 30), ('instant-funding', 10000, 229, 30), ('instant-funding', 25000, 449, 30),
 ('instant-funding', 50000, 749, 30), ('instant-funding', 100000, 1349, 30);
