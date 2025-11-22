-- Migration: Add burn-b402 blink for deflationary token burns
-- Date: 2025-01-12
-- Purpose: Create burn mechanism to reduce B402 circulating supply

DO $$
DECLARE
  v_creator_id UUID;
BEGIN
  -- Get existing creator (same as buy-b402)
  SELECT id INTO v_creator_id
  FROM creators
  WHERE wallet = 'Gk5mZUdomuc7JF9wAAioTSh8ajf98WsVLCyrofuvpUbM'
  LIMIT 1;

  -- Insert the burn-b402 blink
  INSERT INTO blinks (
    slug,
    title,
    description,
    endpoint_url,
    method,
    price_usdc,
    payment_token,
    payout_wallet,
    status,
    icon_url,
    creator_id
  ) VALUES (
    'burn-b402',
    'Burn B402 Token',
    'Buy B402 token with SOL and immediately burn it to reduce supply. Choose preset amounts (0.1, 0.5, 1 SOL) or enter a custom amount. Deflationary mechanism.',
    '/api/jupiter/burn-b402',
    'POST',
    '0.10',
    'SOL',
    'Gk5mZUdomuc7JF9wAAioTSh8ajf98WsVLCyrofuvpUbM',
    'active',
    NULL,
    v_creator_id
  )
  ON CONFLICT (slug) DO UPDATE SET
    title = EXCLUDED.title,
    description = EXCLUDED.description,
    endpoint_url = EXCLUDED.endpoint_url,
    status = EXCLUDED.status;

  RAISE NOTICE 'Successfully created/updated burn-b402 blink';
END $$;
