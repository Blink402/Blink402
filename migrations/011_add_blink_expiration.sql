-- Migration: Add expiration support for blinks
-- This allows campaigns (especially reverse blinks) to have end dates
-- while keeping the page content visible

-- Add expires_at column to blinks table
ALTER TABLE blinks
ADD COLUMN expires_at TIMESTAMPTZ DEFAULT NULL;

-- Add index for efficient expiration checks
CREATE INDEX idx_blinks_expires_at ON blinks(expires_at) WHERE expires_at IS NOT NULL;

-- Set expiration for the view-socials-earn reverse blink (expires now)
UPDATE blinks
SET expires_at = NOW()
WHERE slug = 'view-socials-earn' AND payment_mode = 'reward';

-- Example: To extend expiration by 7 days:
-- UPDATE blinks SET expires_at = NOW() + INTERVAL '7 days' WHERE slug = 'view-socials-earn';

-- Example: To remove expiration (make it live again):
-- UPDATE blinks SET expires_at = NULL WHERE slug = 'view-socials-earn';
