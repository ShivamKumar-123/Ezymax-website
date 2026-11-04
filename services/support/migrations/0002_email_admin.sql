-- Email management (Back Office -> Content -> Email): the outbox knows which client an email went to and what the
-- relay answered, and templates can be overridden per tenant and kind.
ALTER TABLE email_outbox ADD COLUMN user_id BIGINT;
ALTER TABLE email_outbox ADD COLUMN provider_message_id TEXT;
CREATE INDEX email_outbox_tenant_created_idx ON email_outbox (tenant, created_at DESC);
CREATE INDEX email_outbox_user_idx ON email_outbox (tenant, user_id, id DESC) WHERE user_id IS NOT NULL;
CREATE INDEX email_outbox_kind_idx ON email_outbox (tenant, kind, created_at DESC);

-- A template override: the subject, headline and body an admin wrote for a kind, with {{title}}, {{body}},
-- {{name}} and {{data.<key>}} filled from the notification. `enabled = false` keeps the override but uses the
-- producer's own wording. No row = the producer's wording.
CREATE TABLE email_templates (
    tenant      TEXT NOT NULL,
    kind        TEXT NOT NULL,
    subject     TEXT NOT NULL,
    title       TEXT NOT NULL,
    body        TEXT NOT NULL,
    enabled     BOOLEAN NOT NULL DEFAULT true,
    updated_by  TEXT,
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (tenant, kind)
);
