import pg from 'pg';
const { Pool } = pg;

const pool = new Pool({
  connectionString: 'postgresql://postgres:NajctWeCLYaSywSNHKxkWElcSbTsDSPc@caboose.proxy.rlwy.net:58182/railway',
  ssl: { rejectUnauthorized: false }
});

const client = await pool.connect();
const result = await client.query(`
  SELECT column_name, data_type, is_nullable
  FROM information_schema.columns
  WHERE table_name = 'blinks'
  ORDER BY ordinal_position
`);

console.log('\n📋 Blinks Table Schema:\n');
result.rows.forEach(col => {
  console.log(`  ${col.column_name.padEnd(20)} ${col.data_type.padEnd(25)} ${col.is_nullable === 'NO' ? 'NOT NULL' : 'NULL'}`);
});

client.release();
await pool.end();
