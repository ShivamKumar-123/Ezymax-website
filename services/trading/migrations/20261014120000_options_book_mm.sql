-- Ezymex FX Options order book, second milestone (docs/OPTIONS-EXCHANGE.md §4, §5, §8, §11, §12): the Ezymex market
-- maker's accounts and desk pauses, four-eyes approvals (fill busts, book rollout), the liquidation log's account
-- kind, the market-maker group and bust bookkeeping on the tape.

-- One house market-maker account per (tenant, account kind): user OPTIONS_MM_USER_ID, group options-mm.
CREATE TABLE IF NOT EXISTS option_mm_accounts (
    tenant_id   BIGINT NOT NULL REFERENCES tenants(id),
    kind        TEXT NOT NULL CHECK (kind IN ('live', 'demo')),
    login       BIGINT NOT NULL UNIQUE,
    user_id     BIGINT NOT NULL,
    group_code  TEXT NOT NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (tenant_id, kind)
);

-- Desk pauses of the market maker (cancel-all of its quotes in scope until lifted).
CREATE TABLE IF NOT EXISTS option_mm_pauses (
    id          BIGSERIAL PRIMARY KEY,
    tenant_id   BIGINT NOT NULL REFERENCES tenants(id),
    kind        TEXT NOT NULL CHECK (kind IN ('live', 'demo')),
    scope       TEXT NOT NULL CHECK (scope IN ('all', 'underlying', 'expiry')),
    target      TEXT NOT NULL DEFAULT '*',
    reason      TEXT NOT NULL,
    staff       TEXT NOT NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    lifted_at   TIMESTAMPTZ,
    lifted_by   TEXT
);
CREATE INDEX IF NOT EXISTS option_mm_pauses_active_idx ON option_mm_pauses (tenant_id, kind) WHERE lifted_at IS NULL;

-- Four-eyes approvals: the first staff member requests, a different one with options.settle confirms.
CREATE TABLE IF NOT EXISTS option_approvals (
    id               BIGSERIAL PRIMARY KEY,
    tenant_id        BIGINT NOT NULL REFERENCES tenants(id),
    action           TEXT NOT NULL CHECK (action IN ('fill_bust', 'book_enable')),
    target           TEXT NOT NULL,
    kind             TEXT,
    reason           TEXT NOT NULL,
    requested_by     TEXT NOT NULL,
    requested_by_id  TEXT NOT NULL,
    requested_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    status           TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'executed', 'rejected', 'expired', 'failed')),
    approved_by      TEXT,
    approved_at      TIMESTAMPTZ,
    result           JSONB
);
CREATE INDEX IF NOT EXISTS option_approvals_pending_idx ON option_approvals (tenant_id, status, requested_at DESC);

-- The liquidation log by account kind (Back Office filter).
ALTER TABLE option_liquidations ADD COLUMN IF NOT EXISTS kind TEXT;

-- Busted fills: who confirmed it and why (the reversal itself is in the ledger under bust:{fillId}:{login}:*).
ALTER TABLE book_fills ADD COLUMN IF NOT EXISTS bust JSONB;

-- The market-maker group of the platform broker: never offered to clients, 0 / 0 book fees (the MM tier).
INSERT INTO groups (tenant_id, code, name, mode, cent, account_types, leverages, default_leverage, margin_call_pct, stop_out_pct, hedged_margin_pct, min_deposit, commission_per_lot, route, spread_group, max_accounts_per_user, enabled) VALUES
 (1, 'options-mm', 'Options market maker', 'hedging', false, 'both', '{100}', 100, 100, 50, 50, 0, 0, 'B', 'standard', 2, false)
ON CONFLICT DO NOTHING;

DO $$
DECLARE t TEXT;
BEGIN
    FOREACH t IN ARRAY ARRAY['option_mm_accounts', 'option_mm_pauses', 'option_approvals'] LOOP
        EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
        EXECUTE format('DROP POLICY IF EXISTS tenant_isolation ON %I', t);
        EXECUTE format('CREATE POLICY tenant_isolation ON %I USING (tenant_id = NULLIF(current_setting(''ezymex.tenant_id'', true), '''')::bigint)', t);
    END LOOP;
END $$;
