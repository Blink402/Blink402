-- Sample Blinks for Blink402 Demo
-- Run this script to populate your database with example Blinks

-- First, create a sample creator (replace with your actual Solana wallet if needed)
INSERT INTO creators (wallet)
VALUES ('GjJyeC1r5RjHNyZ8pqFqH9TQvYbT8K7sWxK4P5aH7wXw')
ON CONFLICT (wallet) DO NOTHING;

-- Get the creator_id for reference
DO $$
DECLARE
  v_creator_id UUID;
BEGIN
  SELECT id INTO v_creator_id FROM creators WHERE wallet = 'GjJyeC1r5RjHNyZ8pqFqH9TQvYbT8K7sWxK4P5aH7wXw';

  -- 1. AI/ML: GPT Text Generator
  INSERT INTO blinks (
    slug, title, description, price_usdc, icon_url, endpoint_url, method, category, payout_wallet, creator_id
  ) VALUES (
    'gpt-text-gen',
    'GPT Text Generator',
    'Generate creative text with OpenAI GPT. Send a prompt and get AI-generated content instantly.',
    0.05,
    'https://cdn-icons-png.flaticon.com/512/6461/6461819.png',
    'https://api.openai.com/v1/chat/completions',
    'POST',
    'AI/ML',
    'GjJyeC1r5RjHNyZ8pqFqH9TQvYbT8K7sWxK4P5aH7wXw',
    v_creator_id
  ) ON CONFLICT (slug) DO NOTHING;

  -- 2. AI/ML: Image Analysis
  INSERT INTO blinks (
    slug, title, description, price_usdc, icon_url, endpoint_url, method, category, payout_wallet, creator_id
  ) VALUES (
    'vision-analyzer',
    'AI Vision Analyzer',
    'Analyze images with AI. Upload an image and get detailed descriptions, objects detected, and scene analysis.',
    0.08,
    'https://cdn-icons-png.flaticon.com/512/2991/2991148.png',
    'https://api.openai.com/v1/images/generations',
    'POST',
    'AI/ML',
    'GjJyeC1r5RjHNyZ8pqFqH9TQvYbT8K7sWxK4P5aH7wXw',
    v_creator_id
  ) ON CONFLICT (slug) DO NOTHING;

  -- 3. Data: Weather API
  INSERT INTO blinks (
    slug, title, description, price_usdc, icon_url, endpoint_url, method, category, payout_wallet, creator_id
  ) VALUES (
    'weather-now',
    'Weather Lookup',
    'Get current weather data for any city. Returns temperature, conditions, humidity, and 5-day forecast.',
    0.01,
    'https://cdn-icons-png.flaticon.com/512/1163/1163661.png',
    'https://api.weatherapi.com/v1/current.json',
    'GET',
    'Data',
    'GjJyeC1r5RjHNyZ8pqFqH9TQvYbT8K7sWxK4P5aH7wXw',
    v_creator_id
  ) ON CONFLICT (slug) DO NOTHING;

  -- 4. Web3: NFT Metadata
  INSERT INTO blinks (
    slug, title, description, price_usdc, icon_url, endpoint_url, method, category, payout_wallet, creator_id
  ) VALUES (
    'nft-metadata',
    'NFT Metadata Fetcher',
    'Fetch NFT metadata from any Solana collection. Returns name, image, attributes, and rarity data.',
    0.02,
    'https://cdn-icons-png.flaticon.com/512/9693/9693497.png',
    'https://api.helius.xyz/v0/tokens/metadata',
    'POST',
    'Web3',
    'GjJyeC1r5RjHNyZ8pqFqH9TQvYbT8K7sWxK4P5aH7wXw',
    v_creator_id
  ) ON CONFLICT (slug) DO NOTHING;

  -- 5. Utilities: URL Shortener
  INSERT INTO blinks (
    slug, title, description, price_usdc, icon_url, endpoint_url, method, category, payout_wallet, creator_id
  ) VALUES (
    'url-short',
    'URL Shortener',
    'Shorten long URLs instantly. Perfect for sharing on social media or tracking clicks.',
    0.005,
    'https://cdn-icons-png.flaticon.com/512/3039/3039393.png',
    'https://api.short.io/links',
    'POST',
    'Utilities',
    'GjJyeC1r5RjHNyZ8pqFqH9TQvYbT8K7sWxK4P5aH7wXw',
    v_creator_id
  ) ON CONFLICT (slug) DO NOTHING;

  -- 6. Utilities: QR Code Generator
  INSERT INTO blinks (
    slug, title, description, price_usdc, icon_url, endpoint_url, method, category, payout_wallet, creator_id
  ) VALUES (
    'qr-generator',
    'QR Code Generator',
    'Generate QR codes for URLs, text, or data. Returns high-quality PNG image instantly.',
    0.01,
    'https://cdn-icons-png.flaticon.com/512/2279/2279264.png',
    'https://api.qrserver.com/v1/create-qr-code/',
    'GET',
    'Utilities',
    'GjJyeC1r5RjHNyZ8pqFqH9TQvYbT8K7sWxK4P5aH7wXw',
    v_creator_id
  ) ON CONFLICT (slug) DO NOTHING;

  -- 7. Data: Stock Price Lookup
  INSERT INTO blinks (
    slug, title, description, price_usdc, icon_url, endpoint_url, method, category, payout_wallet, creator_id
  ) VALUES (
    'stock-price',
    'Stock Price Check',
    'Get real-time stock prices and market data. Includes price, volume, market cap, and daily changes.',
    0.03,
    'https://cdn-icons-png.flaticon.com/512/2936/2936760.png',
    'https://api.polygon.io/v2/aggs/ticker/',
    'GET',
    'Data',
    'GjJyeC1r5RjHNyZ8pqFqH9TQvYbT8K7sWxK4P5aH7wXw',
    v_creator_id
  ) ON CONFLICT (slug) DO NOTHING;

  -- 8. API Tools: JSON Validator
  INSERT INTO blinks (
    slug, title, description, price_usdc, icon_url, endpoint_url, method, category, payout_wallet, creator_id
  ) VALUES (
    'json-validate',
    'JSON Validator',
    'Validate and format JSON data. Checks for errors, prettifies output, and provides detailed error messages.',
    0.005,
    'https://cdn-icons-png.flaticon.com/512/136/136525.png',
    'https://jsonlint.com/api/validate',
    'POST',
    'API Tools',
    'GjJyeC1r5RjHNyZ8pqFqH9TQvYbT8K7sWxK4P5aH7wXw',
    v_creator_id
  ) ON CONFLICT (slug) DO NOTHING;

  -- 9. AI/ML: Sentiment Analysis
  INSERT INTO blinks (
    slug, title, description, price_usdc, icon_url, endpoint_url, method, category, payout_wallet, creator_id
  ) VALUES (
    'sentiment-check',
    'Sentiment Analyzer',
    'Analyze text sentiment with AI. Returns positive/negative/neutral score with confidence levels.',
    0.02,
    'https://cdn-icons-png.flaticon.com/512/1239/1239350.png',
    'https://api.meaningcloud.com/sentiment-2.1',
    'POST',
    'AI/ML',
    'GjJyeC1r5RjHNyZ8pqFqH9TQvYbT8K7sWxK4P5aH7wXw',
    v_creator_id
  ) ON CONFLICT (slug) DO NOTHING;

  -- 10. Web3: Token Price
  INSERT INTO blinks (
    slug, title, description, price_usdc, icon_url, endpoint_url, method, category, payout_wallet, creator_id
  ) VALUES (
    'token-price',
    'Crypto Price Checker',
    'Get real-time crypto prices from Jupiter DEX. Supports all Solana SPL tokens.',
    0.01,
    'https://cdn-icons-png.flaticon.com/512/6001/6001368.png',
    'https://price.jup.ag/v4/price',
    'GET',
    'Web3',
    'GjJyeC1r5RjHNyZ8pqFqH9TQvYbT8K7sWxK4P5aH7wXw',
    v_creator_id
  ) ON CONFLICT (slug) DO NOTHING;

END $$;

-- Verify the Blinks were created
SELECT
  slug,
  title,
  category,
  price_usdc,
  status
FROM blinks
ORDER BY category, title;
