-- TEST SIMULATION: Lottery Buyback Flow (No Real Money)
-- This script simulates a complete lottery round with buyback to verify the system works
-- Safe to run - creates test data that can be cleaned up

-- Step 1: Create a test lottery round
DO $$
DECLARE
  v_blink_id UUID;
  v_round_id UUID;
  v_platform_fee NUMERIC(20,6);
BEGIN
  -- Get the b402-lottery blink ID
  SELECT id INTO v_blink_id FROM blinks WHERE slug = 'b402-lottery';

  IF v_blink_id IS NULL THEN
    RAISE EXCEPTION 'b402-lottery blink not found!';
  END IF;

  -- Create a test round that has already ended (15 minutes ago)
  INSERT INTO lottery_rounds (
    id,
    blink_id,
    round_number,
    started_at,
    ended_at,
    total_entry_fee_usdc,
    total_entries,
    status,
    buyback_status
  ) VALUES (
    gen_random_uuid(),
    v_blink_id,
    9999, -- Test round number
    NOW() - INTERVAL '30 minutes',
    NOW() - INTERVAL '15 minutes',
    10.00, -- 10 USDC total entry fees (e.g., 10 players × 1 USDC)
    10,
    'closed',
    'pending'
  ) RETURNING id INTO v_round_id;

  -- Calculate platform fee (15% of total)
  v_platform_fee := 10.00 * 0.15; -- Should be 1.50 USDC

  RAISE NOTICE '✅ Test lottery round created:';
  RAISE NOTICE '   Round ID: %', v_round_id;
  RAISE NOTICE '   Total entry fees: 10.00 USDC';
  RAISE NOTICE '   Platform fee (15%%): % USDC', v_platform_fee;
  RAISE NOTICE '   Prize pool breakdown:';
  RAISE NOTICE '     - 1st place (50%%): 5.00 USDC';
  RAISE NOTICE '     - 2nd place (20%%): 2.00 USDC';
  RAISE NOTICE '     - 3rd place (15%%): 1.50 USDC';
  RAISE NOTICE '     - Buyback (15%%):   % USDC', v_platform_fee;
  RAISE NOTICE '';
  RAISE NOTICE '⏳ Buyback worker will process this round within 5 minutes';
  RAISE NOTICE '   Worker polls every 5 minutes for rounds with buyback_status = ''pending''';
  RAISE NOTICE '';
  RAISE NOTICE '🔍 To check buyback progress, run:';
  RAISE NOTICE '   SELECT round_number, total_entry_fee_usdc, buyback_status, buyback_tx_signature, buyback_executed_at';
  RAISE NOTICE '   FROM lottery_rounds WHERE round_number = 9999;';
END $$;

-- Display the test round
SELECT
  round_number,
  total_entry_fee_usdc,
  total_entries,
  status,
  buyback_status,
  started_at,
  ended_at,
  buyback_tx_signature,
  buyback_executed_at
FROM lottery_rounds
WHERE round_number = 9999;

-- Show what the buyback worker will see
SELECT
  id,
  round_number,
  total_entry_fee_usdc,
  (total_entry_fee_usdc * 0.15) AS platform_fee_amount,
  buyback_status,
  ended_at
FROM lottery_rounds
WHERE buyback_status = 'pending'
  AND ended_at IS NOT NULL
  AND status IN ('closed', 'distributed')
ORDER BY ended_at ASC;
