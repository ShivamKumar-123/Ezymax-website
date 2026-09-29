-- Paid payouts are announced to the partner through the support service (POST /v1/notify, type
-- ib.commission_paid: bell, realtime, email per the `ib` preference). notified_at marks delivery; payouts
-- paid before this migration count as announced.
ALTER TABLE payouts
    ADD COLUMN notified_at     TIMESTAMPTZ,
    ADD COLUMN notify_attempts INT NOT NULL DEFAULT 0,
    ADD COLUMN notify_next_at  TIMESTAMPTZ,
    ADD COLUMN notify_error    TEXT;
UPDATE payouts SET notified_at = COALESCE(paid_at, now()) WHERE status = 'paid';
CREATE INDEX payouts_notify_idx ON payouts (id) WHERE status = 'paid' AND notified_at IS NULL;
