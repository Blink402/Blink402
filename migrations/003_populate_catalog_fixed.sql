-- Migration: Populate Catalog Data (Fixed)
-- Date: 2025-11-10
-- Description: Set up initial public blinks and featured items for catalog

-- First, let's check what blinks we have
SELECT id, slug, title, status, runs FROM blinks WHERE status = 'active' ORDER BY runs DESC LIMIT 10;

-- ======================
-- UPDATE EXISTING BLINKS
-- ======================

-- Make top active blinks public using subquery
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
WHERE id IN (
  SELECT id FROM blinks
  WHERE status = 'active'
  ORDER BY runs DESC
  LIMIT 20
);

-- Set top 5 as featured
UPDATE blinks
SET is_featured = true
WHERE id IN (
  SELECT id FROM blinks
  WHERE status = 'active' AND is_public = true
  ORDER BY runs DESC
  LIMIT 5
);

-- Mark featured blinks as forkable
UPDATE blinks
SET is_forkable = true
WHERE is_featured = true;

-- ======================
-- FEATURED BLINKS TABLE
-- ======================

-- Clear existing featured entries
DELETE FROM featured_blinks;

-- Insert featured blinks
INSERT INTO featured_blinks (blink_id, display_order, created_by)
SELECT
  id as blink_id,
  ROW_NUMBER() OVER (ORDER BY runs DESC) as display_order,
  'system' as created_by
FROM blinks
WHERE is_featured = true
ORDER BY runs DESC
LIMIT 5;

-- ======================
-- UPDATE METRICS
-- ======================

-- Set sample performance metrics for all public blinks
UPDATE blinks
SET
  avg_latency_ms = FLOOR(RANDOM() * 1000 + 500)::INTEGER,
  success_rate_percent = (90 + RANDOM() * 10)::DECIMAL(5,2)
WHERE is_public = true;

-- Update badges based on metrics
UPDATE blinks
SET badges = '[]'::jsonb
WHERE is_public = true;

-- Add fast badge
UPDATE blinks
SET badges = badges || '["fast"]'::jsonb
WHERE avg_latency_ms < 1500
  AND is_public = true;

-- Add reliable badge
UPDATE blinks
SET badges = badges || '["reliable"]'::jsonb
WHERE success_rate_percent > 99
  AND is_public = true;

-- Add reverse badge
UPDATE blinks
SET badges = badges || '["reverse"]'::jsonb
WHERE payment_mode = 'reward'
  AND is_public = true;

-- Add forkable badge
UPDATE blinks
SET badges = badges || '["forkable"]'::jsonb
WHERE is_forkable = true;

-- Add verified badge for some featured blinks
UPDATE blinks
SET badges = badges || '["verified"]'::jsonb
WHERE id IN (
  SELECT b.id FROM blinks b
  JOIN creators c ON b.creator_id = c.id
  WHERE b.is_featured = true
  LIMIT 2
);

-- ======================
-- TRENDING METRICS
-- ======================

-- Clear existing metrics for today
DELETE FROM blink_trending_metrics WHERE metric_date = CURRENT_DATE;

-- Insert trending metrics for public blinks
INSERT INTO blink_trending_metrics (blink_id, metric_date, runs_count, unique_users, total_volume_usdc, avg_latency_ms, success_rate)
SELECT
  id as blink_id,
  CURRENT_DATE as metric_date,
  FLOOR(RANDOM() * 100 + 10)::INTEGER as runs_count,
  FLOOR(RANDOM() * 50 + 5)::INTEGER as unique_users,
  (RANDOM() * 10)::DECIMAL(15,6) as total_volume_usdc,
  FLOOR(RANDOM() * 1000 + 500)::INTEGER as avg_latency_ms,
  (90 + RANDOM() * 10)::DECIMAL(5,2) as success_rate
FROM blinks
WHERE is_public = true
LIMIT 10;

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
  'Featured with badges' as category,
  COUNT(*) as count
FROM blinks
WHERE is_featured = true AND badges != '[]'::jsonb
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

-- Show featured blinks details
SELECT
  b.slug,
  b.title,
  b.is_public,
  b.is_featured,
  b.badges,
  b.runs,
  fb.display_order
FROM blinks b
LEFT JOIN featured_blinks fb ON b.id = fb.blink_id
WHERE b.is_featured = true
ORDER BY fb.display_order;