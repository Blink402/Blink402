-- Migration: Add B402 Token Integration
-- Purpose: Track B402 token holder tiers, benefits, and analytics
-- Date: 2025-01-19

-- Add B402 tier tracking to runs table
ALTER TABLE runs ADD COLUMN IF NOT EXISTS b402_tier VARCHAR(10) DEFAULT 'NONE';
ALTER TABLE runs ADD COLUMN IF NOT EXISTS b402_balance DECIMAL(20, 9) DEFAULT 0;
ALTER TABLE runs ADD COLUMN IF NOT EXISTS b402_benefits_applied JSONB DEFAULT '{}';

-- Index for filtering by tier (only index non-NONE tiers)
CREATE INDEX IF NOT EXISTS idx_runs_b402_tier ON runs(b402_tier) WHERE b402_tier != 'NONE';

-- Add B402 statistics to blinks table
ALTER TABLE blinks ADD COLUMN IF NOT EXISTS b402_holders_count INT DEFAULT 0;
ALTER TABLE blinks ADD COLUMN IF NOT EXISTS total_b402_discounts_usdc DECIMAL(10, 2) DEFAULT 0;

-- Create B402 holder analytics table
CREATE TABLE IF NOT EXISTS b402_holder_analytics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet VARCHAR(44) NOT NULL,
  tier VARCHAR(10) NOT NULL CHECK (tier IN ('NONE', 'BRONZE', 'SILVER', 'GOLD', 'DIAMOND')),
  balance DECIMAL(20, 9) NOT NULL DEFAULT 0,

  -- Savings & bonuses
  total_savings_usdc DECIMAL(10, 2) DEFAULT 0,
  total_bonus_payouts_usdc DECIMAL(10, 2) DEFAULT 0,

  -- Usage counters
  free_spins_used INT DEFAULT 0,
  bonus_entries_claimed INT DEFAULT 0,
  total_runs_with_benefits INT DEFAULT 0,

  -- Timestamps
  last_checked_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(wallet)
);

-- Indexes for b402_holder_analytics
CREATE INDEX IF NOT EXISTS idx_b402_analytics_tier ON b402_holder_analytics(tier);
CREATE INDEX IF NOT EXISTS idx_b402_analytics_wallet ON b402_holder_analytics(wallet);
CREATE INDEX IF NOT EXISTS idx_b402_analytics_last_checked ON b402_holder_analytics(last_checked_at);

-- Create function to update b402_holder_analytics.updated_at
CREATE OR REPLACE FUNCTION update_b402_analytics_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to auto-update updated_at
CREATE TRIGGER trigger_b402_analytics_updated_at
  BEFORE UPDATE ON b402_holder_analytics
  FOR EACH ROW
  EXECUTE FUNCTION update_b402_analytics_timestamp();

-- Add comment
COMMENT ON TABLE b402_holder_analytics IS 'Tracks B402 token holder analytics including tier, savings, and benefit usage';
COMMENT ON COLUMN runs.b402_tier IS 'B402 token holder tier at time of run (NONE, BRONZE, SILVER, GOLD, DIAMOND)';
COMMENT ON COLUMN runs.b402_balance IS 'B402 token balance at time of run';
COMMENT ON COLUMN runs.b402_benefits_applied IS 'JSON object storing applied benefits (discounts, multipliers, bonuses)';
