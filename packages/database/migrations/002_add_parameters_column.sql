-- Migration: Add parameters column for dynamic input field configuration
-- This enables Solana Actions spec-compliant parameter declarations
-- Date: 2025-01-14

-- Add parameters column to store Solana Actions parameter definitions
ALTER TABLE blinks
ADD COLUMN IF NOT EXISTS parameters JSONB;

-- Add comment explaining the column
COMMENT ON COLUMN blinks.parameters IS 'Solana Actions spec parameter definitions for dynamic input field generation. Format: [{"name": "wallet", "type": "text", "label": "Wallet Address", "required": true, "pattern": "^[1-9A-HJ-NP-Za-km-z]{32,44}$"}]';

-- Create index for JSONB queries (optional but recommended)
CREATE INDEX IF NOT EXISTS idx_blinks_parameters ON blinks USING GIN (parameters);
