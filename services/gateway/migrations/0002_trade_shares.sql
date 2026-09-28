-- Public trade-share links created from Kalks Trader.
-- A share holds a snapshot of the selected trades; the owner (holder of the manage key) can refresh it or revoke it.
-- Only HMAC(manage key) is stored. Balance / equity / email are never part of a share.

CREATE TABLE trade_shares (
    id             BIGSERIAL PRIMARY KEY,
    tenant_id      BIGINT NOT NULL REFERENCES tenants(id),
    code           TEXT NOT NULL UNIQUE CHECK (code ~ '^[0-9A-Za-z]{12}$'),
    key_hash       BYTEA NOT NULL,
    login          TEXT NOT NULL,
    account_label  TEXT,
    title          TEXT NOT NULL,
    show_amounts   BOOLEAN NOT NULL DEFAULT false,
    -- tickets selected at creation; later snapshot updates may only touch these (or fills of these orders)
    tickets        TEXT[] NOT NULL,
    trades         JSONB NOT NULL DEFAULT '[]'::jsonb,
    view_count     BIGINT NOT NULL DEFAULT 0,
    revoked        BOOLEAN NOT NULL DEFAULT false,
    revoked_at     TIMESTAMPTZ,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    expires_at     TIMESTAMPTZ
);
CREATE INDEX trade_shares_login_idx ON trade_shares (tenant_id, login, created_at DESC);
