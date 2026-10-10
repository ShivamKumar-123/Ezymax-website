-- Referral privacy (owner, 2026-10-10).
--
-- 1. Referral codes no longer carry the client's name (gateway migration 20261010120000): every client got an
--    `EZ…` code and the old one (first name + digits) moved to the gateway's `referral_code_legacy`, which the
--    referral feed now sends. Links already shared keep working, so link clicks resolve either code.
-- 2. Partners see referred clients masked (initials, client id, country, dates and totals; no names, emails or
--    trades): `clientVisibility` defaults to `masked`, and brokers still on `full` are switched once. The Back Office
--    setting (Partners → Settings) can switch it back.

ALTER TABLE members ADD COLUMN IF NOT EXISTS referral_code_legacy TEXT;
CREATE INDEX IF NOT EXISTS members_code_legacy_idx ON members (tenant, referral_code_legacy) WHERE referral_code_legacy IS NOT NULL;

INSERT INTO audit_log (tenant, actor, actor_name, action, target, before, after, note)
SELECT tenant, 'system', 'IB service', 'settings.update', 'settings', jsonb_build_object('clientVisibility', data->>'clientVisibility'),
       jsonb_build_object('clientVisibility', 'masked'), 'Referred clients are shown masked to partners by default (owner decision, 2026-10-10).'
  FROM settings WHERE COALESCE(data->>'clientVisibility', 'full') <> 'masked';
UPDATE settings SET data = jsonb_set(data, '{clientVisibility}', '"masked"'), version = version + 1, updated_at = now(), updated_by = 'system'
 WHERE COALESCE(data->>'clientVisibility', 'full') <> 'masked';
