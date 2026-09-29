-- House accounts (services/algo "House accounts"): platform-owned masters that run a real automated strategy
-- on a real live account. `is_house` drives the "House strategy · Operated by the broker" disclosure on the
-- leaderboard, the master profile and the follower's subscription. Their capital is booked as ledger kind
-- `house_capital` (house:house_capital), never as a client deposit.
ALTER TABLE social_masters ADD COLUMN IF NOT EXISTS is_house BOOLEAN NOT NULL DEFAULT false;
CREATE INDEX IF NOT EXISTS social_masters_house_idx ON social_masters (tenant_id) WHERE is_house;
