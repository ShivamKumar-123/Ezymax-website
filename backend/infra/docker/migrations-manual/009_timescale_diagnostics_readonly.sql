-- TimescaleDB diagnostic queries — READ-ONLY, safe to run on prod.
--
-- Produces the data needed to plan the extension-version-mismatch fix
-- (see memory/project_timescaledb_version_mismatch.md). The script
-- prints six sections:
--
--   1. Installed extension version + available .so binary version
--   2. Per-hypertable row count + on-disk size
--   3. Chunk distribution per hypertable
--   4. Compression status per hypertable
--   5. Existing compression / retention policies
--   6. Recent compression job runs (success / failure)
--
-- Run:
--   docker exec -i fxartha-timescaledb-1 psql -U fxartha -d marketdata \
--     < backend/infra/docker/migrations-manual/009_timescale_diagnostics_readonly.sql
--
-- Nothing mutates. Safe to re-run any time. Output goes to the psql
-- terminal — copy + share with whoever's planning the upgrade.

\echo
\echo '=== 1. Extension version =================================================='
SELECT
    extname,
    extversion              AS catalog_version,
    (SELECT default_version FROM pg_available_extensions WHERE name = e.extname)
                            AS binary_default_version,
    CASE
        WHEN extversion = (SELECT default_version FROM pg_available_extensions WHERE name = e.extname)
        THEN 'OK — versions match'
        ELSE 'MISMATCH — DDL using new functions will fail with "could not access file $libdir/timescaledb-<ver>"'
    END                     AS status
FROM pg_extension e
WHERE extname = 'timescaledb';

\echo
\echo '=== 2. Hypertable size + row counts ======================================'
SELECT
    h.hypertable_name,
    pg_size_pretty(hypertable_size(format('%I.%I', h.hypertable_schema, h.hypertable_name)::regclass)) AS total_size,
    h.num_chunks            AS chunks,
    h.compression_enabled
FROM timescaledb_information.hypertables h
ORDER BY hypertable_size(format('%I.%I', h.hypertable_schema, h.hypertable_name)::regclass) DESC;

\echo
\echo '=== 3. Chunks: oldest + newest per hypertable ============================='
SELECT
    hypertable_name,
    count(*)                              AS chunks,
    min(range_start)                      AS oldest_chunk,
    max(range_end)                        AS newest_chunk,
    pg_size_pretty(sum(total_bytes))      AS total_bytes
FROM timescaledb_information.chunks
GROUP BY hypertable_name
ORDER BY sum(total_bytes) DESC;

\echo
\echo '=== 4. Per-hypertable compression coverage ================================'
SELECT
    hypertable_name,
    count(*) FILTER (WHERE is_compressed)               AS compressed_chunks,
    count(*) FILTER (WHERE NOT is_compressed)           AS uncompressed_chunks,
    round(
        100.0 *
        count(*) FILTER (WHERE is_compressed)::numeric
        / NULLIF(count(*), 0),
    1)                                                  AS compressed_pct
FROM timescaledb_information.chunks
GROUP BY hypertable_name
ORDER BY hypertable_name;

\echo
\echo '=== 5. Active policies (compression + retention) =========================='
SELECT
    j.hypertable_name,
    j.proc_name,
    j.config->>'compress_after' AS compress_after,
    j.config->>'drop_after'     AS drop_after,
    j.scheduled,
    j.next_start
FROM timescaledb_information.jobs j
WHERE j.proc_name IN ('policy_compression', 'policy_retention')
ORDER BY j.hypertable_name, j.proc_name;

\echo
\echo '=== 6. Last 20 policy job runs (success / failure) ========================'
SELECT
    job_id,
    proc_name,
    hypertable_name,
    succeeded,
    finish_time,
    err_message
FROM timescaledb_information.job_stats js
JOIN timescaledb_information.jobs j USING (job_id)
WHERE j.proc_name IN ('policy_compression', 'policy_retention')
ORDER BY finish_time DESC NULLS LAST
LIMIT 20;

\echo
\echo '=== End of diagnostics ===================================================='
\echo
\echo 'If section 1 shows MISMATCH, run the upgrade procedure documented in'
\echo 'memory/project_timescaledb_version_mismatch.md before retrying'
\echo 'migrations-manual/008_timescale_compression_retention.sql.'
