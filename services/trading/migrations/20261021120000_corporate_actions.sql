-- Stock corporate actions (splits and cash dividends) for every stock instrument, core and catalogue.
--
-- Life cycle: proposed (Back Office entry or the EODHD import) → approved (four-eyes for splits and large
-- dividends) → applying (the engine adjusts every account holding a position or pending order at `apply_at`, the
-- ex-date's 00:00 in the exchange's time zone, while the market is closed) → applied. Rejected / cancelled actions
-- never apply. Platform-wide: instruments are the platform's, so actions are not per broker.

CREATE TABLE IF NOT EXISTS corporate_actions (
    id               BIGSERIAL PRIMARY KEY,
    symbol           TEXT NOT NULL,
    kind             TEXT NOT NULL CHECK (kind IN ('split', 'dividend')),
    ex_date          DATE NOT NULL,
    apply_at         TIMESTAMPTZ NOT NULL,
    -- split: `ratio_from` old shares become `ratio_to` new shares (4-for-1: from 1, to 4)
    ratio_from       NUMERIC,
    ratio_to         NUMERIC,
    -- dividend: gross cash per share in `currency`; longs receive it less `withholding_pct`, shorts pay it gross
    amount           NUMERIC,
    currency         TEXT,
    withholding_pct  NUMERIC NOT NULL DEFAULT 0,
    record_date      DATE,
    pay_date         DATE,
    -- last price when proposed (four-eyes threshold, cross-check)
    ref_price        NUMERIC,
    four_eyes        BOOLEAN NOT NULL DEFAULT FALSE,
    status           TEXT NOT NULL CHECK (status IN ('proposed', 'approved', 'applying', 'applied', 'rejected', 'cancelled')),
    source           TEXT NOT NULL DEFAULT 'manual',
    source_ref       TEXT,
    note             TEXT,
    created_by       TEXT NOT NULL,
    -- staff id of the proposer / last editor ('' for the import): four-eyes compares it with the approver's
    created_by_id    TEXT NOT NULL DEFAULT '',
    created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
    approved_by      TEXT,
    approved_by_id   TEXT,
    approved_at      TIMESTAMPTZ,
    applied_at       TIMESTAMPTZ,
    report           JSONB,
    -- provider cross-check on the ex-date (Infoway adjustment factors): ok | mismatch | no_data
    check_status     TEXT,
    check_detail     JSONB,
    CHECK ((kind = 'split' AND ratio_from > 0 AND ratio_to > 0) OR (kind = 'dividend' AND amount > 0 AND currency IS NOT NULL)),
    CHECK (withholding_pct >= 0 AND withholding_pct <= 100)
);
-- one live action per symbol, kind and ex-date (a rejected one can be proposed again)
CREATE UNIQUE INDEX IF NOT EXISTS corporate_actions_one_per_day ON corporate_actions (symbol, kind, ex_date) WHERE status NOT IN ('rejected', 'cancelled');
CREATE INDEX IF NOT EXISTS corporate_actions_due ON corporate_actions (status, apply_at);

-- Accounts an action was applied to (written after the account's events committed; the account's own event stream
-- is the idempotency guard, this table is the report).
CREATE TABLE IF NOT EXISTS corporate_action_runs (
    action_id   BIGINT NOT NULL REFERENCES corporate_actions(id),
    login       BIGINT NOT NULL,
    tenant_id   BIGINT NOT NULL,
    applied_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    result      JSONB NOT NULL,
    PRIMARY KEY (action_id, login)
);

-- Every change of an action (proposed, edited, approved, rejected, applied, import), append-only.
CREATE TABLE IF NOT EXISTS corporate_action_audit (
    id          BIGSERIAL PRIMARY KEY,
    action_id   BIGINT,
    at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    actor       TEXT NOT NULL,
    event       TEXT NOT NULL,
    detail      JSONB,
    reason      TEXT
);
DROP TRIGGER IF EXISTS corporate_action_audit_append_only ON corporate_action_audit;
CREATE TRIGGER corporate_action_audit_append_only BEFORE UPDATE OR DELETE ON corporate_action_audit FOR EACH ROW EXECUTE FUNCTION reject_mutation();

-- Import runs (EODHD): when, what was found, errors.
CREATE TABLE IF NOT EXISTS corporate_action_imports (
    id          BIGSERIAL PRIMARY KEY,
    source      TEXT NOT NULL,
    started_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    finished_at TIMESTAMPTZ,
    report      JSONB
);
