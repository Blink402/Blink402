-- Create Slot Machine Blink Entry (FIXED VERSION)
-- Run this SQL against your PostgreSQL database

-- Step 1: Check if you have an existing creator, if so use it
-- If not, create one with your actual 44-character Solana wallet address
DO $$
DECLARE
  creator_wallet VARCHAR(44) := 'H6qTyy7pHTH6dQuKCRFnm9D9EQGLJZ7DVFCMQxvRpump'; -- Replace with your wallet
  creator_uuid UUID;
  payout_wallet VARCHAR(44) := 'H6qTyy7pHTH6dQuKCRFnm9D9EQGLJZ7DVFCMQxvRpump'; -- Wallet that receives payments
  funded_wallet VARCHAR(44) := 'H6qTyy7pHTH6dQuKCRFnm9D9EQGLJZ7DVFCMQxvRpump'; -- Wallet that pays winnings (must have USDC!)
BEGIN
  -- Get or create creator
  SELECT id INTO creator_uuid FROM creators WHERE wallet = creator_wallet;

  IF creator_uuid IS NULL THEN
    INSERT INTO creators (wallet, display_name)
    VALUES (creator_wallet, 'Blink402 Official')
    RETURNING id INTO creator_uuid;

    RAISE NOTICE 'Created new creator with ID: %', creator_uuid;
  ELSE
    RAISE NOTICE 'Using existing creator with ID: %', creator_uuid;
  END IF;

  -- Insert or update slot-machine blink
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
    payout_wallet,  -- Wallet that receives payments
    'charge',  -- User pays to spin
    NULL,  -- No fixed reward amount (varies based on win)
    funded_wallet,  -- Wallet that pays out winnings (MUST HAVE USDC BALANCE!)
    999999,  -- Unlimited spins per user
    creator_uuid,
    'healthy'
  )
  ON CONFLICT (slug) DO UPDATE SET
    title = EXCLUDED.title,
    description = EXCLUDED.description,
    price_usdc = EXCLUDED.price_usdc,
    funded_wallet = EXCLUDED.funded_wallet,
    updated_at = NOW();

  RAISE NOTICE 'Slot machine blink created/updated successfully!';
END $$;

-- Verify the insert
SELECT
  slug,
  title,
  price_usdc,
  payment_token,
  category,
  status,
  payout_wallet,
  funded_wallet,
  creator_id
FROM blinks
WHERE slug = 'slot-machine';
