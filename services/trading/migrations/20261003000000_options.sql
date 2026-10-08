-- Ezymex FX Options in the trading engine (services/trading/README.md, "Ezymex FX Options").
--
-- Option positions, orders and deals live in the same event streams as CFDs (the full JSON stays in `data`);
-- these columns only make them queryable (settlement lists, the options book, statements). Old rows keep NULL.

ALTER TABLE positions ADD COLUMN IF NOT EXISTS option JSONB, ADD COLUMN IF NOT EXISTS combo_id BIGINT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS option JSONB, ADD COLUMN IF NOT EXISTS combo_id BIGINT, ADD COLUMN IF NOT EXISTS trigger JSONB;
ALTER TABLE deals ADD COLUMN IF NOT EXISTS option JSONB;

CREATE INDEX IF NOT EXISTS positions_option_open_idx ON positions (tenant_id, (option->>'underlying')) WHERE status = 'open' AND option IS NOT NULL;
CREATE INDEX IF NOT EXISTS positions_combo_idx ON positions (combo_id) WHERE combo_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS deals_option_idx ON deals (tenant_id, reason, time DESC) WHERE option IS NOT NULL;
CREATE INDEX IF NOT EXISTS deals_position_idx ON deals (position_ticket);

-- Barrier knocks: one row per position, written in the same transaction as the knock event.
CREATE TABLE IF NOT EXISTS option_knocks (
    ticket      BIGINT PRIMARY KEY,
    tenant_id   BIGINT NOT NULL REFERENCES tenants(id),
    login       BIGINT NOT NULL,
    series      TEXT NOT NULL,
    underlying  TEXT NOT NULL,
    kind        TEXT NOT NULL CHECK (kind IN ('UO', 'DO', 'UI', 'DI')),
    level       NUMERIC NOT NULL,
    rebate      NUMERIC NOT NULL DEFAULT 0,
    spot        NUMERIC,
    effect      TEXT NOT NULL CHECK (effect IN ('knock_out', 'knock_in')),
    deal_id     BIGINT,
    knocked_at  TIMESTAMPTZ NOT NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS option_knocks_underlying_idx ON option_knocks (tenant_id, underlying, knocked_at DESC);

-- Settlement runs per tenant and expiry (`SYMBOL:YYYY-MM-DD`) and fixing run. The positions themselves settle
-- through their event streams (ledger key settle:{expiry}:{run}:{ticket}); this table records what each pass did,
-- the re-run window and who asked for a re-run.
CREATE TABLE IF NOT EXISTS option_settlement_runs (
    id           BIGSERIAL PRIMARY KEY,
    tenant_id    BIGINT NOT NULL REFERENCES tenants(id),
    expiry_key   TEXT NOT NULL,
    symbol       TEXT NOT NULL,
    expiry_date  DATE NOT NULL,
    run          INT NOT NULL,
    fixing       NUMERIC NOT NULL,
    source       TEXT,
    status       TEXT NOT NULL DEFAULT 'done' CHECK (status IN ('running', 'done', 'failed')),
    kind         TEXT NOT NULL DEFAULT 'settle' CHECK (kind IN ('settle', 'rerun')),
    positions    INT NOT NULL DEFAULT 0,
    accounts     INT NOT NULL DEFAULT 0,
    payout_usd   NUMERIC NOT NULL DEFAULT 0,
    failures     INT NOT NULL DEFAULT 0,
    reason       TEXT NOT NULL DEFAULT '',
    created_by   TEXT NOT NULL DEFAULT 'system',
    started_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    finished_at  TIMESTAMPTZ,
    UNIQUE (tenant_id, expiry_key, run)
);
CREATE INDEX IF NOT EXISTS option_settlement_runs_recent_idx ON option_settlement_runs (tenant_id, started_at DESC);

-- The house delta-hedge account of each tenant (a normal live account of the house user, CFD trades only).
CREATE TABLE IF NOT EXISTS option_hedge_accounts (
    tenant_id   BIGINT PRIMARY KEY REFERENCES tenants(id),
    login       BIGINT NOT NULL UNIQUE,
    user_id     BIGINT NOT NULL,
    group_code  TEXT NOT NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Hedge orders the delta hedger placed (audit trail of the house book).
CREATE TABLE IF NOT EXISTS option_hedges (
    id          BIGSERIAL PRIMARY KEY,
    tenant_id   BIGINT NOT NULL REFERENCES tenants(id),
    login       BIGINT NOT NULL,
    symbol      TEXT NOT NULL,
    side        TEXT NOT NULL CHECK (side IN ('buy', 'sell')),
    volume      NUMERIC NOT NULL,
    price       NUMERIC,
    net_delta   NUMERIC NOT NULL,
    hedge_before NUMERIC NOT NULL,
    status      TEXT NOT NULL CHECK (status IN ('filled', 'failed')),
    error       TEXT,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS option_hedges_recent_idx ON option_hedges (tenant_id, created_at DESC);

-- The last options snapshot (so a restart while the options service is down still prices and goes close-only on time).
CREATE TABLE IF NOT EXISTS option_snapshot (
    id          INT PRIMARY KEY CHECK (id = 1),
    version     BIGINT NOT NULL,
    etag        TEXT,
    body        JSONB NOT NULL,
    fetched_at  TIMESTAMPTZ NOT NULL
);

DO $$
DECLARE t TEXT;
BEGIN
    FOREACH t IN ARRAY ARRAY['option_knocks', 'option_settlement_runs', 'option_hedge_accounts', 'option_hedges'] LOOP
        EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
        EXECUTE format('DROP POLICY IF EXISTS tenant_isolation ON %I', t);
        EXECUTE format('CREATE POLICY tenant_isolation ON %I USING (tenant_id = NULLIF(current_setting(''ezymex.tenant_id'', true), '''')::bigint)', t);
    END LOOP;
END $$;
