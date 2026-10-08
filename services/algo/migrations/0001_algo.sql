-- Ezymex ALGO service (services/algo): strategies, backtests, runtime deployments, webhook signals,
-- public API keys, marketplace. Every table carries tenant_id with an RLS policy on
-- current_setting('ezymex.tenant_id'); the service connects as the table owner and filters by tenant itself.

CREATE TABLE strategies (
    id              BIGSERIAL PRIMARY KEY,
    tenant_id       TEXT NOT NULL DEFAULT 'ezymex',
    user_id         BIGINT NOT NULL,
    name            TEXT NOT NULL,
    symbol          TEXT NOT NULL,
    timeframe       TEXT NOT NULL,
    kind            TEXT NOT NULL CHECK (kind IN ('visual', 'code')),
    origin          TEXT NOT NULL DEFAULT 'manual' CHECK (origin IN ('manual', 'ai', 'template', 'marketplace')),
    source_listing_id BIGINT,
    status          TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'archived')),
    latest_version  INT NOT NULL DEFAULT 1,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX strategies_user ON strategies (tenant_id, user_id, updated_at DESC);

-- Versions are immutable: deployments, backtests and listings point at an exact version.
CREATE TABLE strategy_versions (
    id              BIGSERIAL PRIMARY KEY,
    tenant_id       TEXT NOT NULL DEFAULT 'ezymex',
    strategy_id     BIGINT NOT NULL REFERENCES strategies(id) ON DELETE CASCADE,
    version         INT NOT NULL,
    kind            TEXT NOT NULL CHECK (kind IN ('visual', 'code')),
    spec            JSONB NOT NULL,
    source          TEXT,
    valid           BOOLEAN NOT NULL,
    errors          JSONB NOT NULL DEFAULT '[]',
    warnings        JSONB NOT NULL DEFAULT '[]',
    note            TEXT,
    prompt          TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (strategy_id, version)
);

CREATE TABLE backtests (
    id              BIGSERIAL PRIMARY KEY,
    tenant_id       TEXT NOT NULL DEFAULT 'ezymex',
    user_id         BIGINT NOT NULL,
    strategy_id     BIGINT NOT NULL REFERENCES strategies(id) ON DELETE CASCADE,
    version_id      BIGINT NOT NULL REFERENCES strategy_versions(id),
    params          JSONB NOT NULL,
    status          TEXT NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'running', 'done', 'failed', 'cancelled')),
    progress        REAL NOT NULL DEFAULT 0,
    stage           TEXT,
    error           TEXT,
    summary         JSONB,
    report          JSONB,
    cpu_ms          BIGINT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    started_at      TIMESTAMPTZ,
    finished_at     TIMESTAMPTZ
);
CREATE INDEX backtests_user ON backtests (tenant_id, user_id, created_at DESC);
CREATE INDEX backtests_queue ON backtests (status, created_at) WHERE status IN ('queued', 'running');

-- A strategy version running 24/7 on one trading account.
CREATE TABLE deployments (
    id              BIGSERIAL PRIMARY KEY,
    tenant_id       TEXT NOT NULL DEFAULT 'ezymex',
    user_id         BIGINT NOT NULL,
    strategy_id     BIGINT NOT NULL REFERENCES strategies(id),
    version_id      BIGINT NOT NULL REFERENCES strategy_versions(id),
    login           BIGINT NOT NULL,
    account_type    TEXT NOT NULL CHECK (account_type IN ('demo', 'live')),
    status          TEXT NOT NULL DEFAULT 'running' CHECK (status IN ('running', 'paused', 'stopped', 'killed', 'error')),
    risk            JSONB NOT NULL DEFAULT '{}',
    subscription_id BIGINT,
    start_balance   NUMERIC(20, 2),
    stats           JSONB NOT NULL DEFAULT '{}',
    last_bar_t      BIGINT,
    last_eval_at    TIMESTAMPTZ,
    error           TEXT,
    stop_reason     TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    stopped_at      TIMESTAMPTZ
);
CREATE INDEX deployments_user ON deployments (tenant_id, user_id, created_at DESC);
CREATE INDEX deployments_running ON deployments (status) WHERE status IN ('running', 'paused');

