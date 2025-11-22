-- Migration: Add x402 payment tracking fields to runs table
-- Date: 2025-01-09
-- Description: Add columns to track ONCHAIN facilitator-based x402 payments

-- Add x402-related columns to runs table
ALTER TABLE runs
  ADD COLUMN IF NOT EXISTS payment_method VARCHAR(20) DEFAULT 'x402',
  ADD COLUMN IF NOT EXISTS facilitator VARCHAR(100),
  ADD COLUMN IF NOT EXISTS facilitator_tx_hash VARCHAR(255);

-- Add check constraint for payment_method
ALTER TABLE runs
  DROP CONSTRAINT IF EXISTS runs_payment_method_check;

ALTER TABLE runs
  ADD CONSTRAINT runs_payment_method_check
  CHECK (payment_method IN ('solana_actions', 'x402'));

-- Add index for facilitator lookups (for analytics)
CREATE INDEX IF NOT EXISTS idx_runs_facilitator ON runs(facilitator);
CREATE INDEX IF NOT EXISTS idx_runs_payment_method ON runs(payment_method);

-- Add comments for documentation
COMMENT ON COLUMN runs.payment_method IS 'Payment protocol used: solana_actions (legacy) or x402 (ONCHAIN facilitator)';
COMMENT ON COLUMN runs.facilitator IS 'x402 facilitator used for payment (e.g., OctonetAI, PayAI, Coinbase CDP, Daydreams)';
COMMENT ON COLUMN runs.facilitator_tx_hash IS 'Transaction hash returned by the facilitator after settlement';

-- Update existing rows to use x402 as default (optional - can be left as is)
-- UPDATE runs SET payment_method = 'x402' WHERE payment_method IS NULL;
