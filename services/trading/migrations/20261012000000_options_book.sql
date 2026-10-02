-- Kalks FX Options order book exchange (docs/OPTIONS-EXCHANGE.md, decision O49).
--
-- One book actor per (tenant, account kind, underlying). The actor group-commits every batch in ONE transaction:
-- the journal (every non-ephemeral command with its outputs), the resting orders, the book positions, the series
-- state, the fills and the outbox items for the accounts. Market-maker quotes (ephemeral) go to
-- book_quote_journal. The book is DORMANT for a (tenant, kind) until its option_book_venues row exists.
-- All tables carry tenant_id with the usual RLS policy (the engine connects as the owner and filters itself).

-- Where the order book is live (forward-only; written by the enable / novation flow).
CREATE TABLE IF NOT EXISTS option_book_venues (
    tenant_id    BIGINT NOT NULL REFERENCES tenants(id),
    kind         TEXT NOT NULL CHECK (kind IN ('live', 'demo')),
    enabled_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    enabled_by   TEXT NOT NULL DEFAULT 'system',
    reason       TEXT NOT NULL DEFAULT '',
    data         JSONB,
    PRIMARY KEY (tenant_id, kind)
);

-- Every non-ephemeral command with its outputs, per actor, in sequence. The nightly replay re-runs
-- matching::apply over it (merged with book_quote_journal by seq) and compares outputs byte for byte.
CREATE TABLE IF NOT EXISTS book_journal (
    tenant_id        BIGINT NOT NULL REFERENCES tenants(id),
    kind             TEXT NOT NULL CHECK (kind IN ('live', 'demo')),
    underlying       TEXT NOT NULL,
    seq              BIGINT NOT NULL,
    cmd_kind         TEXT NOT NULL,
    cmd              JSONB NOT NULL,
    out              JSONB NOT NULL,
    login            BIGINT,
    order_id         BIGINT,
    client_order_id  TEXT,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (tenant_id, kind, underlying, seq)
);
CREATE INDEX IF NOT EXISTS book_journal_order_idx ON book_journal (order_id) WHERE order_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS book_journal_login_idx ON book_journal (login, created_at DESC) WHERE login IS NOT NULL;

-- Ephemeral (market-maker) commands: same seq space as book_journal, written asynchronously (≤ 1 s) or with the
-- next durable batch. Monthly partitions.
CREATE TABLE IF NOT EXISTS book_quote_journal (
    tenant_id   BIGINT NOT NULL,
    kind        TEXT NOT NULL,
    underlying  TEXT NOT NULL,
    seq         BIGINT NOT NULL,
    cmd_kind    TEXT NOT NULL,
    cmd         JSONB NOT NULL,
    out         JSONB NOT NULL,
    login       BIGINT,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (tenant_id, kind, underlying, seq, created_at)
) PARTITION BY RANGE (created_at);
CREATE TABLE IF NOT EXISTS book_quote_journal_default PARTITION OF book_quote_journal DEFAULT;
DO $$
DECLARE m DATE := date_trunc('month', now())::date;
BEGIN
    FOR i IN 0..23 LOOP
        EXECUTE format('CREATE TABLE IF NOT EXISTS %I PARTITION OF book_quote_journal FOR VALUES FROM (%L) TO (%L)',
                       'book_quote_journal_' || to_char(m + make_interval(months => i), 'YYYYMM'),
                       m + make_interval(months => i), m + make_interval(months => i + 1));
    END LOOP;
EXCEPTION WHEN others THEN
    -- rows of a future month already sit in the default partition: keep the default
    RAISE NOTICE 'book_quote_journal partitions: %', SQLERRM;
END $$;

