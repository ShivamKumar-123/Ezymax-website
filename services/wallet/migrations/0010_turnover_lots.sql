-- Turnover measured in lots (owner, 23 November 2026).
--
-- The requirement shipped measured in notional - lots x contract size x price, summed over closed positions -
-- and leverage makes that a weak gate: a single 0.01-lot gold trade is worth about 3,650 USD of notional, so
-- even the hard maximum of ten times a small deposit was cleared by one click. Of 49 depositors only the three
-- who never placed a trade at all would have been held. Lots cannot be inflated by leverage, so the multiplier
-- moves to "lots per 100 units of deposit" and each requirement records the unit it was raised in, so one
-- already outstanding keeps the meaning it was created with.
ALTER TABLE tenant_settings ADD COLUMN IF NOT EXISTS turnover_unit TEXT NOT NULL DEFAULT 'notional';
ALTER TABLE turnover_requirements ADD COLUMN IF NOT EXISTS unit TEXT NOT NULL DEFAULT 'notional';

DO $$ BEGIN
    ALTER TABLE tenant_settings ADD CONSTRAINT tenant_settings_turnover_unit CHECK (turnover_unit IN ('notional', 'lots'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    ALTER TABLE turnover_requirements ADD CONSTRAINT turnover_requirements_unit CHECK (unit IN ('notional', 'lots'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
