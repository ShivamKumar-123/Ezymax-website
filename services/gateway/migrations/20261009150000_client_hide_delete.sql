-- Back Office client management (client_lifecycle.rs): hide test / spam clients, delete clients.
--
-- * users.hidden_*: an admin-view setting only. A hidden client is left out of the Back Office client list and
--   counts unless staff ask for hidden clients; sign-in, trading and money are not affected. Unhiding clears it.
-- * users.deleted_*: the client was deleted after financial activity (anonymised). The row and its id stay, since
--   the engine, wallet, IB and reports records reference them; personal data is scrubbed, the status is 'closed'
--   and sign-in is impossible.
-- * deleted_users: tombstones of clients purged without any financial activity (their users row is gone). No
--   personal data: the id, the random referral code and the sign-up time, so the internal user feed
--   (/v1/internal/referrals/users) can tell the IB / reports / growth / support mirrors to scrub their copy.

ALTER TABLE users
    ADD COLUMN IF NOT EXISTS hidden_at       TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS hidden_by       BIGINT REFERENCES staff(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS hidden_reason   TEXT CHECK (hidden_reason IS NULL OR length(hidden_reason) BETWEEN 3 AND 500),
    ADD COLUMN IF NOT EXISTS deleted_at      TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS deleted_by      BIGINT REFERENCES staff(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS deleted_reason  TEXT CHECK (deleted_reason IS NULL OR length(deleted_reason) BETWEEN 3 AND 500);
CREATE INDEX IF NOT EXISTS users_hidden_idx ON users (tenant_id) WHERE hidden_at IS NOT NULL OR deleted_at IS NOT NULL;

CREATE TABLE deleted_users (
    id             BIGINT PRIMARY KEY,
    tenant_id      BIGINT NOT NULL REFERENCES tenants(id),
    referral_code  TEXT NOT NULL,
    created_at     TIMESTAMPTZ NOT NULL,
    deleted_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_by     BIGINT REFERENCES staff(id) ON DELETE SET NULL
);
CREATE INDEX deleted_users_changed_idx ON deleted_users (deleted_at, id);

-- tenant isolation, like every tenant-scoped table (20260929180000_tenant_domains_rls.sql)
ALTER TABLE deleted_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE deleted_users FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON deleted_users USING (ezymex_tenant_row(tenant_id)) WITH CHECK (ezymex_tenant_row(tenant_id));
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'ezymex_tenant') THEN
        EXECUTE 'GRANT SELECT, INSERT, UPDATE, DELETE ON deleted_users TO ezymex_tenant';
    END IF;
END $$;
