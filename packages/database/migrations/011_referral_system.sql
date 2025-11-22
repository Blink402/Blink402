-- Migration 011: Referral System
-- Adds tables for referral codes, tracking, and commission payouts

-- Table: referral_codes
-- Stores unique referral codes for each user with tier and earnings tracking
CREATE TABLE IF NOT EXISTS referral_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_wallet VARCHAR(44) UNIQUE NOT NULL,
  code VARCHAR(20) UNIQUE NOT NULL,
  tier VARCHAR(20) DEFAULT 'bronze' CHECK (tier IN ('bronze', 'silver', 'gold')),
  total_referrals INTEGER DEFAULT 0,
  total_earnings_usdc DECIMAL(10,6) DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_referral_codes_wallet ON referral_codes(user_wallet);
CREATE INDEX idx_referral_codes_code ON referral_codes(code);
CREATE INDEX idx_referral_codes_tier ON referral_codes(tier);

-- Table: referrals
-- Tracks referrer → referee relationships and spending
CREATE TABLE IF NOT EXISTS referrals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_wallet VARCHAR(44) NOT NULL,
  referee_wallet VARCHAR(44) NOT NULL,
  referral_code VARCHAR(20) NOT NULL,
  referred_at TIMESTAMP DEFAULT NOW(),
  first_call_at TIMESTAMP,
  total_spent_usdc DECIMAL(10,6) DEFAULT 0,
  commission_paid_usdc DECIMAL(10,6) DEFAULT 0,
  bonus_claimed BOOLEAN DEFAULT FALSE,
  CONSTRAINT fk_referral_code FOREIGN KEY (referral_code) REFERENCES referral_codes(code) ON DELETE CASCADE,
  CONSTRAINT unique_referral UNIQUE (referrer_wallet, referee_wallet)
);

CREATE INDEX idx_referrals_referrer ON referrals(referrer_wallet);
CREATE INDEX idx_referrals_referee ON referrals(referee_wallet);
CREATE INDEX idx_referrals_code ON referrals(referral_code);
CREATE INDEX idx_referrals_first_call ON referrals(first_call_at);

-- Table: commission_payouts
-- Records all commission payments to referrers
CREATE TABLE IF NOT EXISTS commission_payouts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_wallet VARCHAR(44) NOT NULL,
  referee_wallet VARCHAR(44) NOT NULL,
  run_id UUID NOT NULL,
  amount_usdc DECIMAL(10,6) NOT NULL,
  commission_rate DECIMAL(5,4) NOT NULL,
  tier VARCHAR(20) NOT NULL,
  paid_at TIMESTAMP DEFAULT NOW(),
  transaction_signature VARCHAR(88),
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'failed')),
  CONSTRAINT fk_run FOREIGN KEY (run_id) REFERENCES runs(id) ON DELETE CASCADE
);

CREATE INDEX idx_commission_payouts_referrer ON commission_payouts(referrer_wallet);
CREATE INDEX idx_commission_payouts_referee ON commission_payouts(referee_wallet);
CREATE INDEX idx_commission_payouts_run ON commission_payouts(run_id);
CREATE INDEX idx_commission_payouts_status ON commission_payouts(status);
CREATE INDEX idx_commission_payouts_paid_at ON commission_payouts(paid_at);

-- Function: Update referral code tier based on total referrals
CREATE OR REPLACE FUNCTION update_referral_tier() RETURNS TRIGGER AS $$
BEGIN
  IF NEW.total_referrals >= 51 THEN
    NEW.tier = 'gold';
  ELSIF NEW.total_referrals >= 11 THEN
    NEW.tier = 'silver';
  ELSE
    NEW.tier = 'bronze';
  END IF;

  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_referral_tier
  BEFORE UPDATE OF total_referrals ON referral_codes
  FOR EACH ROW
  EXECUTE FUNCTION update_referral_tier();

-- Function: Generate unique referral code
CREATE OR REPLACE FUNCTION generate_referral_code(p_user_wallet VARCHAR) RETURNS VARCHAR AS $$
DECLARE
  v_code VARCHAR(20);
  v_exists BOOLEAN;
  v_counter INTEGER := 0;
BEGIN
  -- Try wallet suffix first (last 4-6 chars)
  v_code := UPPER(SUBSTRING(p_user_wallet FROM LENGTH(p_user_wallet) - 5));

  LOOP
    -- Check if code exists
    SELECT EXISTS(SELECT 1 FROM referral_codes WHERE code = v_code) INTO v_exists;

    IF NOT v_exists THEN
      RETURN v_code;
    END IF;

    -- If exists, append counter
    v_counter := v_counter + 1;
    v_code := UPPER(SUBSTRING(p_user_wallet FROM LENGTH(p_user_wallet) - 5)) || v_counter::TEXT;

    -- Safety: prevent infinite loop
    IF v_counter > 1000 THEN
      RAISE EXCEPTION 'Could not generate unique referral code after 1000 attempts';
    END IF;
  END LOOP;
END;
$$ LANGUAGE plpgsql;

COMMENT ON TABLE referral_codes IS 'Stores unique referral codes for each user with tier-based commission rates';
COMMENT ON TABLE referrals IS 'Tracks referrer → referee relationships and tracks spending for commission calculations';
COMMENT ON TABLE commission_payouts IS 'Records all commission payments made to referrers with transaction signatures';
COMMENT ON FUNCTION generate_referral_code IS 'Generates unique referral code based on wallet address suffix';
COMMENT ON FUNCTION update_referral_tier IS 'Automatically updates referral tier when total_referrals changes';
