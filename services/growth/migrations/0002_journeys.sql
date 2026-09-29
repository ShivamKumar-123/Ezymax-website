-- Marketing automation journeys (D144): trigger -> steps (wait, email, in-app, condition), per-client enrolments
-- and an event log that doubles as per-step stats. Emails go out through the gateway's branded marketing mailer
-- (consent + unsubscribe enforced there); in-app messages through the support service's /v1/notify.

-- Lifecycle facts per client that journeys trigger on (gateway users feed + reports client facts).
ALTER TABLE profiles
    ADD COLUMN IF NOT EXISTS email_verified_at      TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS kyc_verified_at        TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS last_login_at          TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS birthday               TEXT,          -- MM-DD
    ADD COLUMN IF NOT EXISTS marketing_consent      BOOLEAN NOT NULL DEFAULT true,
    ADD COLUMN IF NOT EXISTS status                 TEXT NOT NULL DEFAULT 'active',
    ADD COLUMN IF NOT EXISTS utm_source             TEXT,
    ADD COLUMN IF NOT EXISTS utm_campaign           TEXT,
    ADD COLUMN IF NOT EXISTS first_deposit_at       TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS first_live_account_at  TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS first_trade_at         TIMESTAMPTZ;

CREATE TABLE journeys (
    id            BIGSERIAL PRIMARY KEY,
    tenant        TEXT NOT NULL,
    name          TEXT NOT NULL,
    description   TEXT NOT NULL DEFAULT '',
    trigger       JSONB NOT NULL,                 -- {"kind": "...", "days": N?}
    steps         JSONB NOT NULL DEFAULT '[]',    -- [{"id", "kind", ...}]
    status        TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'live', 'paused', 'archived')),
    -- only trigger events at or after this moment enrol (switching a journey on never mails the back catalogue)
    live_since    TIMESTAMPTZ,
    created_by    TEXT NOT NULL,
    updated_by    TEXT,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX journeys_tenant ON journeys (tenant, status);

CREATE TABLE journey_enrollments (
    id            BIGSERIAL PRIMARY KEY,
    journey_id    BIGINT NOT NULL REFERENCES journeys(id),
    tenant        TEXT NOT NULL,
    user_id       BIGINT NOT NULL,
    -- one enrolment per trigger occurrence: '' for one-off triggers, the year for birthdays, the day for inactivity
    occurrence    TEXT NOT NULL DEFAULT '',
    status        TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed', 'exited', 'failed')),
    step_index    INT NOT NULL DEFAULT 0,
    next_run_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    trigger_at    TIMESTAMPTZ NOT NULL,
    enrolled_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    finished_at   TIMESTAMPTZ,
    attempts      INT NOT NULL DEFAULT 0,
    last_error    TEXT,
    UNIQUE (journey_id, user_id, occurrence)
);
CREATE INDEX journey_enrollments_due ON journey_enrollments (next_run_at) WHERE status = 'active';
CREATE INDEX journey_enrollments_journey ON journey_enrollments (journey_id, id DESC);

-- Everything that happened to an enrolment. step_id NULL = journey-level (enrolled, completed, exited).
CREATE TABLE journey_events (
    id             BIGSERIAL PRIMARY KEY,
    journey_id     BIGINT NOT NULL,
    enrollment_id  BIGINT NOT NULL,
    tenant         TEXT NOT NULL,
    user_id        BIGINT NOT NULL,
    step_id        TEXT,
    kind           TEXT NOT NULL,  -- enrolled | waiting | email_sent | email_logged | email_suppressed | inapp_sent | condition_met | condition_not_met | completed | exited | failed | error
    detail         TEXT NOT NULL DEFAULT '',
    at             TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX journey_events_journey ON journey_events (journey_id, step_id, kind);
CREATE INDEX journey_events_enrollment ON journey_events (enrollment_id, id);
