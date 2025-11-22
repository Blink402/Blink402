-- Migration: 001_initial_schema
-- Description: Initial database schema for Blink402
-- Date: 2025-11-04

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ======================
-- 1. CREATORS TABLE
-- ======================
CREATE TABLE IF NOT EXISTS creators (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet VARCHAR(44) UNIQUE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_creators_wallet ON creators(wallet);

-- ======================
-- 2. BLINKS TABLE
-- ======================
CREATE TABLE IF NOT EXISTS blinks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug VARCHAR(255) UNIQUE NOT NULL,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  price_usdc DECIMAL(10,6) NOT NULL,
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

CREATE INDEX IF NOT EXISTS idx_blinks_slug ON blinks(slug);
CREATE INDEX IF NOT EXISTS idx_blinks_creator_id ON blinks(creator_id);
CREATE INDEX IF NOT EXISTS idx_blinks_status ON blinks(status);
CREATE INDEX IF NOT EXISTS idx_blinks_category ON blinks(category);

-- ======================
-- 3. RUNS TABLE
-- ======================
CREATE TABLE IF NOT EXISTS runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  blink_id UUID NOT NULL REFERENCES blinks(id) ON DELETE CASCADE,
  reference UUID UNIQUE NOT NULL,
  signature VARCHAR(88),
  payer VARCHAR(44),
  status VARCHAR(20) DEFAULT 'pending',
  duration_ms INTEGER,
  error_message TEXT,
  response_preview TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  paid_at TIMESTAMP WITH TIME ZONE,
  executed_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX IF NOT EXISTS idx_runs_blink_id ON runs(blink_id);
CREATE INDEX IF NOT EXISTS idx_runs_reference ON runs(reference);
CREATE INDEX IF NOT EXISTS idx_runs_signature ON runs(signature);
CREATE INDEX IF NOT EXISTS idx_runs_payer ON runs(payer);
CREATE INDEX IF NOT EXISTS idx_runs_status ON runs(status);
CREATE INDEX IF NOT EXISTS idx_runs_created_at ON runs(created_at DESC);

-- ======================
-- 4. RECEIPTS TABLE
-- ======================
CREATE TABLE IF NOT EXISTS receipts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id UUID UNIQUE NOT NULL REFERENCES runs(id) ON DELETE CASCADE,
  tree VARCHAR(44) NOT NULL,
  leaf INTEGER NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_receipts_run_id ON receipts(run_id);
CREATE INDEX IF NOT EXISTS idx_receipts_tree ON receipts(tree);

-- ======================
-- TRIGGERS
-- ======================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_blinks_updated_at
  BEFORE UPDATE ON blinks
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE OR REPLACE FUNCTION increment_blink_runs()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.status = 'success' THEN
        UPDATE blinks
        SET runs = runs + 1
        WHERE id = NEW.blink_id;
    END IF;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER increment_blink_runs_on_success
  AFTER INSERT OR UPDATE OF status ON runs
  FOR EACH ROW
  WHEN (NEW.status = 'success')
  EXECUTE FUNCTION increment_blink_runs();
