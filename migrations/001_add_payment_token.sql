-- Migration: Add payment_token column to blinks table
-- Date: 2025-01-05
-- Description: Adds payment_token column to support SOL and USDC payments

-- Add payment_token column with default value 'USDC'
ALTER TABLE blinks ADD COLUMN IF NOT EXISTS payment_token VARCHAR(10) NOT NULL DEFAULT 'USDC';

-- Add CHECK constraint to ensure valid payment tokens
ALTER TABLE blinks ADD CONSTRAINT blinks_payment_token_valid CHECK (payment_token IN ('SOL', 'USDC'));

-- Update existing rows to set payment_token based on business logic
-- (All existing blinks default to USDC for backward compatibility)
UPDATE blinks SET payment_token = 'USDC' WHERE payment_token IS NULL;

-- Add comment for documentation
COMMENT ON COLUMN blinks.payment_token IS 'Payment token type: SOL or USDC';
