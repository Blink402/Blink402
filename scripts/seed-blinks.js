#!/usr/bin/env node

/**
 * Seed sample Blinks into the database
 * Usage: node scripts/seed-blinks.js
 */

import pg from 'pg';
const { Pool } = pg;

const DATABASE_URL = process.env.DATABASE_URL || 'postgresql://postgres:NajctWeCLYaSywSNHKxkWElcSbTsDSPc@caboose.proxy.rlwy.net:58182/railway';

const pool = new Pool({
  connectionString: DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

const SAMPLE_WALLET = 'GjJyeC1r5RjHNyZ8pqFqH9TQvYbT8K7sWxK4P5aH7wXw';

const sampleBlinks = [
  {
    slug: 'gpt-text-gen',
    title: 'GPT Text Generator',
    description: 'Generate creative text with OpenAI GPT. Send a prompt and get AI-generated content instantly.',
    price: 0.05,
    icon_url: 'https://cdn-icons-png.flaticon.com/512/6461/6461819.png',
    endpoint_url: 'https://api.openai.com/v1/chat/completions',
    method: 'POST',
    category: 'AI/ML',
    payment_token: 'USDC'
  },
  {
    slug: 'vision-analyzer',
    title: 'AI Vision Analyzer',
    description: 'Analyze images with AI. Upload an image and get detailed descriptions, objects detected, and scene analysis.',
    price: 0.08,
    icon_url: 'https://cdn-icons-png.flaticon.com/512/2991/2991148.png',
    endpoint_url: 'https://api.openai.com/v1/images/generations',
    method: 'POST',
    category: 'AI/ML',
    payment_token: 'USDC'
  },
  {
    slug: 'weather-now',
    title: 'Weather Lookup',
    description: 'Get current weather data for any city. Returns temperature, conditions, humidity, and 5-day forecast.',
    price: 0.01,
    icon_url: 'https://cdn-icons-png.flaticon.com/512/1163/1163661.png',
    endpoint_url: 'https://api.weatherapi.com/v1/current.json',
    method: 'GET',
    category: 'Data',
    payment_token: 'USDC'
  },
  {
    slug: 'nft-metadata',
    title: 'NFT Metadata Fetcher',
    description: 'Fetch NFT metadata from any Solana collection. Returns name, image, attributes, and rarity data.',
    price: 0.02,
    icon_url: 'https://cdn-icons-png.flaticon.com/512/9693/9693497.png',
    endpoint_url: 'https://api.helius.xyz/v0/tokens/metadata',
    method: 'POST',
    category: 'Web3',
    payment_token: 'USDC'
  },
  {
    slug: 'url-short',
    title: 'URL Shortener',
    description: 'Shorten long URLs instantly. Perfect for sharing on social media or tracking clicks.',
    price: 0.005,
    icon_url: 'https://cdn-icons-png.flaticon.com/512/3039/3039393.png',
    endpoint_url: 'https://api.short.io/links',
    method: 'POST',
    category: 'Utilities',
    payment_token: 'USDC'
  },
  {
    slug: 'qr-generator',
    title: 'QR Code Generator',
    description: 'Generate QR codes for URLs, text, or data. Returns high-quality PNG image instantly.',
    price: 0.01,
    icon_url: 'https://cdn-icons-png.flaticon.com/512/2279/2279264.png',
    endpoint_url: 'https://api.qrserver.com/v1/create-qr-code/',
    method: 'GET',
    category: 'Utilities',
    payment_token: 'USDC'
  },
  {
    slug: 'stock-price',
    title: 'Stock Price Check',
    description: 'Get real-time stock prices and market data. Includes price, volume, market cap, and daily changes.',
    price: 0.03,
    icon_url: 'https://cdn-icons-png.flaticon.com/512/2936/2936760.png',
    endpoint_url: 'https://api.polygon.io/v2/aggs/ticker/',
    method: 'GET',
    category: 'Data',
    payment_token: 'USDC'
  },
  {
    slug: 'json-validate',
    title: 'JSON Validator',
    description: 'Validate and format JSON data. Checks for errors, prettifies output, and provides detailed error messages.',
    price: 0.005,
    icon_url: 'https://cdn-icons-png.flaticon.com/512/136/136525.png',
    endpoint_url: 'https://jsonlint.com/api/validate',
    method: 'POST',
    category: 'API Tools',
    payment_token: 'USDC'
  },
  {
    slug: 'sentiment-check',
    title: 'Sentiment Analyzer',
    description: 'Analyze text sentiment with AI. Returns positive/negative/neutral score with confidence levels.',
    price: 0.02,
    icon_url: 'https://cdn-icons-png.flaticon.com/512/1239/1239350.png',
    endpoint_url: 'https://api.meaningcloud.com/sentiment-2.1',
    method: 'POST',
    category: 'AI/ML',
    payment_token: 'USDC'
  },
  {
    slug: 'token-price',
    title: 'Crypto Price Checker',
    description: 'Get real-time crypto prices from Jupiter DEX. Supports all Solana SPL tokens.',
    price: 0.01,
    icon_url: 'https://cdn-icons-png.flaticon.com/512/6001/6001368.png',
    endpoint_url: 'https://price.jup.ag/v4/price',
    method: 'GET',
    category: 'Web3',
    payment_token: 'USDC'
  }
];

async function seedBlinks() {
  const client = await pool.connect();

  try {
    console.log('🌱 Starting database seeding...\n');

    // Create or get creator
    console.log('📝 Creating sample creator...');
    const creatorResult = await client.query(
      `INSERT INTO creators (wallet)
       VALUES ($1)
       ON CONFLICT (wallet) DO UPDATE SET wallet = EXCLUDED.wallet
       RETURNING id`,
      [SAMPLE_WALLET]
    );
    const creatorId = creatorResult.rows[0].id;
    console.log(`✅ Creator ID: ${creatorId}\n`);

    // Insert Blinks
    console.log('🔗 Creating sample Blinks...\n');
    let successCount = 0;
    let skipCount = 0;

    for (const blink of sampleBlinks) {
      try {
        await client.query(
          `INSERT INTO blinks (
            slug, title, description, price, icon_url,
            endpoint_url, method, category, payout_wallet, creator_id, payment_token
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
          [
            blink.slug,
            blink.title,
            blink.description,
            blink.price,
            blink.icon_url,
            blink.endpoint_url,
            blink.method,
            blink.category,
            SAMPLE_WALLET,
            creatorId,
            blink.payment_token
          ]
        );
        console.log(`✅ ${blink.title} (${blink.slug})`);
        successCount++;
      } catch (err) {
        if (err.code === '23505') {
          // Unique constraint violation - Blink already exists
          console.log(`⏭️  ${blink.title} (already exists)`);
          skipCount++;
        } else {
          console.error(`❌ ${blink.title}: ${err.message}`);
        }
      }
    }

    // Summary
    console.log('\n📊 Seeding Summary:');
    console.log(`   ✅ Created: ${successCount} blinks`);
    console.log(`   ⏭️  Skipped: ${skipCount} blinks (already exist)`);
    console.log(`   📦 Total: ${sampleBlinks.length} blinks\n`);

    // Show all Blinks
    const blinksResult = await client.query(
      `SELECT slug, title, category, price, status
       FROM blinks
       ORDER BY category, title`
    );

    console.log('🎯 All Blinks in Database:');
    console.log('─'.repeat(70));
    blinksResult.rows.forEach(row => {
      console.log(`${row.category.padEnd(15)} | ${row.title.padEnd(25)} | $${row.price} | ${row.slug}`);
    });
    console.log('─'.repeat(70));
    console.log(`\n🚀 Done! View them at: http://localhost:3000/catalog\n`);

  } catch (error) {
    console.error('❌ Seeding failed:', error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

// Run the seeder
seedBlinks().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
