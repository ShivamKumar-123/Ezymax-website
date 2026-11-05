-- The automatic first-deposit grant (0007) writes `source = 'auto'`, but the check constraint from 0001 still
-- lists only the four hand-made sources, so every automatic grant failed at the INSERT and the worker retried
-- the same deposit every pass; the client who had deposited and verified saw no bonus. Widen the list.
ALTER TABLE bonus_grants DROP CONSTRAINT IF EXISTS bonus_grants_source_check;
ALTER TABLE bonus_grants ADD CONSTRAINT bonus_grants_source_check CHECK (source IN ('claim', 'promo', 'redemption', 'admin', 'auto'));
