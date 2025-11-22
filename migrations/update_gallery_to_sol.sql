-- Migration: Update Gallery Blinks to use SOL instead of USDC
-- This updates existing gallery blinks to use SOL as payment token

-- Update all gallery blinks to use SOL
UPDATE blinks
SET payment_token = 'SOL'
WHERE endpoint_url LIKE '%/gallery/%';

-- Optional: Update the price if you want to change from USDC to SOL equivalent
-- For example, if price was 2.00 USDC, you might want 0.05 SOL
-- Uncomment and adjust the conversion rate as needed:
-- UPDATE blinks
-- SET price_usdc = 0.05
-- WHERE endpoint_url LIKE '%/gallery/%' AND price_usdc = 2.00;

-- Verify the update
SELECT slug, title, price_usdc, payment_token, endpoint_url
FROM blinks
WHERE endpoint_url LIKE '%/gallery/%';