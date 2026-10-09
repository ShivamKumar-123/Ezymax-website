-- Manual payment methods and deposit requests. The broker lists bank / UPI accounts and crypto addresses on any
-- network (with a QR code); a client pays one of them outside the platform, then sends a request with the UTR /
-- transaction id / tx hash (and optionally a screenshot). Staff verify it and approve (one ledger credit, kind
-- bank_deposit or crypto_deposit) or reject it. The automatic BEP20 / TRC20 deposits (deposits, deposit_intents) are
-- untouched. Additive only.

-- QR codes staff upload and payment screenshots clients attach: PNG / JPEG / WEBP sniffed from the bytes, at most
-- 5 MB, stored privately under WALLET_STORAGE_DIR (0600 files) and read by an unguessable id. QR images are readable by
-- the tenant's signed-in clients and staff; proofs only by staff and the client who uploaded them.
CREATE TABLE payment_media (
    id           TEXT PRIMARY KEY,                -- 24 random lower-case hex characters
    tenant_id    BIGINT NOT NULL REFERENCES tenants(id),
    purpose      TEXT NOT NULL CHECK (purpose IN ('qr', 'proof')),
    mime         TEXT NOT NULL CHECK (mime IN ('image/png', 'image/jpeg', 'image/webp')),
    size_bytes   INT NOT NULL CHECK (size_bytes > 0),
    sha256       TEXT NOT NULL,
    path         TEXT NOT NULL,                   -- relative to WALLET_STORAGE_DIR
    uploaded_by  TEXT NOT NULL,                   -- staff:<id> | user:<id>
    user_id      BIGINT,                          -- the uploading client (proofs)
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX payment_media_tenant_idx ON payment_media (tenant_id, purpose, created_at DESC);

-- What a client can pay. kind bank: details {account_name, bank_name, account_number, ifsc, swift, iban, branch, upi_id}
-- (account_name or upi_id required); kind crypto: details {network, token, address, memo} (address required) and an
-- optional evm {chain_id, token_contract (null = the native coin), token_decimals} that enables "Pay with MetaMask".
-- rate = units of `currency` per 1 USDT (1 for USDT); min / max in `currency`. `version` guards concurrent edits.
-- A deleted method (deleted_at) is kept for the requests that point at it and is never shown again.
CREATE TABLE payment_methods (
    id            BIGSERIAL PRIMARY KEY,
    tenant_id     BIGINT NOT NULL REFERENCES tenants(id),
    kind          TEXT NOT NULL CHECK (kind IN ('bank', 'crypto')),
    name          TEXT NOT NULL,
    status        TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'hidden')),
    sort_order    INT NOT NULL DEFAULT 0,
    currency      TEXT NOT NULL,
    rate          NUMERIC NOT NULL CHECK (rate > 0),
    min_amount    NUMERIC NOT NULL DEFAULT 0 CHECK (min_amount >= 0),
    max_amount    NUMERIC CHECK (max_amount IS NULL OR max_amount > 0),
    details       JSONB NOT NULL DEFAULT '{}'::jsonb,
    evm           JSONB,
    qr_media_id   TEXT REFERENCES payment_media(id),
    instructions  TEXT NOT NULL DEFAULT '',
    created_by    TEXT NOT NULL,
    updated_by    TEXT NOT NULL,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at    TIMESTAMPTZ,
    version       INT NOT NULL DEFAULT 1,
    CHECK (max_amount IS NULL OR max_amount >= min_amount)
);
CREATE INDEX payment_methods_tenant_idx ON payment_methods (tenant_id, sort_order, id) WHERE deleted_at IS NULL;

-- A client's deposit request against a method. amount is in the method currency; expected_credit = amount / rate in
-- USDT (floored to 6 decimals); credit_amount is what staff approved (a different amount needs a note). The method is
-- snapshotted (kind, name, currency, rate, network, token, destination) so later edits never change a request.
-- reference_key is the duplicate key of the reference (lower case; a hex tx hash without its 0x).
CREATE TABLE manual_deposits (
    id               BIGSERIAL PRIMARY KEY,
    tenant_id        BIGINT NOT NULL REFERENCES tenants(id),
    user_id          BIGINT NOT NULL,
    user_name        TEXT,
    user_email       TEXT,
    method_id        BIGINT NOT NULL REFERENCES payment_methods(id),
    kind             TEXT NOT NULL CHECK (kind IN ('bank', 'crypto')),
    method           JSONB NOT NULL,
    currency         TEXT NOT NULL,
    amount           NUMERIC NOT NULL CHECK (amount > 0),
    rate             NUMERIC NOT NULL CHECK (rate > 0),
    expected_credit  NUMERIC NOT NULL CHECK (expected_credit > 0),
    credit_amount    NUMERIC CHECK (credit_amount IS NULL OR credit_amount > 0),
    reference        TEXT NOT NULL,
    reference_key    TEXT NOT NULL,
    proof_media_id   TEXT REFERENCES payment_media(id),
    client_note      TEXT,
    status           TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'cancelled')),
    decided_by_id    TEXT,
    decided_by_name  TEXT,
    decided_at       TIMESTAMPTZ,
    -- rejection reason (shown to the client) / approval note (internal)
    decision_reason  TEXT,
    decision_note    TEXT,
    ledger_txn_id    BIGINT REFERENCES ledger_txns(id),
    idempotency_key  TEXT NOT NULL,
    ip               TEXT,
    user_agent       TEXT,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (tenant_id, user_id, idempotency_key),
    CHECK (status <> 'approved' OR (credit_amount IS NOT NULL AND ledger_txn_id IS NOT NULL))
);
-- the same UTR / transaction id / hash can't be pending or credited twice
CREATE UNIQUE INDEX manual_deposits_reference_idx ON manual_deposits (tenant_id, kind, reference_key) WHERE status IN ('pending', 'approved');
CREATE INDEX manual_deposits_status_idx ON manual_deposits (tenant_id, status, id DESC);
CREATE INDEX manual_deposits_user_idx ON manual_deposits (tenant_id, user_id, id DESC);
CREATE INDEX manual_deposits_method_idx ON manual_deposits (tenant_id, method_id) WHERE status = 'pending';
