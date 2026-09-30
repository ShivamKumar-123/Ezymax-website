-- Marketplace subscriptions are set up exactly once (README "Marketplace › One subscription, one charge").
--
-- A client's subscribe requests are serialised by a per-client advisory lock: the check for a live subscription
-- (active, or still being set up) and the new row are one atomic step, so two quick requests never both charge.
--
-- * request_key  the client's idempotency key: a retry with the same key answers with the same subscription
--                (finishing it when its setup was interrupted) instead of starting another one.
-- * setup        the row's payment, copy deployment or clone are not finished yet (status stays 'past_due',
--                as before, until it becomes 'active'); a live setup blocks a second subscription to the listing.
-- * setup_until  lease of the one worker finishing it: the request, a retry with the same key, or the janitor
--                that finishes interrupted setups (a lost answer, a restart, a payment the wallet didn't confirm).
-- * request      what the request asked for (risk limits, the listing title the payment was booked with), so a
--                setup can be finished later with the very same wallet transfer.
-- * failure      why a setup didn't go through (shown again to a retry with the same key).
ALTER TABLE subscriptions ADD COLUMN request_key TEXT CHECK (request_key IS NULL OR request_key ~ '^[A-Za-z0-9_-]{1,80}$');
ALTER TABLE subscriptions ADD COLUMN setup BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE subscriptions ADD COLUMN setup_until TIMESTAMPTZ;
ALTER TABLE subscriptions ADD COLUMN request JSONB NOT NULL DEFAULT '{}';
ALTER TABLE subscriptions ADD COLUMN failure TEXT;

CREATE UNIQUE INDEX subscriptions_request_key ON subscriptions (tenant_id, user_id, request_key) WHERE request_key IS NOT NULL;
CREATE INDEX subscriptions_setup ON subscriptions (setup_until) WHERE setup;
CREATE INDEX subscriptions_live ON subscriptions (tenant_id, listing_id, user_id) WHERE status = 'active' OR setup;
