-- Ezymex growth: loyalty, cashback, contests, bonuses, promo codes, banners, share cards (services/growth).
-- Money is NUMERIC (USD), never float. `tenant` is the gateway tenant slug; every query filters by it.

CREATE TABLE settings (
    tenant      TEXT PRIMARY KEY,
    data        JSONB NOT NULL,
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_by  TEXT
);

-- Client profile: gateway users feed + the segment headers the Client Area BFF sends.
CREATE TABLE profiles (
    tenant         TEXT NOT NULL,
    user_id        BIGINT NOT NULL,
    first_name     TEXT NOT NULL DEFAULT '',
    last_name      TEXT NOT NULL DEFAULT '',
    email          TEXT NOT NULL DEFAULT '',
    country        TEXT NOT NULL DEFAULT '',
    kyc_status     TEXT NOT NULL DEFAULT 'unverified',
    referral_code  TEXT NOT NULL DEFAULT '',
    signed_up_at   TIMESTAMPTZ,
    synced_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (tenant, user_id)
);

CREATE TABLE cursors (
    name        TEXT PRIMARY KEY,
    value       TEXT NOT NULL,
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Engine account facts (type, group, cent), cached per login.
CREATE TABLE accounts (
    login       BIGINT PRIMARY KEY,
    tenant      TEXT NOT NULL,
    user_id     BIGINT NOT NULL,
    kind        TEXT NOT NULL,           -- live | demo
    group_code  TEXT NOT NULL DEFAULT '',
    cent        BOOLEAN NOT NULL DEFAULT false,
    fetched_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX accounts_user_idx ON accounts (tenant, user_id);

-- Every closing deal seen, once. The idempotency key for points, cashback, bonus release and contests.
CREATE TABLE deals (
    deal_id       BIGINT PRIMARY KEY,
    tenant        TEXT NOT NULL,
    login         BIGINT NOT NULL,
    user_id       BIGINT NOT NULL,
    account_kind  TEXT NOT NULL DEFAULT '',
    account_group TEXT NOT NULL DEFAULT '',
    symbol        TEXT NOT NULL,
    asset_class   TEXT,
    side          TEXT NOT NULL DEFAULT '',
    volume        NUMERIC NOT NULL,
    lots          NUMERIC NOT NULL,
    profit        NUMERIC NOT NULL DEFAULT 0,
    deal_kind     TEXT NOT NULL DEFAULT 'close',
    open_time     TIMESTAMPTZ NOT NULL,
    close_time    TIMESTAMPTZ NOT NULL,
    reversed      BOOLEAN NOT NULL DEFAULT false,
    processed_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX deals_user_idx ON deals (tenant, user_id, close_time DESC);
CREATE INDEX deals_login_idx ON deals (login, close_time);

-- ------------------------------------------------------------------ loyalty

CREATE TABLE tiers (
    tenant      TEXT NOT NULL,
    key         TEXT NOT NULL,
    name        TEXT NOT NULL,
    rank        INT NOT NULL,
    min_points  BIGINT NOT NULL,
    multiplier  NUMERIC NOT NULL,
    perks       JSONB NOT NULL DEFAULT '[]'::jsonb,
    PRIMARY KEY (tenant, key)
);

CREATE TABLE earn_rules (
    id              BIGSERIAL PRIMARY KEY,
    tenant          TEXT NOT NULL,
    name            TEXT NOT NULL,
    asset_class     TEXT,
    symbols         TEXT[] NOT NULL DEFAULT '{}',
    account_groups  TEXT[] NOT NULL DEFAULT '{}',
    account_type    TEXT NOT NULL DEFAULT 'live' CHECK (account_type IN ('live', 'demo', 'any')),
    points_per_lot  NUMERIC NOT NULL CHECK (points_per_lot >= 0),
    priority        INT NOT NULL DEFAULT 100,
    active          BOOLEAN NOT NULL DEFAULT true,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX earn_rules_tenant_idx ON earn_rules (tenant, priority, id);

-- Signed points movements. (tenant, kind, ref) is unique, so every source books once.
CREATE TABLE points_ledger (
    id           BIGSERIAL PRIMARY KEY,
    tenant       TEXT NOT NULL,
    user_id      BIGINT NOT NULL,
    kind         TEXT NOT NULL CHECK (kind IN ('earn', 'redeem', 'bonus', 'promo', 'expire', 'adjust', 'reversal')),
    points       BIGINT NOT NULL,
    ref          TEXT NOT NULL,
    deal_id      BIGINT,
    login        BIGINT,
    lots         NUMERIC,
    description  TEXT NOT NULL,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (tenant, kind, ref)
);
CREATE INDEX points_ledger_user_idx ON points_ledger (tenant, user_id, created_at DESC);

CREATE TABLE catalogue (
    id           BIGSERIAL PRIMARY KEY,
    tenant       TEXT NOT NULL,
    name         TEXT NOT NULL,
    description  TEXT NOT NULL DEFAULT '',
    kind         TEXT NOT NULL CHECK (kind IN ('cashback', 'bonus_credit', 'fee_discount')),
    cost_points  BIGINT NOT NULL CHECK (cost_points > 0),
    value        NUMERIC NOT NULL CHECK (value > 0),       -- USD (cashback, bonus_credit) or % (fee_discount)
    min_tier     TEXT,
    stock        INT,
    params       JSONB NOT NULL DEFAULT '{}'::jsonb,
    active       BOOLEAN NOT NULL DEFAULT true,
    sort         INT NOT NULL DEFAULT 100,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE redemptions (
    id            BIGSERIAL PRIMARY KEY,
    tenant        TEXT NOT NULL,
    user_id       BIGINT NOT NULL,
    item_id       BIGINT NOT NULL REFERENCES catalogue(id),
    item_name     TEXT NOT NULL,
    kind          TEXT NOT NULL,
    points        BIGINT NOT NULL,
    value         NUMERIC NOT NULL,
    status        TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'failed')),
    login         BIGINT,
    voucher_code  TEXT,
    grant_id      BIGINT,
    wallet_txn    TEXT,
    attempts      INT NOT NULL DEFAULT 0,
    next_try_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    error         TEXT,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    completed_at  TIMESTAMPTZ
);
CREATE INDEX redemptions_user_idx ON redemptions (tenant, user_id, created_at DESC);

CREATE TABLE vouchers (
    id          BIGSERIAL PRIMARY KEY,
    tenant      TEXT NOT NULL,
    user_id     BIGINT NOT NULL,
    code        TEXT NOT NULL UNIQUE,
    kind        TEXT NOT NULL DEFAULT 'fee_discount',
    pct         NUMERIC NOT NULL,
    applies_to  TEXT NOT NULL DEFAULT 'any',
    status      TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'used', 'expired')),
    source      TEXT NOT NULL,
    expires_at  TIMESTAMPTZ NOT NULL,
    used_at     TIMESTAMPTZ,
    used_ref    TEXT,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX vouchers_user_idx ON vouchers (tenant, user_id);

-- ------------------------------------------------------------------ cashback

CREATE TABLE cashback_programmes (
    id              BIGSERIAL PRIMARY KEY,
    tenant          TEXT NOT NULL,
    name            TEXT NOT NULL,
    description     TEXT NOT NULL DEFAULT '',
    asset_classes   TEXT[] NOT NULL DEFAULT '{}',
    symbols         TEXT[] NOT NULL DEFAULT '{}',
    account_groups  TEXT[] NOT NULL DEFAULT '{}',
    usd_per_lot     NUMERIC NOT NULL CHECK (usd_per_lot > 0),
    max_per_month   NUMERIC,
    opt_in          BOOLEAN NOT NULL DEFAULT false,
    active          BOOLEAN NOT NULL DEFAULT true,
    starts_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
    ends_at         TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE cashback_enrolments (
    tenant        TEXT NOT NULL,
    programme_id  BIGINT NOT NULL REFERENCES cashback_programmes(id),
    user_id       BIGINT NOT NULL,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (programme_id, user_id)
);

CREATE TABLE cashback_payouts (
    id           BIGSERIAL PRIMARY KEY,
    tenant       TEXT NOT NULL,
    user_id      BIGINT NOT NULL,
    amount       NUMERIC NOT NULL CHECK (amount > 0),
    status       TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'failed')),
    wallet_txn   TEXT,
    attempts     INT NOT NULL DEFAULT 0,
    next_try_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    error        TEXT,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    paid_at      TIMESTAMPTZ
);

CREATE TABLE cashback_accruals (
    id            BIGSERIAL PRIMARY KEY,
    tenant        TEXT NOT NULL,
    programme_id  BIGINT NOT NULL REFERENCES cashback_programmes(id),
    user_id       BIGINT NOT NULL,
    deal_id       BIGINT NOT NULL,
    login         BIGINT NOT NULL,
    symbol        TEXT NOT NULL,
    lots          NUMERIC NOT NULL,
    amount        NUMERIC NOT NULL,
    status        TEXT NOT NULL DEFAULT 'accrued' CHECK (status IN ('accrued', 'paid', 'void')),
    payout_id     BIGINT REFERENCES cashback_payouts(id),
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (programme_id, deal_id)
);
CREATE INDEX cashback_accruals_user_idx ON cashback_accruals (tenant, user_id, created_at DESC);

-- ------------------------------------------------------------------ bonuses (D29)

CREATE TABLE bonus_campaigns (
    id                     BIGSERIAL PRIMARY KEY,
    tenant                 TEXT NOT NULL,
    name                   TEXT NOT NULL,
    description            TEXT NOT NULL DEFAULT '',
    terms                  TEXT NOT NULL DEFAULT '',
    kind                   TEXT NOT NULL CHECK (kind IN ('deposit', 'fixed')),
    pct                    NUMERIC NOT NULL DEFAULT 0,
    cap                    NUMERIC NOT NULL DEFAULT 0,
    fixed_amount           NUMERIC NOT NULL DEFAULT 0,
    min_deposit            NUMERIC NOT NULL DEFAULT 0,
    release_per_lot        NUMERIC NOT NULL CHECK (release_per_lot > 0),
    expiry_days            INT NOT NULL CHECK (expiry_days > 0),
    forfeit_on_withdrawal  BOOLEAN NOT NULL DEFAULT true,
    claim_window_days      INT NOT NULL DEFAULT 30,
    account_groups         TEXT[] NOT NULL DEFAULT '{}',
    max_claims             INT,
    per_user_limit         INT NOT NULL DEFAULT 1,
    new_users_days         INT,
    kyc_required           BOOLEAN NOT NULL DEFAULT false,
    visibility             TEXT NOT NULL DEFAULT 'public' CHECK (visibility IN ('public', 'code_only')),
    status                 TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'paused', 'ended')),
    starts_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
    ends_at                TIMESTAMPTZ,
    created_by             TEXT,
    created_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at             TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE bonus_grants (
    id               BIGSERIAL PRIMARY KEY,
    tenant           TEXT NOT NULL,
    campaign_id      BIGINT NOT NULL REFERENCES bonus_campaigns(id),
    user_id          BIGINT NOT NULL,
    source           TEXT NOT NULL CHECK (source IN ('claim', 'promo', 'redemption', 'admin')),
    status           TEXT NOT NULL CHECK (status IN ('awaiting_deposit', 'pending', 'active', 'completed', 'forfeited', 'expired', 'cancelled', 'failed')),
    login            BIGINT,
    cent             BOOLEAN NOT NULL DEFAULT false,
    deposit_amount   NUMERIC,
    deposit_txn      BIGINT,
    amount           NUMERIC NOT NULL DEFAULT 0,
    released         NUMERIC NOT NULL DEFAULT 0,
    removed          NUMERIC NOT NULL DEFAULT 0,
    lots_traded      NUMERIC NOT NULL DEFAULT 0,
    release_per_lot  NUMERIC NOT NULL,
    expiry_days      INT NOT NULL,
    claimed_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
    claim_deadline   TIMESTAMPTZ,
    granted_at       TIMESTAMPTZ,
    expires_at       TIMESTAMPTZ,
    ended_at         TIMESTAMPTZ,
    end_reason       TEXT,
    ledger_checked   TIMESTAMPTZ,
    note             TEXT
);
CREATE INDEX bonus_grants_user_idx ON bonus_grants (tenant, user_id);
CREATE INDEX bonus_grants_status_idx ON bonus_grants (status);
-- one live grant per trading account
CREATE UNIQUE INDEX bonus_grants_one_active ON bonus_grants (login) WHERE status IN ('pending', 'active');

