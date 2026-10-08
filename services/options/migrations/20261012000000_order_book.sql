-- Ezymex FX Options order book (docs/OPTIONS-EXCHANGE.md, decision O49): the options-service side.
-- * Per-underlying order-book parameters (§2, §5, §6, §8): price tick, market / limit bands, liquidation band and
--   backstop fee, RFQ quote lifetime, mark clamp rules. minContracts / contractStep / maxContracts already exist.
-- * Group maker / taker fees per contract (§7).
-- * The Ezymex market maker's quoting parameters (§4), delivered to the engine in the snapshot as `mm[]`.
-- Everything here is published in the versioned engine snapshot (every write bumps meta.version).

-- ---------------------------------------------------------------- underlyings (§2, §5, §6, §8)
ALTER TABLE underlyings
    -- premium tick in the quote currency per unit (filled below / by the trigger: FX pip / 10, XAU 0.01, else 0.001)
    ADD COLUMN premium_tick         DOUBLE PRECISION,
    -- market orders become an IOC limit at mark x (1 +/- this %), at least bandMinTicks away
    ADD COLUMN market_band_pct      DOUBLE PRECISION NOT NULL DEFAULT 10 CHECK (market_band_pct > 0 AND market_band_pct <= 100),
    -- an aggressive limit must be within mark x (1 +/- this %) + bandMinTicks
    ADD COLUMN limit_band_pct       DOUBLE PRECISION NOT NULL DEFAULT 50 CHECK (limit_band_pct > 0 AND limit_band_pct <= 100),
    ADD COLUMN band_min_ticks       INT NOT NULL DEFAULT 5 CHECK (band_min_ticks >= 0 AND band_min_ticks <= 100000),
    -- liquidation: reduce-only IOC at mark x (1 -/+ liqBandPct %); backstop at mark -/+ max(liqFeePct % x mark, 1 tick)
    ADD COLUMN liq_band_pct         DOUBLE PRECISION NOT NULL DEFAULT 5 CHECK (liq_band_pct >= 0 AND liq_band_pct <= 50),
    ADD COLUMN liq_fee_pct          DOUBLE PRECISION NOT NULL DEFAULT 2 CHECK (liq_fee_pct >= 0 AND liq_fee_pct <= 50),
    -- combo RFQ: an MM quote stays firm this long
    ADD COLUMN rfq_quote_ttl_secs   INT NOT NULL DEFAULT 5 CHECK (rfq_quote_ttl_secs BETWEEN 1 AND 60),
    -- mark = model mid clamped inside the book when both sides hold at least markMinQty contracts and the book spread
    -- is at most markMaxSpreadMult x the model spread (one side only: max(model, bid) / min(model, ask))
    ADD COLUMN mark_min_qty         DOUBLE PRECISION NOT NULL DEFAULT 1 CHECK (mark_min_qty >= 0),
    ADD COLUMN mark_max_spread_mult DOUBLE PRECISION NOT NULL DEFAULT 3 CHECK (mark_max_spread_mult >= 1 AND mark_max_spread_mult <= 100);

-- §2 default tick: FX pip / 10 (EURUSD 0.00001 = $0.10 per 10,000 contract, USDJPY 0.001), XAU 0.01, other metals
-- and oil 0.001.
CREATE FUNCTION default_premium_tick(asset_class TEXT, symbol TEXT, pip_size DOUBLE PRECISION) RETURNS DOUBLE PRECISION
    LANGUAGE sql IMMUTABLE AS $$
    SELECT CASE
        WHEN asset_class = 'forex' THEN round((pip_size / 10)::numeric, 10)::double precision
        WHEN symbol LIKE 'XAU%' THEN 0.01
        ELSE 0.001
    END
$$;

UPDATE underlyings SET premium_tick = default_premium_tick(asset_class, symbol, pip_size) WHERE premium_tick IS NULL;

-- New rows (the seed, future underlyings) get the default tick unless one is given.
CREATE FUNCTION underlyings_premium_tick() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
    IF NEW.premium_tick IS NULL THEN
        NEW.premium_tick := default_premium_tick(NEW.asset_class, NEW.symbol, NEW.pip_size);
    END IF;
    RETURN NEW;
END
$$;
CREATE TRIGGER underlyings_premium_tick BEFORE INSERT ON underlyings FOR EACH ROW EXECUTE FUNCTION underlyings_premium_tick();

ALTER TABLE underlyings ALTER COLUMN premium_tick SET NOT NULL;
ALTER TABLE underlyings ADD CONSTRAINT underlyings_premium_tick_check CHECK (premium_tick > 0 AND premium_tick < 1000);

