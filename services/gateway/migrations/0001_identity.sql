-- Kalks identity core: tenants, client users, staff, sessions, email OTPs, trusted devices, audit log.
-- Every row carries tenant_id (white-label multi-tenant; tenant #1 = Kalks).

CREATE TABLE tenants (
    id          BIGSERIAL PRIMARY KEY,
    slug        TEXT NOT NULL UNIQUE,
    name        TEXT NOT NULL,
    status      TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'suspended')),
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Client Area users (traders, partners). Email is the login id, unique per tenant.
CREATE TABLE users (
    id                 BIGSERIAL PRIMARY KEY,
    tenant_id          BIGINT NOT NULL REFERENCES tenants(id),
    email              TEXT NOT NULL CHECK (email = lower(email)),
    password_hash      TEXT NOT NULL,
    first_name         TEXT NOT NULL,
    last_name          TEXT NOT NULL,
    phone_dial         TEXT NOT NULL,
    phone              TEXT NOT NULL,
    country            CHAR(2) NOT NULL,
    date_of_birth      DATE NOT NULL,
    referral_code      TEXT NOT NULL,
    referred_by        BIGINT REFERENCES users(id) ON DELETE SET NULL,
    referred_code_raw  TEXT,
    kyc_status         TEXT NOT NULL DEFAULT 'unverified'
                       CHECK (kyc_status IN ('unverified', 'pending', 'verified', 'rejected')),
    status             TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'blocked', 'closed')),
    email_verified_at  TIMESTAMPTZ,
    terms_accepted_at  TIMESTAMPTZ NOT NULL,
    failed_logins      INT NOT NULL DEFAULT 0,
    locked_until       TIMESTAMPTZ,
    last_login_at      TIMESTAMPTZ,
    created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (tenant_id, email),
    UNIQUE (tenant_id, referral_code)
);

-- Back Office staff. Hierarchy: platform_owner > super_admin (tenant) > RBAC staff roles.
CREATE TABLE staff (
    id             BIGSERIAL PRIMARY KEY,
    tenant_id      BIGINT NOT NULL REFERENCES tenants(id),
    email          TEXT NOT NULL CHECK (email = lower(email)),
    password_hash  TEXT NOT NULL,
    name           TEXT NOT NULL,
    role           TEXT NOT NULL CHECK (role IN (
                       'platform_owner', 'super_admin', 'admin', 'dealer', 'risk_manager',
                       'compliance', 'finance', 'support', 'marketing', 'partner_manager', 'viewer')),
    status         TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'disabled')),
    failed_logins  INT NOT NULL DEFAULT 0,
    locked_until   TIMESTAMPTZ,
    last_login_at  TIMESTAMPTZ,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (tenant_id, email)
);

-- Opaque session tokens; only HMAC-SHA256(token) is stored.
CREATE TABLE sessions (
    id            BIGSERIAL PRIMARY KEY,
    tenant_id     BIGINT NOT NULL REFERENCES tenants(id),
    subject_kind  TEXT NOT NULL CHECK (subject_kind IN ('user', 'staff')),
    subject_id    BIGINT NOT NULL,
    token_hash    BYTEA NOT NULL UNIQUE,
    ip            TEXT,
    user_agent    TEXT,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    last_seen_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    expires_at    TIMESTAMPTZ NOT NULL,
    revoked_at    TIMESTAMPTZ
);
CREATE INDEX sessions_subject_idx ON sessions (subject_kind, subject_id) WHERE revoked_at IS NULL;

-- Email one-time codes (register / new-device login / password reset). id is the opaque challenge id.
CREATE TABLE email_otps (
    id            TEXT PRIMARY KEY,
    tenant_id     BIGINT NOT NULL REFERENCES tenants(id),
    subject_kind  TEXT NOT NULL CHECK (subject_kind IN ('user', 'staff')),
    subject_id    BIGINT NOT NULL,
    purpose       TEXT NOT NULL CHECK (purpose IN ('verify_email', 'login', 'reset_password')),
    code_hash     BYTEA NOT NULL,
    device_hash   BYTEA,
    attempts      INT NOT NULL DEFAULT 0,
    sent_count    INT NOT NULL DEFAULT 1,
    last_sent_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    expires_at    TIMESTAMPTZ NOT NULL,
    consumed_at   TIMESTAMPTZ,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX email_otps_subject_idx ON email_otps (subject_kind, subject_id);

-- Devices that passed an email OTP; a login from any other device needs a fresh code.
CREATE TABLE trusted_devices (
    tenant_id     BIGINT NOT NULL REFERENCES tenants(id),
    subject_kind  TEXT NOT NULL CHECK (subject_kind IN ('user', 'staff')),
    subject_id    BIGINT NOT NULL,
    device_hash   BYTEA NOT NULL,
    user_agent    TEXT,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    last_seen_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (subject_kind, subject_id, device_hash)
);

-- Append-only audit trail. UPDATE / DELETE / TRUNCATE are rejected by trigger.
CREATE TABLE audit_log (
    id           BIGSERIAL PRIMARY KEY,
    tenant_id    BIGINT NOT NULL REFERENCES tenants(id),
    actor_kind   TEXT NOT NULL CHECK (actor_kind IN ('user', 'staff', 'system', 'anonymous')),
    actor_id     BIGINT,
    action       TEXT NOT NULL,
    target_kind  TEXT,
    target_id    BIGINT,
    ip           TEXT,
    user_agent   TEXT,
    meta         JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX audit_log_tenant_time_idx ON audit_log (tenant_id, created_at DESC);
CREATE INDEX audit_log_actor_idx ON audit_log (actor_kind, actor_id);

CREATE FUNCTION audit_log_immutable() RETURNS trigger AS $$
BEGIN
    RAISE EXCEPTION 'audit_log is append-only';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER audit_log_no_update BEFORE UPDATE OR DELETE ON audit_log
    FOR EACH ROW EXECUTE FUNCTION audit_log_immutable();
CREATE TRIGGER audit_log_no_truncate BEFORE TRUNCATE ON audit_log
    FOR EACH STATEMENT EXECUTE FUNCTION audit_log_immutable();

INSERT INTO tenants (slug, name) VALUES ('kalks', 'Kalks Markets');
