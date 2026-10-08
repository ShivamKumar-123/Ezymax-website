-- Client controls (Back Office): presence, restrictions and staff sessions ("log in as client").
--
-- * users.last_active_at: last activity of the client in person, for Online / Away / Offline. Bumped (at most
--   every 30 s) by the client's own Client Area requests and heartbeat, and by the trading engine's Ezymex Trader
--   connection reports. View-only logins and staff sessions never bump it.
-- * client_presence: live Ezymex Trader connections, reported by the trading engine every 15 s
--   (POST /v1/internal/presence/trader). A connection counts as live while it was reported in the last 60 s.
-- * client_restrictions: per-client restrictions with a reason, an optional expiry and a staff author. One open
--   row per (client, kind); lifting or expiry closes it (lifted_at), so the table is also the history.
--   `freeze` stands for every restriction except sign-in. The owning services enforce them: the gateway
--   (sign-in), the trading engine (trading, close-only, copy / PAMM / MAM, Ezymex Trader sign-in) and the wallet
--   (deposits, withdrawals, wallet <-> trading transfers, IB payouts).
-- * sessions.impersonator_*: a Client Area session a staff member opened as the client (30 min, bound to the
--   staff member's own session). read_only sessions are refused every change like view-only logins.
-- * impersonation_tickets: one-time, 60 s hand-over from the Back Office to the Client Area (HMAC stored).

ALTER TABLE users ADD COLUMN IF NOT EXISTS last_active_at TIMESTAMPTZ;
CREATE INDEX IF NOT EXISTS users_last_active_idx ON users (tenant_id, last_active_at DESC NULLS LAST) WHERE NOT is_house;
-- seed from what is already known
UPDATE users u SET last_active_at = s.at
  FROM (SELECT subject_id, max(last_seen_at) AS at FROM sessions WHERE subject_kind = 'user' AND viewer_id IS NULL GROUP BY subject_id) s
 WHERE s.subject_id = u.id AND u.last_active_at IS NULL;

CREATE TABLE client_presence (
    conn_key     TEXT PRIMARY KEY CHECK (length(conn_key) BETWEEN 1 AND 80),
    tenant_id    BIGINT NOT NULL REFERENCES tenants(id),
    user_id      BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    app          TEXT NOT NULL DEFAULT 'trader' CHECK (app IN ('trader')),
    login        BIGINT,
    ip           TEXT,
    country      TEXT CHECK (country IS NULL OR country ~ '^[a-z]{2}$'),
    user_agent   TEXT,
    since        TIMESTAMPTZ NOT NULL,
    last_active  TIMESTAMPTZ NOT NULL,
    ended_at     TIMESTAMPTZ
);
CREATE INDEX client_presence_user_idx ON client_presence (user_id, last_active DESC);
CREATE INDEX client_presence_live_idx ON client_presence (tenant_id, last_active DESC) WHERE ended_at IS NULL;

CREATE TABLE client_restrictions (
    id           BIGSERIAL PRIMARY KEY,
    tenant_id    BIGINT NOT NULL REFERENCES tenants(id),
    user_id      BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    kind         TEXT NOT NULL CHECK (kind IN ('login', 'trading', 'close_only', 'deposits', 'withdrawals', 'transfers', 'ib', 'social', 'freeze')),
    reason       TEXT NOT NULL CHECK (length(reason) BETWEEN 3 AND 500),
    expires_at   TIMESTAMPTZ,
    created_by   BIGINT REFERENCES staff(id) ON DELETE SET NULL,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    lifted_at    TIMESTAMPTZ,
    lifted_by    BIGINT REFERENCES staff(id) ON DELETE SET NULL,
    lift_reason  TEXT CHECK (lift_reason IS NULL OR length(lift_reason) <= 500)
);
CREATE UNIQUE INDEX client_restrictions_open_idx ON client_restrictions (user_id, kind) WHERE lifted_at IS NULL;
CREATE INDEX client_restrictions_tenant_open_idx ON client_restrictions (tenant_id, user_id) WHERE lifted_at IS NULL;
CREATE INDEX client_restrictions_user_idx ON client_restrictions (user_id, created_at DESC);

ALTER TABLE sessions
    ADD COLUMN impersonator_id          BIGINT REFERENCES staff(id) ON DELETE CASCADE,
    ADD COLUMN impersonator_session_id  BIGINT,
    ADD COLUMN impersonation_mode       TEXT CHECK (impersonation_mode IS NULL OR impersonation_mode IN ('read_only', 'full')),
    ADD COLUMN impersonation_reason     TEXT;
CREATE INDEX sessions_impersonator_idx ON sessions (impersonator_id) WHERE impersonator_id IS NOT NULL AND revoked_at IS NULL;

CREATE TABLE impersonation_tickets (
    token_hash        BYTEA PRIMARY KEY,
    tenant_id         BIGINT NOT NULL REFERENCES tenants(id),
    user_id           BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    staff_id          BIGINT NOT NULL REFERENCES staff(id) ON DELETE CASCADE,
    staff_session_id  BIGINT NOT NULL,
    mode              TEXT NOT NULL CHECK (mode IN ('read_only', 'full')),
    reason            TEXT NOT NULL,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
    expires_at        TIMESTAMPTZ NOT NULL,
    used_at           TIMESTAMPTZ
);

-- staff sessions and presence rows are audited with actor_kind 'staff' / 'system'; nothing new there.

DO $$
DECLARE
    tbl TEXT;
BEGIN
    FOREACH tbl IN ARRAY ARRAY['client_presence', 'client_restrictions', 'impersonation_tickets'] LOOP
        EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', tbl);
        EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', tbl);
        EXECUTE format('CREATE POLICY tenant_isolation ON %I USING (ezymex_tenant_row(tenant_id)) WITH CHECK (ezymex_tenant_row(tenant_id))', tbl);
        IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'ezymex_tenant') THEN
            EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON %I TO ezymex_tenant', tbl);
        END IF;
    END LOOP;
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'ezymex_tenant') THEN
        EXECUTE 'GRANT USAGE, SELECT ON SEQUENCE client_restrictions_id_seq TO ezymex_tenant';
    END IF;
END $$;
