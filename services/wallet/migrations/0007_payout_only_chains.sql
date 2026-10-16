-- A chain can now be open for withdrawals only.
--
-- `receiving_address` is where clients send deposits. A broker that takes deposits by UPI and pays out in USDT
-- has no such address, and the NOT NULL kept it from opening the chain at all. It is now required exactly when
-- deposits are enabled, enforced here so the database cannot hold the inconsistent state.

ALTER TABLE chain_settings ALTER COLUMN receiving_address DROP NOT NULL;

ALTER TABLE chain_settings
    ADD CONSTRAINT chain_settings_receiving_for_deposits
    CHECK (NOT deposits_enabled OR receiving_address IS NOT NULL);

-- Set when a payout completed without checking which address sent it, because the broker had no company
-- address on file for that chain. Reconciliation needs to know the difference.
ALTER TABLE withdrawals ADD COLUMN payout_sender_unverified BOOLEAN NOT NULL DEFAULT false;
