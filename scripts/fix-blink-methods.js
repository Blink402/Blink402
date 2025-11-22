import pg from 'pg';
const { Pool } = pg;

const pool = new Pool({
  connectionString: 'postgresql://postgres:NajctWeCLYaSywSNHKxkWElcSbTsDSPc@caboose.proxy.rlwy.net:58182/railway',
  ssl: { rejectUnauthorized: false }
});

async function fixBlinkMethods() {
  const client = await pool.connect();

  try {
    console.log('🔧 FIXING BLINK HTTP METHODS...\n');

    // Fix ip-geolocation: POST → GET
    await client.query(`
      UPDATE blinks
      SET method = 'GET'
      WHERE slug = 'ip-geolocation'
      RETURNING slug, title, method
    `);
    console.log('✅ Fixed ip-geolocation: POST → GET');

    // Pause pay-to-view-my-x (invalid endpoint - not an API)
    await client.query(`
      UPDATE blinks
      SET status = 'paused'
      WHERE slug = 'pay-to-view-my-x'
      RETURNING slug, title
    `);
    console.log('✅ Paused pay-to-view-my-x (invalid endpoint)');

    // Check final state
    const result = await client.query(`
      SELECT slug, title, method, status
      FROM blinks
      WHERE slug IN ('ip-geolocation', 'pay-to-view-my-x')
    `);

    console.log('\n📋 UPDATED BLINKS:\n');
    result.rows.forEach(blink => {
      console.log(`${blink.slug}:`);
      console.log(`  Title: ${blink.title}`);
      console.log(`  Method: ${blink.method}`);
      console.log(`  Status: ${blink.status}\n`);
    });

    console.log('✅ Done!\n');

  } finally {
    client.release();
    await pool.end();
  }
}

fixBlinkMethods().catch(err => {
  console.error('❌ Error:', err);
  process.exit(1);
});
