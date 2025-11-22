-- Migration 012: Add reward_claims table for reverse blink tracking
-- Created: 2025-01-11
-- Purpose: Track reward claims to enforce limits (max_claims_per_user, IP-based abuse prevention)

CREATE TABLE IF NOT EXISTS reward_claims (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  blink_id UUID NOT NULL REFERENCES blinks(id) ON DELETE CASCADE,
  user_wallet VARCHAR(44) NOT NULL,
  reference VARCHAR(44) NOT NULL,
  signature VARCHAR(88) NOT NULL,
  claim_count INTEGER DEFAULT 1,
  claimed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  -- Constraints
  UNIQUE(blink_id, user_wallet, reference),  -- Prevent duplicate claims
  UNIQUE(signature)  -- Each reward tx is unique
);

-- Indexes for fast lookups
CREATE INDEX idx_reward_claims_blink_user ON reward_claims(blink_id, user_wallet);
CREATE INDEX idx_reward_claims_blink ON reward_claims(blink_id);
CREATE INDEX idx_reward_claims_signature ON reward_claims(signature);
CREATE INDEX idx_reward_claims_claimed_at ON reward_claims(claimed_at);

-- Add constraint for claim_count
ALTER TABLE reward_claims ADD CONSTRAINT reward_claims_count_positive
  CHECK (claim_count > 0);

-- Comments
COMMENT ON TABLE reward_claims IS 'Tracks reward claims for reverse blinks (payment_mode=reward)';
COMMENT ON COLUMN reward_claims.blink_id IS 'The reverse blink that paid the reward';
COMMENT ON COLUMN reward_claims.user_wallet IS 'User wallet that received the reward';
COMMENT ON COLUMN reward_claims.reference IS 'Reference UUID from memo transaction';
COMMENT ON COLUMN reward_claims.signature IS 'On-chain signature of reward payment transaction';
COMMENT ON COLUMN reward_claims.claim_count IS 'Number of times this wallet has claimed from this blink (always 1 with UNIQUE constraint)';
COMMENT ON COLUMN reward_claims.claimed_at IS 'Timestamp when reward was claimed';
