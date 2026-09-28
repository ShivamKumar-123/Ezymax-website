-- IB programme (services/ib): the partner campaign a client signed up through (?ref=CODE&c=CAMPAIGN).
-- Set once at sign-up together with referred_by; the IB service reads it through /v1/internal/referrals/users.
-- Versioned by timestamp so it never collides with sequential migrations added in parallel.
ALTER TABLE users ADD COLUMN IF NOT EXISTS referral_campaign TEXT;
CREATE INDEX IF NOT EXISTS users_changed_idx ON users (tenant_id, updated_at, id);
