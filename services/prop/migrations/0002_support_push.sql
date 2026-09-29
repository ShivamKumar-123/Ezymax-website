-- Outbox columns: every prop notification is also pushed to the support service (POST /v1/notify: bell in
-- the Client Area and Kalks Trader, realtime, email per the trader's `prop` preference) by `notifier`.
-- Rows written before this migration count as delivered.
ALTER TABLE notifications
    ADD COLUMN pushed_at     TIMESTAMPTZ,
    ADD COLUMN push_attempts INT NOT NULL DEFAULT 0,
    ADD COLUMN push_next_at  TIMESTAMPTZ,
    ADD COLUMN push_error    TEXT;
UPDATE notifications SET pushed_at = at WHERE pushed_at IS NULL;
CREATE INDEX notifications_push_idx ON notifications (id) WHERE pushed_at IS NULL;