-- Engine legs: grant (+bonus), release (−bonus, +balance), remove (−bonus). Posted with idempotency keys.
CREATE TABLE bonus_events (
    id          BIGSERIAL PRIMARY KEY,
    grant_id    BIGINT NOT NULL REFERENCES bonus_grants(id),
    tenant      TEXT NOT NULL,
    kind        TEXT NOT NULL CHECK (kind IN ('grant', 'release', 'remove')),
    amount      NUMERIC NOT NULL CHECK (amount > 0),
    lots        NUMERIC,
    deal_id     BIGINT,
    ref         TEXT NOT NULL,
    status      TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'booked', 'failed')),
    legs_done   INT NOT NULL DEFAULT 0,
    attempts    INT NOT NULL DEFAULT 0,
    next_try_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    error       TEXT,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    booked_at   TIMESTAMPTZ,
    UNIQUE (grant_id, kind, ref)
);
CREATE INDEX bonus_events_pending_idx ON bonus_events (status, next_try_at) WHERE status = 'pending';

-- ------------------------------------------------------------------ promo codes (D144)

CREATE TABLE promo_codes (
    id                   BIGSERIAL PRIMARY KEY,
    tenant               TEXT NOT NULL,
    code                 TEXT NOT NULL,
    description          TEXT NOT NULL DEFAULT '',
    kind                 TEXT NOT NULL CHECK (kind IN ('bonus', 'points', 'discount')),
    campaign_id          BIGINT REFERENCES bonus_campaigns(id),
    points               BIGINT,
    discount_pct         NUMERIC,
    discount_applies_to  TEXT NOT NULL DEFAULT 'any',
    max_uses             INT,
    per_user_limit       INT NOT NULL DEFAULT 1,
    uses                 INT NOT NULL DEFAULT 0,
    new_users_days       INT,
    countries            TEXT[] NOT NULL DEFAULT '{}',
    kyc_required         BOOLEAN NOT NULL DEFAULT false,
    active               BOOLEAN NOT NULL DEFAULT true,
    starts_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
    ends_at              TIMESTAMPTZ,
    created_by           TEXT,
    created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX promo_codes_code_idx ON promo_codes (tenant, upper(code));

CREATE TABLE promo_redemptions (
    id          BIGSERIAL PRIMARY KEY,
    tenant      TEXT NOT NULL,
    promo_id    BIGINT REFERENCES promo_codes(id),
    code        TEXT NOT NULL,
    user_id     BIGINT NOT NULL,
    status      TEXT NOT NULL CHECK (status IN ('applied', 'blocked')),
    reason      TEXT,
    result      JSONB,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX promo_redemptions_promo_idx ON promo_redemptions (promo_id, created_at DESC);
CREATE INDEX promo_redemptions_user_idx ON promo_redemptions (tenant, user_id);

-- ------------------------------------------------------------------ banners (D121)

CREATE TABLE banners (
    id              BIGSERIAL PRIMARY KEY,
    tenant          TEXT NOT NULL,
    title           TEXT NOT NULL,
    body            TEXT NOT NULL DEFAULT '',
    cta_label       TEXT,
    cta_url         TEXT,
    image_url       TEXT,
    tone            TEXT NOT NULL DEFAULT 'ember',
    placement       TEXT NOT NULL CHECK (placement IN ('dashboard', 'wallet', 'rewards', 'terminal')),
    countries       TEXT[] NOT NULL DEFAULT '{}',
    kyc             TEXT[] NOT NULL DEFAULT '{}',
    account_types   TEXT[] NOT NULL DEFAULT '{}',
    new_users_days  INT,
    priority        INT NOT NULL DEFAULT 100,
    dismissible     BOOLEAN NOT NULL DEFAULT true,
    active          BOOLEAN NOT NULL DEFAULT true,
    starts_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
    ends_at         TIMESTAMPTZ,
    created_by      TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- One impression / click / dismissal per client per banner per day.
CREATE TABLE banner_events (
    banner_id  BIGINT NOT NULL REFERENCES banners(id),
    user_id    BIGINT NOT NULL,
    kind       TEXT NOT NULL CHECK (kind IN ('impression', 'click', 'dismiss')),
    day        DATE NOT NULL,
    PRIMARY KEY (banner_id, user_id, kind, day)
);

-- ------------------------------------------------------------------ contests (D135)

CREATE TABLE contests (
    id                BIGSERIAL PRIMARY KEY,
    tenant            TEXT NOT NULL,
    slug              TEXT NOT NULL,
    name              TEXT NOT NULL,
    description       TEXT NOT NULL DEFAULT '',
    kind              TEXT NOT NULL CHECK (kind IN ('demo', 'live')),
    status            TEXT NOT NULL DEFAULT 'scheduled' CHECK (status IN ('draft', 'scheduled', 'running', 'ended', 'finalized', 'paid', 'cancelled')),
    starts_at         TIMESTAMPTZ NOT NULL,
    ends_at           TIMESTAMPTZ NOT NULL,
    scoring           TEXT NOT NULL CHECK (scoring IN ('return_pct', 'profit', 'lots')),
    min_trades        INT NOT NULL DEFAULT 0,
    max_entrants      INT,
    starting_balance  NUMERIC,
    demo_group        TEXT,
    account_groups    TEXT[] NOT NULL DEFAULT '{}',
    kyc_required      BOOLEAN NOT NULL DEFAULT false,
    min_equity        NUMERIC,
    prizes            JSONB NOT NULL DEFAULT '[]'::jsonb,
    rules             TEXT NOT NULL DEFAULT '',
    anti_cheat        JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_by        TEXT,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
    refreshed_at      TIMESTAMPTZ,
    finalized_at      TIMESTAMPTZ,
    finalized_by      TEXT,
    paid_at           TIMESTAMPTZ,
    CHECK (ends_at > starts_at)
);
CREATE UNIQUE INDEX contests_slug_idx ON contests (tenant, slug);

CREATE TABLE contest_entries (
    id                 BIGSERIAL PRIMARY KEY,
    contest_id         BIGINT NOT NULL REFERENCES contests(id),
    tenant             TEXT NOT NULL,
    user_id            BIGINT NOT NULL,
    login              BIGINT NOT NULL,
    display_name       TEXT NOT NULL,
    country            TEXT NOT NULL DEFAULT '',
    joined_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    start_equity       NUMERIC,
    status             TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'disqualified')),
    disqualify_reason  TEXT,
    realised           NUMERIC NOT NULL DEFAULT 0,
    floating           NUMERIC NOT NULL DEFAULT 0,
    lots               NUMERIC NOT NULL DEFAULT 0,
    trades             INT NOT NULL DEFAULT 0,
    score              NUMERIC NOT NULL DEFAULT 0,
    return_pct         NUMERIC NOT NULL DEFAULT 0,
    rank               INT,
    prize_amount       NUMERIC,
    prize_payout       TEXT,
    prize_status       TEXT NOT NULL DEFAULT 'none' CHECK (prize_status IN ('none', 'pending', 'paid', 'failed')),
    prize_ref          TEXT,
    prize_error        TEXT,
    updated_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (contest_id, user_id),
    UNIQUE (contest_id, login)
);

CREATE TABLE contest_trades (
    contest_id    BIGINT NOT NULL REFERENCES contests(id),
    entry_id      BIGINT NOT NULL REFERENCES contest_entries(id),
    deal_id       BIGINT NOT NULL,
    profit        NUMERIC NOT NULL,
    lots          NUMERIC NOT NULL,
    hold_seconds  BIGINT NOT NULL,
    close_time    TIMESTAMPTZ NOT NULL,
    PRIMARY KEY (contest_id, deal_id)
);

CREATE TABLE contest_flags (
    id           BIGSERIAL PRIMARY KEY,
    contest_id   BIGINT NOT NULL REFERENCES contests(id),
    entry_id     BIGINT NOT NULL REFERENCES contest_entries(id),
    kind         TEXT NOT NULL CHECK (kind IN ('balance_change', 'single_trade', 'short_holds')),
    severity     TEXT NOT NULL DEFAULT 'medium',
    details      JSONB NOT NULL DEFAULT '{}'::jsonb,
    status       TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'cleared', 'disqualified')),
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    resolved_by  TEXT,
    resolved_at  TIMESTAMPTZ,
    note         TEXT,
    UNIQUE (entry_id, kind)
);

