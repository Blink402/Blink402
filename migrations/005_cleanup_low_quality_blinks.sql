-- Migration: Clean up low-quality blinks
-- Date: 2025-11-10
-- Description: Hide low-quality blinks from catalog by applying publishing standards

-- First, set ALL blinks to private by default
UPDATE blinks
SET
  is_public = FALSE,
  publish_to_catalog = FALSE
WHERE 1=1;

-- Now, only publish blinks that meet ALL quality criteria:
-- 1. Have proper metadata
-- 2. Are active
-- 3. Have good performance (or are new)
-- 4. Have low report count
UPDATE blinks
SET
  is_public = TRUE,
  publish_to_catalog = TRUE,
  catalog_published_at = CASE
    WHEN catalog_published_at IS NULL THEN NOW()
    ELSE catalog_published_at
  END
WHERE
  -- Must be active
  status = 'active'
  -- Must have valid title (not empty, not just numbers)
  AND title IS NOT NULL
  AND title != ''
  AND LENGTH(title) >= 3
  AND title !~ '^\d+$'  -- Not just numbers
  -- Must have meaningful description
  AND description IS NOT NULL
  AND LENGTH(description) >= 20
  AND description NOT LIKE '%fdsfsdf%'
  AND description NOT LIKE '%asdf%'
  AND description NOT LIKE '%test%test%'
  AND description NOT LIKE '%lorem ipsum%'
  -- Must not be unhealthy
  AND (health_status != 'unhealthy' OR health_status IS NULL)
  -- Must have acceptable success rate (or be new)
  AND (
    success_rate_percent IS NULL
    OR success_rate_percent >= 70
    OR runs < 5  -- New blinks get a chance
  )
  -- Must not have too many reports
  AND (reported_count IS NULL OR reported_count <= 5)
  -- Must have reasonable pricing (not spam prices)
  AND price_usdc >= 0.001
  AND price_usdc <= 100;

-- Ensure our featured blinks remain published (if they exist)
UPDATE blinks
SET
  is_public = TRUE,
  publish_to_catalog = TRUE
WHERE id IN (
  SELECT blink_id FROM featured_blinks
  WHERE featured_until IS NULL OR featured_until > NOW()
);

-- Mark known quality blinks as public (specific slugs we want to keep)
UPDATE blinks
SET
  is_public = TRUE,
  publish_to_catalog = TRUE
WHERE slug IN (
  'wallet-analyzer',
  'x',
  'lorem-picsum',
  'solana-token-prices-from-jupiter',
  'random-quote',
  'country-info',
  'dog-image',
  'public-ip',
  'bored-activity',
  'dog-facts',
  'cat-facts',
  'random-advice',
  'chuck-jokes',
  'ip-geolocation',
  'blockchain-info-bitcoin-stats'
);

-- Update metrics for published blinks
UPDATE blinks b
SET
  avg_latency_ms = subq.avg_latency,
  success_rate_percent = subq.success_rate
FROM (
  SELECT
    blink_id,
    AVG(duration_ms)::INTEGER as avg_latency,
    (COUNT(CASE WHEN status = 'executed' THEN 1 END)::DECIMAL / NULLIF(COUNT(*), 0) * 100) as success_rate
  FROM runs
  WHERE created_at > NOW() - INTERVAL '30 days'
  GROUP BY blink_id
) subq
WHERE b.id = subq.blink_id
  AND b.is_public = TRUE;

-- Update badges for published blinks
UPDATE blinks
SET badges = calculate_blink_badges(id)
WHERE is_public = TRUE;

-- Log the results
DO $$
DECLARE
  total_count INTEGER;
  public_count INTEGER;
  private_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO total_count FROM blinks;
  SELECT COUNT(*) INTO public_count FROM blinks WHERE is_public = TRUE AND publish_to_catalog = TRUE;
  SELECT COUNT(*) INTO private_count FROM blinks WHERE is_public = FALSE OR publish_to_catalog = FALSE;

  RAISE NOTICE 'Migration complete:';
  RAISE NOTICE '  Total blinks: %', total_count;
  RAISE NOTICE '  Public/Published: %', public_count;
  RAISE NOTICE '  Private/Unpublished: %', private_count;
END $$;