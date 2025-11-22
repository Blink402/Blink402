-- Migration 015: Lottery System
-- Creates tables for Blink-native lottery with 15-minute rounds
-- Prize split: 50% 1st, 20% 2nd, 15% 3rd, 15% platform buyback

-- Table 1: Lottery Rounds
-- Tracks 15-minute lottery rounds for each lottery-enabled blink
CREATE TABLE IF NOT EXISTS lottery_rounds (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  blink_id UUID NOT NULL REFERENCES blinks(id) ON DELETE CASCADE,
  round_number INTEGER NOT NULL,
  started_at TIMESTAMP NOT NULL DEFAULT NOW(),
  ended_at TIMESTAMP,
  total_entry_fee_usdc NUMERIC(20, 6) DEFAULT 0,
  total_entries INTEGER DEFAULT 0,
  winners_selected_at TIMESTAMP,
  status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'closed', 'distributed')),
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),

  -- Ensure one active round per blink
  UNIQUE(blink_id, round_number)
);

-- Table 2: Lottery Entries
-- Stores individual user entries (1 USDC per entry)
CREATE TABLE IF NOT EXISTS lottery_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  round_id UUID NOT NULL REFERENCES lottery_rounds(id) ON DELETE CASCADE,
  run_id UUID NOT NULL REFERENCES runs(id) ON DELETE CASCADE,
  payer_wallet VARCHAR(44) NOT NULL,
  entry_fee_usdc NUMERIC(20, 6) NOT NULL,
  entry_timestamp TIMESTAMP NOT NULL DEFAULT NOW(),

  -- Prevent duplicate entries from same run
  UNIQUE(round_id, run_id)
);

-- Table 3: Lottery Winners
-- Tracks winners and payout status
CREATE TABLE IF NOT EXISTS lottery_winners (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  round_id UUID NOT NULL REFERENCES lottery_rounds(id) ON DELETE CASCADE,
  winner_wallet VARCHAR(44) NOT NULL,
  payout_amount_usdc NUMERIC(20, 6) NOT NULL,
  payout_rank INTEGER NOT NULL CHECK (payout_rank IN (1, 2, 3)),
  payout_tx_signature VARCHAR(88),
  payout_status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (payout_status IN ('pending', 'completed', 'failed')),
  completed_at TIMESTAMP,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),

  -- Prevent duplicate winners in same round
  UNIQUE(round_id, winner_wallet)
);

-- Performance Indexes
CREATE INDEX IF NOT EXISTS idx_lottery_rounds_blink_status ON lottery_rounds(blink_id, status);
CREATE INDEX IF NOT EXISTS idx_lottery_rounds_status_ended ON lottery_rounds(status, ended_at) WHERE status = 'active';
CREATE INDEX IF NOT EXISTS idx_lottery_entries_round ON lottery_entries(round_id);
CREATE INDEX IF NOT EXISTS idx_lottery_entries_payer ON lottery_entries(round_id, payer_wallet);
CREATE INDEX IF NOT EXISTS idx_lottery_entries_timestamp ON lottery_entries(entry_timestamp);
CREATE INDEX IF NOT EXISTS idx_lottery_winners_round_status ON lottery_winners(round_id, payout_status);
CREATE INDEX IF NOT EXISTS idx_lottery_winners_wallet ON lottery_winners(winner_wallet);
CREATE INDEX IF NOT EXISTS idx_lottery_winners_status ON lottery_winners(payout_status) WHERE payout_status = 'pending';

-- Add lottery_enabled flag to blinks table
ALTER TABLE blinks ADD COLUMN IF NOT EXISTS lottery_enabled BOOLEAN DEFAULT FALSE;
ALTER TABLE blinks ADD COLUMN IF NOT EXISTS lottery_round_duration_minutes INTEGER DEFAULT 15;

-- Create index for lottery blinks
CREATE INDEX IF NOT EXISTS idx_blinks_lottery_enabled ON blinks(lottery_enabled) WHERE lottery_enabled = TRUE;

-- Comments for documentation
COMMENT ON TABLE lottery_rounds IS 'Tracks lottery rounds with 15-minute intervals';
COMMENT ON TABLE lottery_entries IS 'Individual user entries (1 USDC per entry)';
COMMENT ON TABLE lottery_winners IS 'Winner records with payout tracking';
COMMENT ON COLUMN lottery_rounds.status IS 'active: accepting entries, closed: winners selected, distributed: all payouts complete';
COMMENT ON COLUMN lottery_winners.payout_rank IS '1=first place (50%), 2=second (20%), 3=third (15%)';
