-- Instrument catalogue (1,000+ provider symbols next to the 28 core instruments).
--
-- Catalogue symbols take their contract specs from per-asset-class templates in config/trading-specs.json
-- ("templates"); the Back Office can override template fields here. They are tradable on demo accounts, and on live
-- accounts only once the platform switches live trading on for their asset class or for the symbol itself. The core
-- instruments are not affected by either table. Platform-wide (not per broker): the platform owner controls it.

-- Back Office overrides of template fields (a partial spec: only the fields set here replace the file's values).
CREATE TABLE IF NOT EXISTS symbol_templates (
    key         TEXT PRIMARY KEY,
    spec        JSONB NOT NULL,
    updated_by  TEXT NOT NULL,
    reason      TEXT NOT NULL,
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Live trading switch: scope 'class' (asset class, enabled = on/off) or 'symbol' (explicit per-symbol on/off that
-- wins over its class). No row = off.
CREATE TABLE IF NOT EXISTS symbol_live (
    scope       TEXT NOT NULL CHECK (scope IN ('class', 'symbol')),
    key         TEXT NOT NULL,
    enabled     BOOLEAN NOT NULL,
    updated_by  TEXT NOT NULL,
    reason      TEXT NOT NULL,
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (scope, key)
);

-- Every change to either table, append-only.
CREATE TABLE IF NOT EXISTS symbol_catalogue_audit (
    id          BIGSERIAL PRIMARY KEY,
    at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    staff_id    TEXT NOT NULL,
    staff_name  TEXT NOT NULL,
    staff_role  TEXT NOT NULL,
    action      TEXT NOT NULL,
    target      TEXT NOT NULL,
    before      JSONB,
    after       JSONB,
    reason      TEXT NOT NULL
);
DROP TRIGGER IF EXISTS symbol_catalogue_audit_append_only ON symbol_catalogue_audit;
CREATE TRIGGER symbol_catalogue_audit_append_only BEFORE UPDATE OR DELETE ON symbol_catalogue_audit FOR EACH ROW EXECUTE FUNCTION reject_mutation();
