import pg from 'pg';
import fs from 'fs';
const { Pool } = pg;

const pool = new Pool({
  connectionString: 'postgresql://postgres:NajctWeCLYaSywSNHKxkWElcSbTsDSPc@caboose.proxy.rlwy.net:58182/railway',
  ssl: { rejectUnauthorized: false }
});

async function runMigration() {
  const client = await pool.connect();

  try {
    console.log('🔄 Running migration 003: Fix payment_token default...\n');

    // Read migration file
    const sql = fs.readFileSync('./migrations/003_fix_payment_token_default.sql', 'utf8');

    // Execute migration
    await client.query(sql);

    console.log('✅ Migration completed successfully!\n');

    // Verify results
    const result = await client.query(`
      SELECT
        column_name,
        column_default,
        is_nullable,
        data_type
      FROM information_schema.columns
      WHERE table_name = 'blinks'
      AND column_name = 'payment_token'
    `);

    console.log('📋 Column definition after migration:');
    console.log(result.rows[0]);
    console.log('');

    // Check how many blinks were updated
    const countResult = await client.query(`
      SELECT payment_token, COUNT(*) as count
      FROM blinks
      GROUP BY payment_token
    `);

    console.log('📊 Blinks by payment token:');
    countResult.rows.forEach(row => {
      console.log(`  ${row.payment_token}: ${row.count}`);
    });

  } catch (error) {
    console.error('❌ Migration failed:', error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

runMigration().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
