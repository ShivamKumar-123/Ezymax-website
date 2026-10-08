-- Ezymex FX Options trading contests and options share cards (founder decision O36). Additive only: every existing
-- contest keeps `instrument = 'cfd'` and scores exactly as before. Option deals still earn no loyalty points,
-- cashback or bonus lot-release (O34); they now count, and only count, in contests with `instrument = 'options'`.

-- contests: what is traded, the volume unit `contracts` (options), and the minimum opening premium per trade (USD)
-- below which a trade adds no volume and no trade count (penny options can't farm volume; its P&L still counts).
ALTER TABLE contests ADD COLUMN IF NOT EXISTS instrument TEXT NOT NULL DEFAULT 'cfd';
ALTER TABLE contests DROP CONSTRAINT IF EXISTS contests_instrument_check;
ALTER TABLE contests ADD CONSTRAINT contests_instrument_check CHECK (instrument IN ('cfd', 'options'));
ALTER TABLE contests ADD COLUMN IF NOT EXISTS min_premium NUMERIC CHECK (min_premium IS NULL OR min_premium >= 0);
ALTER TABLE contests DROP CONSTRAINT IF EXISTS contests_scoring_check;
ALTER TABLE contests ADD CONSTRAINT contests_scoring_check CHECK (scoring IN ('return_pct', 'profit', 'lots', 'contracts'));

-- entries: contracts traded (options volume) and the trades left out of the score
ALTER TABLE contest_entries ADD COLUMN IF NOT EXISTS contracts NUMERIC NOT NULL DEFAULT 0;
ALTER TABLE contest_entries ADD COLUMN IF NOT EXISTS self_trades INT NOT NULL DEFAULT 0;
ALTER TABLE contest_entries ADD COLUMN IF NOT EXISTS small_trades INT NOT NULL DEFAULT 0;

-- trades: contracts and opening premium (USD) of an option trade, and why it doesn't count:
--   self_trade  = the opposite side was held / traded by another account of the same client (wash): no P&L, volume or count
--   min_premium = opening premium below the contest minimum: P&L counts (losses can't be hidden), no volume, no trade count
ALTER TABLE contest_trades ADD COLUMN IF NOT EXISTS contracts NUMERIC NOT NULL DEFAULT 0;
ALTER TABLE contest_trades ADD COLUMN IF NOT EXISTS premium NUMERIC;
ALTER TABLE contest_trades ADD COLUMN IF NOT EXISTS excluded TEXT;
ALTER TABLE contest_trades DROP CONSTRAINT IF EXISTS contest_trades_excluded_check;
ALTER TABLE contest_trades ADD CONSTRAINT contest_trades_excluded_check CHECK (excluded IS NULL OR excluded IN ('self_trade', 'min_premium'));

-- anti-cheat: a new flag kind for self-trades between a client's own accounts
ALTER TABLE contest_flags DROP CONSTRAINT IF EXISTS contest_flags_kind_check;
ALTER TABLE contest_flags ADD CONSTRAINT contest_flags_kind_check CHECK (kind IN ('balance_change', 'single_trade', 'short_holds', 'self_trade'));

-- deals: the opening premium (USD) of an option exit and the order-book fill it came from (absent on house-priced
-- deals), for the minimum-premium rule and self-trade detection across a client's accounts
ALTER TABLE deals ADD COLUMN IF NOT EXISTS premium NUMERIC;
ALTER TABLE deals ADD COLUMN IF NOT EXISTS fill_id TEXT;
CREATE INDEX IF NOT EXISTS deals_option_user_idx ON deals (tenant, user_id, symbol) WHERE instrument = 'option';
CREATE INDEX IF NOT EXISTS deals_fill_idx ON deals (fill_id) WHERE fill_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS contest_trades_entry_idx ON contest_trades (entry_id);
