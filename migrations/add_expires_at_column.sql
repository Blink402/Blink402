-- Migration: Add expires_at column to runs table
-- Date: 2025-11-06
-- Purpose: Add expiration timestamp to payment references (prevents stale reference reuse)

-- Add expires_at column with default of 15 minutes from creation
ALTER TABLE runs
ADD COLUMN IF NOT EXISTS expires_at TIMESTAMP WITH TIME ZONE
DEFAULT NOW() + INTERVAL '15 minutes' NOT NULL;

-- Backfill existing rows with expires_at = created_at + 15 minutes
UPDATE runs
SET expires_at = created_at + INTERVAL '15 minutes'
WHERE expires_at IS NULL;

-- Create index for expiration queries
CREATE INDEX IF NOT EXISTS idx_runs_expires_at ON runs(expires_at);

-- Verify the column was added
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_name = 'runs' AND column_name = 'expires_at';
