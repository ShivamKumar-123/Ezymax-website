-- Mobile push notifications through the Expo push service (src/push.rs).

-- One row per app installation (its Expo push token), owned by the client signed in on that phone. A sign-in on the
-- same phone moves the row to the new client (the token is unique per tenant). The app refreshes `last_seen_at`
-- while it is used; rows unseen for 90 days are removed, and the Expo service's DeviceNotRegistered drops a row
-- at once. Signing out on the phone deletes it.
CREATE TABLE push_tokens (
    id            BIGSERIAL PRIMARY KEY,
    tenant        TEXT NOT NULL,
    user_id       BIGINT NOT NULL,
    token         TEXT NOT NULL,
    device_id     TEXT NOT NULL,                    -- the app's installation id (X-Kalks-Device)
    platform      TEXT NOT NULL CHECK (platform IN ('ios', 'android')),
    locale        TEXT NOT NULL DEFAULT 'en',
    app_version   TEXT NOT NULL DEFAULT '',
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    last_seen_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (tenant, token)
);
CREATE INDEX push_tokens_user_idx ON push_tokens (tenant, user_id);

-- Send queue: one message per (notification, phone). Sent in batches of up to 100 (Expo's limit), retried with
-- backoff on rate limits and outages; the delivery receipt is checked about 15 minutes after sending.
CREATE TABLE push_outbox (
    id               BIGSERIAL PRIMARY KEY,
    tenant           TEXT NOT NULL,
    notification_id  BIGINT,
    user_id          BIGINT NOT NULL,
    token            TEXT NOT NULL,
    message          JSONB NOT NULL,                -- the Expo message without `to`
    status           TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'failed', 'dropped')),
    attempts         INT NOT NULL DEFAULT 0,
    next_attempt_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    ticket_id        TEXT,
    receipt          TEXT,                          -- 'ok', the Expo error code, or 'expired' (no receipt came back)
    last_error       TEXT,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
    sent_at          TIMESTAMPTZ
);
CREATE INDEX push_outbox_due_idx ON push_outbox (next_attempt_at) WHERE status = 'pending';
CREATE INDEX push_outbox_receipt_idx ON push_outbox (sent_at) WHERE status = 'sent' AND receipt IS NULL;
