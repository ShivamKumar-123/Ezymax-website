-- Withdrawals to a UPI ID (India).
--
-- Until now a client could only be paid in USDT on chain, while most deposits arrive in INR through UPI
-- (manual_deposits). A client who funded in rupees had no way back out. `method` says which half of the row
-- applies: a crypto withdrawal keeps `chain` + `to_address` (a wallet address) and is verified on chain by the
-- watcher; a UPI withdrawal has no chain, puts the client's own UPI ID in `to_address` and is settled by staff,
-- who record the bank reference in `payout_reference`.
--
-- `payout_currency` / `payout_amount` / `payout_rate` freeze the INR figure quoted when the client asked, so a
-- later rate change never alters what was promised, and staff pay exactly that.

ALTER TABLE withdrawals
    ADD COLUMN method           TEXT NOT NULL DEFAULT 'crypto' CHECK (method IN ('crypto', 'upi')),
    ADD COLUMN payout_reference TEXT,
    ADD COLUMN payout_currency  TEXT,
    ADD COLUMN payout_amount    NUMERIC CHECK (payout_amount IS NULL OR payout_amount > 0),
    ADD COLUMN payout_rate      NUMERIC CHECK (payout_rate IS NULL OR payout_rate > 0),
    ALTER COLUMN chain DROP NOT NULL;

-- A chain is meaningless for an off-chain payout, and a crypto withdrawal without one cannot be verified.
ALTER TABLE withdrawals
    ADD CONSTRAINT withdrawals_chain_matches_method
    CHECK ((method = 'crypto' AND chain IS NOT NULL) OR (method <> 'crypto' AND chain IS NULL));

CREATE INDEX withdrawals_method_idx ON withdrawals (tenant_id, method, status);

-- Off-chain withdrawal methods, switched on and priced per broker. Crypto stays in chain_settings, which already
-- carries its own switch and network fee.
--
-- `rate` is units of `currency` per 1 USDT and is NULL until staff set it: a payout method that does not know
-- what a dollar is worth must not be sellable, so enabling without a rate is refused by the API rather than
-- defaulting to something invented. `fee_flat` is in USDT and is charged on top of the tenant's flat and
-- percentage fee, exactly as a chain's network fee is.
CREATE TABLE withdraw_methods (
    tenant_id    BIGINT NOT NULL REFERENCES tenants(id),
    method       TEXT NOT NULL CHECK (method IN ('upi')),
    enabled      BOOLEAN NOT NULL DEFAULT false,
    currency     TEXT NOT NULL DEFAULT 'INR',
    rate         NUMERIC CHECK (rate IS NULL OR rate > 0),
    fee_flat     NUMERIC NOT NULL DEFAULT 0 CHECK (fee_flat >= 0),
    min_amount   NUMERIC CHECK (min_amount IS NULL OR min_amount > 0),
    max_amount   NUMERIC CHECK (max_amount IS NULL OR max_amount > 0),
    instructions TEXT,
    updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_by   TEXT,
    PRIMARY KEY (tenant_id, method),
    CHECK (max_amount IS NULL OR min_amount IS NULL OR max_amount >= min_amount)
);

-- Every tenant gets the row, switched off: the method appears in the Back Office ready to be priced, and no
-- client sees it until someone sets a rate and turns it on.
INSERT INTO withdraw_methods (tenant_id, method, updated_by)
SELECT id, 'upi', 'migration' FROM tenants
ON CONFLICT DO NOTHING;
