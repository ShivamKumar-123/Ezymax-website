-- Client controls (gateway client_controls.rs): Ezymex Trader sessions a staff member opened as the client from
-- the Back Office ("log in as client"). They are read-only unless the Super Admin chose full access, last 30
-- minutes, and trades placed in a full-access staff session are recorded with the actor `staff:<id>`.
ALTER TABLE sso_tokens
    ADD COLUMN staff_id    BIGINT,
    ADD COLUMN staff_name  TEXT,
    ADD COLUMN read_only   BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN minutes     INT CHECK (minutes IS NULL OR minutes BETWEEN 1 AND 720);
ALTER TABLE terminal_sessions
    ADD COLUMN staff_id    BIGINT,
    ADD COLUMN staff_name  TEXT;
