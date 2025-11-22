-- Fix broken endpoint methods (keeping all content types active)
-- Only fixing actual METHOD errors, not blocking any content types

-- Fix is-it-down-checker: isitup.org only accepts GET, not POST
UPDATE blinks
SET
  method = 'GET',
  updated_at = NOW()
WHERE slug = 'is-it-down-checker';

-- Fix lorem-picsum: Image service only accepts GET
UPDATE blinks
SET
  method = 'GET',
  updated_at = NOW()
WHERE slug = 'lorem-picsum';

-- Keep pump.fun ACTIVE - it's a valid website to monetize!
-- (no changes needed, it should work fine as website content)

-- Keep the Twitter/X endpoint for now - will check if it exists
-- If it doesn't exist, users will get a clear error and can update

-- Query to verify the fixes
SELECT
  slug,
  title,
  method,
  endpoint_url,
  status,
  payment_token,
  price_usdc
FROM blinks
WHERE slug IN ('is-it-down-checker', 'lorem-picsum', 'b-402-live-', 'x')
ORDER BY slug;

-- Show all active blinks for review
SELECT
  slug,
  title,
  method,
  endpoint_url,
  status
FROM blinks
WHERE status = 'active'
ORDER BY created_at DESC;