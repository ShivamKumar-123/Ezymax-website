-- UTM attribution (D144): the gateway users feed carries the first-touch utm_* the client signed up with.
-- `campaign` = utm_campaign, falling back to the IB partner campaign (?ref=CODE&c=CAMPAIGN).
ALTER TABLE clients ADD COLUMN IF NOT EXISTS utm_source TEXT;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS utm_medium TEXT;
CREATE INDEX IF NOT EXISTS clients_campaign ON clients (tenant, campaign);
