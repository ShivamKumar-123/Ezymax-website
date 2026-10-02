-- Kalks FX Options (founder decision O34): IBs earn per CONTRACT on option deals, from a separate rate per
-- level (USD per contract, round turn, paid on the closing deal). The rate stays 0 until the broker sets it in
-- the Back Office, so options earn nothing by default. CFD per-lot rates are never applied to option deals and
-- option contracts never count as lots (level upgrades, lot statistics): `lots` stays 0 on option rows and the
-- contracts are kept in their own column.

ALTER TABLE levels ADD COLUMN IF NOT EXISTS options_rate NUMERIC NOT NULL DEFAULT 0;   -- USD per option contract

ALTER TABLE deals ADD COLUMN IF NOT EXISTS instrument TEXT NOT NULL DEFAULT 'cfd' CHECK (instrument IN ('cfd', 'option'));
ALTER TABLE deals ADD COLUMN IF NOT EXISTS contracts NUMERIC NOT NULL DEFAULT 0;

ALTER TABLE commissions ADD COLUMN IF NOT EXISTS contracts NUMERIC NOT NULL DEFAULT 0;
