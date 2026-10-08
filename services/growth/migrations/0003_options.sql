-- Ezymex FX Options (founder decision O34): option deals earn no loyalty points, cashback, bonus lot-release
-- or contest results (a dedicated options contest may come later). They are still recorded once (idempotency
-- per deal id) with 0 lots and `instrument = 'option'`, so a later reversal is a no-op and the history shows why.
ALTER TABLE deals ADD COLUMN IF NOT EXISTS instrument TEXT NOT NULL DEFAULT 'cfd' CHECK (instrument IN ('cfd', 'option'));
