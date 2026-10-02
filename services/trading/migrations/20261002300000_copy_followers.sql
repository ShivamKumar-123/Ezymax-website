-- Copy trading: following lifecycle, follower tools, master tools (Task 1 A6–A11, C6–C7) and the
-- notification outbox (src/notify.rs). Additive only: every column has a default, so an older engine keeps working.

-- Notification outbox: rows written with the business change, delivered to the support service
-- (POST /v1/notify) by `notify::spawn`, retried until done. `dedupe_key` is unique per tenant, so enqueueing
-- the same event twice is a no-op; support dedupes again per recipient on the same key.
-- CREATE ... IF NOT EXISTS + ADD COLUMN IF NOT EXISTS keep this safe if another migration created the table first.
CREATE TABLE IF NOT EXISTS notify_outbox (
    id          BIGSERIAL PRIMARY KEY,
    tenant_id   BIGINT NOT NULL REFERENCES tenants(id),
    user_id     BIGINT NOT NULL,
    kind        TEXT NOT NULL,
    data        JSONB NOT NULL DEFAULT '{}',
    dedupe_key  TEXT NOT NULL,
    status      TEXT NOT NULL DEFAULT 'pending',
    attempts    INT NOT NULL DEFAULT 0,
    last_error  TEXT,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    sent_at     TIMESTAMPTZ
);
ALTER TABLE notify_outbox ADD COLUMN IF NOT EXISTS user_id BIGINT;
ALTER TABLE notify_outbox ADD COLUMN IF NOT EXISTS kind TEXT;
ALTER TABLE notify_outbox ADD COLUMN IF NOT EXISTS data JSONB NOT NULL DEFAULT '{}';
ALTER TABLE notify_outbox ADD COLUMN IF NOT EXISTS dedupe_key TEXT;
ALTER TABLE notify_outbox ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'pending';
ALTER TABLE notify_outbox ADD COLUMN IF NOT EXISTS attempts INT NOT NULL DEFAULT 0;
ALTER TABLE notify_outbox ADD COLUMN IF NOT EXISTS last_error TEXT;
ALTER TABLE notify_outbox ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT now();
ALTER TABLE notify_outbox ADD COLUMN IF NOT EXISTS sent_at TIMESTAMPTZ;
CREATE UNIQUE INDEX IF NOT EXISTS notify_outbox_dedupe_idx ON notify_outbox (tenant_id, dedupe_key);
CREATE INDEX IF NOT EXISTS notify_outbox_pending_idx ON notify_outbox (id) WHERE status = 'pending';

-- A8: a master's fee change waits for each follower's acceptance (pending_* + terms_deadline); past the
-- deadline the copy pauses with pause_reason 'terms'. attention = 'master_stopped' when the master was
-- suspended / frozen / removed (the Client Area offers the unfollow wizard).
-- A9: auto_sl_pips = the follower's own stop loss on every copied trade (the tighter of it and the master's).
-- A9 demo trial: trial / trial_ends_at.
ALTER TABLE copy_subscriptions ADD COLUMN IF NOT EXISTS auto_sl_pips NUMERIC CHECK (auto_sl_pips IS NULL OR auto_sl_pips > 0);
ALTER TABLE copy_subscriptions ADD COLUMN IF NOT EXISTS pending_fee_pct NUMERIC;
ALTER TABLE copy_subscriptions ADD COLUMN IF NOT EXISTS pending_fee_period TEXT;
ALTER TABLE copy_subscriptions ADD COLUMN IF NOT EXISTS terms_deadline TIMESTAMPTZ;
ALTER TABLE copy_subscriptions ADD COLUMN IF NOT EXISTS pause_reason TEXT;
ALTER TABLE copy_subscriptions ADD COLUMN IF NOT EXISTS attention TEXT;
ALTER TABLE copy_subscriptions ADD COLUMN IF NOT EXISTS trial BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE copy_subscriptions ADD COLUMN IF NOT EXISTS trial_ends_at TIMESTAMPTZ;

-- A11: follower limits and the private (invite-only) copy link.
ALTER TABLE social_masters ADD COLUMN IF NOT EXISTS max_followers INT CHECK (max_followers IS NULL OR max_followers >= 0);
ALTER TABLE social_masters ADD COLUMN IF NOT EXISTS accept_new BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE social_masters ADD COLUMN IF NOT EXISTS invite_only BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE social_masters ADD COLUMN IF NOT EXISTS invite_code TEXT;

-- A10 execution report: master vs follower fill price, slippage in pips (positive = worse for the follower) and
-- the copy delay of every mirrored open / close.
ALTER TABLE copy_log ADD COLUMN IF NOT EXISTS master_price NUMERIC;
ALTER TABLE copy_log ADD COLUMN IF NOT EXISTS follower_price NUMERIC;
ALTER TABLE copy_log ADD COLUMN IF NOT EXISTS delay_ms BIGINT;
ALTER TABLE copy_log ADD COLUMN IF NOT EXISTS slippage_pips NUMERIC;
CREATE INDEX IF NOT EXISTS copy_log_at_idx ON copy_log (tenant_id, at);

-- A11: announcements from a master to their followers (shown in the Client Area, sent to the bell).
CREATE TABLE IF NOT EXISTS social_announcements (
    id          BIGSERIAL PRIMARY KEY,
    tenant_id   BIGINT NOT NULL REFERENCES tenants(id),
    master_id   BIGINT NOT NULL REFERENCES social_masters(id),
    title       TEXT NOT NULL,
    body        TEXT NOT NULL DEFAULT '',
    recipients  INT NOT NULL DEFAULT 0,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS social_announcements_master_idx ON social_announcements (master_id, id DESC);

DO $$
DECLARE t TEXT;
BEGIN
    FOREACH t IN ARRAY ARRAY['notify_outbox','social_announcements'] LOOP
        EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
        IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = t AND policyname = 'tenant_isolation') THEN
            EXECUTE format('CREATE POLICY tenant_isolation ON %I USING (tenant_id = NULLIF(current_setting(''kalks.tenant_id'', true), '''')::bigint)', t);
        END IF;
    END LOOP;
END $$;
