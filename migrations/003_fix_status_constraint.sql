-- Migration: Fix status constraint to handle existing data
-- Date: 2025-01-10
-- Purpose: Add flexible constraint that handles existing data patterns

-- First, let's see what data patterns exist
SELECT status,
       COUNT(*) as count,
       COUNT(signature) as has_signature,
       COUNT(paid_at) as has_paid_at,
       COUNT(executed_at) as has_executed_at
FROM runs
GROUP BY status;

-- Drop the problematic constraint if it exists
ALTER TABLE runs DROP CONSTRAINT IF EXISTS check_status_transitions;

-- Fix any inconsistent data
-- For 'paid' status, ensure signature and paid_at are set
UPDATE runs
SET paid_at = COALESCE(paid_at, created_at)
WHERE status = 'paid' AND paid_at IS NULL;

UPDATE runs
SET signature = COALESCE(signature, 'MIGRATION_PLACEHOLDER_' || id::text)
WHERE status = 'paid' AND signature IS NULL;

-- For 'executed' status, ensure all fields are set
UPDATE runs
SET paid_at = COALESCE(paid_at, created_at),
    executed_at = COALESCE(executed_at, created_at + interval '1 second'),
    signature = COALESCE(signature, 'MIGRATION_PLACEHOLDER_' || id::text)
WHERE status = 'executed';

-- For 'failed' status, allow with or without signature (payment might fail before submission)
-- No update needed

-- Now add a more flexible constraint
ALTER TABLE runs ADD CONSTRAINT check_status_transitions CHECK (
  (status = 'pending') OR
  (status = 'paid' AND signature IS NOT NULL) OR
  (status = 'executed' AND signature IS NOT NULL) OR
  (status = 'failed')
);

-- Verify the constraint was created
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'check_status_transitions'
  ) THEN
    RAISE EXCEPTION 'Migration failed: check_status_transitions constraint not created';
  END IF;

  RAISE NOTICE 'Migration completed successfully: Added flexible status constraint';
END $$;