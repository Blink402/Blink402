import pg from 'pg';
const { Pool } = pg;

const pool = new Pool({
  connectionString: 'postgresql://postgres:NajctWeCLYaSywSNHKxkWElcSbTsDSPc@caboose.proxy.rlwy.net:58182/railway',
  ssl: { rejectUnauthorized: false }
});

async function checkRecentPayments() {
  const client = await pool.connect();

  try {
    console.log('🔍 Checking recent payment attempts...\n');

    // Get recent runs
    const runsResult = await client.query(`
      SELECT
        r.id,
        r.reference,
        r.signature,
        r.payer,
        r.status,
        r.created_at,
        b.slug,
        b.title,
        b.price,
        b.payment_token,
        b.payout_wallet
      FROM runs r
      JOIN blinks b ON r.blink_id = b.id
      ORDER BY r.created_at DESC
      LIMIT 20
    `);

    if (runsResult.rows.length === 0) {
      console.log('📭 No payment attempts found in database.\n');
      console.log('This means either:');
      console.log('  1. Payment transaction creation is failing');
      console.log('  2. Run is not being created in database');
      console.log('  3. Frontend is not calling POST /actions/:slug\n');
      return;
    }

    console.log(`📊 Found ${runsResult.rows.length} recent payment attempts:\n`);
    console.log('─'.repeat(100));

    runsResult.rows.forEach((run, i) => {
      console.log(`\n${i + 1}. ${run.title} (${run.slug})`);
      console.log(`   Reference: ${run.reference}`);
      console.log(`   Signature: ${run.signature || 'NULL (NOT PAID YET)'}`);
      console.log(`   Payer: ${run.payer || 'NULL'}`);
      console.log(`   Status: ${run.status}`);
      console.log(`   Amount: ${run.price} ${run.payment_token}`);
      console.log(`   Payout To: ${run.payout_wallet}`);
      console.log(`   Created: ${run.created_at}`);

      if (run.status === 'pending') {
        console.log(`   ⚠️  Payment not verified yet`);
      } else if (run.status === 'failed') {
        console.log(`   ❌ Payment verification FAILED`);
      } else if (run.status === 'paid') {
        console.log(`   ✅ Payment verified but API not executed`);
      } else if (run.status === 'executed') {
        console.log(`   ✅ Fully completed`);
      }
    });

    console.log('\n' + '─'.repeat(100));

    // Count by status
    const statusCount = await client.query(`
      SELECT status, COUNT(*) as count
      FROM runs
      GROUP BY status
      ORDER BY count DESC
    `);

    console.log('\n📊 Payment Status Summary:');
    statusCount.rows.forEach(row => {
      console.log(`   ${row.status.padEnd(10)}: ${row.count}`);
    });

    // Check for common issues
    const pendingCount = statusCount.rows.find(r => r.status === 'pending')?.count || 0;
    const failedCount = statusCount.rows.find(r => r.status === 'failed')?.count || 0;

    console.log('\n');

    if (pendingCount > 0) {
      console.log(`⚠️  ${pendingCount} payments are PENDING (waiting for verification)`);
      console.log('   This means:');
      console.log('   - Transaction might still be processing');
      console.log('   - RPC endpoint might be slow');
      console.log('   - Payment verification timeout too short\n');
    }

    if (failedCount > 0) {
      console.log(`❌ ${failedCount} payments FAILED verification`);
      console.log('   Common causes:');
      console.log('   - Wrong payment amount');
      console.log('   - Wrong recipient address');
      console.log('   - RPC connection issues');
      console.log('   - Payment token mismatch (SOL vs USDC)\n');
    }

    console.log('🔧 Next Steps:');
    console.log('   1. Check Railway logs for detailed error messages');
    console.log('   2. Verify RPC endpoint is working');
    console.log('   3. Test with mainnet Solana explorer');
    console.log('   4. Increase verification timeout\n');

  } catch (error) {
    console.error('❌ Check failed:', error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

checkRecentPayments().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
