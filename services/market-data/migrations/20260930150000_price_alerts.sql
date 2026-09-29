-- Price alerts (server-side, per client): evaluated on every quote change of the symbol, on the account group's
-- price (spread markup applied, like the quotes the client sees). See src/alerts/mod.rs.

CREATE TABLE IF NOT EXISTS price_alerts (
    id             BIGSERIAL PRIMARY KEY,
    tenant         TEXT NOT NULL,
    user_id        BIGINT NOT NULL,
    symbol         TEXT NOT NULL,
    -- the spread group whose prices are watched (the client's trading account group)
    spread_group   TEXT NOT NULL DEFAULT 'standard',
    -- above / below: the price crosses a level; change_up / change_down: it moves by `value` percent from `reference`
    condition      TEXT NOT NULL CHECK (condition IN ('above', 'below', 'change_up', 'change_down')),
    value          DOUBLE PRECISION NOT NULL,
    basis          TEXT NOT NULL DEFAULT 'bid' CHECK (basis IN ('bid', 'ask')),
    -- change_*: the price the move is measured from (when set, or when it last triggered)
    reference      DOUBLE PRECISION,
    -- the price that triggers
    target         DOUBLE PRECISION NOT NULL,
    repeat         BOOLEAN NOT NULL DEFAULT FALSE,
    -- level alerts: waiting for the price to reach the level (a repeating one re-arms on the other side of it)
    armed          BOOLEAN NOT NULL DEFAULT TRUE,
    status         TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'paused', 'triggered', 'expired')),
    note           TEXT NOT NULL DEFAULT '',
    expires_at     TIMESTAMPTZ,
    trigger_count  INTEGER NOT NULL DEFAULT 0,
    triggered_at   TIMESTAMPTZ,
    last_price     DOUBLE PRECISION,
    -- bumped by every change the client makes: a trigger decided on an older version is dropped
    rev            INTEGER NOT NULL DEFAULT 1,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS price_alerts_owner ON price_alerts (tenant, user_id, id DESC);
CREATE INDEX IF NOT EXISTS price_alerts_active ON price_alerts (id) WHERE status = 'active';
CREATE INDEX IF NOT EXISTS price_alerts_expiry ON price_alerts (expires_at) WHERE status IN ('active', 'paused') AND expires_at IS NOT NULL;

-- Every trigger: the client's history, and the outbox the notifications service (services/support) is fed from.
CREATE TABLE IF NOT EXISTS price_alert_events (
    id               BIGSERIAL PRIMARY KEY,
    alert_id         BIGINT REFERENCES price_alerts (id) ON DELETE SET NULL,
    tenant           TEXT NOT NULL,
    user_id          BIGINT NOT NULL,
    symbol           TEXT NOT NULL,
    condition        TEXT NOT NULL,
    value            DOUBLE PRECISION NOT NULL,
    basis            TEXT NOT NULL,
    reference        DOUBLE PRECISION,
    target           DOUBLE PRECISION NOT NULL,
    price            DOUBLE PRECISION NOT NULL,
    repeat           BOOLEAN NOT NULL,
    note             TEXT NOT NULL DEFAULT '',
    triggered_at     TIMESTAMPTZ NOT NULL,
    -- hidden from the client's history ("Clear"); still delivered
    cleared          BOOLEAN NOT NULL DEFAULT FALSE,
    -- delivery to the notifications service
    delivered_at     TIMESTAMPTZ,
    attempts         INTEGER NOT NULL DEFAULT 0,
    next_attempt_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    failed           BOOLEAN NOT NULL DEFAULT FALSE,
    last_error       TEXT
);
CREATE INDEX IF NOT EXISTS price_alert_events_owner ON price_alert_events (tenant, user_id, id DESC);
CREATE INDEX IF NOT EXISTS price_alert_events_outbox ON price_alert_events (next_attempt_at) WHERE delivered_at IS NULL AND NOT failed;
