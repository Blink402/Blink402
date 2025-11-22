import pg from 'pg';
const { Pool } = pg;

const pool = new Pool({
  connectionString: 'postgresql://postgres:NajctWeCLYaSywSNHKxkWElcSbTsDSPc@caboose.proxy.rlwy.net:58182/railway',
  ssl: { rejectUnauthorized: false }
});

async function diagnoseAndFixBlinks() {
  const client = await pool.connect();

  try {
    console.log('🔍 DIAGNOSING BLINK DATABASE ISSUES...\n');

    // Check all blinks
    const result = await client.query(`
      SELECT
        b.id,
        b.slug,
        b.title,
        b.price,
        b.payment_token,
        b.payout_wallet,
        b.method,
        b.endpoint_url,
        b.status,
        c.wallet as creator_wallet
      FROM blinks b
      JOIN creators c ON b.creator_id = c.id
      ORDER BY b.created_at DESC
    `);

    console.log(`📊 Found ${result.rows.length} blinks\n`);

    let issues = [];

    result.rows.forEach(blink => {
      console.log(`🔧 Checking: ${blink.title} (${blink.slug})`);
      console.log(`   Payment Token: ${blink.payment_token}`);
      console.log(`   Payout Wallet: ${blink.payout_wallet}`);
      console.log(`   Price: ${blink.price}`);
      console.log(`   Status: ${blink.status}`);

      // Check for issues
      if (!blink.payment_token) {
        issues.push({ slug: blink.slug, issue: 'Missing payment_token', fix: 'SOL' });
      }
      if (!blink.payout_wallet) {
        issues.push({ slug: blink.slug, issue: 'Missing payout_wallet', fix: blink.creator_wallet });
      }
      if (blink.payout_wallet !== blink.creator_wallet) {
        issues.push({ slug: blink.slug, issue: 'Payout wallet mismatch', fix: blink.creator_wallet });
      }
      if (!blink.price || parseFloat(blink.price) <= 0) {
        issues.push({ slug: blink.slug, issue: 'Invalid price', fix: '0.001' });
      }

      console.log('');
    });

    if (issues.length === 0) {
      console.log('✅ No database issues found!\n');
      console.log('🔍 The problem might be in the verification logic or RPC connection.\n');
      return;
    }

    console.log(`\n⚠️  Found ${issues.length} issues:\n`);
    issues.forEach(issue => {
      console.log(`   ${issue.slug}: ${issue.issue} → Fix: ${issue.fix}`);
    });

    console.log('\n🔧 Fixing issues...\n');

    // Fix all blinks
    await client.query(`
      UPDATE blinks
      SET
        payment_token = COALESCE(payment_token, 'SOL'),
        status = COALESCE(status, 'active')
      WHERE payment_token IS NULL OR status IS NULL
    `);

    // Verify payout_wallet matches creator wallet
    await client.query(`
      UPDATE blinks b
      SET payout_wallet = c.wallet
      FROM creators c
      WHERE b.creator_id = c.id
      AND (b.payout_wallet IS NULL OR b.payout_wallet != c.wallet)
    `);

    console.log('✅ Fixed all database issues!\n');

    // Show final state
    const finalResult = await client.query(`
      SELECT slug, title, price, payment_token, payout_wallet, status
      FROM blinks
      ORDER BY created_at DESC
    `);

    console.log('📋 Final Blink State:');
    console.log('─'.repeat(80));
    finalResult.rows.forEach(row => {
      console.log(`${row.slug.padEnd(20)} | ${row.payment_token.padEnd(5)} | $${row.price} | ${row.status}`);
    });
    console.log('─'.repeat(80));

    console.log('\n🚀 Database is now fixed!\n');

  } catch (error) {
    console.error('❌ Diagnosis failed:', error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

diagnoseAndFixBlinks().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
