#!/usr/bin/env node
import { getPool } from '@blink402/database';

async function checkPaymentTokens() {
  const pool = getPool();

  try {
    console.log('📊 Checking payment_token values in blinks table...\n');

    // Get all blinks with their payment_token values
    const result = await pool.query(`
      SELECT
        id,
        slug,
        payment_token,
        price_usdc,
        status,
        created_at
      FROM blinks
      ORDER BY created_at DESC;
    `);

    console.log(`Total blinks found: ${result.rows.length}\n`);

    if (result.rows.length === 0) {
      console.log('No blinks in database yet.');
      return;
    }

    // Count by payment_token
    const counts = {
      SOL: 0,
      USDC: 0,
      NULL: 0,
      OTHER: 0
    };

    result.rows.forEach(row => {
      if (row.payment_token === 'SOL') counts.SOL++;
      else if (row.payment_token === 'USDC') counts.USDC++;
      else if (row.payment_token === null) counts.NULL++;
      else counts.OTHER++;
    });

    console.log('📈 Payment Token Distribution:');
    console.log(`  SOL:   ${counts.SOL}`);
    console.log(`  USDC:  ${counts.USDC}`);
    console.log(`  NULL:  ${counts.NULL}`);
    console.log(`  OTHER: ${counts.OTHER}\n`);

    // Show first 10 blinks in detail
    console.log('📋 Recent Blinks (up to 10):');
    console.log('─'.repeat(80));
    result.rows.slice(0, 10).forEach(row => {
      console.log(`ID: ${row.id}`);
      console.log(`Slug: ${row.slug}`);
      console.log(`Payment Token: ${row.payment_token || 'NULL'}`);
      console.log(`Price: $${row.price_usdc}`);
      console.log(`Status: ${row.status}`);
      console.log(`Created: ${row.created_at}`);
      console.log('─'.repeat(80));
    });

  } catch (error) {
    console.error('Error querying database:', error);
    throw error;
  } finally {
    await pool.end();
  }
}

checkPaymentTokens().catch(console.error);
