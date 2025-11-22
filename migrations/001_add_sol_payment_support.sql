-- Migration: Add SOL payment support
-- Adds payment_token column to support both SOL and USDC payments

-- Add payment_token column (defaults to USDC for existing blinks)
ALTER TABLE blinks
ADD COLUMN IF NOT EXISTS payment_token VARCHAR(10) DEFAULT 'USDC' NOT NULL;

-- Add constraint to ensure valid payment tokens
ALTER TABLE blinks
ADD CONSTRAINT blinks_payment_token_valid
CHECK (payment_token IN ('SOL', 'USDC'));

-- Rename price_usdc to price for clarity (it now applies to both SOL and USDC)
ALTER TABLE blinks
RENAME COLUMN price_usdc TO price;

-- Update comments
COMMENT ON COLUMN blinks.payment_token IS 'Payment currency: SOL or USDC';
COMMENT ON COLUMN blinks.price IS 'Price per execution in the specified payment_token (e.g., 0.01 SOL or 0.01 USDC)';

-- Create index for filtering by payment type
CREATE INDEX IF NOT EXISTS idx_blinks_payment_token ON blinks(payment_token);
