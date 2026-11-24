-- How many withdrawals one client may request in a server day (GMT+3, the day the daily amount limit already
-- counts in). The amount limit `withdraw_daily_max` says how much may leave; this says how many times it may be
-- asked for, which is a different question: ten requests of a hundred each cost ten payouts in fees and ten
-- manual approvals, whatever the total.
--
-- 1 is the default and what every existing tenant gets, because that is the rule the broker asked for. 0 means
-- no limit, so the rule can be lifted from the Back Office without a deployment.
ALTER TABLE tenant_settings ADD COLUMN IF NOT EXISTS withdraw_daily_count INT NOT NULL DEFAULT 1;
