-- Kalks market data: raw-price candles (all timeframes), optional tick archive, spread markups per account group.
-- Prices here are the RAW provider price. Group spreads are applied only when quotes are sent to clients,
-- so chart history is identical for everyone and matches the wider market.

CREATE TABLE IF NOT EXISTS instruments (
    symbol           TEXT PRIMARY KEY,
    asset_class      TEXT NOT NULL,
    digits           SMALLINT NOT NULL,
    base_spread      DOUBLE PRECISION NOT NULL,
    provider_market  TEXT NOT NULL,
    provider_code    TEXT NOT NULL,
    enabled          BOOLEAN NOT NULL DEFAULT TRUE,
    updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- tf: 1=M1 5=M5 15=M15 30=M30 60=H1 240=H4 1440=D1 10080=W1 43200=MN (minutes)
CREATE TABLE IF NOT EXISTS candles (
    symbol  TEXT NOT NULL,
    tf      INTEGER NOT NULL,
    t       TIMESTAMPTZ NOT NULL,          -- bar open time (UTC instant)
    o       DOUBLE PRECISION NOT NULL,
    h       DOUBLE PRECISION NOT NULL,
    l       DOUBLE PRECISION NOT NULL,
    c       DOUBLE PRECISION NOT NULL,
    v       DOUBLE PRECISION NOT NULL DEFAULT 0,
    source  SMALLINT NOT NULL DEFAULT 0,   -- 0 = built from live ticks, 1 = provider history, 2 = aggregated from lower TF
    PRIMARY KEY (symbol, tf, t)
);
CREATE INDEX IF NOT EXISTS candles_recent ON candles (symbol, tf, t DESC);

CREATE TABLE IF NOT EXISTS ticks (
    symbol  TEXT NOT NULL,
    t       TIMESTAMPTZ NOT NULL,
    bid     DOUBLE PRECISION,
    ask     DOUBLE PRECISION,
    last    DOUBLE PRECISION
);
CREATE INDEX IF NOT EXISTS ticks_symbol_t ON ticks (symbol, t DESC);

CREATE TABLE IF NOT EXISTS backfill_state (
    symbol      TEXT NOT NULL,
    tf          INTEGER NOT NULL,
    oldest_t    TIMESTAMPTZ,
    target_t    TIMESTAMPTZ NOT NULL,
    done        BOOLEAN NOT NULL DEFAULT FALSE,
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (symbol, tf)
);

-- Spread markup per account group (set from the Back Office). points = instrument price step (10^-digits).
CREATE TABLE IF NOT EXISTS account_groups (
    code  TEXT PRIMARY KEY,
    name  TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS spread_markups (
    group_code         TEXT NOT NULL REFERENCES account_groups(code) ON DELETE CASCADE,
    symbol             TEXT NOT NULL,          -- '*' = default for all symbols in the group
    markup_points      INTEGER NOT NULL DEFAULT 0,
    min_spread_points  INTEGER NOT NULL DEFAULT 0,
    updated_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (group_code, symbol)
);

INSERT INTO account_groups (code, name) VALUES
    ('raw', 'Raw feed (no markup)'), ('standard', 'Standard'), ('pro', 'Pro'), ('ecn', 'ECN'), ('cent', 'Cent')
ON CONFLICT (code) DO NOTHING;
INSERT INTO spread_markups (group_code, symbol, markup_points, min_spread_points) VALUES
    ('standard', '*', 10, 0), ('pro', '*', 3, 0), ('ecn', '*', 0, 0), ('cent', '*', 10, 0)
ON CONFLICT (group_code, symbol) DO NOTHING;