-- ---------------------------------------------------------------- group fees (§7)
-- USD per contract. maker < 0 = a rebate paid to the resting side; taker >= 0. Both capped at commission_cap_pct % of
-- the premium: fee = sign x min(|rate| x qty, cap % x premium). NULL = this row's commission_per_contract on both sides
-- (the engine's fallback, today's economics). Admin validation: over a broker's rows, min(taker) >= max(|maker rebate|).
ALTER TABLE group_settings
    ADD COLUMN maker_fee_per_contract DOUBLE PRECISION CHECK (maker_fee_per_contract IS NULL OR (maker_fee_per_contract >= -1000 AND maker_fee_per_contract <= 1000)),
    ADD COLUMN taker_fee_per_contract DOUBLE PRECISION CHECK (taker_fee_per_contract IS NULL OR (taker_fee_per_contract >= 0 AND taker_fee_per_contract <= 1000));

-- The platform default row: a 0.05 USD maker rebate and a 0.25 USD taker fee per contract.
UPDATE group_settings SET maker_fee_per_contract = -0.05, taker_fee_per_contract = 0.25
 WHERE tenant = 'ezymex' AND group_code = '*' AND symbol = '*' AND maker_fee_per_contract IS NULL AND taker_fee_per_contract IS NULL;

-- ---------------------------------------------------------------- Ezymex market maker (§4)
-- Quoting parameters per (tenant or '*', account kind live / demo / '*', underlying or '*'). The most specific row
-- wins: tenant > kind > underlying (tenant + kind + underlying first, '*, *, *' last). Spreads are decimal vols each
-- side of the smile vol per tenor bucket (0DTE, <= 7 days, <= 30 days, longer). Limits withdraw a side: net delta in
-- delta-weighted contracts, gamma = contract-delta change per 1 % spot move, vega USD per vol point.
CREATE TABLE mm_settings (
    tenant                   TEXT NOT NULL DEFAULT '*',
    kind                     TEXT NOT NULL DEFAULT '*' CHECK (kind IN ('*', 'live', 'demo')),
    underlying               TEXT NOT NULL DEFAULT '*',
    enabled                  BOOLEAN NOT NULL DEFAULT true,
    spread_vol_0dte          DOUBLE PRECISION NOT NULL DEFAULT 0.008 CHECK (spread_vol_0dte >= 0 AND spread_vol_0dte <= 0.2),
    spread_vol_7d            DOUBLE PRECISION NOT NULL DEFAULT 0.005 CHECK (spread_vol_7d >= 0 AND spread_vol_7d <= 0.2),
    spread_vol_30d           DOUBLE PRECISION NOT NULL DEFAULT 0.004 CHECK (spread_vol_30d >= 0 AND spread_vol_30d <= 0.2),
    spread_vol_long          DOUBLE PRECISION NOT NULL DEFAULT 0.0035 CHECK (spread_vol_long >= 0 AND spread_vol_long <= 0.2),
    min_spread_ticks         INT NOT NULL DEFAULT 2 CHECK (min_spread_ticks BETWEEN 1 AND 100000),
    skew_vol                 DOUBLE PRECISION NOT NULL DEFAULT 0.002 CHECK (skew_vol >= 0 AND skew_vol <= 0.2),
    skew_ticks_per_contract  DOUBLE PRECISION NOT NULL DEFAULT 0.05 CHECK (skew_ticks_per_contract >= 0 AND skew_ticks_per_contract <= 1000),
    base_size                DOUBLE PRECISION NOT NULL DEFAULT 10 CHECK (base_size >= 1 AND base_size <= 1000000),
    max_net_delta            DOUBLE PRECISION NOT NULL DEFAULT 500 CHECK (max_net_delta > 0),
    max_gamma                DOUBLE PRECISION NOT NULL DEFAULT 150 CHECK (max_gamma > 0),
    max_vega                 DOUBLE PRECISION NOT NULL DEFAULT 25000 CHECK (max_vega > 0),
    max_contracts_per_series DOUBLE PRECISION NOT NULL DEFAULT 2000 CHECK (max_contracts_per_series > 0),
    updated_at               TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_by               TEXT NOT NULL DEFAULT 'seed',
    PRIMARY KEY (tenant, kind, underlying)
);
INSERT INTO mm_settings (tenant, kind, underlying) VALUES ('*', '*', '*');

UPDATE meta SET value = value + 1 WHERE key = 'version';
