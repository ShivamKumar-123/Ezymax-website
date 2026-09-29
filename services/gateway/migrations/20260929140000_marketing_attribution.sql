-- Marketing attribution and consent (D144).
--
-- * utm_* / landing_page / first_referrer: first-touch campaign attribution captured by the Client Area on the
--   landing (website -> Client Area register redirect keeps the query string) and stored once at sign-up.
--   Reports read `utm_campaign` (falling back to the IB `referral_campaign`) to group sign-ups and deposits.
-- * marketing_consent: journey and campaign emails only go to clients who allow them. Transactional emails
--   (codes, KYC, wallet, security) never look at it. The unsubscribe link in every marketing email clears it.
ALTER TABLE users
    ADD COLUMN IF NOT EXISTS utm_source                TEXT,
    ADD COLUMN IF NOT EXISTS utm_medium                TEXT,
    ADD COLUMN IF NOT EXISTS utm_campaign              TEXT,
    ADD COLUMN IF NOT EXISTS utm_term                  TEXT,
    ADD COLUMN IF NOT EXISTS utm_content               TEXT,
    ADD COLUMN IF NOT EXISTS landing_page              TEXT,
    ADD COLUMN IF NOT EXISTS first_referrer            TEXT,
    ADD COLUMN IF NOT EXISTS marketing_consent         BOOLEAN NOT NULL DEFAULT true,
    ADD COLUMN IF NOT EXISTS marketing_consent_at      TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS marketing_unsubscribed_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS users_utm_campaign_idx ON users (tenant_id, utm_campaign) WHERE utm_campaign IS NOT NULL;
