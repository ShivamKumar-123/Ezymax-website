-- Deposit turnover requirements: a confirmed deposit asks for a matching amount of traded volume before the
-- money it funded can be withdrawn.
--
-- Off by default, and deliberately so. A turnover requirement is a restriction on a client's own money, and
-- whether it may be applied at all depends on what the broker has disclosed and what its agreements and
-- regulator allow. The multiplier therefore ships at zero with the switch off: nothing changes for anybody
-- until a broker turns it on, and when they do it applies to deposits taken from that moment, never backwards.

ALTER TABLE tenant_settings
    ADD COLUMN turnover_enabled     BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN turnover_multiplier  NUMERIC NOT NULL DEFAULT 0 CHECK (turnover_multiplier >= 0),
    -- deposits below this are too small to be worth a requirement (0 = every deposit counts)
    ADD COLUMN turnover_min_deposit NUMERIC NOT NULL DEFAULT 0 CHECK (turnover_min_deposit >= 0);

-- One requirement per credited deposit. `required` is frozen at the multiplier in force when the deposit
-- landed, so a later change to the policy cannot move the goalposts under a client who has already paid in.
CREATE TABLE turnover_requirements (
    id             BIGSERIAL PRIMARY KEY,
    tenant_id      BIGINT NOT NULL REFERENCES tenants(id),
    user_id        BIGINT NOT NULL,
    -- the credited deposit itself: the ledger is the only place every rail (on-chain, OxaPay, manual bank)
    -- agrees on what arrived, and its unique key is what makes a retried webhook harmless here
    ledger_txn_id  BIGINT NOT NULL REFERENCES ledger_txns(id),
    currency       TEXT NOT NULL,
    deposit_amount NUMERIC NOT NULL CHECK (deposit_amount > 0),
    multiplier     NUMERIC NOT NULL CHECK (multiplier >= 0),
    required       NUMERIC NOT NULL CHECK (required >= 0),
    completed      NUMERIC NOT NULL DEFAULT 0 CHECK (completed >= 0),
    -- pending → completed when the volume is there, or waived by a named member of staff with a reason
    status         TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'waived')),
    waived_by      TEXT,
    waived_reason  TEXT,
    completed_at   TIMESTAMPTZ,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (ledger_txn_id)
);
-- what the withdrawal gate asks for, several times a minute
CREATE INDEX turnover_req_open_idx ON turnover_requirements (tenant_id, user_id, id) WHERE status = 'pending';

-- One closed deal, once. The engine's deal id is the primary key, so a replayed feed page, an overlapping
-- window or a restarted worker cannot credit the same trade twice.
CREATE TABLE turnover_volume (
    deal_id    BIGINT PRIMARY KEY,
    tenant_id  BIGINT NOT NULL REFERENCES tenants(id),
    user_id    BIGINT NOT NULL,
    login      BIGINT NOT NULL,
    symbol     TEXT NOT NULL,
    lots       NUMERIC NOT NULL,
    -- USD notional as the engine valued it, with the rate it took, so the figure can be checked later
    notional   NUMERIC NOT NULL CHECK (notional >= 0),
    rate       NUMERIC NOT NULL,
    closed_at  TIMESTAMPTZ NOT NULL,
    reversed   BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX turnover_volume_user_idx ON turnover_volume (tenant_id, user_id, deal_id);

-- Which deal paid down which requirement. Every change to `completed` has a row here and the two must agree,
-- which is what makes the progress a client is shown auditable rather than a running total nobody can explain.
CREATE TABLE turnover_allocations (
    id             BIGSERIAL PRIMARY KEY,
    tenant_id      BIGINT NOT NULL REFERENCES tenants(id),
    requirement_id BIGINT NOT NULL REFERENCES turnover_requirements(id),
    deal_id        BIGINT NOT NULL REFERENCES turnover_volume(deal_id),
    -- credit: the deal counted. reversal: the desk reopened it and the credit was taken back.
    kind           TEXT NOT NULL CHECK (kind IN ('credit', 'reversal')),
    amount         NUMERIC NOT NULL,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (requirement_id, deal_id, kind)
);
CREATE INDEX turnover_alloc_req_idx ON turnover_allocations (requirement_id, id);

-- How far the two feeds have been read: the wallet's own ledger for deposits, the engine's deals for volume.
CREATE TABLE turnover_cursors (
    tenant_id  BIGINT NOT NULL REFERENCES tenants(id),
    name       TEXT NOT NULL,
    at         BIGINT NOT NULL DEFAULT 0,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (tenant_id, name)
);
