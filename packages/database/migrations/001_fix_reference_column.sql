-- Migration: Fix reference column type from UUID to VARCHAR(44)
-- Reason: Solana Pay uses PublicKey (base58 strings) as references, not UUIDs
-- Date: 2025-01-04

-- Drop the existing runs table constraint on reference if it exists
ALTER TABLE runs DROP CONSTRAINT IF EXISTS runs_reference_key;

-- Change the reference column type
ALTER TABLE runs ALTER COLUMN reference TYPE VARCHAR(44);

-- Re-add the unique constraint
ALTER TABLE runs ADD CONSTRAINT runs_reference_key UNIQUE (reference);

-- Update the comment to reflect the correct type
COMMENT ON COLUMN runs.reference IS 'Solana PublicKey (base58) for payment verification (Solana Pay reference field)';
