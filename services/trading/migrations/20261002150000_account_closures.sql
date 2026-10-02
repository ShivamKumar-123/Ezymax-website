-- Account lifecycle operations (Task 1, M2 + M7): closure requests and the closure queue, per-broker account
-- policies (demo auto-archive, dormancy, four-eyes threshold, retention), the client's default account, and the
-- dormancy / anonymisation bookkeeping on the accounts projection.
--
-- The account status itself (archived / closed) lives in the event stream (`Event::AccountUpdated`); these tables
-- only hold the workflow around it.

-- Per-broker account policy (B8, B11, C2, C9). One row per tenant, created on first use with these defaults.
CREATE TABLE account_policies (
    tenant_id             BIGINT PRIMARY KEY REFERENCES tenants(id),
    -- expired demo accounts are archived this many days after they expired (0 = never)
    demo_archive_days     INT NOT NULL DEFAULT 30 CHECK (demo_archive_days BETWEEN 0 AND 3650),
    -- live accounts without activity (sign-in, client trade, transfer) for this many days are flagged dormant (0 = never)
    dormant_days          INT NOT NULL DEFAULT 180 CHECK (dormant_days BETWEEN 0 AND 3650),
    -- dormant live accounts that are empty (flat, no balance, credit or bonus) are archived automatically
    dormant_auto_archive  BOOLEAN NOT NULL DEFAULT true,
    -- closing a live account whose balance at request time was above this (USD) needs two approvers
    close_four_eyes_usd   NUMERIC NOT NULL DEFAULT 1000 CHECK (close_four_eyes_usd >= 0),
    -- closed accounts are anonymised this many years after closing (trades and ledger are kept)
    retention_years       INT NOT NULL DEFAULT 7 CHECK (retention_years BETWEEN 1 AND 50),
    updated_by            TEXT,
    updated_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);
INSERT INTO account_policies (tenant_id) SELECT id FROM tenants ON CONFLICT DO NOTHING;

-- Close permanently (B12, C2, C3, C5, C11) and reopen (C12) requests.
CREATE TABLE account_closures (
    id                    BIGSERIAL PRIMARY KEY,
    tenant_id             BIGINT NOT NULL REFERENCES tenants(id),
    login                 BIGINT NOT NULL,
    user_id               BIGINT NOT NULL,
    -- close: close permanently · reopen: bring a closed account back (Super Admin, always four-eyes)
    kind                  TEXT NOT NULL CHECK (kind IN ('close', 'reopen')),
    source                TEXT NOT NULL CHECK (source IN ('client', 'staff')),
    status                TEXT NOT NULL CHECK (status IN ('pending', 'approved', 'rejected', 'cancelled')),
    -- exit survey main reason (client) or staff reason code
    reason_code           TEXT NOT NULL,
    -- exit survey: {reasons: [..], comment}
    survey                JSONB NOT NULL DEFAULT '{}'::jsonb,
    -- internal note of the requester (staff); never shown to the client
    note                  TEXT NOT NULL DEFAULT '',
    -- account balance + credit + bonus in USD when the request was made (before any emptying): four-eyes threshold
    balance_usd           NUMERIC NOT NULL DEFAULT 0,
    four_eyes             BOOLEAN NOT NULL DEFAULT false,
    requested_by          TEXT NOT NULL,
    requested_by_name     TEXT NOT NULL DEFAULT '',
    first_approval_by     TEXT,
    first_approval_name   TEXT,
    first_approval_at     TIMESTAMPTZ,
    decided_by            TEXT,
    decided_by_name       TEXT,
    decided_at            TIMESTAMPTZ,
    -- client-facing reason template key and optional message (C5); the decision note stays internal
    client_reason         TEXT,
    client_message        TEXT,
    decision_note         TEXT,
    -- the C3 check list at decision time
    checks                JSONB,
    created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);
-- at most one open request per account and kind
CREATE UNIQUE INDEX account_closures_open_idx ON account_closures (login, kind) WHERE status = 'pending';
CREATE INDEX account_closures_queue_idx ON account_closures (tenant_id, status, created_at DESC);
CREATE INDEX account_closures_user_idx ON account_closures (tenant_id, user_id, created_at DESC);

-- The client's default account (B9 star).
CREATE TABLE account_prefs (
    tenant_id      BIGINT NOT NULL REFERENCES tenants(id),
    user_id        BIGINT NOT NULL,
    default_login  BIGINT,
    updated_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (tenant_id, user_id)
);

-- Dormancy (B11) and retention (C9) on the accounts projection (not part of the event payload).
ALTER TABLE accounts
    ADD COLUMN IF NOT EXISTS dormant_since        TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS dormant_notified_at  TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS anonymised_at        TIMESTAMPTZ;
CREATE INDEX IF NOT EXISTS accounts_activity_idx ON accounts (tenant_id, kind, status, last_activity_at);
