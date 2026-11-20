-- Direct referrals as a PDF (owner, 2026-11-20).
--
-- A partner whose broker shows referred clients in full can download their direct referrals with name, email and
-- phone. The referral feed now carries each client's phone number (gateway internal.rs); this column keeps it.
-- Dropping the feed cursor makes the next poll walk every client once more, so clients mirrored before today get
-- their number too - the upsert is idempotent, and nothing but `phone` changes for them.
ALTER TABLE members ADD COLUMN IF NOT EXISTS phone TEXT NOT NULL DEFAULT '';
DELETE FROM cursors WHERE name = 'gateway_users';
