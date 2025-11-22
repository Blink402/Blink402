-- Migration: Add B402 buyback amount tracking to lottery_rounds
-- This tracks the amount of B402 tokens acquired during each buyback

ALTER TABLE lottery_rounds
  ADD COLUMN buyback_b402_amount NUMERIC(20, 6) DEFAULT 0;

COMMENT ON COLUMN lottery_rounds.buyback_b402_amount IS 'Amount of B402 tokens acquired during buyback (6 decimals)';
