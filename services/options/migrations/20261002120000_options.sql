-- Kalks FX Options reference data and market side (database kalks_options).
-- Money (positions, premiums, margin, settlement) lives in the trading engine; this database holds what the
-- engine prices with (published as a versioned snapshot) plus listings, fixings and the dealing controls.

-- Monotonic config version: bumped by every change the engine snapshot depends on (ETag "opt-<version>").
CREATE TABLE meta (
    key   TEXT PRIMARY KEY,
    value BIGINT NOT NULL
);
INSERT INTO meta (key, value) VALUES ('version', 1);

-- One row per option underlying (a market-data symbol from config/instruments.json).
CREATE TABLE underlyings (
    symbol            TEXT PRIMARY KEY,
    name              TEXT NOT NULL,
    asset_class       TEXT NOT NULL CHECK (asset_class IN ('forex', 'metals', 'energies')),
    -- gk = Garman-Kohlhagen (rd = quote ccy rate, rf = base ccy rate); bs = Black-Scholes with the base
    -- "currency" rate as lease / dividend yield (XAU, XAG); black76 = the price is a forward (b = 0).
    model             TEXT NOT NULL CHECK (model IN ('gk', 'bs', 'black76')),
    base_ccy          TEXT NOT NULL,
    quote_ccy         TEXT NOT NULL,
    -- holiday calendars that must all be open on an expiry (USD / New York is always added)
    calendars         TEXT[] NOT NULL,
    contract_size     DOUBLE PRECISION NOT NULL CHECK (contract_size > 0),
    contract_unit     TEXT NOT NULL,
    digits            INT NOT NULL CHECK (digits BETWEEN 0 AND 8),
    pip_size          DOUBLE PRECISION NOT NULL CHECK (pip_size > 0),
    strike_step       DOUBLE PRECISION NOT NULL CHECK (strike_step > 0),
    strikes_each_side INT NOT NULL DEFAULT 10 CHECK (strikes_each_side BETWEEN 1 AND 60),
    extend_threshold  INT NOT NULL DEFAULT 3 CHECK (extend_threshold >= 0),
    expiry_kinds      TEXT[] NOT NULL DEFAULT '{daily,weekly,monthly}',
    daily_count       INT NOT NULL DEFAULT 5 CHECK (daily_count BETWEEN 0 AND 30),
    weekly_count      INT NOT NULL DEFAULT 4 CHECK (weekly_count BETWEEN 0 AND 26),
    monthly_count     INT NOT NULL DEFAULT 3 CHECK (monthly_count BETWEEN 0 AND 24),
    cut_time          TEXT NOT NULL DEFAULT '10:00',
    cut_zone          TEXT NOT NULL DEFAULT 'America/New_York',
    twap_minutes      INT NOT NULL DEFAULT 30 CHECK (twap_minutes BETWEEN 1 AND 240),
    no_open_minutes   INT NOT NULL DEFAULT 15 CHECK (no_open_minutes >= 0),
    close_only_minutes INT NOT NULL DEFAULT 1 CHECK (close_only_minutes >= 0),
    delta_convention  TEXT NOT NULL DEFAULT 'spot' CHECK (delta_convention IN ('spot', 'forward')),
    weekend_vol_weight DOUBLE PRECISION NOT NULL DEFAULT 0.15 CHECK (weekend_vol_weight BETWEEN 0 AND 2),
    holiday_vol_weight DOUBLE PRECISION NOT NULL DEFAULT 0.5 CHECK (holiday_vol_weight BETWEEN 0 AND 2),
    -- SPAN-style scan: price range R (fraction of spot), vol range (absolute), extreme move x R and cover
    price_scan        DOUBLE PRECISION NOT NULL CHECK (price_scan > 0 AND price_scan < 1),
    vol_scan          DOUBLE PRECISION NOT NULL CHECK (vol_scan > 0 AND vol_scan < 1),
    extreme_multiple  DOUBLE PRECISION NOT NULL DEFAULT 3 CHECK (extreme_multiple >= 1),
    extreme_cover     DOUBLE PRECISION NOT NULL DEFAULT 0.35 CHECK (extreme_cover BETWEEN 0 AND 1),
    min_contracts     DOUBLE PRECISION NOT NULL DEFAULT 1 CHECK (min_contracts > 0),
    max_contracts     DOUBLE PRECISION NOT NULL DEFAULT 100 CHECK (max_contracts > 0),
    contract_step     DOUBLE PRECISION NOT NULL DEFAULT 1 CHECK (contract_step > 0),
    barriers_enabled  BOOLEAN NOT NULL DEFAULT true,
    enabled           BOOLEAN NOT NULL DEFAULT true,
    sort              INT NOT NULL DEFAULT 0,
    notes             TEXT NOT NULL DEFAULT '',
    updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_by        TEXT NOT NULL DEFAULT 'seed'
);