-- Book orders (non-ephemeral): resting ones have status 'open' and are reloaded at start by priority; finished
-- ones stay as the order history.
CREATE TABLE IF NOT EXISTS book_orders (
    id                BIGINT PRIMARY KEY,
    tenant_id         BIGINT NOT NULL REFERENCES tenants(id),
    kind              TEXT NOT NULL CHECK (kind IN ('live', 'demo')),
    underlying        TEXT NOT NULL,
    series            TEXT NOT NULL,
    login             BIGINT NOT NULL,
    stp               BIGINT NOT NULL,
    side              TEXT NOT NULL CHECK (side IN ('buy', 'sell')),
    px                BIGINT NOT NULL,
    price             NUMERIC NOT NULL,
    qty               BIGINT NOT NULL,
    left_qty          BIGINT NOT NULL,
    filled            BIGINT NOT NULL,
    notional          BIGINT NOT NULL,
    prio              BIGINT NOT NULL,
    tif               TEXT NOT NULL,
    flags             INT NOT NULL,
    expire_at         TIMESTAMPTZ,
    reserve_per_step  NUMERIC NOT NULL,
    status            TEXT NOT NULL CHECK (status IN ('open', 'filled', 'cancelled', 'expired', 'rejected', 'replaced')),
    reason            TEXT,
    client_order_id   TEXT,
    data              JSONB NOT NULL,
    created_at        TIMESTAMPTZ NOT NULL,
    updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
    done_at           TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS book_orders_open_idx ON book_orders (tenant_id, kind, underlying, prio) WHERE status = 'open';
CREATE INDEX IF NOT EXISTS book_orders_login_idx ON book_orders (login, created_at DESC);
CREATE INDEX IF NOT EXISTS book_orders_client_idx ON book_orders (login, client_order_id) WHERE client_order_id IS NOT NULL;

-- Net book position per series and login (steps, signed). Σ over logins = 0 per series.
CREATE TABLE IF NOT EXISTS book_positions (
    tenant_id   BIGINT NOT NULL REFERENCES tenants(id),
    kind        TEXT NOT NULL CHECK (kind IN ('live', 'demo')),
    underlying  TEXT NOT NULL,
    series      TEXT NOT NULL,
    login       BIGINT NOT NULL,
    steps       BIGINT NOT NULL,
    updated_seq BIGINT NOT NULL,
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (tenant_id, kind, underlying, series, login)
);

-- Per-series book state (state, contract units, last trade, day volume), reloaded at start with the orders.
CREATE TABLE IF NOT EXISTS book_series (
    tenant_id   BIGINT NOT NULL REFERENCES tenants(id),
    kind        TEXT NOT NULL CHECK (kind IN ('live', 'demo')),
    underlying  TEXT NOT NULL,
    series      TEXT NOT NULL,
    state       TEXT NOT NULL CHECK (state IN ('open', 'cancel_only', 'closed')),
    spec        JSONB NOT NULL,
    last_px     BIGINT,
    last_qty    BIGINT,
    vol_day     BIGINT NOT NULL DEFAULT 0,
    vol         BIGINT NOT NULL DEFAULT 0,
    updated_seq BIGINT NOT NULL,
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (tenant_id, kind, underlying, series)
);

-- Trades (the tape). Each fill stores the full resting-order state in `data`.
CREATE TABLE IF NOT EXISTS book_fills (
    tenant_id      BIGINT NOT NULL REFERENCES tenants(id),
    fill_id        TEXT NOT NULL,
    kind           TEXT NOT NULL CHECK (kind IN ('live', 'demo')),
    underlying     TEXT NOT NULL,
    seq            BIGINT NOT NULL,
    series         TEXT NOT NULL,
    px             BIGINT NOT NULL,
    price          NUMERIC NOT NULL,
    qty            BIGINT NOT NULL,
    contracts      NUMERIC NOT NULL,
    maker_login    BIGINT NOT NULL,
    taker_login    BIGINT NOT NULL,
    maker_order    BIGINT,
    taker_order    BIGINT,
    aggressor      TEXT NOT NULL CHECK (aggressor IN ('buy', 'sell')),
    fill_kind      TEXT NOT NULL CHECK (fill_kind IN ('book', 'rfq', 'liquidation', 'backstop', 'novation')),
    combo          BIGINT,
    usd_per_quote  NUMERIC NOT NULL,
    premium_usd    NUMERIC NOT NULL,
    at             TIMESTAMPTZ NOT NULL,
    data           JSONB NOT NULL,
    busted_at      TIMESTAMPTZ,
    PRIMARY KEY (tenant_id, fill_id)
);
CREATE INDEX IF NOT EXISTS book_fills_series_idx ON book_fills (tenant_id, kind, series, at DESC);
CREATE INDEX IF NOT EXISTS book_fills_maker_idx ON book_fills (maker_login, at DESC);
CREATE INDEX IF NOT EXISTS book_fills_taker_idx ON book_fills (taker_login, at DESC);

-- Items for the accounts (fills: two per fill; removals). Applied in seq order per login, never dropped.
CREATE TABLE IF NOT EXISTS book_outbox (
    tenant_id   BIGINT NOT NULL REFERENCES tenants(id),
    kind        TEXT NOT NULL CHECK (kind IN ('live', 'demo')),
    underlying  TEXT NOT NULL,
    seq         BIGINT NOT NULL,
    book_seq    BIGINT NOT NULL,
    login       BIGINT NOT NULL,
    item_kind   TEXT NOT NULL,
    item        JSONB NOT NULL,
    status      TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'applied', 'failed')),
    attempts    INT NOT NULL DEFAULT 0,
    last_error  TEXT,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    applied_at  TIMESTAMPTZ,
    PRIMARY KEY (tenant_id, kind, underlying, seq)
);
CREATE INDEX IF NOT EXISTS book_outbox_pending_idx ON book_outbox (tenant_id, kind, underlying, seq) WHERE status <> 'applied';
CREATE INDEX IF NOT EXISTS book_outbox_login_idx ON book_outbox (login, seq) WHERE status <> 'applied';

