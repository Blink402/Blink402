-- ============================================
-- EXECUTE DATABASE CLEANUP
-- ============================================
-- Copy/paste this entire block into Railway psql

BEGIN;

-- Show preview first
SELECT '=== CLEANUP PREVIEW ===' as info;

SELECT
  'Expired Pending Runs (>1 day old)' as cleanup_item,
  COUNT(*) as records_to_delete
FROM runs
WHERE status = 'pending'
  AND expires_at < NOW()
  AND created_at < NOW() - INTERVAL '1 day'

UNION ALL

SELECT
  'Old Failed Runs (>30 days)',
  COUNT(*)
FROM runs
WHERE status = 'failed'
  AND created_at < NOW() - INTERVAL '30 days'

UNION ALL

SELECT
  'Runs from Archived Blinks (>30 days)',
  COUNT(*)
FROM runs
WHERE blink_id IN (SELECT id FROM blinks WHERE status = 'archived')
  AND created_at < NOW() - INTERVAL '30 days';

-- If the counts look reasonable, comment out ROLLBACK and uncomment the DELETE statements

-- CLEANUP: Expired pending runs
-- DELETE FROM runs WHERE status = 'pending' AND expires_at < NOW() AND created_at < NOW() - INTERVAL '1 day';

-- CLEANUP: Old failed runs
-- DELETE FROM runs WHERE status = 'failed' AND created_at < NOW() - INTERVAL '30 days';

-- CLEANUP: Runs from archived blinks
-- DELETE FROM runs WHERE blink_id IN (SELECT id FROM blinks WHERE status = 'archived') AND created_at < NOW() - INTERVAL '30 days';

-- MAINTENANCE: Reclaim space
-- VACUUM ANALYZE runs;

-- Preview mode - shows what would be deleted but doesn't commit
-- To execute: Comment out ROLLBACK and uncomment DELETE statements above
ROLLBACK;

-- After reviewing, run this to actually execute:
-- Replace ROLLBACK with COMMIT and uncomment DELETE statements
