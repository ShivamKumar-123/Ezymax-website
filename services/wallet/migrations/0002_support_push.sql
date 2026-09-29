-- Outbox columns: every wallet notification is pushed to the support service (POST /v1/notify: bell,
-- realtime, email per the client's preference) by the notifier worker after the transaction commits.
-- Rows written before this migration are treated as already delivered (support's polling adapter covered them).
ALTER TABLE notifications
    ADD COLUMN pushed_at     TIMESTAMPTZ,
    ADD COLUMN push_attempts INT NOT NULL DEFAULT 0,
    ADD COLUMN push_next_at  TIMESTAMPTZ,
    ADD COLUMN push_error    TEXT;
UPDATE notifications SET pushed_at = created_at WHERE pushed_at IS NULL;
CREATE INDEX notifications_push_idx ON notifications (id) WHERE pushed_at IS NULL;
