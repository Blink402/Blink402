-- ============================================
-- READY TO RUN: Database Cleanup
-- ============================================
-- This will DELETE data. Only run if you've reviewed the preview!
-- Copy entire block into Railway psql console

BEGIN;

-- 1. Delete expired pending runs (never completed, expired >1 day ago)
DELETE FROM runs
WHERE status = 'pending'
  AND expires_at < NOW()
  AND created_at < NOW() - INTERVAL '1 day';

-- 2. Delete old failed runs (older than 30 days)
DELETE FROM runs
WHERE status = 'failed'
  AND created_at < NOW() - INTERVAL '30 days';

-- 3. Delete old runs from archived blinks (older than 30 days)
DELETE FROM runs
WHERE blink_id IN (
  SELECT id FROM blinks WHERE status = 'archived'
)
AND created_at < NOW() - INTERVAL '30 days';

-- Show what was deleted
SELECT
  (SELECT COUNT(*) FROM runs WHERE status = 'pending' AND expires_at < NOW()) as remaining_expired_pending,
  (SELECT COUNT(*) FROM runs WHERE status = 'failed') as remaining_failed,
  (SELECT COUNT(*) FROM runs) as total_runs_remaining;

-- Reclaim disk space
VACUUM ANALYZE runs;

-- Commit the changes
COMMIT;

-- After running, check database size:
-- SELECT pg_size_pretty(pg_database_size('railway')) as database_size;
