-- Migration: Fix payer field length to accommodate signatures as fallback
-- Date: 2025-01-10
-- Purpose: The payer field sometimes stores signatures when we can't extract the actual payer

-- The payer field is currently VARCHAR(44) for wallet addresses
-- But sometimes we fallback to storing the signature when payer extraction fails
-- Signatures are 88 characters, so we need to increase the field size

-- Increase payer field to handle both wallet addresses (44 chars) and signatures (88 chars)
ALTER TABLE runs
  ALTER COLUMN payer TYPE VARCHAR(128);

-- Add comment to explain the dual purpose
COMMENT ON COLUMN runs.payer IS 'Solana wallet that paid for execution OR transaction signature as fallback (44 or 88 chars)';

-- Verify the change
DO $$
DECLARE
  col_type text;
BEGIN
  SELECT data_type || '(' || character_maximum_length || ')'
  INTO col_type
  FROM information_schema.columns
  WHERE table_name = 'runs' AND column_name = 'payer';

  IF col_type != 'character varying(128)' THEN
    RAISE EXCEPTION 'Failed to update payer field length. Current type: %', col_type;
  END IF;

  RAISE NOTICE 'Successfully updated payer field to VARCHAR(128)';
END $$;