-- ------------------------------------------------------------------ share cards (D136)

CREATE TABLE shares (
    code          TEXT PRIMARY KEY,
    tenant        TEXT NOT NULL,
    user_id       BIGINT NOT NULL,
    kind          TEXT NOT NULL CHECK (kind IN ('trade', 'period')),
    login         BIGINT NOT NULL,
    deal_id       BIGINT,
    show_amounts  BOOLEAN NOT NULL DEFAULT false,
    data          JSONB NOT NULL,
    views         BIGINT NOT NULL DEFAULT 0,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX shares_user_idx ON shares (tenant, user_id, created_at DESC);

-- ------------------------------------------------------------------ wallet credits (prizes, points cashback)

CREATE TABLE wallet_credits (
    id           BIGSERIAL PRIMARY KEY,
    tenant       TEXT NOT NULL,
    user_id      BIGINT NOT NULL,
    idem_key     TEXT NOT NULL UNIQUE,
    kind         TEXT NOT NULL,          -- wallet transfer kind
    amount       NUMERIC NOT NULL CHECK (amount > 0),
    ref          TEXT NOT NULL,
    note         TEXT NOT NULL,
    status       TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'failed')),
    wallet_txn   TEXT,
    attempts     INT NOT NULL DEFAULT 0,
    next_try_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    error        TEXT,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    paid_at      TIMESTAMPTZ
);

-- ------------------------------------------------------------------ audit

CREATE TABLE audit_log (
    id          BIGSERIAL PRIMARY KEY,
    tenant      TEXT NOT NULL,
    actor       TEXT NOT NULL,
    actor_name  TEXT,
    action      TEXT NOT NULL,
    target      TEXT,
    before      JSONB,
    after       JSONB,
    note        TEXT,
    at          TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX audit_log_tenant_idx ON audit_log (tenant, at DESC);

CREATE FUNCTION growth_append_only() RETURNS trigger AS $$
BEGIN
    RAISE EXCEPTION '% is append-only', TG_TABLE_NAME;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER audit_log_no_update BEFORE UPDATE OR DELETE ON audit_log FOR EACH ROW EXECUTE FUNCTION growth_append_only();
CREATE TRIGGER points_ledger_no_update BEFORE UPDATE OR DELETE ON points_ledger FOR EACH ROW EXECUTE FUNCTION growth_append_only();
