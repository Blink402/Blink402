-- Migration: Add signature constraints and security improvements
-- Date: 2025-01-10
-- Purpose: Fix payment verification race conditions and add idempotency

-- 1. Add new columns if they don't exist
ALTER TABLE runs
  ADD COLUMN IF NOT EXISTS paid_at TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS executed_at TIMESTAMP WITH TIME ZONE;

-- 2. Make signature column UNIQUE if not already
-- First drop the existing index if it's not unique
DROP INDEX IF EXISTS idx_runs_signature;

-- Add UNIQUE constraint to signature column
ALTER TABLE runs
  ALTER COLUMN signature TYPE VARCHAR(128),
  ADD CONSTRAINT runs_signature_unique UNIQUE (signature);

-- 3. Add compound unique constraint for reference-signature pairs
-- This prevents the same transaction from being used with different references
ALTER TABLE runs
  DROP CONSTRAINT IF EXISTS unique_reference_signature,
  ADD CONSTRAINT unique_reference_signature UNIQUE(reference, signature);

-- 4. Temporarily disable the check constraint for migration
ALTER TABLE runs DROP CONSTRAINT IF EXISTS check_status_transitions;

-- 5. Update existing data to be compatible with new constraints
-- Set paid_at for already paid runs
UPDATE runs
SET paid_at = created_at
WHERE status IN ('paid', 'executed') AND paid_at IS NULL;

-- Set executed_at for already executed runs
UPDATE runs
SET executed_at = created_at + interval '1 second'
WHERE status = 'executed' AND executed_at IS NULL;

-- Clear signatures for pending runs (they shouldn't have them)
UPDATE runs
SET signature = NULL
WHERE status = 'pending' AND signature IS NOT NULL;

-- 6. Add the status transition validation constraint
ALTER TABLE runs ADD CONSTRAINT check_status_transitions CHECK (
  (status = 'pending' AND signature IS NULL AND paid_at IS NULL) OR
  (status = 'paid' AND signature IS NOT NULL AND paid_at IS NOT NULL) OR
  (status = 'executed' AND signature IS NOT NULL AND paid_at IS NOT NULL AND executed_at IS NOT NULL) OR
  (status = 'failed' AND signature IS NOT NULL)
);

-- 7. Re-create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_runs_signature ON runs(signature);
CREATE INDEX IF NOT EXISTS idx_runs_paid_at ON runs(paid_at);
CREATE INDEX IF NOT EXISTS idx_runs_executed_at ON runs(executed_at);

-- 8. Add comments for documentation
COMMENT ON COLUMN runs.paid_at IS 'Timestamp when payment was confirmed on-chain';
COMMENT ON COLUMN runs.executed_at IS 'Timestamp when upstream API was successfully executed';
COMMENT ON COLUMN runs.signature IS 'Solana transaction signature (base58) - UNIQUE to prevent reuse attacks';

-- 9. Verify migration success
DO $$
BEGIN
  -- Check that constraints exist
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'unique_reference_signature'
  ) THEN
    RAISE EXCEPTION 'Migration failed: unique_reference_signature constraint not created';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'check_status_transitions'
  ) THEN
    RAISE EXCEPTION 'Migration failed: check_status_transitions constraint not created';
  END IF;

  RAISE NOTICE 'Migration completed successfully: Added signature constraints and security improvements';
END $$;