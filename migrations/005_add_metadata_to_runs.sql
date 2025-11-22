-- Migration: Add metadata column to runs table for storing additional data
-- Date: 2025-01-10
-- Purpose: Store user input parameters like target_wallet for wallet-analyzer

-- Add metadata column to store JSON data including target_wallet and other parameters
ALTER TABLE runs
  ADD COLUMN IF NOT EXISTS metadata JSONB;

-- Add comment to explain the column
COMMENT ON COLUMN runs.metadata IS 'JSON data for storing user input parameters (e.g., target_wallet for wallet-analyzer)';

-- Create index for faster queries on metadata
CREATE INDEX IF NOT EXISTS idx_runs_metadata ON runs USING GIN (metadata);

-- Verify the change
DO $$
DECLARE
  col_exists boolean;
BEGIN
  SELECT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'runs' AND column_name = 'metadata'
  ) INTO col_exists;

  IF NOT col_exists THEN
    RAISE EXCEPTION 'Failed to add metadata column to runs table';
  END IF;

  RAISE NOTICE 'Successfully added metadata column to runs table';
END $$;