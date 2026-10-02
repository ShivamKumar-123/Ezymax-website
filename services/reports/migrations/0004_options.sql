-- Kalks FX Options: the engine deal's `option` object (series, underlying, right, strike, expiry, cash = premium
-- or settlement cash booked by the deal, fixing, commissionCharged, …). NULL on CFD deals. Option deals carry
-- contracts in `volume` (never lots) and premiums per unit in the prices; statements show them in their own
-- Options section and broker reports count their commission on every trade (open and close).
ALTER TABLE deals ADD COLUMN IF NOT EXISTS option JSONB;
CREATE INDEX IF NOT EXISTS deals_option_time ON deals (tenant, time) WHERE option IS NOT NULL;
