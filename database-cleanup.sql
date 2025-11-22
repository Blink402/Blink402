-- ============================================
-- DATABASE CLEANUP SCRIPT
-- ============================================
-- Run these in order, reviewing results before proceeding
-- Always backup before running cleanup operations!

-- ============================================
-- LEVEL 1: SAFE CLEANUP (Recommended)
-- ============================================

-- 1.1: Delete expired pending runs (never completed, past 15min window)
-- These will never be paid and are just cluttering the database
DELETE FROM runs
WHERE status = 'pending'
  AND expires_at < NOW()
  AND created_at < NOW() - INTERVAL '1 day'; -- Extra safety: at least 1 day old

-- Check: How many would be deleted?
-- SELECT COUNT(*) FROM runs WHERE status = 'pending' AND expires_at < NOW() AND created_at < NOW() - INTERVAL '1 day';

-- 1.2: Delete old failed runs (older than 30 days)
-- Keep recent failures for debugging, remove old ones
DELETE FROM runs
WHERE status = 'failed'
  AND created_at < NOW() - INTERVAL '30 days';

-- Check: How many would be deleted?
-- SELECT COUNT(*) FROM runs WHERE status = 'failed' AND created_at < NOW() - INTERVAL '30 days';

-- 1.3: Clean up old reward claims (older than 90 days)
-- Historical reward data that's no longer needed
DELETE FROM reward_claims
WHERE claimed_at < NOW() - INTERVAL '90 days';

-- Check: How many would be deleted?
-- SELECT COUNT(*) FROM reward_claims WHERE claimed_at < NOW() - INTERVAL '90 days';

-- ============================================
-- LEVEL 2: MODERATE CLEANUP (Review First)
-- ============================================

-- 2.1: Delete runs from archived blinks (older than 30 days)
-- If a blink is archived, its old run history isn't needed
DELETE FROM runs
WHERE blink_id IN (
  SELECT id FROM blinks WHERE status = 'archived'
)
AND created_at < NOW() - INTERVAL '30 days';

-- Check: How many would be deleted?
-- SELECT COUNT(*) FROM runs
-- WHERE blink_id IN (SELECT id FROM blinks WHERE status = 'archived')
-- AND created_at < NOW() - INTERVAL '30 days';

-- 2.2: Delete old settled creator debts (settled for 90+ days)
-- Keep for accounting purposes, but can remove very old settled debts
DELETE FROM creator_debts
WHERE settled = true
  AND settled_at < NOW() - INTERVAL '90 days';

-- Check: How many would be deleted?
-- SELECT COUNT(*) FROM creator_debts WHERE settled = true AND settled_at < NOW() - INTERVAL '90 days';

-- 2.3: Delete old issued refunds (older than 90 days)
-- Keep recent refunds for accounting/support, remove very old ones
DELETE FROM refunds
WHERE status = 'issued'
  AND processed_at < NOW() - INTERVAL '90 days';

-- Check: How many would be deleted?
-- SELECT COUNT(*) FROM refunds WHERE status = 'issued' AND processed_at < NOW() - INTERVAL '90 days';

-- ============================================
-- LEVEL 3: AGGRESSIVE CLEANUP (Caution!)
-- ============================================

-- 3.1: Permanently delete archived blinks and all associated data
-- WARNING: This is irreversible! Only run if you're sure.
-- DELETE FROM blinks WHERE status = 'archived' AND created_at < NOW() - INTERVAL '90 days';
-- (CASCADE will delete all associated runs, receipts, refunds, etc.)

-- 3.2: Delete old executed runs (older than 90 days)
-- WARNING: This removes successful transaction history
-- DELETE FROM runs WHERE status = 'executed' AND executed_at < NOW() - INTERVAL '90 days';

-- ============================================
-- MAINTENANCE: VACUUM AND ANALYZE
-- ============================================

-- After cleanup, reclaim disk space and update statistics
VACUUM ANALYZE runs;
VACUUM ANALYZE blinks;
VACUUM ANALYZE refunds;
VACUUM ANALYZE reward_claims;
VACUUM ANALYZE creator_debts;

-- ============================================
-- SUMMARY QUERY: Check database size after cleanup
-- ============================================

SELECT
  schemaname,
  tablename,
  pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size,
  pg_total_relation_size(schemaname||'.'||tablename) AS size_bytes
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;