-- Combo RFQs (docs §5; used by the RFQ milestone).
CREATE TABLE IF NOT EXISTS book_rfqs (
    id          BIGINT PRIMARY KEY,
    tenant_id   BIGINT NOT NULL REFERENCES tenants(id),
    kind        TEXT NOT NULL CHECK (kind IN ('live', 'demo')),
    underlying  TEXT NOT NULL,
    login       BIGINT NOT NULL,
    legs        JSONB NOT NULL,
    qty         NUMERIC NOT NULL,
    status      TEXT NOT NULL DEFAULT 'open',
    expires_at  TIMESTAMPTZ NOT NULL,
    data        JSONB,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS book_rfqs_login_idx ON book_rfqs (login, created_at DESC);

-- Halts / cancel-only switches (Back Office kill switches, outbox failures, reconcile mismatches).
CREATE TABLE IF NOT EXISTS book_halts (
    id          BIGSERIAL PRIMARY KEY,
    tenant_id   BIGINT NOT NULL REFERENCES tenants(id),
    kind        TEXT NOT NULL CHECK (kind IN ('live', 'demo')),
    underlying  TEXT,
    scope       TEXT NOT NULL,
    target      TEXT NOT NULL DEFAULT '',
    mode        TEXT NOT NULL CHECK (mode IN ('halt', 'cancel_only', 'resume')),
    reason      TEXT NOT NULL,
    staff       TEXT NOT NULL DEFAULT 'system',
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    lifted_at   TIMESTAMPTZ,
    lifted_by   TEXT
);
CREATE INDEX IF NOT EXISTS book_halts_active_idx ON book_halts (tenant_id, kind) WHERE lifted_at IS NULL;

-- Liquidation steps (docs §8; written by the liquidator milestone).
CREATE TABLE IF NOT EXISTS option_liquidations (
    id          BIGSERIAL PRIMARY KEY,
    tenant_id   BIGINT NOT NULL REFERENCES tenants(id),
    login       BIGINT NOT NULL,
    run_id      TEXT NOT NULL,
    step        INT NOT NULL,
    action      TEXT NOT NULL,
    unit        JSONB,
    result      JSONB,
    level_before NUMERIC,
    level_after  NUMERIC,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS option_liquidations_login_idx ON option_liquidations (tenant_id, login, created_at DESC);

-- Actor state snapshots (replay starting points for the nightly audit).
CREATE TABLE IF NOT EXISTS book_snapshots (
    tenant_id   BIGINT NOT NULL REFERENCES tenants(id),
    kind        TEXT NOT NULL CHECK (kind IN ('live', 'demo')),
    underlying  TEXT NOT NULL,
    seq         BIGINT NOT NULL,
    state       JSONB NOT NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (tenant_id, kind, underlying, seq)
);

-- The journal is append-only.
DROP TRIGGER IF EXISTS book_journal_append_only ON book_journal;
CREATE TRIGGER book_journal_append_only BEFORE UPDATE OR DELETE ON book_journal FOR EACH ROW EXECUTE FUNCTION reject_mutation();

DO $$
DECLARE t TEXT;
BEGIN
    FOREACH t IN ARRAY ARRAY['option_book_venues', 'book_journal', 'book_quote_journal', 'book_orders', 'book_positions', 'book_series',
                             'book_fills', 'book_outbox', 'book_rfqs', 'book_halts', 'option_liquidations', 'book_snapshots'] LOOP
        EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
        EXECUTE format('DROP POLICY IF EXISTS tenant_isolation ON %I', t);
        EXECUTE format('CREATE POLICY tenant_isolation ON %I USING (tenant_id = NULLIF(current_setting(''kalks.tenant_id'', true), '''')::bigint)', t);
    END LOOP;
END $$;
