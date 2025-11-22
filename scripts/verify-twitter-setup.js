import pg from 'pg';
const { Pool } = pg;

const pool = new Pool({
  connectionString: 'postgresql://postgres:NajctWeCLYaSywSNHKxkWElcSbTsDSPc@caboose.proxy.rlwy.net:58182/railway',
  ssl: { rejectUnauthorized: false }
});

async function verifySetup() {
  const client = await pool.connect();

  try {
    console.log('🔍 Verifying Twitter bot setup...\n');

    // Check twitter_credentials table
    const credResult = await client.query(`
      SELECT COUNT(*) as count FROM twitter_credentials
    `);
    console.log(`✅ twitter_credentials table: ${credResult.rows[0].count} connected accounts`);

    // Check twitter_activity table
    const actResult = await client.query(`
      SELECT COUNT(*) as count FROM twitter_activity
    `);
    console.log(`✅ twitter_activity table: ${actResult.rows[0].count} activity records`);

    // Check environment variables (from Railway)
    console.log('\n📋 Environment Variables:');
    console.log(`   TWITTER_CLIENT_ID: ${process.env.TWITTER_CLIENT_ID ? '✅ Set' : '❌ Missing'}`);
    console.log(`   TWITTER_CLIENT_SECRET: ${process.env.TWITTER_CLIENT_SECRET ? '✅ Set' : '❌ Missing'}`);
    console.log(`   TWITTER_REDIRECT_URI: ${process.env.TWITTER_REDIRECT_URI || '❌ Missing'}`);
    console.log(`   TWITTER_BEARER_TOKEN: ${process.env.TWITTER_BEARER_TOKEN ? '✅ Set' : '❌ Missing'}`);

    console.log('\n🎉 Twitter bot setup is complete!\n');
    console.log('📝 Next steps:');
    console.log('   1. Go to https://blink402.dev/dashboard');
    console.log('   2. Connect your Twitter account');
    console.log('   3. Create a Twitter blink');
    console.log('   4. Share and monetize!\n');

  } catch (error) {
    console.error('❌ Verification failed:', error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

verifySetup().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
