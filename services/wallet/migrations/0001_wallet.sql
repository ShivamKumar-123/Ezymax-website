-- Kalks wallet (database kalks_wallet). Central client wallet (D3): double-entry ledger, on-chain USDT
-- deposits / withdrawals (BEP20, TRC20), wallet <-> trading account transfers. Every table carries tenant_id.
-- Money is NUMERIC (never float); the service enforces the scale (USDT: 6 decimals).

CREATE TABLE tenants (
    id          BIGINT PRIMARY KEY,
    slug        TEXT NOT NULL UNIQUE,
    name        TEXT NOT NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
-- ids mirror the gateway's tenants table (kalks_core)
INSERT INTO tenants (id, slug, name) VALUES (1, 'kalks', 'Kalks');

-- D36: per-tenant withdrawal limits, fees, cooldown
CREATE TABLE tenant_settings (
    tenant_id               BIGINT PRIMARY KEY REFERENCES tenants(id),
    withdraw_min            NUMERIC NOT NULL DEFAULT 10 CHECK (withdraw_min > 0),
    withdraw_max            NUMERIC NOT NULL DEFAULT 50000,
    withdraw_daily_max      NUMERIC NOT NULL DEFAULT 100000,
    withdraw_fee_flat       NUMERIC NOT NULL DEFAULT 1 CHECK (withdraw_fee_flat >= 0),
    withdraw_fee_pct        NUMERIC NOT NULL DEFAULT 0 CHECK (withdraw_fee_pct >= 0 AND withdraw_fee_pct < 10),
    deposit_cooldown_hours  INT NOT NULL DEFAULT 24 CHECK (deposit_cooldown_hours BETWEEN 0 AND 720),
    intent_ttl_minutes      INT NOT NULL DEFAULT 60 CHECK (intent_ttl_minutes BETWEEN 5 AND 1440),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_by              TEXT,
    CHECK (withdraw_max >= withdraw_min)
);
INSERT INTO tenant_settings (tenant_id) VALUES (1);

-- Per chain: company receiving / payout address, confirmations (D10), switches, minimums, network fee.
-- Rows are seeded by the service on first start from WALLET_BSC_ADDRESS / WALLET_TRON_ADDRESS.
CREATE TABLE chain_settings (
    tenant_id            BIGINT NOT NULL REFERENCES tenants(id),
    chain                TEXT NOT NULL CHECK (chain IN ('bsc', 'tron')),
    receiving_address    TEXT NOT NULL,
    payout_address       TEXT,
    confirmations        INT NOT NULL CHECK (confirmations BETWEEN 1 AND 500),
    deposits_enabled     BOOLEAN NOT NULL DEFAULT true,
    withdrawals_enabled  BOOLEAN NOT NULL DEFAULT true,
    min_deposit          NUMERIC NOT NULL DEFAULT 10 CHECK (min_deposit >= 0),
    withdraw_fee         NUMERIC NOT NULL DEFAULT 0 CHECK (withdraw_fee >= 0),
    updated_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_by           TEXT,
    PRIMARY KEY (tenant_id, chain)
);

-- Every receiving address a chain has ever used: deposits to an old address are still recognised.
CREATE TABLE company_addresses (
    tenant_id   BIGINT NOT NULL REFERENCES tenants(id),
    chain       TEXT NOT NULL,
    address     TEXT NOT NULL,          -- canonical: bsc lower-case 0x…, tron base58 T…
    role        TEXT NOT NULL CHECK (role IN ('receiving', 'payout')),
    active      BOOLEAN NOT NULL DEFAULT true,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (tenant_id, chain, address, role)
);

/* ------------------------------------------------------------------ */
/* Double-entry ledger                                                 */
/* ------------------------------------------------------------------ */

CREATE TABLE ledger_txns (
    id               BIGSERIAL PRIMARY KEY,
    tenant_id        BIGINT NOT NULL REFERENCES tenants(id),
    idempotency_key  TEXT NOT NULL,
    kind             TEXT NOT NULL,
    user_id          BIGINT,
    currency         TEXT NOT NULL,
    reference        TEXT,
    note             TEXT,
    actor            TEXT NOT NULL,        -- service:<name> | staff:<id> | user:<id> | system
    request          JSONB,                -- idempotency fingerprint
    result           JSONB,                -- replayed response (external transfers)
    created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (tenant_id, idempotency_key)
);
CREATE INDEX ledger_txns_user_idx ON ledger_txns (tenant_id, user_id, id DESC);

CREATE TABLE ledger_postings (
    id            BIGSERIAL PRIMARY KEY,
    tenant_id     BIGINT NOT NULL REFERENCES tenants(id),
    txn_id        BIGINT NOT NULL REFERENCES ledger_txns(id),
    account_code  TEXT NOT NULL,
    user_id       BIGINT,
    currency      TEXT NOT NULL,
    amount        NUMERIC NOT NULL CHECK (amount <> 0),
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX ledger_postings_txn_idx ON ledger_postings (txn_id);
CREATE INDEX ledger_postings_account_idx ON ledger_postings (tenant_id, account_code);
CREATE INDEX ledger_postings_user_idx ON ledger_postings (tenant_id, user_id, txn_id DESC) WHERE user_id IS NOT NULL;

-- Projection of the user accounts, written in the same transaction as the postings.
CREATE TABLE wallet_balances (
    tenant_id   BIGINT NOT NULL REFERENCES tenants(id),
    user_id     BIGINT NOT NULL,
    currency    TEXT NOT NULL,
    available   NUMERIC NOT NULL DEFAULT 0 CHECK (available >= 0),
    locked      NUMERIC NOT NULL DEFAULT 0 CHECK (locked >= 0),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (tenant_id, user_id, currency)
);

CREATE FUNCTION wallet_append_only() RETURNS trigger AS $$
BEGIN
    RAISE EXCEPTION '% is append-only', TG_TABLE_NAME;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER ledger_txns_append_only BEFORE UPDATE OR DELETE ON ledger_txns FOR EACH ROW EXECUTE FUNCTION wallet_append_only();
CREATE TRIGGER ledger_postings_append_only BEFORE UPDATE OR DELETE ON ledger_postings FOR EACH ROW EXECUTE FUNCTION wallet_append_only();
CREATE TRIGGER ledger_txns_no_truncate BEFORE TRUNCATE ON ledger_txns FOR EACH STATEMENT EXECUTE FUNCTION wallet_append_only();
CREATE TRIGGER ledger_postings_no_truncate BEFORE TRUNCATE ON ledger_postings FOR EACH STATEMENT EXECUTE FUNCTION wallet_append_only();

-- Σ postings = 0 per currency, checked when the transaction commits.
CREATE FUNCTION ledger_txn_balanced() RETURNS trigger AS $$
DECLARE
    bad TEXT;
BEGIN
    SELECT currency INTO bad FROM ledger_postings WHERE txn_id = NEW.txn_id GROUP BY currency HAVING sum(amount) <> 0 LIMIT 1;
    IF bad IS NOT NULL THEN
        RAISE EXCEPTION 'ledger txn % does not balance in %', NEW.txn_id, bad;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE CONSTRAINT TRIGGER ledger_postings_balanced AFTER INSERT ON ledger_postings
    DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION ledger_txn_balanced();

/* ------------------------------------------------------------------ */
/* Deposits                                                            */
/* ------------------------------------------------------------------ */

CREATE TABLE deposit_intents (
    id              TEXT PRIMARY KEY,               -- dep_<random>
    tenant_id       BIGINT NOT NULL REFERENCES tenants(id),
    user_id         BIGINT NOT NULL,
    chain           TEXT NOT NULL,
    currency        TEXT NOT NULL,
    amount          NUMERIC NOT NULL CHECK (amount > 0),
    address         TEXT NOT NULL,
    token_contract  TEXT NOT NULL,
    status          TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'submitted', 'completed', 'expired')),
    ip              TEXT,
    expires_at      TIMESTAMPTZ NOT NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX deposit_intents_user_idx ON deposit_intents (tenant_id, user_id, created_at DESC);

CREATE TABLE deposits (
    id                      BIGSERIAL PRIMARY KEY,
    tenant_id               BIGINT NOT NULL REFERENCES tenants(id),
    user_id                 BIGINT,                 -- NULL while unmatched
    intent_id               TEXT REFERENCES deposit_intents(id),
    chain                   TEXT NOT NULL,
    currency                TEXT NOT NULL DEFAULT 'USDT',
    tx_hash                 TEXT NOT NULL,          -- canonical: bsc 0x + 64 lower hex, tron 64 lower hex
    log_index               INT,
    from_address            TEXT,
    to_address              TEXT,
    token_contract          TEXT,
    amount                  NUMERIC,                -- on-chain amount (credited amount)
    expected_amount         NUMERIC,
    block_number            BIGINT,
    block_time              TIMESTAMPTZ,
    confirmations           INT NOT NULL DEFAULT 0,
    required_confirmations  INT NOT NULL,
    status                  TEXT NOT NULL CHECK (status IN ('pending', 'confirming', 'credited', 'failed', 'review', 'unmatched', 'rejected')),
    review_reason           TEXT,
    failure_reason          TEXT,
    source                  TEXT NOT NULL CHECK (source IN ('client', 'scanner')),
    suggested_user_id       BIGINT,
    assigned_by             TEXT,
    ledger_txn_id           BIGINT REFERENCES ledger_txns(id),
    checks                  INT NOT NULL DEFAULT 0,
    last_checked_at         TIMESTAMPTZ,
    rechecked_at            TIMESTAMPTZ,
    credited_at             TIMESTAMPTZ,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (chain, tx_hash)
);
CREATE INDEX deposits_open_idx ON deposits (status) WHERE status IN ('pending', 'confirming');
CREATE INDEX deposits_tenant_idx ON deposits (tenant_id, created_at DESC);
CREATE INDEX deposits_user_idx ON deposits (tenant_id, user_id, created_at DESC);
CREATE INDEX deposits_from_idx ON deposits (tenant_id, chain, from_address);

-- Scanner cursor per chain + address (BSC: last block scanned; TRON: last block timestamp in ms).
CREATE TABLE chain_cursors (
    tenant_id   BIGINT NOT NULL REFERENCES tenants(id),
    chain       TEXT NOT NULL,
    address     TEXT NOT NULL,
    position    BIGINT NOT NULL,
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (tenant_id, chain, address)
);

/* ------------------------------------------------------------------ */
/* Withdrawals                                                         */
/* ------------------------------------------------------------------ */

CREATE TABLE withdrawals (
    id                BIGSERIAL PRIMARY KEY,
    tenant_id         BIGINT NOT NULL REFERENCES tenants(id),
    user_id           BIGINT NOT NULL,
    idempotency_key   TEXT,
    chain             TEXT NOT NULL,
    currency          TEXT NOT NULL DEFAULT 'USDT',
    to_address        TEXT NOT NULL,
    amount            NUMERIC NOT NULL CHECK (amount > 0),
    fee               NUMERIC NOT NULL CHECK (fee >= 0),
    net_amount        NUMERIC NOT NULL CHECK (net_amount > 0),
    status            TEXT NOT NULL CHECK (status IN ('requested', 'approved', 'rejected', 'cancelled', 'paid', 'completed')),
    kyc_status        TEXT,
    ip                TEXT,
    user_agent        TEXT,
    reason            TEXT,
    review_note       TEXT,
    reviewed_by       TEXT,
    reviewed_at       TIMESTAMPTZ,
    payout_tx_hash    TEXT,
    payout_error      TEXT,
    payout_confirmations INT NOT NULL DEFAULT 0,
    paid_by           TEXT,
    paid_at           TIMESTAMPTZ,
    completed_at      TIMESTAMPTZ,
    lock_txn_id       BIGINT REFERENCES ledger_txns(id),
    final_txn_id      BIGINT REFERENCES ledger_txns(id),
    created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (tenant_id, idempotency_key)
);
CREATE UNIQUE INDEX withdrawals_payout_hash_idx ON withdrawals (chain, payout_tx_hash) WHERE payout_tx_hash IS NOT NULL;
CREATE INDEX withdrawals_status_idx ON withdrawals (tenant_id, status, created_at);
CREATE INDEX withdrawals_user_idx ON withdrawals (tenant_id, user_id, created_at DESC);

/* ------------------------------------------------------------------ */
/* Wallet <-> trading account                                          */
/* ------------------------------------------------------------------ */

CREATE TABLE trading_transfers (
    id                BIGSERIAL PRIMARY KEY,
    tenant_id         BIGINT NOT NULL REFERENCES tenants(id),
    user_id           BIGINT NOT NULL,
    login             BIGINT NOT NULL,
    direction         TEXT NOT NULL CHECK (direction IN ('to_trading', 'from_trading')),
    currency          TEXT NOT NULL DEFAULT 'USDT',
    amount            NUMERIC NOT NULL CHECK (amount > 0),
    idempotency_key   TEXT NOT NULL,
    engine_key        TEXT NOT NULL UNIQUE,
    status            TEXT NOT NULL CHECK (status IN ('pending', 'completed', 'failed')),
    error_code        TEXT,
    error_message     TEXT,
    engine_txn        BIGINT,
    engine_amount     NUMERIC,
    engine_currency   TEXT,
    attempts          INT NOT NULL DEFAULT 0,
    reserve_txn_id    BIGINT REFERENCES ledger_txns(id),
    final_txn_id      BIGINT REFERENCES ledger_txns(id),
    created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (tenant_id, idempotency_key)
);
CREATE INDEX trading_transfers_pending_idx ON trading_transfers (status) WHERE status = 'pending';
CREATE INDEX trading_transfers_user_idx ON trading_transfers (tenant_id, user_id, created_at DESC);

/* ------------------------------------------------------------------ */
/* Notifications (D41: shown in the CRM; email follows via the gateway) */
/* ------------------------------------------------------------------ */

CREATE TABLE notifications (
    id          BIGSERIAL PRIMARY KEY,
    tenant_id   BIGINT NOT NULL REFERENCES tenants(id),
    user_id     BIGINT NOT NULL,
    kind        TEXT NOT NULL,
    title       TEXT NOT NULL,
    body        TEXT NOT NULL,
    data        JSONB NOT NULL DEFAULT '{}'::jsonb,
    emailed_at  TIMESTAMPTZ,
    read_at     TIMESTAMPTZ,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX notifications_user_idx ON notifications (tenant_id, user_id, id DESC);

/* ------------------------------------------------------------------ */
/* Request log (IP checks for the withdrawal risk checklist)           */
/* ------------------------------------------------------------------ */

CREATE TABLE client_ips (
    tenant_id   BIGINT NOT NULL REFERENCES tenants(id),
    user_id     BIGINT NOT NULL,
    ip          TEXT NOT NULL,
    first_seen  TIMESTAMPTZ NOT NULL DEFAULT now(),
    last_seen   TIMESTAMPTZ NOT NULL DEFAULT now(),
    hits        INT NOT NULL DEFAULT 1,
    PRIMARY KEY (tenant_id, user_id, ip)
);
CREATE INDEX client_ips_ip_idx ON client_ips (tenant_id, ip);

/* ------------------------------------------------------------------ */
/* Audit (append-only)                                                 */
/* ------------------------------------------------------------------ */

CREATE TABLE audit_log (
    id           BIGSERIAL PRIMARY KEY,
    tenant_id    BIGINT NOT NULL REFERENCES tenants(id),
    actor_kind   TEXT NOT NULL CHECK (actor_kind IN ('staff', 'user', 'service', 'system')),
    actor_id     TEXT,
    actor_name   TEXT,
    actor_role   TEXT,
    action       TEXT NOT NULL,
    target_kind  TEXT,
    target_id    TEXT,
    reason       TEXT,
    before       JSONB,
    after        JSONB,
    ip           TEXT,
    user_agent   TEXT,
    at           TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX audit_log_tenant_at_idx ON audit_log (tenant_id, at DESC);
CREATE TRIGGER audit_log_append_only BEFORE UPDATE OR DELETE ON audit_log FOR EACH ROW EXECUTE FUNCTION wallet_append_only();
CREATE TRIGGER audit_log_no_truncate BEFORE TRUNCATE ON audit_log FOR EACH STATEMENT EXECUTE FUNCTION wallet_append_only();
