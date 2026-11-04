-- Client report emails (weekly trading summary, monthly statement): one row per client and period, claimed
-- before the summary is built so a restart or a second worker never sends the same period twice.
CREATE TABLE client_report_sends (
    tenant      TEXT        NOT NULL,
    kind        TEXT        NOT NULL,           -- weekly | monthly
    user_id     BIGINT      NOT NULL,
    period      TEXT        NOT NULL,           -- 2026-W45 | 2026-10
    at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    status      TEXT        NOT NULL DEFAULT 'claimed', -- claimed | sent | skipped | failed
    error       TEXT,
    PRIMARY KEY (tenant, kind, user_id, period)
);
CREATE INDEX client_report_sends_at ON client_report_sends (tenant, at DESC);
