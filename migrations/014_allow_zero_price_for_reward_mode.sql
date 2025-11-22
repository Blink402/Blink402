-- Migration 014: Allow Zero Price for Reward Mode Blinks
-- Created: 2025-01-12
-- Purpose: Modify price_usdc constraint to allow 0 for reward mode blinks

-- Drop the old constraint
ALTER TABLE blinks DROP CONSTRAINT IF EXISTS blinks_price_positive;

-- Add new constraint that allows 0 for reward mode, requires > 0 for charge mode
ALTER TABLE blinks ADD CONSTRAINT blinks_price_positive CHECK (
  (payment_mode = 'reward' AND price_usdc >= 0) OR
  (payment_mode != 'reward' AND price_usdc > 0)
);

-- Add comment explaining the constraint
COMMENT ON CONSTRAINT blinks_price_positive ON blinks IS
  'Allows price_usdc = 0 for reward mode (users get paid), requires price_usdc > 0 for charge mode (users pay)';
