-- Migration: Add performance indexes for frequently queried columns
-- Date: 2025-11-06
-- Purpose: Improve query performance for payment verification, dashboard queries, and blink lookups
-- Related: Code audit critical fixes

-- ============================================================
-- INDEXES FOR RUNS TABLE
-- ============================================================

-- Index on reference column (queried on every payment verification)
-- This is the most critical index as it's used in the hot path
CREATE INDEX IF NOT EXISTS idx_runs_reference ON runs(reference);

-- Composite index for dashboard queries (blink_id, status)
-- Used when fetching run statistics for a specific blink
CREATE INDEX IF NOT EXISTS idx_runs_blink_status ON runs(blink_id, status);

-- Index on created_at for time-based queries
CREATE INDEX IF NOT EXISTS idx_runs_created_at ON runs(created_at DESC);

-- ============================================================
-- INDEXES FOR BLINKS TABLE
-- ============================================================

-- Index on slug column (queried on every action request)
-- Already should exist as unique constraint, but adding explicit index for clarity
-- Note: Unique constraints automatically create indexes in PostgreSQL
-- CREATE UNIQUE INDEX IF NOT EXISTS idx_blinks_slug ON blinks(slug);
-- Skipping as UNIQUE constraint on slug already creates an index

-- Composite index for creator dashboard queries (creator_id, status)
-- Used when fetching all blinks for a creator with filtering
CREATE INDEX IF NOT EXISTS idx_blinks_creator_status ON blinks(creator_id, status);

-- Index on status for global filtering
CREATE INDEX IF NOT EXISTS idx_blinks_status ON blinks(status);

-- Index on created_at for chronological ordering
CREATE INDEX IF NOT EXISTS idx_blinks_created_at ON blinks(created_at DESC);

-- ============================================================
-- INDEXES FOR CREATORS TABLE
-- ============================================================

-- Index on wallet address (lookups by wallet address)
-- Already should exist as unique constraint
-- CREATE UNIQUE INDEX IF NOT EXISTS idx_creators_wallet ON creators(wallet);
-- Skipping as UNIQUE constraint on wallet already creates an index

-- ============================================================
-- INDEXES FOR RECEIPTS TABLE (if applicable)
-- ============================================================

-- Index on run_id for receipt lookups
CREATE INDEX IF NOT EXISTS idx_receipts_run_id ON receipts(run_id);

-- ============================================================
-- ANALYZE TABLES
-- ============================================================

-- Update table statistics so query planner can use new indexes
ANALYZE runs;
ANALYZE blinks;
ANALYZE creators;
ANALYZE receipts;

-- ============================================================
-- VERIFICATION QUERIES
-- ============================================================

-- Run these to verify indexes were created successfully:
-- SELECT schemaname, tablename, indexname, indexdef FROM pg_indexes WHERE tablename IN ('runs', 'blinks', 'creators', 'receipts') ORDER BY tablename, indexname;

-- Check index usage over time:
-- SELECT schemaname, tablename, indexname, idx_scan, idx_tup_read, idx_tup_fetch FROM pg_stat_user_indexes WHERE schemaname = 'public' ORDER BY idx_scan DESC;
