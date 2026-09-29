-- House users (services/algo "House accounts"): the platform-owned owner of a house trading account. Created
-- only by the ALGO service (POST /v1/internal/house-users); never a client. No login: the password hash is
-- not a valid PHC string and the e-mail is on the reserved .invalid domain. Excluded from client lists,
-- client counts and the referral / reports sync.
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_house BOOLEAN NOT NULL DEFAULT false;
CREATE INDEX IF NOT EXISTS users_house_idx ON users (tenant_id) WHERE is_house;
