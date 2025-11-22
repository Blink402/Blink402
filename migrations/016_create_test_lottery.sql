-- Migration 016: Create Test Lottery Blink
-- Creates a test lottery for immediate testing

-- 1. Create lottery creator (using platform wallet)
INSERT INTO creators (wallet, display_name, bio, created_at)
VALUES (
  'ErFb9cHKm1XJUdZ3GvgHtQyS94R95TJSU6SsZ9XCsAXA',
  'Blink402 Lottery',
  'Official Blink402 lottery - win USDC every 15 minutes!',
  NOW()
)
ON CONFLICT (wallet) DO UPDATE
SET display_name = EXCLUDED.display_name,
    bio = EXCLUDED.bio;

-- 2. Create test lottery blink
INSERT INTO blinks (
  slug,
  title,
  description,
  price_usdc,
  endpoint_url,
  method,
  category,
  icon_url,
  payout_wallet,
  payment_mode,
  creator_id,
  runs,
  status,
  payment_token,
  lottery_enabled,
  lottery_round_duration_minutes,
  is_public,
  is_featured,
  publish_to_catalog,
  created_at
)
VALUES (
  'b402-lottery',
  'Blink402 Lottery',
  'Enter for 1 USDC, win up to 50% of the prize pool! Draws every 15 minutes. 50% 1st place, 20% 2nd, 15% 3rd, 15% buyback.',
  '1.00',
  'https://blink402.dev/api/lottery/dummy', -- Dummy endpoint (not used)
  'POST',
  'lottery',
  'https://blink402.dev/lottery-icon.png',
  'ErFb9cHKm1XJUdZ3GvgHtQyS94R95TJSU6SsZ9XCsAXA',
  'charge',
  (SELECT id FROM creators WHERE wallet = 'ErFb9cHKm1XJUdZ3GvgHtQyS94R95TJSU6SsZ9XCsAXA'),
  0,
  'active',
  'USDC',
  TRUE,
  15,
  TRUE,
  TRUE,
  TRUE,
  NOW()
)
ON CONFLICT (slug) DO UPDATE
SET lottery_enabled = TRUE,
    lottery_round_duration_minutes = 15,
    is_public = TRUE,
    is_featured = TRUE,
    publish_to_catalog = TRUE,
    status = 'active';

-- 3. Log creation
COMMENT ON TABLE lottery_rounds IS 'Lottery system ready - use /lottery/b402-lottery/enter to play';