-- Per-calendar bank holidays (USD, EUR, ..., XAU = London + New York, OIL). Weekends are implicit.
-- Seeded from config/holidays/*.json; staff edits set source = 'admin'. Disabling a seeded date keeps the
-- row (active = false) so a later seed does not bring it back.
CREATE TABLE holidays (
    calendar   TEXT NOT NULL,
    day        DATE NOT NULL,
    name       TEXT NOT NULL,
    source     TEXT NOT NULL DEFAULT 'seed' CHECK (source IN ('seed', 'admin')),
    active     BOOLEAN NOT NULL DEFAULT true,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_by TEXT NOT NULL DEFAULT 'seed',
    PRIMARY KEY (calendar, day)
);

-- Interest rates per currency (annual decimal, used as continuously compounded) and metal lease rates.
CREATE TABLE rates (
    ccy        TEXT PRIMARY KEY,
    rate       DOUBLE PRECISION NOT NULL CHECK (rate > -0.2 AND rate < 1),
    kind       TEXT NOT NULL DEFAULT 'policy' CHECK (kind IN ('policy', 'lease', 'market')),
    source     TEXT NOT NULL DEFAULT '',
    as_of      DATE NOT NULL DEFAULT CURRENT_DATE,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_by TEXT NOT NULL DEFAULT 'seed'
);

CREATE TABLE rate_history (
    id         BIGSERIAL PRIMARY KEY,
    ccy        TEXT NOT NULL,
    rate       DOUBLE PRECISION NOT NULL,
    prev_rate  DOUBLE PRECISION,
    as_of      DATE NOT NULL,
    reason     TEXT NOT NULL DEFAULT '',
    changed_by TEXT NOT NULL,
    changed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX rate_history_ccy ON rate_history (ccy, changed_at DESC);

-- Vol surfaces, append-only versions per underlying. pillars = [{tenor, days, atm, rr25, bf25, rr10?, bf10?}]
-- (vols as decimals). blend_weight = share of the surface ATM vs our realized vol (1 = surface only).
CREATE TABLE vol_surfaces (
    id           BIGSERIAL PRIMARY KEY,
    symbol       TEXT NOT NULL REFERENCES underlyings (symbol),
    version      INT NOT NULL,
    blend_weight DOUBLE PRECISION NOT NULL DEFAULT 0.7 CHECK (blend_weight BETWEEN 0 AND 1),
    pillars      JSONB NOT NULL,
    reason       TEXT NOT NULL,
    published_by TEXT NOT NULL,
    published_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (symbol, version)
);

-- Realized vol from market-data candles (latest per estimator/window) plus a daily history.
CREATE TABLE realized_vol (
    symbol      TEXT NOT NULL,
    tf          TEXT NOT NULL,
    estimator   TEXT NOT NULL CHECK (estimator IN ('yang_zhang', 'garman_klass', 'close', 'ewma')),
    window_bars INT NOT NULL,
    value       DOUBLE PRECISION NOT NULL,
    bars        INT NOT NULL,
    computed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (symbol, tf, estimator, window_bars)
);

CREATE TABLE realized_vol_history (
    symbol      TEXT NOT NULL,
    day         DATE NOT NULL,
    estimator   TEXT NOT NULL,
    window_bars INT NOT NULL,
    value       DOUBLE PRECISION NOT NULL,
    PRIMARY KEY (symbol, day, estimator, window_bars)
);

-- Listed expiry dates per underlying. One date can belong to several cycles (kinds). The cut instant is
-- fixed when listed (a later change of the underlying's cut applies to new listings only).
CREATE TABLE expiries (
    id              BIGSERIAL PRIMARY KEY,
    symbol          TEXT NOT NULL REFERENCES underlyings (symbol),
    expiry_date     DATE NOT NULL,
    kinds           TEXT[] NOT NULL,
    cut_at          TIMESTAMPTZ NOT NULL,
    twap_start      TIMESTAMPTZ NOT NULL,
    status          TEXT NOT NULL DEFAULT 'listed' CHECK (status IN ('listed', 'fixing', 'fixed', 'settled', 'cancelled')),
    fixing          DOUBLE PRECISION,
    fixing_source   TEXT CHECK (fixing_source IN ('twap', 'm1', 'manual')),
    fixing_run      INT NOT NULL DEFAULT 0,
    fixing_samples  INT,
    fixing_expected INT,
    fixing_coverage DOUBLE PRECISION,
    fixing_max_gap_ms BIGINT,
    fixed_at        TIMESTAMPTZ,
    fixing_error    TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (symbol, expiry_date)
);
CREATE INDEX expiries_open ON expiries (status, cut_at);

-- Every fixing run (run 1 automatic; re-runs within the window are audited with a reason).
CREATE TABLE fixings (
    id           BIGSERIAL PRIMARY KEY,
    expiry_id    BIGINT NOT NULL REFERENCES expiries (id),
    run          INT NOT NULL,
    price        DOUBLE PRECISION NOT NULL,
    source       TEXT NOT NULL CHECK (source IN ('twap', 'm1', 'manual')),
    samples      INT NOT NULL,
    expected     INT NOT NULL,
    coverage     DOUBLE PRECISION NOT NULL,
    max_gap_ms   BIGINT NOT NULL,
    window_start TIMESTAMPTZ NOT NULL,
    window_end   TIMESTAMPTZ NOT NULL,
    reason       TEXT NOT NULL DEFAULT '',
    created_by   TEXT NOT NULL DEFAULT 'system',
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (expiry_id, run)
);

-- Option series (one strike and type of one expiry). code = SYMBOL-YYYYMMDD-STRIKE-C|P.
CREATE TABLE series (
    code         TEXT PRIMARY KEY,
    symbol       TEXT NOT NULL REFERENCES underlyings (symbol),
    expiry_id    BIGINT NOT NULL REFERENCES expiries (id),
    strike       DOUBLE PRECISION NOT NULL CHECK (strike > 0),
    strike_ticks BIGINT NOT NULL,
    kind         TEXT NOT NULL CHECK (kind IN ('call', 'put')),
    status       TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'expired', 'settled', 'delisted')),
    origin       TEXT NOT NULL DEFAULT 'listing' CHECK (origin IN ('listing', 'extension', 'admin')),
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (expiry_id, strike_ticks, kind)
);
CREATE INDEX series_expiry ON series (expiry_id);

-- 1-second raw mids in the TWAP window before each cut.
CREATE TABLE twap_samples (
    expiry_id BIGINT NOT NULL REFERENCES expiries (id),
    t         TIMESTAMPTZ NOT NULL,
    mid       DOUBLE PRECISION NOT NULL,
    PRIMARY KEY (expiry_id, t)
);

-- Module switch per broker (tenant slug; tenant #1 = 'kalks'). Demo and live are separate switches and both
-- default to OFF. public_chain = the guest chain page / public REST.
CREATE TABLE tenant_settings (
    tenant       TEXT PRIMARY KEY,
    enabled_demo BOOLEAN NOT NULL DEFAULT false,
    enabled_live BOOLEAN NOT NULL DEFAULT false,
    public_chain BOOLEAN NOT NULL DEFAULT false,
    underlyings  TEXT[],
    updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_by   TEXT NOT NULL DEFAULT 'seed'
);

-- Spreads, fees and limits per tenant / trading group / underlying ('*' = any). The most specific row wins:
-- (group, symbol) > (group, *) > (*, symbol) > (*, *).
CREATE TABLE group_settings (
    tenant                  TEXT NOT NULL,
    group_code              TEXT NOT NULL DEFAULT '*',
    symbol                  TEXT NOT NULL DEFAULT '*',
    vol_spread              DOUBLE PRECISION NOT NULL DEFAULT 0.004 CHECK (vol_spread >= 0 AND vol_spread < 0.5),
    min_spread_usd          DOUBLE PRECISION NOT NULL DEFAULT 0.5 CHECK (min_spread_usd >= 0),
    commission_per_contract DOUBLE PRECISION NOT NULL DEFAULT 0.25 CHECK (commission_per_contract >= 0),
    commission_cap_pct      DOUBLE PRECISION NOT NULL DEFAULT 10 CHECK (commission_cap_pct BETWEEN 0 AND 100),
    max_contracts_per_client DOUBLE PRECISION NOT NULL DEFAULT 200 CHECK (max_contracts_per_client >= 0),
    weekend_margin_pct      DOUBLE PRECISION NOT NULL DEFAULT 25 CHECK (weekend_margin_pct BETWEEN 0 AND 500),
    enabled                 BOOLEAN NOT NULL DEFAULT true,
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_by              TEXT NOT NULL DEFAULT 'seed',
    PRIMARY KEY (tenant, group_code, symbol)
);

-- Dealer controls. tenant '*' = every broker (Kalks staff only). scope/target: all/'*', underlying/SYMBOL,
-- expiry/'SYMBOL:YYYY-MM-DD', series/CODE. mode: halt (no trading), close_only, freeze (marks use
-- frozen_spot), manual_vol (ATM vol override).
CREATE TABLE controls (
    id          BIGSERIAL PRIMARY KEY,
    tenant      TEXT NOT NULL DEFAULT '*',
    scope       TEXT NOT NULL CHECK (scope IN ('all', 'underlying', 'expiry', 'series')),
    target      TEXT NOT NULL DEFAULT '*',
    mode        TEXT NOT NULL CHECK (mode IN ('halt', 'close_only', 'freeze', 'manual_vol')),
    manual_vol  DOUBLE PRECISION CHECK (manual_vol IS NULL OR (manual_vol > 0 AND manual_vol < 5)),
    frozen_spot DOUBLE PRECISION CHECK (frozen_spot IS NULL OR frozen_spot > 0),
    reason      TEXT NOT NULL,
    active      BOOLEAN NOT NULL DEFAULT true,
    expires_at  TIMESTAMPTZ,
    created_by  TEXT NOT NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    cleared_by  TEXT,
    cleared_at  TIMESTAMPTZ,
    clear_reason TEXT
);
CREATE INDEX controls_active ON controls (active, tenant);

-- Per-client options limits (gateway user id).
CREATE TABLE client_limits (
    tenant        TEXT NOT NULL,
    user_id       BIGINT NOT NULL,
    max_contracts DOUBLE PRECISION CHECK (max_contracts IS NULL OR max_contracts >= 0),
    max_short_contracts DOUBLE PRECISION CHECK (max_short_contracts IS NULL OR max_short_contracts >= 0),
    close_only    BOOLEAN NOT NULL DEFAULT false,
    blocked       BOOLEAN NOT NULL DEFAULT false,
    reason        TEXT NOT NULL DEFAULT '',
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_by    TEXT NOT NULL,
    PRIMARY KEY (tenant, user_id)
);

-- End-of-day (17:00 New York) model marks per series, for statements and charts.
CREATE TABLE marks_eod (
    day         DATE NOT NULL,
    series_code TEXT NOT NULL,
    spot        DOUBLE PRECISION NOT NULL,
    vol         DOUBLE PRECISION NOT NULL,
    mark        DOUBLE PRECISION NOT NULL,
    mark_usd    DOUBLE PRECISION NOT NULL,
    delta       DOUBLE PRECISION NOT NULL,
    gamma       DOUBLE PRECISION NOT NULL,
    vega        DOUBLE PRECISION NOT NULL,
    theta       DOUBLE PRECISION NOT NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (day, series_code)
);

CREATE TABLE audit_log (
    id     BIGSERIAL PRIMARY KEY,
    tenant TEXT NOT NULL,
    actor  TEXT NOT NULL,
    action TEXT NOT NULL,
    target TEXT NOT NULL DEFAULT '',
    before JSONB,
    after  JSONB,
    reason TEXT NOT NULL DEFAULT '',
    at     TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX audit_log_tenant ON audit_log (tenant, id DESC);
