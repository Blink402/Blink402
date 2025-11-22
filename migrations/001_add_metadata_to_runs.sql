-- Migration: Add metadata column to runs table
-- Purpose: Store additional request metadata (e.g., target_wallet for wallet-analyzer Blink)
-- Date: 2025-11-08

-- Add metadata column if it doesn't exist
ALTER TABLE runs ADD COLUMN IF NOT EXISTS metadata JSONB;

-- Add comment for documentation
COMMENT ON COLUMN runs.metadata IS 'Additional request metadata (e.g., target_wallet for wallet-analyzer, custom parameters for other Blinks)';

-- Create index on metadata for faster JSONB queries (optional but recommended)
CREATE INDEX IF NOT EXISTS idx_runs_metadata ON runs USING GIN (metadata);
