-- TimescaleDB compression + retention policies for phase-3 audit.
--
-- The init-timescale.sql script that runs on a fresh DB sets retention
-- on `ticks` (30d) and `ohlcv_1m` (1y), but leaves four gaps:
--   1. No compression policy anywhere → uncompressed hypertables grow
--      ~10x larger than they need to. At 500 symbols × ~1 tick/sec ×
--      30 days = ~1.3B rows. With ZSTD column-store compression on
--      old chunks that drops to ~13M-equivalent disk pages.
--   2. ohlcv_5m / 15m / 1h / 4h / 1d / 1w have no retention policy.
--      They grow indefinitely (1w bars at 500 symbols = 26k rows/year
--      — small, but no GC means it's not bounded).
--   3. Continuous aggregates (ohlcv_5m_agg, ohlcv_1h_agg) similarly
--      have no retention.
--   4. Compression-segmentby is missing — without it, ZSTD doesn't
--      group-by-symbol and compression ratios are far worse.
--
-- Apply once on the TimescaleDB instance:
--   docker exec -i fxartha-timescaledb-1 psql -U fxartha -d fxartha_timeseries \
--     < backend/infra/docker/migrations-manual/008_timescale_compression_retention.sql
--
-- Idempotent: every ALTER and add_*_policy is guarded so re-running is safe.
-- Existing init-timescale.sql is also updated for fresh installs.

-- ──────────────────────────────────────────────────────────────────
-- 1. Enable compression on each hypertable, segmented by symbol so
--    queries that filter on (symbol, time-range) decompress only the
--    chunks for that symbol.
-- ──────────────────────────────────────────────────────────────────

DO $$
BEGIN
    BEGIN
        ALTER TABLE ticks SET (
            timescaledb.compress,
            timescaledb.compress_segmentby = 'symbol',
            timescaledb.compress_orderby = 'time DESC'
        );
    EXCEPTION WHEN OTHERS THEN
        -- Already configured — Timescale raises if compress is on twice.
        RAISE NOTICE 'ticks: compress already configured';
    END;

    BEGIN
        ALTER TABLE ohlcv_1m SET (
            timescaledb.compress,
            timescaledb.compress_segmentby = 'symbol',
            timescaledb.compress_orderby = 'time DESC'
        );
    EXCEPTION WHEN OTHERS THEN
        RAISE NOTICE 'ohlcv_1m: compress already configured';
    END;

    BEGIN
        ALTER TABLE ohlcv_5m SET (
            timescaledb.compress,
            timescaledb.compress_segmentby = 'symbol',
            timescaledb.compress_orderby = 'time DESC'
        );
    EXCEPTION WHEN OTHERS THEN
        RAISE NOTICE 'ohlcv_5m: compress already configured';
    END;

    BEGIN
        ALTER TABLE ohlcv_15m SET (
            timescaledb.compress,
            timescaledb.compress_segmentby = 'symbol',
            timescaledb.compress_orderby = 'time DESC'
        );
    EXCEPTION WHEN OTHERS THEN
        RAISE NOTICE 'ohlcv_15m: compress already configured';
    END;

    BEGIN
        ALTER TABLE ohlcv_1h SET (
            timescaledb.compress,
            timescaledb.compress_segmentby = 'symbol',
            timescaledb.compress_orderby = 'time DESC'
        );
    EXCEPTION WHEN OTHERS THEN
        RAISE NOTICE 'ohlcv_1h: compress already configured';
    END;

    BEGIN
        ALTER TABLE ohlcv_4h SET (
            timescaledb.compress,
            timescaledb.compress_segmentby = 'symbol',
            timescaledb.compress_orderby = 'time DESC'
        );
    EXCEPTION WHEN OTHERS THEN
        RAISE NOTICE 'ohlcv_4h: compress already configured';
    END;

    BEGIN
        ALTER TABLE ohlcv_1d SET (
            timescaledb.compress,
            timescaledb.compress_segmentby = 'symbol',
            timescaledb.compress_orderby = 'time DESC'
        );
    EXCEPTION WHEN OTHERS THEN
        RAISE NOTICE 'ohlcv_1d: compress already configured';
    END;

    BEGIN
        ALTER TABLE ohlcv_1w SET (
            timescaledb.compress,
            timescaledb.compress_segmentby = 'symbol',
            timescaledb.compress_orderby = 'time DESC'
        );
    EXCEPTION WHEN OTHERS THEN
        RAISE NOTICE 'ohlcv_1w: compress already configured';
    END;
END $$;

-- ──────────────────────────────────────────────────────────────────
-- 2. Compression policies — chunks older than the listed window get
--    automatically column-compressed. Pick the window so live writes
--    (which can't be compressed) are never blocked: ~7d covers any
--    realistic late-arriving tick correction.
-- ──────────────────────────────────────────────────────────────────

SELECT add_compression_policy('ticks',     INTERVAL '7 days',  if_not_exists => TRUE);
SELECT add_compression_policy('ohlcv_1m',  INTERVAL '7 days',  if_not_exists => TRUE);
SELECT add_compression_policy('ohlcv_5m',  INTERVAL '14 days', if_not_exists => TRUE);
SELECT add_compression_policy('ohlcv_15m', INTERVAL '14 days', if_not_exists => TRUE);
SELECT add_compression_policy('ohlcv_1h',  INTERVAL '30 days', if_not_exists => TRUE);
SELECT add_compression_policy('ohlcv_4h',  INTERVAL '60 days', if_not_exists => TRUE);
SELECT add_compression_policy('ohlcv_1d',  INTERVAL '90 days', if_not_exists => TRUE);
SELECT add_compression_policy('ohlcv_1w',  INTERVAL '180 days', if_not_exists => TRUE);

-- ──────────────────────────────────────────────────────────────────
-- 3. Retention policies for the OHLCV tables that init-timescale.sql
--    left out. Time horizon matches what charts typically need: the
--    finer the bar, the shorter the history (intraday charts rarely
--    scroll back a year, daily/weekly charts often go years).
-- ──────────────────────────────────────────────────────────────────

SELECT add_retention_policy('ohlcv_5m',  INTERVAL '2 years',  if_not_exists => TRUE);
SELECT add_retention_policy('ohlcv_15m', INTERVAL '3 years',  if_not_exists => TRUE);
SELECT add_retention_policy('ohlcv_1h',  INTERVAL '5 years',  if_not_exists => TRUE);
SELECT add_retention_policy('ohlcv_4h',  INTERVAL '10 years', if_not_exists => TRUE);
-- ohlcv_1d and ohlcv_1w intentionally have no retention — daily/weekly
-- bars across 10+ years of forex history are tiny and frequently used
-- for back-testing.

-- ──────────────────────────────────────────────────────────────────
-- 4. Inspect what's now configured. Output goes to the operator's
--    psql session — not used by the platform.
-- ──────────────────────────────────────────────────────────────────

SELECT hypertable_name, compression_enabled
FROM timescaledb_information.hypertables
ORDER BY hypertable_name;

SELECT j.hypertable_name, j.config->>'compress_after' AS compress_after
FROM timescaledb_information.jobs j
WHERE j.proc_name = 'policy_compression'
ORDER BY j.hypertable_name;

SELECT j.hypertable_name, j.config->>'drop_after' AS retention
FROM timescaledb_information.jobs j
WHERE j.proc_name = 'policy_retention'
ORDER BY j.hypertable_name;
