-- KYC (D6, D28, D88, D89, D92): manual review by compliance staff, with automatic pre-checks.
--
-- A client has at most one open case (draft / submitted / in_review / more_info). Decisions set
-- users.kyc_status, which other services read: withdrawals need users.kyc_status = 'verified'.
--   draft                   -> users.kyc_status unchanged
--   submitted / in_review   -> 'pending'
--   more_info               -> 'pending' (the client must upload the requested documents)
--   approved                -> 'verified' (+ users.identity_locked_at: name and date of birth are locked)
--   rejected                -> 'rejected'
--
-- Document files never live in the database or a web root: they are AES-256-GCM encrypted on the gateway's
-- disk (KYC_STORAGE_DIR) and only `file_ref` (a random name) is stored here. Staff read them through an
-- authenticated streaming endpoint.

CREATE TABLE kyc_cases (
    id                  BIGSERIAL PRIMARY KEY,
    tenant_id           BIGINT NOT NULL REFERENCES tenants(id),
    user_id             BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    kind                TEXT NOT NULL CHECK (kind IN ('individual', 'corporate')),
    status              TEXT NOT NULL DEFAULT 'draft'
                        CHECK (status IN ('draft', 'submitted', 'in_review', 'more_info', 'approved', 'rejected')),
    -- verification level reached: 0 none, 2 identity verified (level 1 = contact verified lives on users)
    level               INT NOT NULL DEFAULT 0 CHECK (level BETWEEN 0 AND 3),
    id_doc_type         TEXT CHECK (id_doc_type IS NULL OR id_doc_type IN ('passport', 'national_id', 'driving_licence')),
    -- client-entered details: residential address; corporate: company + directors / UBOs
    details             JSONB NOT NULL DEFAULT '{}'::jsonb,
    -- open "more information" request: [{kind, side, party}] the client must upload again
    requested           JSONB NOT NULL DEFAULT '[]'::jsonb,
    request_message     TEXT,
    decision_code       TEXT,
    decision_message    TEXT,
    allow_resubmit      BOOLEAN NOT NULL DEFAULT true,
    risk_level          TEXT CHECK (risk_level IS NULL OR risk_level IN ('low', 'medium', 'high')),
    risk_notes          TEXT,
    checklist           JSONB NOT NULL DEFAULT '{}'::jsonb,
    reviewer_id         BIGINT REFERENCES staff(id),
    submissions         INT NOT NULL DEFAULT 0,
    first_submitted_at  TIMESTAMPTZ,
    submitted_at        TIMESTAMPTZ,
    review_started_at   TIMESTAMPTZ,
    decided_at          TIMESTAMPTZ,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX kyc_cases_one_open ON kyc_cases (user_id) WHERE status IN ('draft', 'submitted', 'in_review', 'more_info');
CREATE INDEX kyc_cases_queue_idx ON kyc_cases (tenant_id, status, submitted_at);
CREATE INDEX kyc_cases_user_idx ON kyc_cases (user_id, created_at DESC);

CREATE TABLE kyc_documents (
    id             BIGSERIAL PRIMARY KEY,
    tenant_id      BIGINT NOT NULL REFERENCES tenants(id),
    case_id        BIGINT NOT NULL REFERENCES kyc_cases(id) ON DELETE CASCADE,
    user_id        BIGINT NOT NULL,
    kind           TEXT NOT NULL CHECK (kind IN ('id_document', 'proof_of_address', 'selfie', 'incorporation', 'company_address', 'party_id')),
    side           TEXT NOT NULL DEFAULT 'single' CHECK (side IN ('front', 'back', 'single')),
    -- corporate: the director / UBO key from kyc_cases.details.parties
    party          TEXT CHECK (party IS NULL OR party ~ '^p[0-9]{1,2}$'),
    doc_type       TEXT,
    file_ref       TEXT NOT NULL UNIQUE,
    sha256         TEXT NOT NULL CHECK (sha256 ~ '^[0-9a-f]{64}$'),
    mime           TEXT NOT NULL CHECK (mime IN ('image/jpeg', 'image/png', 'image/heic', 'application/pdf')),
    size_bytes     INT NOT NULL CHECK (size_bytes > 0),
    width          INT,
    height         INT,
    original_name  TEXT,
    issue_date     DATE,
    -- {"client": {...browser pre-checks...}, "server": {...gateway checks...}}
    checks         JSONB NOT NULL DEFAULT '{}'::jsonb,
    status         TEXT NOT NULL DEFAULT 'uploaded' CHECK (status IN ('uploaded', 'accepted', 'rejected', 'superseded')),
    created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX kyc_documents_case_idx ON kyc_documents (case_id, created_at);
CREATE INDEX kyc_documents_sha_idx ON kyc_documents (tenant_id, sha256);

-- Client-visible timeline of a case (the status tracker). The audit log keeps the full staff trail.
CREATE TABLE kyc_events (
    id          BIGSERIAL PRIMARY KEY,
    case_id     BIGINT NOT NULL REFERENCES kyc_cases(id) ON DELETE CASCADE,
    kind        TEXT NOT NULL,
    actor_kind  TEXT NOT NULL CHECK (actor_kind IN ('user', 'staff', 'system')),
    actor_id    BIGINT,
    meta        JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX kyc_events_case_idx ON kyc_events (case_id, id);

-- Internal reviewer notes (never shown to the client).
CREATE TABLE kyc_notes (
    id          BIGSERIAL PRIMARY KEY,
    case_id     BIGINT NOT NULL REFERENCES kyc_cases(id) ON DELETE CASCADE,
    staff_id    BIGINT NOT NULL REFERENCES staff(id),
    body        TEXT NOT NULL CHECK (length(body) BETWEEN 1 AND 2000),
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX kyc_notes_case_idx ON kyc_notes (case_id, id);

-- D92: name and date of birth are locked once identity is verified. Enforced in the database so no code
-- path can change them; a deliberate correction runs in a transaction with SET LOCAL ezymex.identity_unlock = 'on'.
ALTER TABLE users ADD COLUMN identity_locked_at TIMESTAMPTZ;

CREATE FUNCTION users_identity_lock() RETURNS trigger AS $$
BEGIN
    IF OLD.identity_locked_at IS NOT NULL
       AND (NEW.first_name IS DISTINCT FROM OLD.first_name
            OR NEW.last_name IS DISTINCT FROM OLD.last_name
            OR NEW.date_of_birth IS DISTINCT FROM OLD.date_of_birth)
       AND coalesce(current_setting('ezymex.identity_unlock', true), '') <> 'on' THEN
        RAISE EXCEPTION 'name and date of birth are locked after identity verification';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER users_identity_locked BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION users_identity_lock();
