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
    console.log('🚀 Running Twitter integration migration...\n');

    // Read migration file
    const migration = fs.readFileSync('migrations/002_add_twitter_integration.sql', 'utf8');

    // Run migration
    await client.query(migration);

    console.log('✅ Migration completed successfully!\n');

    // Verify tables were created
    const result = await client.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_name IN ('twitter_credentials', 'twitter_activity')
      ORDER BY table_name
    `);

    console.log('📋 Twitter tables created:');
    result.rows.forEach(row => {
      console.log(`   - ${row.table_name}`);
    });

    console.log('\n🎉 Twitter bot is now ready for production!\n');

  } catch (error) {
    if (error.message.includes('already exists')) {
      console.log('ℹ️  Migration already applied - tables already exist\n');
    } else {
      console.error('❌ Migration failed:', error);
      throw error;
    }
  } finally {
    client.release();
    await pool.end();
  }
}

runMigration().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
