-- Automatic bonus on a first deposit: the offer the banner actually promises.
--
-- A deposit campaign used to require the client to find the Promotions page and press Claim before depositing;
-- anyone who read "25% cashback on your first deposit" and simply deposited got nothing. A campaign marked
-- `auto_grant` is granted by the service instead, on the first qualifying deposit a client makes while the
-- campaign is running. Off by default, so no existing campaign changes behaviour.
ALTER TABLE bonus_campaigns ADD COLUMN IF NOT EXISTS auto_grant BOOLEAN NOT NULL DEFAULT false;

-- How far the worker has read the trading engine's funding feed (/v1/internal/funding). Deposits are matched
-- by walking that feed once, oldest first, rather than by polling every client's ledger.
CREATE TABLE IF NOT EXISTS funding_cursor (
    tenant     TEXT PRIMARY KEY,
    after_txn  BIGINT NOT NULL DEFAULT 0,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- "has this client already been granted this campaign" is asked once per deposit
CREATE INDEX IF NOT EXISTS bonus_grants_campaign_user_idx ON bonus_grants (campaign_id, user_id);
