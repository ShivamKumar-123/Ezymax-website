-- House accounts (README "House accounts"): platform-owned accounts that run one real strategy each on a
-- real live account through the runtime, so copy trading and the marketplace are not empty at launch. Their
-- track record is only what they actually trade. Every row points at the real objects it created: the
-- gateway house user, the engine account and approved house master, the strategy/version, the backtest
-- (shown labelled as a backtest), the runtime deployment and the marketplace listing.
CREATE TABLE house_accounts (
    id              BIGSERIAL PRIMARY KEY,
    tenant_id       TEXT NOT NULL DEFAULT 'kalks',
    preset          TEXT NOT NULL,
    nickname        TEXT NOT NULL,
    capital         NUMERIC(20, 2) NOT NULL,           -- house capital booked so far (initial + top-ups − withdrawals)
    user_id         BIGINT,                            -- gateway house user (is_house)
    login           BIGINT,                            -- engine live account
    master_id       BIGINT,                            -- engine social_masters (is_house)
    strategy_id     BIGINT REFERENCES strategies(id),
    version_id      BIGINT REFERENCES strategy_versions(id),
    backtest_id     BIGINT,
    deployment_id   BIGINT REFERENCES deployments(id),
    listing_id      BIGINT REFERENCES listings(id),
    enabled         BOOLEAN NOT NULL DEFAULT true,     -- per-account switch (strategy running + listed)
    visible         BOOLEAN NOT NULL DEFAULT true,     -- shown on the leaderboard and in the marketplace while on
    applied_hidden  BOOLEAN,                           -- last master visibility sent to the engine
    status          TEXT NOT NULL DEFAULT 'provisioning' CHECK (status IN ('provisioning', 'active', 'failed', 'retired')),
    error           TEXT,
    created_by      TEXT NOT NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    retired_at      TIMESTAMPTZ
);
CREATE UNIQUE INDEX house_accounts_preset_idx ON house_accounts (tenant_id, preset) WHERE status <> 'retired';

-- Master switch per tenant (off = every house account paused and hidden, whatever its own switch says).
CREATE TABLE house_settings (
    tenant_id   TEXT PRIMARY KEY,
    enabled     BOOLEAN NOT NULL DEFAULT true,
    updated_by  TEXT,
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Marketplace disclosure: a listing published by a house account, with its (labelled) backtest.
ALTER TABLE listings ADD COLUMN is_house BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE listings ADD COLUMN backtest_id BIGINT;