CREATE TABLE deployment_positions (
    ticket          BIGINT PRIMARY KEY,
    tenant_id       TEXT NOT NULL DEFAULT 'ezymex',
    deployment_id   BIGINT NOT NULL REFERENCES deployments(id) ON DELETE CASCADE,
    symbol          TEXT NOT NULL,
    side            TEXT NOT NULL,
    volume          NUMERIC(20, 4) NOT NULL,
    open_price      DOUBLE PRECISION,
    opened_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
    closed_at       TIMESTAMPTZ,
    close_price     DOUBLE PRECISION,
    profit          NUMERIC(20, 2),
    reason          TEXT,
    breakeven_done  BOOLEAN NOT NULL DEFAULT FALSE
);
CREATE INDEX deployment_positions_dep ON deployment_positions (deployment_id, opened_at DESC);

CREATE TABLE deployment_logs (
    id              BIGSERIAL PRIMARY KEY,
    tenant_id       TEXT NOT NULL DEFAULT 'ezymex',
    deployment_id   BIGINT NOT NULL REFERENCES deployments(id) ON DELETE CASCADE,
    at              TIMESTAMPTZ NOT NULL DEFAULT now(),
    level           TEXT NOT NULL DEFAULT 'info',
    kind            TEXT NOT NULL,
    message         TEXT NOT NULL
);
CREATE INDEX deployment_logs_dep ON deployment_logs (deployment_id, id DESC);

-- Verified track record: realized P&L per server day, from the engine's deals.
CREATE TABLE deployment_daily (
    deployment_id   BIGINT NOT NULL REFERENCES deployments(id) ON DELETE CASCADE,
    tenant_id       TEXT NOT NULL DEFAULT 'ezymex',
    day             DATE NOT NULL,
    realized        NUMERIC(20, 2) NOT NULL DEFAULT 0,
    trades          INT NOT NULL DEFAULT 0,
    wins            INT NOT NULL DEFAULT 0,
    PRIMARY KEY (deployment_id, day)
);

-- Per-user kill switch (D84): stops every deployment, webhook and API trade of the user.
CREATE TABLE user_controls (
    tenant_id       TEXT NOT NULL DEFAULT 'ezymex',
    user_id         BIGINT NOT NULL,
    killed          BOOLEAN NOT NULL DEFAULT FALSE,
    killed_at       TIMESTAMPTZ,
    killed_by       TEXT,
    reason          TEXT,
    PRIMARY KEY (tenant_id, user_id)
);

CREATE TABLE settings (
    tenant_id       TEXT NOT NULL DEFAULT 'ezymex',
    key             TEXT NOT NULL,
    value           JSONB NOT NULL,
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_by      TEXT,
    PRIMARY KEY (tenant_id, key)
);

CREATE TABLE webhooks (
    id              BIGSERIAL PRIMARY KEY,
    tenant_id       TEXT NOT NULL DEFAULT 'ezymex',
    user_id         BIGINT NOT NULL,
    name            TEXT NOT NULL,
    token_hash      TEXT NOT NULL UNIQUE,
    token_hint      TEXT NOT NULL,
    passphrase_hash TEXT,
    status          TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'disabled')),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    last_used_at    TIMESTAMPTZ
);
CREATE INDEX webhooks_user ON webhooks (tenant_id, user_id);

-- Fan-out (D85): one alert → several of the user's own accounts, each with its own sizing.
CREATE TABLE webhook_routes (
    id              BIGSERIAL PRIMARY KEY,
    tenant_id       TEXT NOT NULL DEFAULT 'ezymex',
    webhook_id      BIGINT NOT NULL REFERENCES webhooks(id) ON DELETE CASCADE,
    login           BIGINT NOT NULL,
    account_type    TEXT NOT NULL,
    sizing          JSONB NOT NULL,
    symbol_map      JSONB NOT NULL DEFAULT '{}',
    enabled         BOOLEAN NOT NULL DEFAULT TRUE,
    UNIQUE (webhook_id, login)
);

