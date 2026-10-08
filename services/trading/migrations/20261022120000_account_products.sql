-- CFD and Ezymex FX Options become separate account types (README "Account products").
--
-- Every group (account type) trades one product: `cfd` (every group so far) or `options`. A CFD account trades CFDs
-- only and an options account Ezymex FX Options only; the engine refuses the other product with `product_mismatch`
-- and an account never changes product (group changes stay within it). Accounts carry the product of their group.

ALTER TABLE groups ADD COLUMN IF NOT EXISTS product TEXT NOT NULL DEFAULT 'cfd' CHECK (product IN ('cfd', 'options'));

-- The Ezymex market maker's accounts quote the options order book only.
UPDATE groups SET product = 'options' WHERE code = 'options-mm';

-- The Options account type, live and demo, for every broker: the Standard group's risk levels, deposits, limits and
-- demo settings (and its spread group, for the underlying prices), hedging (one position per option trade, the way
-- option positions are booked) and one nominal leverage, as option margin does not use leverage. No CFD commission:
-- option fees come from the options service's group settings (the broker's '*' row until staff add an `options` row).
INSERT INTO groups (tenant_id, code, name, mode, cent, account_types, leverages, default_leverage, margin_call_pct, stop_out_pct,
                    hedged_margin_pct, min_deposit, swap_free, commission_per_lot, route, spread_group, max_accounts_per_user,
                    demo_initial_balance, demo_refills_per_day, demo_expiry_days, enabled, product)
SELECT tenant_id, 'options', 'Options', 'hedging', false, 'both', '{100}', 100, margin_call_pct, stop_out_pct,
       hedged_margin_pct, min_deposit, swap_free, 0, route, spread_group, max_accounts_per_user,
       demo_initial_balance, demo_refills_per_day, demo_expiry_days, true, 'options'
FROM groups WHERE code = 'standard'
ON CONFLICT DO NOTHING;
