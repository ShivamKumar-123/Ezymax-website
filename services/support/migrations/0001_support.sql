-- Ezymex support + notifications (services/support). `tenant` is the gateway tenant slug; every query filters by it.

CREATE TABLE settings (
    tenant      TEXT PRIMARY KEY,
    data        JSONB NOT NULL,
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_by  TEXT
);

-- One chat with the AI bot and, after a handover, with human agents (D95, D124).
--   bot       the AI bot is answering
--   waiting   handed over, waiting for an agent (first-response SLA runs)
--   assigned  an agent owns it (reply SLA runs while the client waits for an answer)
--   resolved  closed; the client may rate it (CSAT)
CREATE TABLE conversations (
    id                 BIGSERIAL PRIMARY KEY,
    tenant             TEXT NOT NULL,
    user_id            BIGINT NOT NULL,
    user_name          TEXT NOT NULL DEFAULT '',
    user_email         TEXT NOT NULL DEFAULT '',
    subject            TEXT NOT NULL DEFAULT '',
    status             TEXT NOT NULL CHECK (status IN ('bot', 'waiting', 'assigned', 'resolved')),
    channel            TEXT NOT NULL DEFAULT 'web',
    priority           TEXT NOT NULL DEFAULT 'normal' CHECK (priority IN ('normal', 'high')),
    tags               TEXT[] NOT NULL DEFAULT '{}',
    assignee_id        TEXT,
    assignee_name      TEXT,
    handover_reason    TEXT,
    handed_over_at     TIMESTAMPTZ,
    first_response_at  TIMESTAMPTZ,
    sla_due_at         TIMESTAMPTZ,
    sla_breached       BOOLEAN NOT NULL DEFAULT false,
    preview            TEXT NOT NULL DEFAULT '',
    client_unread      INT NOT NULL DEFAULT 0,
    staff_unread       INT NOT NULL DEFAULT 0,
    bot_replies        INT NOT NULL DEFAULT 0,
    csat_rating        SMALLINT CHECK (csat_rating BETWEEN 1 AND 5),
    csat_comment       TEXT,
    csat_at            TIMESTAMPTZ,
    resolved_at        TIMESTAMPTZ,
    resolved_by        TEXT,
    created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
    last_message_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX conversations_user_idx ON conversations (tenant, user_id, created_at DESC);
CREATE INDEX conversations_queue_idx ON conversations (tenant, status, last_message_at DESC);
-- at most one open conversation per client
CREATE UNIQUE INDEX conversations_one_open ON conversations (tenant, user_id) WHERE status <> 'resolved';

CREATE TABLE attachments (
    id               BIGSERIAL PRIMARY KEY,
    tenant           TEXT NOT NULL,
    conversation_id  BIGINT REFERENCES conversations (id),
    user_id          BIGINT NOT NULL,             -- the client the file belongs to
    uploaded_by      TEXT NOT NULL,               -- 'user:<id>' or 'staff:<id>'
    file_name        TEXT NOT NULL,
    mime             TEXT NOT NULL,
    size_bytes       INT NOT NULL,
    sha256           TEXT NOT NULL,
    storage_key      TEXT NOT NULL,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE messages (
    id               BIGSERIAL PRIMARY KEY,
    tenant           TEXT NOT NULL,
    conversation_id  BIGINT NOT NULL REFERENCES conversations (id),
    author           TEXT NOT NULL CHECK (author IN ('client', 'bot', 'agent', 'system', 'note')),
    author_id        TEXT,
    author_name      TEXT,
    body             TEXT NOT NULL DEFAULT '',
    attachment_id    BIGINT REFERENCES attachments (id),
    meta             JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX messages_conv_idx ON messages (conversation_id, id);

CREATE TABLE canned_replies (
    id          BIGSERIAL PRIMARY KEY,
    tenant      TEXT NOT NULL,
    shortcut    TEXT NOT NULL,
    title       TEXT NOT NULL,
    body        TEXT NOT NULL,
    tags        TEXT[] NOT NULL DEFAULT '{}',
    use_count   INT NOT NULL DEFAULT 0,
    created_by  TEXT NOT NULL,
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (tenant, shortcut)
);

-- Knowledge base the AI bot answers from (keyword / BM25 retrieval, no embeddings).
CREATE TABLE kb_articles (
    id          BIGSERIAL PRIMARY KEY,
    tenant      TEXT NOT NULL,
    slug        TEXT NOT NULL,
    title       TEXT NOT NULL,
    category    TEXT NOT NULL,
    body        TEXT NOT NULL,
    tags        TEXT[] NOT NULL DEFAULT '{}',
    status      TEXT NOT NULL DEFAULT 'published' CHECK (status IN ('published', 'draft')),
    source      TEXT NOT NULL DEFAULT 'staff' CHECK (source IN ('seed', 'glossary', 'staff')),
    used_count  INT NOT NULL DEFAULT 0,
    updated_by  TEXT NOT NULL DEFAULT 'system',
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (tenant, slug)
);

-- Back Office agents seen by the inbox (presence + routing).
CREATE TABLE agents (
    tenant      TEXT NOT NULL,
    staff_id    TEXT NOT NULL,
    name        TEXT NOT NULL,
    role        TEXT NOT NULL,
    status      TEXT NOT NULL DEFAULT 'online' CHECK (status IN ('online', 'away')),
    last_seen   TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (tenant, staff_id)
);

-- In-app notifications (D41) for clients (audience 'user', recipient = gateway user id) and staff
-- (audience 'staff', recipient = staff id).
CREATE TABLE notifications (
    id            BIGSERIAL PRIMARY KEY,
    tenant        TEXT NOT NULL,
    audience      TEXT NOT NULL CHECK (audience IN ('user', 'staff')),
    recipient     TEXT NOT NULL,
    type          TEXT NOT NULL,
    severity      TEXT NOT NULL DEFAULT 'info' CHECK (severity IN ('info', 'success', 'warning', 'critical')),
    title         TEXT NOT NULL,
    body          TEXT NOT NULL DEFAULT '',
    link          TEXT,
    data          JSONB NOT NULL DEFAULT '{}'::jsonb,
    source        TEXT NOT NULL DEFAULT 'system',
    dedupe_key    TEXT,
    broadcast_id  BIGINT,
    hidden        BOOLEAN NOT NULL DEFAULT false,   -- in-app switched off by the recipient (row kept for dedupe + email)
    read_at       TIMESTAMPTZ,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX notifications_inbox_idx ON notifications (tenant, audience, recipient, id DESC);
CREATE UNIQUE INDEX notifications_dedupe ON notifications (tenant, audience, recipient, dedupe_key) WHERE dedupe_key IS NOT NULL;

CREATE TABLE notification_prefs (
    tenant      TEXT NOT NULL,
    audience    TEXT NOT NULL,
    recipient   TEXT NOT NULL,
    prefs       JSONB NOT NULL,
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (tenant, audience, recipient)
);

CREATE TABLE broadcasts (
    id           BIGSERIAL PRIMARY KEY,
    tenant       TEXT NOT NULL,
    title        TEXT NOT NULL,
    body         TEXT NOT NULL,
    link         TEXT,
    type         TEXT NOT NULL,
    segment      JSONB NOT NULL,
    in_app       BOOLEAN NOT NULL,
    email        BOOLEAN NOT NULL,
    status       TEXT NOT NULL DEFAULT 'sending' CHECK (status IN ('sending', 'sent', 'failed')),
    recipients   INT NOT NULL DEFAULT 0,
    emailed      INT NOT NULL DEFAULT 0,
    error        TEXT,
    created_by   TEXT NOT NULL,
    created_by_name TEXT,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    finished_at  TIMESTAMPTZ
);

-- Email queue: sent in the background over SMTP (logged in development without SMTP).
CREATE TABLE email_outbox (
    id          BIGSERIAL PRIMARY KEY,
    tenant      TEXT NOT NULL,
    to_addr     TEXT NOT NULL,
    subject     TEXT NOT NULL,
    text_body   TEXT NOT NULL,
    html_body   TEXT NOT NULL,
    kind        TEXT NOT NULL,
    status      TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'logged', 'failed')),
    attempts    INT NOT NULL DEFAULT 0,
    last_error  TEXT,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    sent_at     TIMESTAMPTZ
);
CREATE INDEX email_outbox_pending_idx ON email_outbox (id) WHERE status = 'pending';

CREATE TABLE cursors (
    name        TEXT PRIMARY KEY,
    value       TEXT NOT NULL,
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Append-only audit log (UPDATE / DELETE rejected by trigger).
CREATE TABLE audit_log (
    id          BIGSERIAL PRIMARY KEY,
    tenant      TEXT NOT NULL,
    actor       TEXT NOT NULL,
    actor_name  TEXT,
    action      TEXT NOT NULL,
    target      TEXT,
    before      JSONB,
    after       JSONB,
    note        TEXT,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX audit_log_tenant_idx ON audit_log (tenant, id DESC);

CREATE FUNCTION audit_log_immutable() RETURNS trigger AS $$
BEGIN
    RAISE EXCEPTION 'audit_log is append-only';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER audit_log_no_update BEFORE UPDATE OR DELETE ON audit_log
    FOR EACH ROW EXECUTE FUNCTION audit_log_immutable();
