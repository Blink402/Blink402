-- Demo Blinks Seed Script
-- Creates 5 polished demo Blinks showcasing Blink402 capabilities
-- Run with: psql $DATABASE_URL -f packages/database/seeds/demo-blinks.sql

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Create demo creator (if doesn't exist)
-- Using the devnet test wallet: DBmAKxCMQCo7Nep1HDrpmyMrQopKRNqysBwG9pMdCGG9
INSERT INTO creators (wallet, display_name, bio, avatar_url)
VALUES (
  'DBmAKxCMQCo7Nep1HDrpmyMrQopKRNqysBwG9pMdCGG9',
  'Blink402 Demo',
  'Official demo Blinks showcasing AI services, Solana analytics, and more!',
  'https://api.dicebear.com/7.x/bottts/svg?seed=blink402'
)
ON CONFLICT (wallet) DO NOTHING;

-- Get the creator_id for the demo creator
DO $$
DECLARE
  demo_creator_id UUID;
BEGIN
  -- Get the demo creator ID
  SELECT id INTO demo_creator_id FROM creators WHERE wallet = 'DBmAKxCMQCo7Nep1HDrpmyMrQopKRNqysBwG9pMdCGG9';

  -- Delete existing demo blinks if they exist (for idempotency)
  DELETE FROM blinks WHERE slug IN (
    'colorize-image',
    'punchup-tweet',
    'wallet-snapshot',
    'url-screenshot',
    'label-image-reward'
  );

  -- ==============================================
  -- 1. Image Colorize (B/W → Color)
  -- ==============================================
  INSERT INTO blinks (
    slug,
    title,
    description,
    price_usdc,
    payment_token,
    payment_mode,
    endpoint_url,
    method,
    category,
    icon_url,
    payout_wallet,
    creator_id,
    status,
    health_status
  ) VALUES (
    'colorize-image',
    'AI Image Colorization',
    'Transform any black-and-white photo into a vibrant color image using AI. Upload your B/W photo and receive a beautifully colorized version in seconds.',
    0.03,
    'USDC',
    'charge',
    'https://blink402-production.up.railway.app/ai-services/colorize',
    'POST',
    'AI/ML',
    'https://api.dicebear.com/7.x/shapes/svg?seed=colorize&backgroundColor=5AB4FF',
    'DBmAKxCMQCo7Nep1HDrpmyMrQopKRNqysBwG9pMdCGG9',
    demo_creator_id,
    'active',
    'healthy'
  );

  -- ==============================================
  -- 2. Punch-Up Tweet (Rewrite ≤ 280 chars)
  -- ==============================================
  INSERT INTO blinks (
    slug,
    title,
    description,
    price_usdc,
    payment_token,
    payment_mode,
    endpoint_url,
    method,
    category,
    icon_url,
    payout_wallet,
    creator_id,
    status,
    health_status
  ) VALUES (
    'punchup-tweet',
    'AI Tweet Enhancer',
    'Improve your tweet clarity, tone, and impact with AI. Submit your draft text (up to 280 chars) and get an enhanced version that''s more engaging and professional.',
    0.01,
    'USDC',
    'charge',
    'https://blink402-production.up.railway.app/ai-services/punchup',
    'POST',
    'AI/ML',
    'https://api.dicebear.com/7.x/shapes/svg?seed=tweet&backgroundColor=3B8FD9',
    'DBmAKxCMQCo7Nep1HDrpmyMrQopKRNqysBwG9pMdCGG9',
    demo_creator_id,
    'active',
    'healthy'
  );

  -- ==============================================
  -- 3. Wallet Snapshot (24h on Solana)
  -- ==============================================
  INSERT INTO blinks (
    slug,
    title,
    description,
    price_usdc,
    payment_token,
    payment_mode,
    endpoint_url,
    method,
    category,
    icon_url,
    payout_wallet,
    creator_id,
    status,
    health_status
  ) VALUES (
    'wallet-snapshot',
    'Solana Wallet 24h Analytics',
    'Get comprehensive analytics for any Solana wallet: 24h PnL, transaction history, token holdings, NFTs, and more. Perfect for quick wallet due diligence.',
    0.02,
    'USDC',
    'charge',
    'https://blink402-production.up.railway.app/ai-services/wallet24h',
    'POST',
    'Web3',
    'https://api.dicebear.com/7.x/shapes/svg?seed=wallet&backgroundColor=5AB4FF',
    'DBmAKxCMQCo7Nep1HDrpmyMrQopKRNqysBwG9pMdCGG9',
    demo_creator_id,
    'active',
    'healthy'
  );

  -- ==============================================
  -- 4. URL Snapshot (Above-the-Fold Screenshot)
  -- ==============================================
  INSERT INTO blinks (
    slug,
    title,
    description,
    price_usdc,
    payment_token,
    payment_mode,
    endpoint_url,
    method,
    category,
    icon_url,
    payout_wallet,
    creator_id,
    status,
    health_status
  ) VALUES (
    'url-screenshot',
    'Website Screenshot Capture',
    'Capture a high-quality screenshot of any website above-the-fold. Choose viewport size (mobile, tablet, desktop) and get an instant PNG screenshot.',
    0.02,
    'USDC',
    'charge',
    'https://blink402-production.up.railway.app/ai-services/snapshot',
    'POST',
    'Utilities',
    'https://api.dicebear.com/7.x/shapes/svg?seed=screenshot&backgroundColor=3B8FD9',
    'DBmAKxCMQCo7Nep1HDrpmyMrQopKRNqysBwG9pMdCGG9',
    demo_creator_id,
    'active',
    'healthy'
  );

  -- ==============================================
  -- 5. Reverse Blink – Label This Image (REWARD MODE)
  -- ==============================================
  -- This is a "reward" mode Blink where users GET PAID for submissions
  -- Note: price_usdc must be > 0 due to DB constraint, but in reward mode
  -- the actual payment flow is reversed (creator pays user the reward_amount)
  INSERT INTO blinks (
    slug,
    title,
    description,
    price_usdc,
    payment_token,
    payment_mode,
    reward_amount,
    funded_wallet,
    max_claims_per_user,
    endpoint_url,
    method,
    category,
    icon_url,
    payout_wallet,
    creator_id,
    status,
    health_status
  ) VALUES (
    'label-image-reward',
    'Reverse Blink: Label Images & Earn',
    'Get paid $0.02 USDC for labeling images! Submit an image URL and your label to help train AI models. Users earn rewards for each verified label submission.',
    0.000001,  -- Minimal price (required by DB constraint, but reward_amount is what matters)
    'USDC',
    'reward',
    0.02,  -- User receives $0.02 per submission
    'DBmAKxCMQCo7Nep1HDrpmyMrQopKRNqysBwG9pMdCGG9',  -- Funded by demo wallet
    10,  -- Max 10 submissions per wallet
    'https://blink402-production.up.railway.app/ai-services/label',
    'POST',
    'AI/ML',
    'https://api.dicebear.com/7.x/shapes/svg?seed=reward&backgroundColor=5AB4FF',
    'DBmAKxCMQCo7Nep1HDrpmyMrQopKRNqysBwG9pMdCGG9',
    demo_creator_id,
    'active',
    'healthy'
  );

  -- Log success
  RAISE NOTICE 'Successfully seeded 5 demo Blinks!';
  RAISE NOTICE 'Blinks created:';
  RAISE NOTICE '  1. colorize-image ($0.03 USDC)';
  RAISE NOTICE '  2. punchup-tweet ($0.01 USDC)';
  RAISE NOTICE '  3. wallet-snapshot ($0.02 USDC)';
  RAISE NOTICE '  4. url-screenshot ($0.02 USDC)';
  RAISE NOTICE '  5. label-image-reward (PAYS user $0.02 USDC)';
  RAISE NOTICE '';
  RAISE NOTICE 'Test these Blinks at: https://blink402.com/catalog';
END $$;
