-- candles_recent (symbol, tf, t DESC) duplicates the primary key (symbol, tf, t): a btree is read backwards just
-- as fast, so newest-first candle reads keep using the key. Dropping it halves index writes on every 1 s upsert
-- of forming bars (and frees its disk, ~120 MB in production).
DROP INDEX IF EXISTS candles_recent;
