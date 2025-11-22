-- Migration: Add Wallet Analyzer Blink
-- This migration adds the wallet analyzer Blink to the database

-- Insert wallet analyzer Blink using the first available creator
-- If no creators exist, this will fail - run sample-blinks.sql first to create a creator
DO $$
DECLARE
  v_creator_id UUID;
  v_payout_wallet VARCHAR(44);
BEGIN
  -- Get the first creator (or a specific creator if you want)
  SELECT id, wallet INTO v_creator_id, v_payout_wallet
  FROM creators
  ORDER BY created_at ASC
  LIMIT 1;

  -- Only insert if we found a creator
  IF v_creator_id IS NOT NULL THEN
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
      payout_wallet,
      creator_id,
      status
    ) VALUES (
      'wallet-analyzer',
      'Solana Wallet Analyzer',
      'Deep analysis of any Solana wallet. Get token holdings, transaction history, tokens created, PnL, and more. Powered by Helius.',
      0.01,
      'SOL',
      'https://cdn-icons-png.flaticon.com/512/2092/2092663.png',
      '/wallet-analysis',
      'POST',
      'Web3',
      v_payout_wallet,
      v_creator_id,
      'active'
    ) ON CONFLICT (slug) DO UPDATE SET
      title = EXCLUDED.title,
      description = EXCLUDED.description,
      price_usdc = EXCLUDED.price_usdc,
      payment_token = EXCLUDED.payment_token,
      icon_url = EXCLUDED.icon_url,
      endpoint_url = EXCLUDED.endpoint_url,
      method = EXCLUDED.method,
      category = EXCLUDED.category,
      status = EXCLUDED.status;

    RAISE NOTICE 'Wallet analyzer Blink created/updated successfully';
  ELSE
    RAISE NOTICE 'No creators found. Please create a creator first.';
  END IF;
END $$;
