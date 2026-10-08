-- Suitability for complex products (Ezymex FX Options, O41): before the first options trade a client needs
-- verified identity (users.kyc_status = 'verified'), the current options risk disclosure accepted and a passed
-- knowledge quiz. The trading engine asks GET /v1/internal/suitability/{user_id}?product=options (suitability.rs).
--
-- * disclosures: versioned risk disclosures per tenant and product. Append-only (a change is a new version, so the
--   exact text a client accepted is always on record). The current disclosure is the highest version published
--   by now. A broker created later gets a copy of the platform's current version (tenant `ezymex`) on first use.
-- * suitability: one row per client and product: the accepted disclosure version with time, IP and user agent,
--   and the knowledge quiz result. Every acceptance and every quiz attempt is also written to audit_log.

CREATE TABLE disclosures (
    id            BIGSERIAL PRIMARY KEY,
    tenant_id     BIGINT NOT NULL REFERENCES tenants(id),
    product       TEXT NOT NULL CHECK (product IN ('options')),
    version       INT NOT NULL CHECK (version > 0),
    title         TEXT NOT NULL CHECK (length(title) BETWEEN 3 AND 200),
    body_md       TEXT NOT NULL CHECK (length(body_md) BETWEEN 50 AND 60000),
    published_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_by    BIGINT REFERENCES staff(id) ON DELETE SET NULL,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (tenant_id, product, version)
);

CREATE FUNCTION disclosures_immutable() RETURNS trigger AS $$
BEGIN
    RAISE EXCEPTION 'disclosures are append-only: publish a new version instead';
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER disclosures_no_update BEFORE UPDATE OR DELETE ON disclosures
    FOR EACH ROW EXECUTE FUNCTION disclosures_immutable();

CREATE TABLE suitability (
    id                  BIGSERIAL PRIMARY KEY,
    tenant_id           BIGINT NOT NULL REFERENCES tenants(id),
    user_id             BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    product             TEXT NOT NULL CHECK (product IN ('options')),
    disclosure_version  INT CHECK (disclosure_version IS NULL OR disclosure_version > 0),
    accepted_at         TIMESTAMPTZ,
    ip                  TEXT CHECK (ip IS NULL OR length(ip) <= 64),
    user_agent          TEXT CHECK (user_agent IS NULL OR length(user_agent) <= 400),
    quiz_passed_at      TIMESTAMPTZ,
    quiz_score          SMALLINT CHECK (quiz_score IS NULL OR quiz_score BETWEEN 0 AND 100),
    quiz_attempts       INT NOT NULL DEFAULT 0 CHECK (quiz_attempts >= 0),
    last_attempt_at     TIMESTAMPTZ,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (user_id, product),
    CHECK ((disclosure_version IS NULL) = (accepted_at IS NULL))
);
CREATE INDEX suitability_tenant_idx ON suitability (tenant_id, product, updated_at DESC);

-- ---------- options risk disclosure v1, for every existing broker ----------

