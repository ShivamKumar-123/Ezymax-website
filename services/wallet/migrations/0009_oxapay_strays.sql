-- Payments to the address of a closed OxaPay invoice (ops::oxapay scan_strays).
--
-- OxaPay gives every invoice its own address and books money to it only while the invoice is open. On
-- 13 Nov 2026 a client paid 200 USDT to the saved address of an invoice credited ten days earlier: OxaPay
-- held the money but attributed it to nothing - no webhook, no poll answer, nothing on its dashboard.
-- `oxapay_addresses` remembers every address a paid invoice used; the watcher scans those addresses on chain
-- afterwards and records any later transfer in `oxapay_stray_payments` for staff to recover from OxaPay and
-- credit by hand. Nothing here books money. Additive only.
CREATE TABLE oxapay_addresses (
    id          BIGSERIAL PRIMARY KEY,
    tenant_id   BIGINT NOT NULL REFERENCES tenants(id),
    invoice_id  BIGINT NOT NULL REFERENCES oxapay_invoices(id),
    chain       TEXT NOT NULL CHECK (chain IN ('bsc', 'tron')),
    -- canonical (bsc: lower-case 0x…, tron: base58), as the scanner reports `to`
    address     TEXT NOT NULL,
    -- the watcher's last look at this address (it rests between looks: one RPC call per address per look)
    scanned_at  TIMESTAMPTZ,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (chain, address)
);
CREATE INDEX oxapay_addresses_scan_idx ON oxapay_addresses (tenant_id, chain, scanned_at NULLS FIRST);

CREATE TABLE oxapay_stray_payments (
    id            BIGSERIAL PRIMARY KEY,
    tenant_id     BIGINT NOT NULL REFERENCES tenants(id),
    -- the closed invoice whose address received the money (its owner is not necessarily the payer)
    invoice_id    BIGINT NOT NULL REFERENCES oxapay_invoices(id),
    chain         TEXT NOT NULL,
    address       TEXT NOT NULL,
    tx_hash       TEXT NOT NULL,
    log_index     INTEGER,
    from_address  TEXT,
    amount        NUMERIC NOT NULL,
    block_number  BIGINT,
    block_time    TIMESTAMPTZ,
    -- open: found, nobody has dealt with it. resolved: staff recovered it from OxaPay (and credited the client
    -- through an adjustment) or decided it needs nothing; the note says which.
    status        TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'resolved')),
    note          TEXT,
    resolved_by   TEXT,
    resolved_at   TIMESTAMPTZ,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX oxapay_stray_payments_tx_idx ON oxapay_stray_payments (chain, tx_hash, COALESCE(log_index, -1));
CREATE INDEX oxapay_stray_payments_open_idx ON oxapay_stray_payments (tenant_id, status, id DESC);
