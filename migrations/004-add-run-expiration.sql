-- Migration 004: Add expiration timestamp to runs table
-- References should expire after 15 minutes if not used

-- Add expires_at column (default 15 minutes from creation)
ALTER TABLE runs
ADD COLUMN expires_at TIMESTAMP WITH TIME ZONE
DEFAULT NOW() + INTERVAL '15 minutes';

-- Update existing rows to have expiration
UPDATE runs
SET expires_at = created_at + INTERVAL '15 minutes'
WHERE expires_at IS NULL;

-- Make the column NOT NULL after backfilling
ALTER TABLE runs
ALTER COLUMN expires_at SET NOT NULL;

-- Add index for efficient cleanup queries
CREATE INDEX IF NOT EXISTS idx_runs_expires_at ON runs(expires_at);

-- Add check constraint (expires_at must be after created_at)
ALTER TABLE runs
ADD CONSTRAINT runs_expires_after_created
CHECK (expires_at > created_at);

COMMENT ON COLUMN runs.expires_at IS 'Payment reference expires after this timestamp (15 min default). Prevents stale reference reuse.';
