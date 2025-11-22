import pg from 'pg';
const { Pool } = pg;

const pool = new Pool({
  connectionString: 'postgresql://postgres:NajctWeCLYaSywSNHKxkWElcSbTsDSPc@caboose.proxy.rlwy.net:58182/railway',
  ssl: { rejectUnauthorized: false }
});

async function checkEndpoints() {
  const client = await pool.connect();

  try {
    const result = await client.query(`
      SELECT slug, title, endpoint_url, method, status
      FROM blinks
      ORDER BY created_at DESC
    `);

    console.log('\n📋 CONFIGURED BLINKS:\n');
    result.rows.forEach(blink => {
      console.log(`${blink.slug}:`);
      console.log(`  Title: ${blink.title}`);
      console.log(`  Method: ${blink.method}`);
      console.log(`  Endpoint: ${blink.endpoint_url}`);
      console.log(`  Status: ${blink.status}\n`);
    });
  } finally {
    client.release();
    await pool.end();
  }
}

checkEndpoints().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
