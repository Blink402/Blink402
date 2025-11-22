-- Migration 017: Add Lottery Buyback Tracking
-- Adds fields to lottery_rounds table to track automated B402 buyback & burn

ALTER TABLE lottery_rounds
ADD COLUMN buyback_executed_at TIMESTAMP,
ADD COLUMN buyback_tx_signature VARCHAR(88),
ADD COLUMN buyback_status VARCHAR(20) DEFAULT 'pending'
  CHECK (buyback_status IN ('pending', 'completed', 'failed'));

-- Create index for efficient querying of pending buybacks
CREATE INDEX idx_lottery_rounds_buyback_pending
ON lottery_rounds(buyback_status, ended_at)
WHERE buyback_status = 'pending' AND ended_at IS NOT NULL;

-- Add comment explaining the buyback process
COMMENT ON COLUMN lottery_rounds.buyback_status IS 'Tracks B402 buyback status: pending (not executed), completed (burn successful), failed (needs retry)';
COMMENT ON COLUMN lottery_rounds.buyback_tx_signature IS 'Solana transaction signature of the Pumpportal burn transaction';
COMMENT ON COLUMN lottery_rounds.buyback_executed_at IS 'Timestamp when buyback was successfully executed';
