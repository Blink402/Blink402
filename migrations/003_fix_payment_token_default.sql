-- Migration: Fix payment_token default from USDC to SOL
-- Changes the default payment token from USDC to SOL since most users have SOL

-- First, update all existing blinks with NULL or USDC to SOL (if needed)
-- This is safe to run multiple times
UPDATE blinks
SET payment_token = 'SOL'
WHERE payment_token = 'USDC' OR payment_token IS NULL;

-- Drop the old default
ALTER TABLE blinks
ALTER COLUMN payment_token DROP DEFAULT;

-- Set new default to SOL
ALTER TABLE blinks
ALTER COLUMN payment_token SET DEFAULT 'SOL';

-- Update comment
COMMENT ON COLUMN blinks.payment_token IS 'Payment currency: SOL or USDC (defaults to SOL)';
