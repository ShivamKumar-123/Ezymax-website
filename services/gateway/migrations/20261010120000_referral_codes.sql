-- Referral programme changes (owner, 2026-10-10).
--
-- 1. Referral codes no longer carry the client's name. New codes are `EZ` + 6 characters from an unambiguous
--    alphabet (no 0 / O / 1 / I / L), e.g. EZ7KQ4MX. Every existing client gets one now; the old code moves to
--    `referral_code_legacy` and keeps resolving, so links already shared still attribute. A new code never equals
--    any old code of the same broker (both columns are checked, and purged clients' codes in deleted_users, which
--    the IB / reports mirrors still hold), so a code always points at exactly one client.
--    Deleted (anonymised) clients get a new code too but keep no old one (it contained their first name). House
--    users keep their HOUSE… codes (they never had a name in them).
-- 2. A client's referral link only counts once they have deposited (client_auth.rs / referral.rs). The first
--    deposit the wallet confirms is cached in `referral_active_at` (deposits are final, so it never resets). A
--    sign-up through a link that is not active yet registers normally without `referred_by`; `referral_held` says
--    why (`not_funded`: the referrer had no deposit; `unverified`: the wallet could not be asked) and
--    `referral_held_for` names the referrer it would have gone to, so staff can attribute it by hand.
--
-- `updated_at` is bumped for every re-coded client, so the referral feed (/v1/internal/referrals/users) sends the
-- new codes to the IB, growth, reports and support mirrors.

ALTER TABLE users
    ADD COLUMN IF NOT EXISTS referral_code_legacy TEXT,
    ADD COLUMN IF NOT EXISTS referral_active_at   TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS referral_held        TEXT CHECK (referral_held IS NULL OR referral_held IN ('not_funded', 'unverified')),
    ADD COLUMN IF NOT EXISTS referral_held_for    BIGINT REFERENCES users(id) ON DELETE SET NULL;
CREATE UNIQUE INDEX IF NOT EXISTS users_referral_code_legacy_idx ON users (tenant_id, referral_code_legacy) WHERE referral_code_legacy IS NOT NULL;
CREATE INDEX IF NOT EXISTS users_referral_held_for_idx ON users (referral_held_for) WHERE referral_held_for IS NOT NULL;

-- A fresh code for one broker: EZ + 6 of 23456789ABCDEFGHJKMNPQRSTUVWXYZ, unused as a current, old or purged code.
-- (Not a secret: random() is enough. The gateway generates sign-up codes the same way, referral.rs.)
CREATE OR REPLACE FUNCTION ezymex_new_referral_code(t BIGINT) RETURNS TEXT LANGUAGE plpgsql VOLATILE AS $$
DECLARE
    alphabet CONSTANT TEXT := '23456789ABCDEFGHJKMNPQRSTUVWXYZ';
    code TEXT;
BEGIN
    LOOP
        SELECT 'EZ' || string_agg(substr(alphabet, 1 + floor(random() * length(alphabet))::int, 1), '')
          INTO code FROM generate_series(1, 6);
        EXIT WHEN NOT EXISTS (SELECT 1 FROM users WHERE tenant_id = t AND (referral_code = code OR referral_code_legacy = code))
              AND NOT EXISTS (SELECT 1 FROM deleted_users WHERE tenant_id = t AND referral_code = code);
    END LOOP;
    RETURN code;
END $$;

-- Gives every client whose code is not in the new format a new one (the old one kept as legacy, except for deleted
-- clients). Safe to run again: a client that already has an old code on file or a code in the new format is left
-- alone, so no EZ… link ever changes. (An old code that happens to look new, e.g. first name "Ezab" + 2345, stays.)
-- Returns the number of clients re-coded.
CREATE OR REPLACE FUNCTION ezymex_recode_referrals() RETURNS INT LANGUAGE plpgsql VOLATILE AS $$
DECLARE
    u RECORD;
    n INT := 0;
BEGIN
    FOR u IN SELECT id, tenant_id, referral_code, deleted_at FROM users
              WHERE NOT is_house AND referral_code_legacy IS NULL AND referral_code !~ '^EZ[2-9A-HJKMNP-Z]{6}$'
              ORDER BY id FOR UPDATE
    LOOP
        UPDATE users
           SET referral_code_legacy = CASE WHEN u.deleted_at IS NULL THEN u.referral_code END,
               referral_code = ezymex_new_referral_code(u.tenant_id),
               updated_at = now()
         WHERE id = u.id;
        n := n + 1;
    END LOOP;
    RETURN n;
END $$;

SELECT ezymex_recode_referrals();
