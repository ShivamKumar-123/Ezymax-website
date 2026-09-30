-- Phones of revoked sessions stop receiving pushes (src/push_revoke.rs).
--
-- * sessions.device_ref: the session's app installation, as the support service can match it against the
--   installation id a phone registered its push token with: hex SHA-256 of 'kalks-push-device:' || the
--   X-Kalks-Device id. The id itself is never stored (devices are recognised by a keyed hash, trusted_devices).
-- * push_revocations: outbox of revocations for the support service (POST /v1/push/tokens/revoke), written by the
--   request that revoked the sessions and delivered in the background with retries.
ALTER TABLE sessions ADD COLUMN device_ref TEXT CHECK (device_ref IS NULL OR device_ref ~ '^[0-9a-f]{64}$');

CREATE TABLE push_revocations (
    id               BIGSERIAL PRIMARY KEY,
    tenant_id        BIGINT NOT NULL REFERENCES tenants(id),
    user_id          BIGINT,                              -- NULL: every client of the tenant (a suspended broker)
    devices          TEXT[] NOT NULL DEFAULT '{}',        -- device_refs of the phones whose sessions ended
    all_devices      BOOLEAN NOT NULL DEFAULT FALSE,      -- every phone of the client (signed out everywhere)
    revoked_at       TIMESTAMPTZ NOT NULL DEFAULT now(),  -- registrations made before this go
    attempts         INT NOT NULL DEFAULT 0,
    next_attempt_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    last_error       TEXT,
    delivered_at     TIMESTAMPTZ,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
    CHECK (all_devices OR (user_id IS NOT NULL AND cardinality(devices) > 0))
);
CREATE INDEX push_revocations_due_idx ON push_revocations (next_attempt_at) WHERE delivered_at IS NULL;

-- tenant isolation like every tenant table (tenant_domains_rls migration)
ALTER TABLE push_revocations ENABLE ROW LEVEL SECURITY;
ALTER TABLE push_revocations FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON push_revocations USING (kalks_tenant_row(tenant_id)) WITH CHECK (kalks_tenant_row(tenant_id));
