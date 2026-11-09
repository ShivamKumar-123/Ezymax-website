-- A deleted bonus campaign stays in the table (grants, promo codes and the audit log point at it) but is hidden
-- from every list and can never run again.
ALTER TABLE bonus_campaigns ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
