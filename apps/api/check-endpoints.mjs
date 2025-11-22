#!/usr/bin/env node
import pg from 'pg';
const { Pool } = pg;

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  console.error('DATABASE_URL not found');
  process.exit(1);
}

const pool = new Pool({ connectionString });

async function checkEndpoints() {
  try {
    console.log('🔍 Checking endpoint URLs in blinks table...\n');

    const result = await pool.query(`
      SELECT
        id,
        slug,
        title,
        endpoint_url,
        method,
        payment_token,
        price_usdc,
        status
      FROM blinks
      WHERE status = 'active'
      ORDER BY created_at DESC
      LIMIT 10;
    `);

    console.log(`Active blinks found: ${result.rows.length}\n`);

    if (result.rows.length === 0) {
      console.log('No active blinks in database.');
      return;
    }

    console.log('📋 Active Blinks and their endpoints:');
    console.log('═'.repeat(80));

    for (const row of result.rows) {
      console.log(`\n📌 ${row.title} (${row.slug})`);
      console.log(`   Method: ${row.method}`);
      console.log(`   Endpoint: ${row.endpoint_url}`);
      console.log(`   Payment: ${row.price_usdc} ${row.payment_token}`);
      console.log(`   Status: ${row.status}`);

      // Check if endpoint looks suspicious
      if (row.endpoint_url.startsWith('/')) {
        console.log(`   ⚠️  Internal route - will use APP_URL as base`);
      }
      if (!row.endpoint_url.startsWith('http') && !row.endpoint_url.startsWith('/')) {
        console.log(`   ❌ Invalid URL format - missing protocol`);
      }
      if (row.endpoint_url.includes('localhost') || row.endpoint_url.includes('127.0.0.1')) {
        console.log(`   ⚠️  Localhost URL - won't work in production`);
      }
    }

    console.log('\n' + '═'.repeat(80));

  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await pool.end();
  }
}

checkEndpoints().catch(console.error);