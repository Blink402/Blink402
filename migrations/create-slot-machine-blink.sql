-- Create Slot Machine Blink Entry
-- Run this SQL against your PostgreSQL database

-- First, ensure you have a creator. If not, create one:
-- Replace 'YOUR_WALLET_ADDRESS' with your actual Solana wallet address
INSERT INTO creators (wallet, display_name)
VALUES ('YOUR_WALLET_ADDRESS', 'Blink402 Official')
ON CONFLICT (wallet) DO NOTHING;

-- Then, insert the slot-machine blink
-- Replace 'YOUR_WALLET_ADDRESS' with your actual Solana wallet address (must match creator wallet above)
-- Replace 'YOUR_CREATOR_WALLET' with the wallet that will fund payouts (needs USDC balance)
INSERT INTO blinks (
  slug,
  title,
  description,
  price_usdc,
  payment_token,
  icon_url,
  endpoint_url,
  method,
  category,
  runs,
  status,
  payout_wallet,
  payment_mode,
  reward_amount,
  funded_wallet,
  max_claims_per_user,
  creator_id,
  health_status
)
VALUES (
  'slot-machine',
  'Lucky Slot Machine',
  'Spin the reels for a chance to win up to 50x your bet! Each spin costs 0.05 USDC with a 98% RTP. Provably fair using SHA-256. Instant payouts sent directly to your wallet.',
  0.05,
  'USDC',
  'https://blink402.dev/slot-machine-icon.png',
  '/api/slots/spin',
  'POST',
  'Gaming',
  0,
  'active',
  'YOUR_WALLET_ADDRESS',  -- Wallet that receives payments
  'charge',  -- User pays to spin
  NULL,  -- No fixed reward amount (varies based on win)
  'YOUR_CREATOR_WALLET',  -- Wallet that pays out winnings (needs USDC balance!)
  999999,  -- Unlimited spins per user
  (SELECT id FROM creators WHERE wallet = 'YOUR_WALLET_ADDRESS' LIMIT 1),
  'healthy'
)
ON CONFLICT (slug) DO UPDATE SET
  title = EXCLUDED.title,
  description = EXCLUDED.description,
  price_usdc = EXCLUDED.price_usdc,
  updated_at = NOW();

-- Verify the insert
SELECT
  slug,
  title,
  price_usdc,
  payment_token,
  category,
  status,
  payout_wallet,
  funded_wallet
FROM blinks
WHERE slug = 'slot-machine';
