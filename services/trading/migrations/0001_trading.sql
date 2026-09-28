-- Kalks trading engine (database kalks_trading).
--
-- Source of truth: `events` (append-only, one stream per trading account, replayed on start).
-- Everything else about accounts is a projection written in the same transaction as the events:
-- accounts, orders, positions, deals, ledger_*. Configuration (groups, policies, controls, routing)
-- and the dealing audit log are regular tables. Every table carries tenant_id.

CREATE TABLE tenants (
    id          BIGINT PRIMARY KEY,
    slug        TEXT NOT NULL UNIQUE,
    name        TEXT NOT NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
-- ids mirror the gateway's tenants table (kalks_core)
INSERT INTO tenants (id, slug, name) VALUES (1, 'kalks', 'Kalks');

-- D115: dealing policy per tenant
CREATE TABLE tenant_policies (
    tenant_id           BIGINT PRIMARY KEY REFERENCES tenants(id),
    exec_delay_enabled  BOOLEAN NOT NULL DEFAULT true,
    exec_delay_cap_ms   INT NOT NULL DEFAULT 500 CHECK (exec_delay_cap_ms BETWEEN 0 AND 500),
    margin_call_pct     NUMERIC NOT NULL DEFAULT 100,
    stop_out_pct        NUMERIC NOT NULL DEFAULT 50,
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);
INSERT INTO tenant_policies (tenant_id) VALUES (1);

-- D5/D123: account groups
CREATE TABLE groups (
    tenant_id              BIGINT NOT NULL REFERENCES tenants(id),
    code                   TEXT NOT NULL CHECK (code ~ '^[a-z0-9][a-z0-9-]{0,39}$'),
    name                   TEXT NOT NULL,
    mode                   TEXT NOT NULL CHECK (mode IN ('netting', 'hedging')),
    cent                   BOOLEAN NOT NULL DEFAULT false,
    account_types          TEXT NOT NULL DEFAULT 'both' CHECK (account_types IN ('live', 'demo', 'both')),
    leverages              INT[] NOT NULL,
    default_leverage       INT NOT NULL,
    margin_call_pct        NUMERIC NOT NULL,
    stop_out_pct           NUMERIC NOT NULL,
    hedged_margin_pct      NUMERIC NOT NULL DEFAULT 50 CHECK (hedged_margin_pct BETWEEN 0 AND 100),
    min_deposit            NUMERIC NOT NULL DEFAULT 0,
    swap_free              BOOLEAN NOT NULL DEFAULT false,
    commission_per_lot     NUMERIC NOT NULL DEFAULT 0 CHECK (commission_per_lot >= 0),
    route                  CHAR(1) NOT NULL DEFAULT 'B' CHECK (route IN ('A', 'B')),
    spread_group           TEXT NOT NULL,
    max_accounts_per_user  INT NOT NULL DEFAULT 5,
    demo_initial_balance   NUMERIC NOT NULL DEFAULT 10000,
    demo_refills_per_day   INT NOT NULL DEFAULT 3,
    demo_expiry_days       INT NOT NULL DEFAULT 10,
    enabled                BOOLEAN NOT NULL DEFAULT true,
    created_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (tenant_id, code),
    CHECK (stop_out_pct < margin_call_pct)
);

INSERT INTO groups (tenant_id, code, name, mode, cent, leverages, default_leverage, margin_call_pct, stop_out_pct, hedged_margin_pct, min_deposit, commission_per_lot, route, spread_group, max_accounts_per_user) VALUES
 (1, 'standard',    'Standard',     'hedging', false, '{50,100,200,500,1000}', 500, 100, 50, 50, 10,    0, 'B', 'standard', 5),
 (1, 'pro',         'Pro',          'hedging', false, '{50,100,200,500}',      200, 100, 50, 50, 200,   0, 'B', 'pro',      5),
 (1, 'pro-netting', 'Pro Netting',  'netting', false, '{50,100,200,500}',      200, 100, 50, 0,  200,   0, 'B', 'pro',      5),
 (1, 'ecn',         'ECN',          'hedging', false, '{50,100,200,500}',      200, 100, 50, 50, 500,   7, 'B', 'ecn',      5),
 (1, 'cent',        'Cent',         'hedging', true,  '{100,200,500,1000}',    500, 60,  20, 50, 10,    0, 'B', 'cent',     5),
 (1, 'vip',         'VIP',          'hedging', false, '{50,100,200,500}',      200, 100, 50, 50, 25000, 3, 'B', 'ecn',      5),
 (1, 'prop',        'Prop',         'hedging', false, '{30,50,100}',           100, 100, 50, 50, 0,     0, 'B', 'standard', 5);

-- Projection of the account streams (+ columns that are not trading state: last activity).
CREATE TABLE accounts (
    login             BIGINT PRIMARY KEY,
    tenant_id         BIGINT NOT NULL REFERENCES tenants(id),
    user_id           BIGINT NOT NULL,
    kind              TEXT NOT NULL CHECK (kind IN ('live', 'demo')),
    group_code        TEXT NOT NULL,
    mode              TEXT NOT NULL,
    cent              BOOLEAN NOT NULL,
    currency          TEXT NOT NULL,
    leverage          INT NOT NULL,
    status            TEXT NOT NULL,
    name              TEXT NOT NULL,
    route_override    CHAR(1),
    controls          JSONB NOT NULL,
    demo              JSONB,
    balance           NUMERIC NOT NULL DEFAULT 0,
    credit            NUMERIC NOT NULL DEFAULT 0,
    bonus             NUMERIC NOT NULL DEFAULT 0,
    margin_call       BOOLEAN NOT NULL DEFAULT false,
    version           BIGINT NOT NULL,
    created_at        TIMESTAMPTZ NOT NULL,
    updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
    last_activity_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX accounts_user_idx ON accounts (tenant_id, user_id);
CREATE INDEX accounts_group_idx ON accounts (tenant_id, group_code);

-- D4: MT5-style per-account passwords (argon2id). Not part of the event stream.
CREATE TABLE account_credentials (
    login           BIGINT PRIMARY KEY REFERENCES accounts(login),
    tenant_id       BIGINT NOT NULL REFERENCES tenants(id),
    trading_hash    TEXT NOT NULL,
    investor_hash   TEXT NOT NULL,
    failed_logins   INT NOT NULL DEFAULT 0,
    locked_until    TIMESTAMPTZ,
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE events (
    seq         BIGSERIAL PRIMARY KEY,
    tenant_id   BIGINT NOT NULL REFERENCES tenants(id),
    login       BIGINT NOT NULL,
    version     BIGINT NOT NULL,
    kind        TEXT NOT NULL,
    actor       TEXT NOT NULL,
    payload     JSONB NOT NULL,
    created_at  TIMESTAMPTZ NOT NULL,
    UNIQUE (login, version)
);

CREATE TABLE orders (
    ticket           BIGINT PRIMARY KEY,
    tenant_id        BIGINT NOT NULL REFERENCES tenants(id),
    login            BIGINT NOT NULL,
    symbol           TEXT NOT NULL,
    side             TEXT NOT NULL,
    kind             TEXT NOT NULL,
    status           TEXT NOT NULL CHECK (status IN ('pending', 'filled', 'cancelled', 'expired', 'rejected')),
    volume           NUMERIC NOT NULL,
    price            NUMERIC NOT NULL,
    stop_limit       NUMERIC,
    sl               NUMERIC,
    tp               NUMERIC,
    triggered        BOOLEAN NOT NULL DEFAULT false,
    expiry           TEXT NOT NULL,
    expiry_at        TIMESTAMPTZ,
    oco              BIGINT,
    source           TEXT NOT NULL,
    platform         TEXT NOT NULL,
    comment          TEXT NOT NULL,
    book             CHAR(1),
    client_order_id  TEXT,
    placed_at        TIMESTAMPTZ NOT NULL,
    done_at          TIMESTAMPTZ,
    fill_price       NUMERIC,
    position_ticket  BIGINT,
    reason           TEXT,
    data             JSONB NOT NULL,
    updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX orders_login_idx ON orders (login, placed_at DESC);
CREATE INDEX orders_pending_idx ON orders (tenant_id) WHERE status = 'pending';
CREATE UNIQUE INDEX orders_client_id_idx ON orders (login, client_order_id) WHERE client_order_id IS NOT NULL;

CREATE TABLE positions (
    ticket         BIGINT PRIMARY KEY,
    tenant_id      BIGINT NOT NULL REFERENCES tenants(id),
    login          BIGINT NOT NULL,
    symbol         TEXT NOT NULL,
    side           TEXT NOT NULL,
    volume         NUMERIC NOT NULL,
    open_price     NUMERIC NOT NULL,
    open_time      TIMESTAMPTZ NOT NULL,
    sl             NUMERIC,
    tp             NUMERIC,
    swap           NUMERIC NOT NULL,
    commission     NUMERIC NOT NULL,
    source         TEXT NOT NULL,
    book           CHAR(1) NOT NULL,
    parent_ticket  BIGINT,
    status         TEXT NOT NULL CHECK (status IN ('open', 'closed', 'voided')),
    closed_at      TIMESTAMPTZ,
    data           JSONB NOT NULL,
    updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX positions_login_idx ON positions (login, status);
CREATE INDEX positions_open_idx ON positions (tenant_id, symbol) WHERE status = 'open';

CREATE TABLE deals (
    id               BIGINT PRIMARY KEY,
    tenant_id        BIGINT NOT NULL REFERENCES tenants(id),
    login            BIGINT NOT NULL,
    position_ticket  BIGINT NOT NULL,
    order_ticket     BIGINT,
    symbol           TEXT NOT NULL,
    side             TEXT NOT NULL,
    position_side    TEXT NOT NULL,
    entry            TEXT NOT NULL,
    volume           NUMERIC NOT NULL,
    price            NUMERIC NOT NULL,
    profit           NUMERIC NOT NULL,
    swap             NUMERIC NOT NULL,
    commission       NUMERIC NOT NULL,
    reason           TEXT NOT NULL,
    book             CHAR(1) NOT NULL,
    time             TIMESTAMPTZ NOT NULL,
    open_price       NUMERIC NOT NULL,
    open_time        TIMESTAMPTZ NOT NULL,
    source           TEXT NOT NULL,
    comment          TEXT NOT NULL,
    price_correction BOOLEAN NOT NULL DEFAULT false,
    reversed         BOOLEAN NOT NULL DEFAULT false,
    ledger_txn       BIGINT,
    staff            TEXT,
    reason_code      TEXT,
    data             JSONB NOT NULL
);
CREATE INDEX deals_login_time_idx ON deals (login, time DESC);
CREATE INDEX deals_tenant_time_idx ON deals (tenant_id, time DESC);

-- Double-entry ledger. Amounts are in the ledger account's currency (USD, or USC for cent accounts).
CREATE TABLE ledger_accounts (
    tenant_id   BIGINT NOT NULL REFERENCES tenants(id),
    code        TEXT NOT NULL,
    currency    TEXT NOT NULL,
    balance     NUMERIC NOT NULL DEFAULT 0,
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (tenant_id, code)
);

CREATE TABLE ledger_txns (
    id               BIGINT PRIMARY KEY,
    tenant_id        BIGINT NOT NULL REFERENCES tenants(id),
    idempotency_key  TEXT NOT NULL,
    kind             TEXT NOT NULL,
    login            BIGINT NOT NULL,
    reference        TEXT,
    reason_code      TEXT,
    note             TEXT,
    request          JSONB,
    created_at       TIMESTAMPTZ NOT NULL,
    UNIQUE (tenant_id, idempotency_key)
);
CREATE INDEX ledger_txns_login_idx ON ledger_txns (login, created_at DESC);

CREATE TABLE ledger_postings (
    id            BIGSERIAL PRIMARY KEY,
    tenant_id     BIGINT NOT NULL REFERENCES tenants(id),
    txn_id        BIGINT NOT NULL REFERENCES ledger_txns(id),
    account_code  TEXT NOT NULL,
    currency      TEXT NOT NULL,
    amount        NUMERIC NOT NULL CHECK (amount <> 0)
);
CREATE INDEX ledger_postings_txn_idx ON ledger_postings (txn_id);
CREATE INDEX ledger_postings_account_idx ON ledger_postings (tenant_id, account_code);

-- Σ postings per transaction and currency must be 0, checked at commit.
CREATE FUNCTION ledger_txn_balanced() RETURNS trigger AS $$
BEGIN
    IF EXISTS (SELECT 1 FROM ledger_postings WHERE txn_id = NEW.txn_id GROUP BY currency HAVING sum(amount) <> 0) THEN
        RAISE EXCEPTION 'ledger transaction % does not balance', NEW.txn_id;
    END IF;
    RETURN NULL;
END $$ LANGUAGE plpgsql;
CREATE CONSTRAINT TRIGGER ledger_postings_balanced AFTER INSERT ON ledger_postings
    DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION ledger_txn_balanced();

-- Dealing / account-ops audit log (D111, D117). Append-only.
CREATE TABLE audit_log (
    id           BIGSERIAL PRIMARY KEY,
    tenant_id    BIGINT NOT NULL REFERENCES tenants(id),
    at           TIMESTAMPTZ NOT NULL DEFAULT now(),
    staff_id     TEXT NOT NULL,
    staff_name   TEXT NOT NULL,
    staff_role   TEXT NOT NULL,
    action       TEXT NOT NULL,
    tickets      TEXT[] NOT NULL DEFAULT '{}',
    login        BIGINT,
    symbol       TEXT,
    before       JSONB,
    after        JSONB,
    reason_code  TEXT NOT NULL,
    note         TEXT NOT NULL DEFAULT '',
    flags        TEXT[] NOT NULL DEFAULT '{}'
);
CREATE INDEX audit_log_tenant_at_idx ON audit_log (tenant_id, at DESC);
CREATE INDEX audit_log_login_idx ON audit_log (login);

CREATE FUNCTION reject_mutation() RETURNS trigger AS $$
BEGIN
    RAISE EXCEPTION '% is append-only', TG_TABLE_NAME;
END $$ LANGUAGE plpgsql;
CREATE TRIGGER events_append_only BEFORE UPDATE OR DELETE ON events FOR EACH ROW EXECUTE FUNCTION reject_mutation();
CREATE TRIGGER ledger_txns_append_only BEFORE UPDATE OR DELETE ON ledger_txns FOR EACH ROW EXECUTE FUNCTION reject_mutation();
CREATE TRIGGER ledger_postings_append_only BEFORE UPDATE OR DELETE ON ledger_postings FOR EACH ROW EXECUTE FUNCTION reject_mutation();
CREATE TRIGGER audit_log_append_only BEFORE UPDATE OR DELETE ON audit_log FOR EACH ROW EXECUTE FUNCTION reject_mutation();

CREATE TABLE symbol_controls (
    id           TEXT PRIMARY KEY,
    tenant_id    BIGINT NOT NULL REFERENCES tenants(id),
    symbol       TEXT NOT NULL,
    group_code   TEXT NOT NULL,
    mode         TEXT NOT NULL CHECK (mode IN ('halt', 'close-only')),
    reason_code  TEXT NOT NULL,
    note         TEXT,
    staff        TEXT NOT NULL,
    at           TIMESTAMPTZ NOT NULL,
    UNIQUE (tenant_id, symbol, group_code)
);

CREATE TABLE routing_rules (
    tenant_id   BIGINT PRIMARY KEY REFERENCES tenants(id),
    rules       JSONB NOT NULL,
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
INSERT INTO routing_rules (tenant_id, rules) VALUES (1, '[]');

-- Swap rollovers done (idempotent restart / catch-up).
CREATE TABLE rollovers (
    tenant_id  BIGINT NOT NULL REFERENCES tenants(id),
    day        DATE NOT NULL,
    at         TIMESTAMPTZ NOT NULL,
    accounts   INT NOT NULL,
    done_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (tenant_id, day)
);

-- Terminal sessions (opaque token, HMAC-SHA256 stored). read_only = investor password (D107).
CREATE TABLE terminal_sessions (
    id            BIGSERIAL PRIMARY KEY,
    tenant_id     BIGINT NOT NULL REFERENCES tenants(id),
    login         BIGINT NOT NULL,
    token_hash    BYTEA NOT NULL UNIQUE,
    read_only     BOOLEAN NOT NULL,
    via           TEXT NOT NULL,
    ip            TEXT,
    user_agent    TEXT,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    last_seen_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    expires_at    TIMESTAMPTZ NOT NULL,
    revoked_at    TIMESTAMPTZ
);
CREATE INDEX terminal_sessions_login_idx ON terminal_sessions (login) WHERE revoked_at IS NULL;

-- One-time SSO tokens (CRM "Trade" button → terminal).
CREATE TABLE sso_tokens (
    token_hash  BYTEA PRIMARY KEY,
    tenant_id   BIGINT NOT NULL REFERENCES tenants(id),
    login       BIGINT NOT NULL,
    user_id     BIGINT NOT NULL,
    expires_at  TIMESTAMPTZ NOT NULL,
    used_at     TIMESTAMPTZ
);

-- D113: tenant isolation for any role other than the engine's owner role (the engine itself filters by tenant).
DO $$
DECLARE t TEXT;
BEGIN
    FOREACH t IN ARRAY ARRAY['tenant_policies','groups','accounts','account_credentials','events','orders','positions','deals',
                             'ledger_accounts','ledger_txns','ledger_postings','audit_log','symbol_controls','routing_rules',
                             'rollovers','terminal_sessions','sso_tokens'] LOOP
        EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
        EXECUTE format('CREATE POLICY tenant_isolation ON %I USING (tenant_id = NULLIF(current_setting(''kalks.tenant_id'', true), '''')::bigint)', t);
    END LOOP;
END $$;
