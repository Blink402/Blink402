-- Add bonus pool column to lottery rounds for promotional seeding
ALTER TABLE lottery_rounds
ADD COLUMN bonus_pool_usdc NUMERIC(20, 6) DEFAULT 0 NOT NULL;

COMMENT ON COLUMN lottery_rounds.bonus_pool_usdc IS 'Promotional bonus added to the prize pool (e.g., $50 promo for round 2)';
