-- Migration: Populate Catalog Data
-- Date: 2025-11-10
-- Description: Set up initial public blinks and featured items for catalog

-- ======================
-- UPDATE EXISTING BLINKS
-- ======================

-- Make some blinks public (adjust slugs to match your actual data)
UPDATE blinks
SET
  is_public = true,
  publish_to_catalog = true,
  catalog_published_at = NOW(),
  media_type = CASE
    WHEN category = 'AI/ML' THEN 'ai'
    WHEN category = 'Data' THEN 'data'
    WHEN category = 'Utilities' THEN 'utility'
    ELSE 'text'
  END
WHERE status = 'active'
LIMIT 20;

-- Set specific blinks as featured (top 5 most popular)
UPDATE blinks
SET is_featured = true
WHERE status = 'active'
ORDER BY runs DESC
LIMIT 5;

-- Mark some blinks as forkable
UPDATE blinks
SET is_forkable = true
WHERE is_featured = true;

-- ======================
-- FEATURED BLINKS TABLE
-- ======================

-- Insert featured blinks (select top 5 by runs)
INSERT INTO featured_blinks (blink_id, display_order, created_by)
SELECT
  id as blink_id,
  ROW_NUMBER() OVER (ORDER BY runs DESC) as display_order,
  'system' as created_by
FROM blinks
WHERE is_featured = true
ORDER BY runs DESC
LIMIT 5
ON CONFLICT DO NOTHING;

-- ======================
-- UPDATE METRICS
-- ======================

-- Set some sample performance metrics for featured blinks
UPDATE blinks
SET
  avg_latency_ms = FLOOR(RANDOM() * 1000 + 500)::INTEGER,  -- 500-1500ms
  success_rate_percent = (90 + RANDOM() * 10)::DECIMAL(5,2), -- 90-100%
  badges = CASE
    WHEN avg_latency_ms < 1500 THEN '["fast"]'::jsonb
    ELSE '[]'::jsonb
  END
WHERE is_featured = true;

-- Add reliable badge to high success rate blinks
UPDATE blinks
SET badges = badges || '["reliable"]'::jsonb
WHERE success_rate_percent > 99
  AND is_featured = true;

-- Add reverse badge to reward mode blinks
UPDATE blinks
SET badges = badges || '["reverse"]'::jsonb
WHERE payment_mode = 'reward'
  AND is_public = true;

-- Add forkable badge
UPDATE blinks
SET badges = badges || '["forkable"]'::jsonb
WHERE is_forkable = true;

-- ======================
-- TRENDING METRICS
-- ======================

-- Insert some sample trending metrics for today (for demo purposes)
INSERT INTO blink_trending_metrics (blink_id, metric_date, runs_count, unique_users, total_volume_usdc, avg_latency_ms, success_rate)
SELECT
  id as blink_id,
  CURRENT_DATE as metric_date,
  FLOOR(RANDOM() * 100 + 10)::INTEGER as runs_count, -- 10-110 runs
  FLOOR(RANDOM() * 50 + 5)::INTEGER as unique_users, -- 5-55 users
  (RANDOM() * 10)::DECIMAL(15,6) as total_volume_usdc, -- 0-10 USDC
  FLOOR(RANDOM() * 1000 + 500)::INTEGER as avg_latency_ms, -- 500-1500ms
  (90 + RANDOM() * 10)::DECIMAL(5,2) as success_rate -- 90-100%
FROM blinks
WHERE is_public = true
LIMIT 10
ON CONFLICT (blink_id, metric_date) DO NOTHING;

-- ======================
-- VERIFICATION
-- ======================

-- Show results
SELECT
  'Public Blinks' as category,
  COUNT(*) as count
FROM blinks
WHERE is_public = true
UNION ALL
SELECT
  'Featured Blinks' as category,
  COUNT(*) as count
FROM blinks
WHERE is_featured = true
UNION ALL
SELECT
  'Forkable Blinks' as category,
  COUNT(*) as count
FROM blinks
WHERE is_forkable = true
UNION ALL
SELECT
  'Featured Table Entries' as category,
  COUNT(*) as count
FROM featured_blinks
UNION ALL
SELECT
  'Trending Metrics' as category,
  COUNT(*) as count
FROM blink_trending_metrics
WHERE metric_date = CURRENT_DATE;