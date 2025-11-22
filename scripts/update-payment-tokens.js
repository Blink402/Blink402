import pg from 'pg';
const { Pool } = pg;

const pool = new Pool({
  connectionString: 'postgresql://postgres:NajctWeCLYaSywSNHKxkWElcSbTsDSPc@caboose.proxy.rlwy.net:58182/railway',
  ssl: { rejectUnauthorized: false }
});

async function updatePaymentTokens() {
  const client = await pool.connect();

  try {
    console.log('🔄 Updating payment tokens from USDC to SOL...\n');

    const result = await client.query(
      `UPDATE blinks
       SET payment_token = 'SOL'
       WHERE payment_token = 'USDC'
       RETURNING slug, title`
    );

    console.log(`✅ Updated ${result.rowCount} blinks to use SOL:\n`);
    result.rows.forEach(row => {
      console.log(`   - ${row.title} (${row.slug})`);
    });

    console.log('\n🚀 Done! All blinks now use SOL for easier testing.\n');

  } catch (error) {
    console.error('❌ Update failed:', error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

updatePaymentTokens().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
