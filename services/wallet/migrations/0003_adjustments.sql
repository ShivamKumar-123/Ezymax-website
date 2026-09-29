-- Back Office "Balance & credit": manual adjustments of client wallets and trading accounts (add / deduct
-- funds, give / take credit) with a reason, an internal comment, an optional client-visible statement note,
-- four-eyes approval above a tenant threshold and a full before / after trail.
--
-- Wallet targets are booked here (ledger kinds manual_deposit / manual_withdrawal / adjustment_in /
-- adjustment_out); trading targets are booked by the trading engine (POST /v1/admin/accounts/{login}/adjust,
-- idempotency key wallet-adj-<tenant>-<id>) and this row keeps the request, the approval and the outcome.

-- NULL = four-eyes off (every adjustment applies at once); otherwise adjustments whose USD value is above it
-- wait for a second staff member with finance.adjust_approve.
ALTER TABLE tenant_settings
    ADD COLUMN adjust_approval_usd NUMERIC CHECK (adjust_approval_usd IS NULL OR adjust_approval_usd >= 0);

CREATE TABLE adjustments (
    id                  BIGSERIAL PRIMARY KEY,
    tenant_id           BIGINT NOT NULL REFERENCES tenants(id),
    -- one per submit (the Back Office dialog), so a double click books once
    idempotency_key     TEXT NOT NULL,
    user_id             BIGINT NOT NULL,
    target              TEXT NOT NULL CHECK (target IN ('wallet', 'trading')),
    login               BIGINT,
    account_type        TEXT CHECK (account_type IN ('live', 'demo')),
    -- USDT (wallet) or the account currency (USD / USC)
    currency            TEXT NOT NULL,
    op                  TEXT NOT NULL CHECK (op IN ('add', 'deduct', 'credit_in', 'credit_out')),
    category            TEXT NOT NULL CHECK (category IN ('deposit', 'withdrawal', 'correction', 'compensation', 'bonus', 'fee', 'chargeback', 'other')),
    amount              NUMERIC NOT NULL CHECK (amount > 0),
    amount_usd          NUMERIC NOT NULL CHECK (amount_usd > 0),
    comment             TEXT NOT NULL,
    client_note         TEXT,
    notify              BOOLEAN NOT NULL DEFAULT false,
    force               BOOLEAN NOT NULL DEFAULT false,
    -- pending: waits for approval · processing: sent to the engine, outcome not known yet (recovery retries it)
    status              TEXT NOT NULL CHECK (status IN ('pending', 'processing', 'applied', 'rejected', 'failed', 'cancelled')),
    requested_by_id     TEXT NOT NULL,
    requested_by_name   TEXT NOT NULL,
    requested_by_role   TEXT NOT NULL,
    requested_perms     TEXT[],
    decided_by_id       TEXT,
    decided_by_name     TEXT,
    decided_at          TIMESTAMPTZ,
    decision_note       TEXT,
    before              JSONB,
    after               JSONB,
    -- wallet ledger txn id or engine ledger txn id, and the ledger kind booked
    txn_id              BIGINT,
    ledger_kind         TEXT,
    error_code          TEXT,
    error_message       TEXT,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    applied_at          TIMESTAMPTZ,
    UNIQUE (tenant_id, idempotency_key),
    CHECK ((target = 'wallet' AND login IS NULL) OR (target = 'trading' AND login IS NOT NULL)),
    CHECK (target = 'trading' OR op IN ('add', 'deduct'))
);
CREATE INDEX adjustments_tenant_idx ON adjustments (tenant_id, id DESC);
CREATE INDEX adjustments_user_idx ON adjustments (tenant_id, user_id, id DESC);
CREATE INDEX adjustments_open_idx ON adjustments (tenant_id, status) WHERE status IN ('pending', 'processing');
