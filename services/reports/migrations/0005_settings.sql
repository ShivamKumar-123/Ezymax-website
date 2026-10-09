-- Broker analytics settings (Analytics → Broker risk). One JSON value per (tenant, key); every change is written
-- to audit_log with the staff member's reason. Keys: `broker_capital` = {"amount": USD, "reason", "note"?} — the
-- capital the broker holds against client exposure, compared with the worst preset scenario loss.
CREATE TABLE IF NOT EXISTS settings (
    tenant      TEXT        NOT NULL,
    key         TEXT        NOT NULL,
    value       JSONB       NOT NULL,
    updated_by  TEXT        NOT NULL,
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (tenant, key)
);
