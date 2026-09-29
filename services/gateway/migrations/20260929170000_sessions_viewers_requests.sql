-- Client Area security (D32, D90, D93, D94).
--
-- * sessions.viewer_id: a session opened with a view-only login (D90). It belongs to the owning client
--   (subject_kind 'user', subject_id = owner) but the gateway refuses every change made with it.
-- * sessions.country: approximate location (ISO country from the edge, e.g. Cloudflare CF-IPCountry).
-- * tenants.client_idle_minutes: Client Area sessions end after this long without activity (admin setting).
-- * client_viewers: view-only logins a client creates for accountants, investors or mentors. Only the argon2id
--   hash of the password is stored; the password is shown to the client once.
-- * client_requests: self-service account closure and personal-data export requests, processed by staff.

ALTER TABLE sessions ADD COLUMN viewer_id BIGINT;
ALTER TABLE sessions ADD COLUMN country TEXT CHECK (country IS NULL OR country ~ '^[a-z]{2}$');
CREATE INDEX sessions_viewer_idx ON sessions (viewer_id) WHERE viewer_id IS NOT NULL AND revoked_at IS NULL;

ALTER TABLE tenants ADD COLUMN client_idle_minutes INT NOT NULL DEFAULT 1440
    CHECK (client_idle_minutes BETWEEN 5 AND 10080);

-- viewer activity is audited with actor_kind 'viewer' (actor_id = viewer id, target = the owning client)
ALTER TABLE audit_log DROP CONSTRAINT audit_log_actor_kind_check;
ALTER TABLE audit_log ADD CONSTRAINT audit_log_actor_kind_check
    CHECK (actor_kind IN ('user', 'staff', 'system', 'anonymous', 'viewer'));

CREATE TABLE client_viewers (
    id             BIGSERIAL PRIMARY KEY,
    tenant_id      BIGINT NOT NULL REFERENCES tenants(id),
    user_id        BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    label          TEXT NOT NULL CHECK (length(label) BETWEEN 1 AND 60),
    username       TEXT NOT NULL CHECK (username ~ '^[a-z0-9][a-z0-9._-]{3,31}$'),
    password_hash  TEXT NOT NULL,
    -- trading account logins the viewer may see
    accounts       TEXT[] NOT NULL DEFAULT '{}',
    -- Client Area sections: dashboard, accounts, history, wallet, partner
    sections       TEXT[] NOT NULL DEFAULT '{}',
    expires_at     TIMESTAMPTZ,
    revoked_at     TIMESTAMPTZ,
    failed_logins  INT NOT NULL DEFAULT 0,
    locked_until   TIMESTAMPTZ,
    last_login_at  TIMESTAMPTZ,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (tenant_id, username)
);
CREATE INDEX client_viewers_user_idx ON client_viewers (user_id);

CREATE TABLE client_requests (
    id            BIGSERIAL PRIMARY KEY,
    tenant_id     BIGINT NOT NULL REFERENCES tenants(id),
    user_id       BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    kind          TEXT NOT NULL CHECK (kind IN ('closure', 'data_export')),
    status        TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'completed', 'rejected', 'cancelled')),
    reason        TEXT CHECK (reason IS NULL OR length(reason) <= 1000),
    staff_note    TEXT CHECK (staff_note IS NULL OR length(staff_note) <= 1000),
    handled_by    BIGINT REFERENCES staff(id) ON DELETE SET NULL,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    closed_at     TIMESTAMPTZ
);
-- one pending request of each kind per client
CREATE UNIQUE INDEX client_requests_pending_idx ON client_requests (user_id, kind) WHERE status IN ('open', 'in_progress');
CREATE INDEX client_requests_tenant_idx ON client_requests (tenant_id, status, created_at DESC);
