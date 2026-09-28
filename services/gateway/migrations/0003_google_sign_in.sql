-- Google sign-in (D27). A client account can be linked to one Google account (OIDC `sub`),
-- unique per tenant. Accounts created through Google get a random, never-disclosed password hash,
-- so password sign-in stays closed until the client sets one with "Forgot password".

ALTER TABLE users ADD COLUMN google_sub TEXT CHECK (google_sub IS NULL OR length(google_sub) BETWEEN 1 AND 255);
ALTER TABLE users ADD COLUMN google_linked_at TIMESTAMPTZ;
ALTER TABLE users ADD COLUMN avatar_url TEXT;
CREATE UNIQUE INDEX users_tenant_google_sub_key ON users (tenant_id, google_sub) WHERE google_sub IS NOT NULL;
