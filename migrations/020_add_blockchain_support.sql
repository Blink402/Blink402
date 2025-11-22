-- Migration: Add multi-chain blockchain support
-- Date: 2025-01-14
-- Description: Add blockchain columns to support both Solana and Base (EVM) chains

-- Add blockchain column to blinks table
ALTER TABLE blinks
  ADD COLUMN IF NOT EXISTS blockchain VARCHAR(20) DEFAULT 'solana';

-- Add check constraint for blockchain on blinks
ALTER TABLE blinks
  DROP CONSTRAINT IF EXISTS blinks_blockchain_check;

ALTER TABLE blinks
  ADD CONSTRAINT blinks_blockchain_check
  CHECK (blockchain IN ('solana', 'base'));

-- Add blockchain column to runs table
ALTER TABLE runs
  ADD COLUMN IF NOT EXISTS blockchain VARCHAR(20) DEFAULT 'solana';

-- Add check constraint for blockchain on runs
ALTER TABLE runs
  DROP CONSTRAINT IF EXISTS runs_blockchain_check;

ALTER TABLE runs
  ADD CONSTRAINT runs_blockchain_check
  CHECK (blockchain IN ('solana', 'base'));

-- Add indexes for blockchain filtering (for analytics and queries)
CREATE INDEX IF NOT EXISTS idx_blinks_blockchain ON blinks(blockchain);
CREATE INDEX IF NOT EXISTS idx_runs_blockchain ON runs(blockchain);

-- Composite index for common queries (blockchain + status)
CREATE INDEX IF NOT EXISTS idx_blinks_blockchain_status ON blinks(blockchain, status);
CREATE INDEX IF NOT EXISTS idx_runs_blockchain_status ON runs(blockchain, status);

-- Add comments for documentation
COMMENT ON COLUMN blinks.blockchain IS 'Blockchain network for payments: solana (Solana mainnet/devnet) or base (Base mainnet/Sepolia testnet)';
COMMENT ON COLUMN runs.blockchain IS 'Blockchain network used for this payment execution';

-- Note: Existing rows will default to 'solana' which maintains backward compatibility
-- No data migration needed as all existing blinks/runs are Solana-based
