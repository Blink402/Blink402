-- Migration: Update Featured Blinks
-- Date: 2025-11-10
-- Description: Update featured blinks on homepage with diverse showcase demos

-- Clear existing featured blinks
DELETE FROM featured_blinks;

-- Insert new featured blinks with custom descriptions
INSERT INTO featured_blinks (blink_id, display_order, title_override, description_override, created_by)
VALUES
  -- Wallet Analyzer - Blockchain analysis tool
  ('bbee3379-ee89-48f8-b870-e8066783ce56', 1, 'Wallet Analyzer',
   'Deep dive into any Solana wallet with comprehensive analytics, token holdings, and transaction history',
   'admin'),

  -- Post Tweet - Social media integration
  ('5b939817-a7bb-4ce5-a4e5-6f8c6b1b60c1', 2, 'Social Media Post',
   'Instantly post to Twitter/X with a single micropayment - no API keys needed',
   'admin'),

  -- Lorem Picsum - Image generation
  ('17c7431e-4fe1-43e9-a13e-7584a7e3fcbf', 3, 'Random Images',
   'Generate beautiful placeholder images on demand for your projects',
   'admin'),

  -- Solana Token Prices - DeFi data
  ('519a4ebf-4110-414f-a3d3-cbf06df0f975', 4, 'Token Prices',
   'Real-time Solana token prices from Jupiter aggregator - DeFi data at your fingertips',
   'admin'),

  -- Inspirational Quotes - Interactive content
  ('0d6b648f-44d9-45bc-a154-d70f9af8a7f0', 5, 'Daily Inspiration',
   'Get motivational quotes to brighten your day - perfect for apps and bots',
   'admin');

-- Update the is_featured flag on the blinks themselves for consistency
UPDATE blinks
SET is_featured = TRUE
WHERE id IN (
  'bbee3379-ee89-48f8-b870-e8066783ce56',
  '5b939817-a7bb-4ce5-a4e5-6f8c6b1b60c1',
  '17c7431e-4fe1-43e9-a13e-7584a7e3fcbf',
  '519a4ebf-4110-414f-a3d3-cbf06df0f975',
  '0d6b648f-44d9-45bc-a154-d70f9af8a7f0'
);

-- Clear is_featured flag for all other blinks
UPDATE blinks
SET is_featured = FALSE
WHERE id NOT IN (
  'bbee3379-ee89-48f8-b870-e8066783ce56',
  '5b939817-a7bb-4ce5-a4e5-6f8c6b1b60c1',
  '17c7431e-4fe1-43e9-a13e-7584a7e3fcbf',
  '519a4ebf-4110-414f-a3d3-cbf06df0f975',
  '0d6b648f-44d9-45bc-a154-d70f9af8a7f0'
);