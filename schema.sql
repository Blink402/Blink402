-- Blink402 Database Schema
-- PostgreSQL 14+ required for gen_random_uuid()

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ======================
-- 1. CREATORS TABLE
-- ======================
-- Stores Solana wallet addresses of Blink creators with optional profile information
CREATE TABLE IF NOT EXISTS creators (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet VARCHAR(44) UNIQUE NOT NULL,
  display_name VARCHAR(100),
  bio TEXT,
  avatar_url TEXT,
  banner_url TEXT,
  profile_slug VARCHAR(100) UNIQUE,
  social_links JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for faster lookups
CREATE INDEX IF NOT EXISTS idx_creators_wallet ON creators(wallet);
CREATE INDEX IF NOT EXISTS idx_creators_profile_slug ON creators(profile_slug);

-- ======================
-- 2. BLINKS TABLE
-- ======================
-- Stores Blink definitions (pay-per-call API endpoints)
CREATE TABLE IF NOT EXISTS blinks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug VARCHAR(255) UNIQUE NOT NULL,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  price_usdc DECIMAL(10,6) NOT NULL,
  payment_token VARCHAR(10) NOT NULL DEFAULT 'SOL',
  icon_url TEXT,
  endpoint_url TEXT NOT NULL,
  method VARCHAR(10) NOT NULL DEFAULT 'POST',
  category VARCHAR(100),
  runs INTEGER DEFAULT 0,
  status VARCHAR(20) DEFAULT 'active',
  payout_wallet VARCHAR(44) NOT NULL,
  creator_id UUID NOT NULL REFERENCES creators(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_blinks_slug ON blinks(slug);
CREATE INDEX IF NOT EXISTS idx_blinks_creator_id ON blinks(creator_id);
CREATE INDEX IF NOT EXISTS idx_blinks_status ON blinks(status);
CREATE INDEX IF NOT EXISTS idx_blinks_category ON blinks(category);

-- ======================
-- 3. RUNS TABLE
-- ======================
-- Tracks individual Blink executions and payments
CREATE TABLE IF NOT EXISTS runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  blink_id UUID NOT NULL REFERENCES blinks(id) ON DELETE CASCADE,
  reference VARCHAR(44) UNIQUE NOT NULL,
  signature VARCHAR(128),
  payer VARCHAR(44),
  status VARCHAR(20) NOT NULL DEFAULT 'pending',
  duration_ms INTEGER,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  expires_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() + INTERVAL '15 minutes' NOT NULL
);

-- Indexes for payment verification and analytics
CREATE INDEX IF NOT EXISTS idx_runs_blink_id ON runs(blink_id);
CREATE INDEX IF NOT EXISTS idx_runs_reference ON runs(reference);
CREATE INDEX IF NOT EXISTS idx_runs_signature ON runs(signature);
CREATE INDEX IF NOT EXISTS idx_runs_status ON runs(status);
CREATE INDEX IF NOT EXISTS idx_runs_created_at ON runs(created_at);
CREATE INDEX IF NOT EXISTS idx_runs_expires_at ON runs(expires_at);

-- ======================
-- 4. RECEIPTS TABLE
-- ======================
-- Optional cNFT receipts for completed runs
CREATE TABLE IF NOT EXISTS receipts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id UUID UNIQUE NOT NULL REFERENCES runs(id) ON DELETE CASCADE,
  tree VARCHAR(44),
  leaf BIGINT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index for receipt lookups
CREATE INDEX IF NOT EXISTS idx_receipts_run_id ON receipts(run_id);

-- ======================
-- TRIGGERS: Update updated_at timestamps
-- ======================
-- Automatically update the updated_at timestamp when records are modified
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_creators_updated_at
  BEFORE UPDATE ON creators
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_blinks_updated_at
  BEFORE UPDATE ON blinks
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ======================
-- CONSTRAINTS & VALIDATION
-- ======================
-- Ensure valid Solana wallet addresses (44 base58 characters)
ALTER TABLE creators ADD CONSTRAINT creators_wallet_length CHECK (length(wallet) = 44);
ALTER TABLE blinks ADD CONSTRAINT blinks_payout_wallet_length CHECK (length(payout_wallet) = 44);

-- Ensure valid HTTP methods
ALTER TABLE blinks ADD CONSTRAINT blinks_method_valid CHECK (method IN ('GET', 'POST', 'PUT', 'DELETE', 'PATCH'));

-- Ensure valid statuses
ALTER TABLE blinks ADD CONSTRAINT blinks_status_valid CHECK (status IN ('active', 'paused', 'archived'));
ALTER TABLE runs ADD CONSTRAINT runs_status_valid CHECK (status IN ('pending', 'paid', 'executed', 'failed'));

-- Ensure positive prices
ALTER TABLE blinks ADD CONSTRAINT blinks_price_positive CHECK (price_usdc > 0);

-- Ensure valid payment tokens
ALTER TABLE blinks ADD CONSTRAINT blinks_payment_token_valid CHECK (payment_token IN ('SOL', 'USDC'));

-- Ensure non-negative run counts
ALTER TABLE blinks ADD CONSTRAINT blinks_runs_non_negative CHECK (runs >= 0);

-- ======================
-- COMMENTS (Documentation)
-- ======================
COMMENT ON TABLE creators IS 'Solana wallet addresses of Blink creators with optional public profiles';
COMMENT ON TABLE blinks IS 'Pay-per-call API endpoint definitions (Solana Actions/Blinks)';
COMMENT ON TABLE runs IS 'Individual Blink execution records with payment tracking';
COMMENT ON TABLE receipts IS 'Optional compressed NFT receipts for completed runs';

COMMENT ON COLUMN creators.display_name IS 'Optional display name (shown instead of wallet address)';
COMMENT ON COLUMN creators.bio IS 'Creator bio/description (max ~500 characters recommended)';
COMMENT ON COLUMN creators.avatar_url IS 'Profile picture URL';
COMMENT ON COLUMN creators.banner_url IS 'Profile header banner URL';
COMMENT ON COLUMN creators.profile_slug IS 'Optional custom URL slug (e.g., "alice" for /profile/alice)';
COMMENT ON COLUMN creators.social_links IS 'JSON object with social media handles: {twitter, github, website, discord}';

COMMENT ON COLUMN blinks.slug IS 'URL-safe unique identifier (e.g., "text-analyzer")';
COMMENT ON COLUMN blinks.price_usdc IS 'Price per execution in SOL or USDC (e.g., 0.01 = 1 cent)';
COMMENT ON COLUMN blinks.payment_token IS 'Payment currency: SOL (native Solana) or USDC (SPL token)';
COMMENT ON COLUMN blinks.payout_wallet IS 'Solana wallet to receive payments (SOL or USDC)';
COMMENT ON COLUMN blinks.runs IS 'Total number of successful executions';
COMMENT ON COLUMN blinks.status IS 'active (live), paused (hidden), archived (deleted)';

COMMENT ON COLUMN runs.reference IS 'Solana PublicKey (base58) for payment verification (Solana Pay reference field)';
COMMENT ON COLUMN runs.signature IS 'Solana transaction signature (base58)';
COMMENT ON COLUMN runs.payer IS 'Solana wallet that paid for execution';
COMMENT ON COLUMN runs.status IS 'pending → paid → executed (or failed)';
COMMENT ON COLUMN runs.duration_ms IS 'Upstream API call duration in milliseconds';
COMMENT ON COLUMN runs.expires_at IS 'Payment reference expires after this timestamp (15 min). Prevents stale reference reuse and ensures timely payment';

COMMENT ON COLUMN receipts.tree IS 'Compressed NFT Merkle tree address';
COMMENT ON COLUMN receipts.leaf IS 'Compressed NFT leaf index';