CREATE TABLE webhook_events (
    id              BIGSERIAL PRIMARY KEY,
    tenant_id       TEXT NOT NULL DEFAULT 'ezymex',
    webhook_id      BIGINT NOT NULL REFERENCES webhooks(id) ON DELETE CASCADE,
    user_id         BIGINT NOT NULL,
    received_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    ip              TEXT,
    dedup_key       TEXT NOT NULL,
    payload         JSONB,
    status          TEXT NOT NULL,
    error           TEXT,
    results         JSONB NOT NULL DEFAULT '[]',
    UNIQUE (webhook_id, dedup_key)
);
CREATE INDEX webhook_events_recent ON webhook_events (tenant_id, received_at DESC);

-- Public API keys (D78). The secret is never stored: it is HMAC(ALGO_KEY_SECRET, key_id:salt) and is
-- recomputed to verify a request, so the database alone cannot reveal or forge a key.
CREATE TABLE api_keys (
    id              BIGSERIAL PRIMARY KEY,
    tenant_id       TEXT NOT NULL DEFAULT 'ezymex',
    user_id         BIGINT NOT NULL,
    login           BIGINT NOT NULL,
    account_type    TEXT NOT NULL,
    name            TEXT NOT NULL,
    key_id          TEXT NOT NULL UNIQUE,
    salt            TEXT NOT NULL,
    scopes          TEXT[] NOT NULL,
    ip_whitelist    TEXT[] NOT NULL DEFAULT '{}',
    rate_per_min    INT,
    expires_at      TIMESTAMPTZ,
    status          TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'revoked')),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    last_used_at    TIMESTAMPTZ,
    last_ip         TEXT,
    revoked_at      TIMESTAMPTZ,
    revoked_by      TEXT
);
CREATE INDEX api_keys_user ON api_keys (tenant_id, user_id);

CREATE TABLE api_requests (
    id              BIGSERIAL PRIMARY KEY,
    tenant_id       TEXT NOT NULL DEFAULT 'ezymex',
    key_id          BIGINT NOT NULL REFERENCES api_keys(id) ON DELETE CASCADE,
    at              TIMESTAMPTZ NOT NULL DEFAULT now(),
    method          TEXT NOT NULL,
    path            TEXT NOT NULL,
    status          INT NOT NULL,
    ip              TEXT,
    ms              INT NOT NULL DEFAULT 0
);
CREATE INDEX api_requests_key ON api_requests (key_id, at DESC);

-- Marketplace (D83).
CREATE TABLE listings (
    id              BIGSERIAL PRIMARY KEY,
    tenant_id       TEXT NOT NULL DEFAULT 'ezymex',
    author_user_id  BIGINT NOT NULL,
    author_name     TEXT NOT NULL,
    strategy_id     BIGINT NOT NULL REFERENCES strategies(id),
    version_id      BIGINT NOT NULL REFERENCES strategy_versions(id),
    track_deployment_id BIGINT NOT NULL REFERENCES deployments(id),
    title           TEXT NOT NULL,
    description     TEXT NOT NULL,
    symbol          TEXT NOT NULL,
    timeframe       TEXT NOT NULL,
    price_monthly   NUMERIC(20, 2) NOT NULL DEFAULT 0,
    currency        TEXT NOT NULL DEFAULT 'USDT',
    allow_clone     BOOLEAN NOT NULL DEFAULT FALSE,
    status          TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'suspended', 'unlisted')),
    moderation_note TEXT,
    moderated_by    TEXT,
    moderated_at    TIMESTAMPTZ,
    rating_avg      REAL NOT NULL DEFAULT 0,
    rating_count    INT NOT NULL DEFAULT 0,
    subscribers     INT NOT NULL DEFAULT 0,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX listings_status ON listings (tenant_id, status, updated_at DESC);

