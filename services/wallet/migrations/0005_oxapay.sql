-- OxaPay crypto checkout: a hosted payment gateway, next to the automatic BEP20 / TRC20 deposits (deposits,
-- deposit_intents) and the manual payment requests staff approve (manual_deposits). The client asks for an
-- invoice, pays any coin OxaPay supports on OxaPay's own page, and OxaPay calls our webhook. Additive only.
--
-- The credit is an ordinary `crypto_deposit` ledger transaction, so wallet history, the funding rules and the
-- Back Office labels work unchanged; this table is the provenance (which invoice, which coin, which hash).
CREATE TABLE oxapay_invoices (
    id             BIGSERIAL PRIMARY KEY,
    tenant_id      BIGINT NOT NULL REFERENCES tenants(id),
    user_id        BIGINT NOT NULL,
    -- our reference, sent to OxaPay as order_id. The webhook finds the row by track_id; order_id is the
    -- fallback for a callback that arrives before we stored the track id, and is what staff quote.
    order_id       TEXT NOT NULL,
    -- OxaPay's payment-session id. Null only while their create call is in flight or failed.
    track_id       TEXT,
    -- what the client asked to deposit, always USD; `credited` USDT is booked 1:1 on payment
    amount         NUMERIC NOT NULL CHECK (amount > 0),
    currency       TEXT NOT NULL DEFAULT 'USD',
    -- new: created here, not yet at OxaPay. waiting: invoice open. paying: funds seen, unconfirmed.
    -- credited: ledger booked. expired / failed / cancelled: nothing was booked.
    status         TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'waiting', 'paying', 'credited', 'expired', 'failed', 'cancelled')),
    payment_url    TEXT,
    -- what OxaPay reported on the paid callback (for reconciliation, never for the credited amount)
    paid_currency  TEXT,
    paid_amount    NUMERIC,
    tx_hash        TEXT,
    network        TEXT,
    credited       NUMERIC CHECK (credited IS NULL OR credited > 0),
    ledger_txn_id  BIGINT REFERENCES ledger_txns(id),
    credited_at    TIMESTAMPTZ,
    expires_at     TIMESTAMPTZ,
    -- the last authoritative payment OxaPay returned (GET /v1/payment/{track_id}), for support and audit
    last_payment   JSONB,
    ip             TEXT,
    user_agent     TEXT,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    CHECK (status <> 'credited' OR (credited IS NOT NULL AND ledger_txn_id IS NOT NULL))
);
-- one row per order reference, and per OxaPay session: the webhook may be delivered up to 5 times
CREATE UNIQUE INDEX oxapay_invoices_order_idx ON oxapay_invoices (tenant_id, order_id);
CREATE UNIQUE INDEX oxapay_invoices_track_idx ON oxapay_invoices (track_id) WHERE track_id IS NOT NULL;
CREATE INDEX oxapay_invoices_user_idx ON oxapay_invoices (tenant_id, user_id, id DESC);
CREATE INDEX oxapay_invoices_status_idx ON oxapay_invoices (tenant_id, status, id DESC);
-- the sweeper looks for open invoices whose lifetime has run out
CREATE INDEX oxapay_invoices_open_idx ON oxapay_invoices (expires_at) WHERE status IN ('new', 'waiting', 'paying');
