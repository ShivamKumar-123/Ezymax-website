-- Manual wallet adjustments that are real money (wallet GET /v1/admin/adjustments, target wallet, status
-- applied): "Deposit (external payment received)" and "Withdrawal (paid externally)". They count as client
-- deposits / withdrawals and FTDs like on-chain ones; every other adjustment reason never does. Manual deposits
-- booked directly on a live trading account are already in `ledger` (kind deposit / withdrawal).
CREATE TABLE wallet_manual (
    tenant      TEXT        NOT NULL,
    id          BIGINT      NOT NULL,
    user_id     BIGINT      NOT NULL,
    kind        TEXT        NOT NULL CHECK (kind IN ('deposit', 'withdrawal')),
    amount      NUMERIC     NOT NULL,
    currency    TEXT        NOT NULL DEFAULT 'USDT',
    applied_at  TIMESTAMPTZ NOT NULL,
    PRIMARY KEY (tenant, id)
);
CREATE INDEX wallet_manual_user ON wallet_manual (tenant, user_id, applied_at);
