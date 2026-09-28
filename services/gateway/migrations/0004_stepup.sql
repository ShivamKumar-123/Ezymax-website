-- Step-up confirmation (D20): sensitive changes in the Client Area (trading / investor passwords, leverage,
-- withdrawals, the Client Area password, profile email) need a fresh emailed code even inside a session.
--
-- The code is an email_otps row with purpose 'confirm', bound to the action (and an optional target such as
-- a trading account login). A correct code yields a short-lived, single-use step-up token; only its keyed hash
-- is stored. The app's server consumes the token (bound to user + action + target) right before the change.

ALTER TABLE email_otps DROP CONSTRAINT email_otps_purpose_check;
ALTER TABLE email_otps ADD CONSTRAINT email_otps_purpose_check
    CHECK (purpose IN ('verify_email', 'login', 'reset_password', 'confirm'));
ALTER TABLE email_otps ADD COLUMN action TEXT CHECK (action IS NULL OR length(action) BETWEEN 1 AND 40);
ALTER TABLE email_otps ADD COLUMN target TEXT CHECK (target IS NULL OR length(target) <= 40);

CREATE TABLE stepup_tokens (
    token_hash   BYTEA PRIMARY KEY,
    tenant_id    BIGINT NOT NULL REFERENCES tenants(id),
    user_id      BIGINT NOT NULL,
    action       TEXT NOT NULL,
    target       TEXT NOT NULL DEFAULT '',
    expires_at   TIMESTAMPTZ NOT NULL,
    consumed_at  TIMESTAMPTZ,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX stepup_tokens_user_idx ON stepup_tokens (user_id);
