-- Migration 013: Add Thank You Claim Blink
-- Created: 2025-01-12
-- Purpose: Add thank-you reward claim blink (max 500 claims, random USDC payouts)

-- Insert thank-you-claim blink
DO $$
DECLARE
  v_creator_id UUID;
  v_giveaway_wallet VARCHAR(44) := 'F788AZHsgc8wWqL1wRMHZTixdQGLedHLnLh4UgXFRYpE';
BEGIN
  -- Get the first creator (or create one if none exists)
  SELECT id INTO v_creator_id
  FROM creators
  ORDER BY created_at ASC
  LIMIT 1;

  -- If no creator exists, create one using the giveaway wallet
  IF v_creator_id IS NULL THEN
    INSERT INTO creators (wallet)
    VALUES (v_giveaway_wallet)
    RETURNING id INTO v_creator_id;
    RAISE NOTICE 'Created new creator with wallet %', v_giveaway_wallet;
  END IF;

  -- Insert thank-you-claim blink
  INSERT INTO blinks (
    slug,
    title,
    description,
    price_usdc,
    payment_token,
    payment_mode,
    reward_amount,
    funded_wallet,
    max_claims_per_user,
    icon_url,
    endpoint_url,
    method,
    category,
    payout_wallet,
    creator_id,
    status,
    is_public,
    publish_to_catalog
  ) VALUES (
    'thank-you-claim',
    'Thank You Reward',
    'Claim your USDC reward for supporting Blink402! Limited to 500 claims total.',
    0.00, -- No charge (reward mode pays users)
    'USDC',
    'reward',
    '0.01', -- Default amount (overridden by backend random logic)
    v_giveaway_wallet, -- Funded wallet (pays rewards)
    1, -- Max 1 claim per wallet
    'https://cdn-icons-png.flaticon.com/512/2521/2521826.png', -- Gift icon
    'https://api.example.com/dummy', -- Not used (reward mode doesn't call upstream)
    'POST',
    'Community',
    v_giveaway_wallet, -- Payout wallet (same as funded wallet)
    v_creator_id,
    'active',
    false, -- Not public in catalog
    false  -- Not published to catalog
  ) ON CONFLICT (slug) DO UPDATE SET
    title = EXCLUDED.title,
    description = EXCLUDED.description,
    payment_mode = EXCLUDED.payment_mode,
    reward_amount = EXCLUDED.reward_amount,
    funded_wallet = EXCLUDED.funded_wallet,
    max_claims_per_user = EXCLUDED.max_claims_per_user,
    status = EXCLUDED.status;

  RAISE NOTICE 'Thank you claim blink created/updated successfully';
  RAISE NOTICE 'Giveaway wallet: %', v_giveaway_wallet;
  RAISE NOTICE 'Max claims: 500 (enforced by backend)';
  RAISE NOTICE 'Payment mode: reward (backend determines random USDC amounts)';
END $$;
