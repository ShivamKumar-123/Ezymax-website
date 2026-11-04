-- Birthday greetings (one per client per calendar year). The row is claimed before the greeting is sent, so two
-- replicas or a repeated tick cannot send it twice; a failed send keeps its reason and is retried a few times that day.
CREATE TABLE birthday_emails (
    id             BIGSERIAL PRIMARY KEY,
    tenant         TEXT NOT NULL,
    user_id        BIGINT NOT NULL,
    year           INT NOT NULL,
    status         TEXT NOT NULL CHECK (status IN ('pending', 'sent', 'skipped', 'failed')),
    attempts       INT NOT NULL DEFAULT 1,
    sent_at        TIMESTAMPTZ,
    failure_reason TEXT,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (tenant, user_id, year)
);
