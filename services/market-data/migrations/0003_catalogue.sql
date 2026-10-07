-- Instrument catalogue (1,000+ provider symbols): the instruments table mirrors config/instruments.json, now with
-- the catalogue rows' tier, name, currencies, exchange and session (informational; the file is the source).
ALTER TABLE instruments ADD COLUMN IF NOT EXISTS tier TEXT NOT NULL DEFAULT 'core';
ALTER TABLE instruments ADD COLUMN IF NOT EXISTS name TEXT;
ALTER TABLE instruments ADD COLUMN IF NOT EXISTS base_ccy TEXT;
ALTER TABLE instruments ADD COLUMN IF NOT EXISTS quote_ccy TEXT;
ALTER TABLE instruments ADD COLUMN IF NOT EXISTS exchange TEXT;
ALTER TABLE instruments ADD COLUMN IF NOT EXISTS session TEXT;
