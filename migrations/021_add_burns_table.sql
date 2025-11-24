-- Migration: Add burns table for B402 auto-burn tracking
-- Purpose: Track deflationary tokenomics - every blink execution burns B402 tokens
-- Created: 2025-11-24

-- Create burns table
CREATE TABLE IF NOT EXISTS burns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id UUID NOT NULL REFERENCES runs(id) ON DELETE CASCADE,
  amount_b402 BIGINT NOT NULL CHECK (amount_b402 > 0),
  tx_signature TEXT NOT NULL UNIQUE,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_burns_run_id ON burns(run_id);
CREATE INDEX IF NOT EXISTS idx_burns_created_at ON burns(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_burns_tx_signature ON burns(tx_signature);

-- Add comment for documentation
COMMENT ON TABLE burns IS 'Tracks B402 token burns for deflationary tokenomics. Each row represents tokens permanently removed from circulation.';
COMMENT ON COLUMN burns.run_id IS 'Reference to the blink execution that triggered this burn';
COMMENT ON COLUMN burns.amount_b402 IS 'Amount of B402 tokens burned (in base units with 9 decimals)';
COMMENT ON COLUMN burns.tx_signature IS 'Solana transaction signature of the burn transaction';

-- Grant permissions (assuming app user exists)
-- GRANT SELECT, INSERT ON burns TO app_user;