INSERT INTO disclosures (tenant_id, product, version, title, body_md, published_at)
SELECT t.id, 'options', 1, 'Ezymex FX Options: risk disclosure', btrim($md$
Options are complex instruments and carry a high level of risk. Read this disclosure in full before you trade Ezymex FX Options, and only trade with money you can afford to lose.

## 1. What you are trading

Ezymex FX Options are European-style options on 13 underlyings: forex major and cross pairs, gold, silver and crude oil (WTI and Brent). They are over-the-counter contracts between you and Ezymex. They are not traded on an exchange and cannot be transferred to another broker. Options use the same trading account and the same funds as your CFD positions.

## 2. Ezymex is your counterparty and sets the prices

- Ezymex quotes every option and takes the other side of every trade. When you make money on an option, Ezymex loses the same amount, and when you lose, Ezymex gains. This is a conflict of interest.
- Option prices (premiums) are set by Ezymex with its own pricing models and volatility inputs, plus a spread. They are not set by an exchange or by other market participants. The price you can sell at (bid) is always lower than the price you can buy at (ask).
- You can close an option before expiry only at the price Ezymex quotes at that moment. In fast markets, close to the expiry cut, or when trading is halted, spreads can widen and new trades can be refused.

## 3. Buying options: you can lose 100% of the premium

- When you buy an option you pay the full premium upfront. If the option expires out of the money it is worthless, and you lose the whole premium plus commission.
- Options lose value as time passes (time decay). Short-dated options, including same-day (0DTE) expiries, can lose most of their value within hours.
- Being right about the direction is not enough. The price has to move far enough, and soon enough, to cover the premium you paid.

## 4. Selling options: you can lose much more than the premium

- When you sell (write) an option you receive the premium, but you must pay the buyer if the option ends in the money. Losses on a sold call grow without limit as the price rises. Losses on a sold put can be many times the premium you received. Losses on sold options can use up your entire account balance.
- Selling options requires margin. Margin is calculated from stress scenarios of price and volatility, can increase at any time (for example before weekends or in volatile markets), and must be covered by your own cash. Bonus and credit cannot be used for premiums or margin.
- If your equity falls below the required margin you will get a margin call, and your positions can be closed automatically at the prices quoted at that time (stop-out), possibly at a large loss and without further notice.
- Prices can gap, for example over a weekend or after news. A gap can cause a loss much larger than you expected before a stop-out takes effect.

## 5. Barrier options can knock out

- A knock-out option is cancelled as soon as the underlying price touches its barrier, even briefly and even if the price moves back afterwards. You lose the premium you paid and nothing is refunded.
- A knock-in option only becomes a normal option if the barrier is touched. If the barrier is never touched, it expires worthless.
- Barriers are watched continuously on the mid price of the underlying. If the market opens beyond a barrier after a weekend or holiday, the barrier counts as touched at the opening price.

## 6. Cash settlement at a 30-minute average price

- All options are settled in cash, in US dollars. You never receive or deliver currency, metal or oil.
- Options are exercised automatically at the expiry cut (by default 10:00 New York time). The settlement price is the time-weighted average of the mid price over the 30 minutes before the cut. It can differ from the price at the moment of the cut and from prices at other providers.
- An option that is in the money at settlement pays the difference between the settlement price and the strike, multiplied by the contract size. An option that is out of the money expires worthless.
- New positions cannot be opened in the last minutes before the cut, and closing can be restricted shortly before it.
- If a settlement price turns out to be wrong, Ezymex may correct it within one hour of the cut. Settlement proceeds can be held for that hour before you can withdraw them.

## 7. Other risks

- Volatility: small moves in the underlying can cause large percentage changes in an option's price.
- Liquidity: you can only trade while Ezymex is quoting. Trading can be halted, set to close-only, or limited per client.
- Technology: outages, delays or errors in prices, platforms or connections can affect your ability to open or close positions.
- Erroneous trades: trades executed at a clearly wrong price can be cancelled or corrected.
- Tax: you are responsible for any taxes on your results.

## 8. Your confirmation

By accepting this disclosure you confirm that you have read and understood it; that you understand how options work; that you can lose all the money you pay for options and, when you sell options, much more than the premium you receive; and that trading options is appropriate for you given your knowledge, experience and financial situation. Past performance is not a guide to future results. Nothing Ezymex provides is investment advice.
$md$, E' \n'), now()
FROM tenants t
ON CONFLICT (tenant_id, product, version) DO NOTHING;

-- ---------- row-level security (see 20260929180000_tenant_domains_rls.sql) ----------

DO $$
DECLARE
    tbl TEXT;
BEGIN
    FOREACH tbl IN ARRAY ARRAY['disclosures', 'suitability'] LOOP
        EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', tbl);
        EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', tbl);
        EXECUTE format('CREATE POLICY tenant_isolation ON %I USING (ezymex_tenant_row(tenant_id)) WITH CHECK (ezymex_tenant_row(tenant_id))', tbl);
        IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'ezymex_tenant') THEN
            EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON %I TO ezymex_tenant', tbl);
        END IF;
    END LOOP;
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'ezymex_tenant') THEN
        EXECUTE 'GRANT USAGE, SELECT ON SEQUENCE disclosures_id_seq TO ezymex_tenant';
        EXECUTE 'GRANT USAGE, SELECT ON SEQUENCE suitability_id_seq TO ezymex_tenant';
    END IF;
END $$;