CREATE TABLE subscriptions (
    id              BIGSERIAL PRIMARY KEY,
    tenant_id       TEXT NOT NULL DEFAULT 'ezymex',
    listing_id      BIGINT NOT NULL REFERENCES listings(id),
    user_id         BIGINT NOT NULL,
    mode            TEXT NOT NULL CHECK (mode IN ('copy', 'clone')),
    status          TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'cancelled', 'expired', 'past_due')),
    login           BIGINT,
    deployment_id   BIGINT REFERENCES deployments(id),
    cloned_strategy_id BIGINT REFERENCES strategies(id),
    price           NUMERIC(20, 2) NOT NULL DEFAULT 0,
    auto_renew      BOOLEAN NOT NULL DEFAULT TRUE,
    period_start    TIMESTAMPTZ NOT NULL DEFAULT now(),
    period_end      TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    cancelled_at    TIMESTAMPTZ
);
CREATE INDEX subscriptions_user ON subscriptions (tenant_id, user_id);
CREATE INDEX subscriptions_listing ON subscriptions (listing_id);

CREATE TABLE subscription_payments (
    id              BIGSERIAL PRIMARY KEY,
    tenant_id       TEXT NOT NULL DEFAULT 'ezymex',
    subscription_id BIGINT NOT NULL REFERENCES subscriptions(id),
    amount          NUMERIC(20, 2) NOT NULL,
    platform_fee    NUMERIC(20, 2) NOT NULL,
    author_amount   NUMERIC(20, 2) NOT NULL,
    cut_pct         NUMERIC(6, 2) NOT NULL,
    period_start    TIMESTAMPTZ NOT NULL,
    period_end      TIMESTAMPTZ NOT NULL,
    status          TEXT NOT NULL,
    error           TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE reviews (
    id              BIGSERIAL PRIMARY KEY,
    tenant_id       TEXT NOT NULL DEFAULT 'ezymex',
    listing_id      BIGINT NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
    user_id         BIGINT NOT NULL,
    user_name       TEXT NOT NULL,
    rating          INT NOT NULL CHECK (rating BETWEEN 1 AND 5),
    comment         TEXT NOT NULL DEFAULT '',
    status          TEXT NOT NULL DEFAULT 'visible' CHECK (status IN ('visible', 'hidden')),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (listing_id, user_id)
);

CREATE TABLE ai_requests (
    id              BIGSERIAL PRIMARY KEY,
    tenant_id       TEXT NOT NULL DEFAULT 'ezymex',
    user_id         BIGINT NOT NULL,
    at              TIMESTAMPTZ NOT NULL DEFAULT now(),
    target          TEXT NOT NULL,
    prompt          TEXT NOT NULL,
    status          TEXT NOT NULL,
    model           TEXT,
    ms              INT
);
CREATE INDEX ai_requests_user ON ai_requests (tenant_id, user_id, at DESC);

CREATE TABLE audit_log (
    id              BIGSERIAL PRIMARY KEY,
    tenant_id       TEXT NOT NULL DEFAULT 'ezymex',
    at              TIMESTAMPTZ NOT NULL DEFAULT now(),
    actor           TEXT NOT NULL,
    action          TEXT NOT NULL,
    target          TEXT,
    data            JSONB NOT NULL DEFAULT '{}'
);
CREATE INDEX audit_log_recent ON audit_log (tenant_id, id DESC);

DO $$
DECLARE t TEXT;
BEGIN
    FOREACH t IN ARRAY ARRAY['strategies','strategy_versions','backtests','deployments','deployment_positions','deployment_logs',
        'deployment_daily','user_controls','settings','webhooks','webhook_routes','webhook_events','api_keys','api_requests',
        'listings','subscriptions','subscription_payments','reviews','ai_requests','audit_log']
    LOOP
        EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
        EXECUTE format('CREATE POLICY tenant_isolation ON %I USING (tenant_id = current_setting(''ezymex.tenant_id'', true))', t);
    END LOOP;
END $$;
