// Script to update featured blinks
// Run with: node scripts/update-featured.js

import { Pool } from 'pg'
import { config } from 'dotenv'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import fs from 'fs/promises'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

// Load environment variables
config()

async function updateFeaturedBlinks() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL || 'postgresql://postgres:NajctWeCLYaSywSNHKxkWElcSbTsDSPc@postgres-7_oq.railway.internal:5432/railway'
  })

  try {
    console.log('Connecting to database...')

    // Read the migration file
    const migrationPath = join(__dirname, '..', 'migrations', '004_update_featured_blinks.sql')
    const sqlContent = await fs.readFile(migrationPath, 'utf-8')

    console.log('Running migration to update featured blinks...')

    // Execute the migration
    await pool.query(sqlContent)

    console.log('✅ Featured blinks updated successfully!')

    // Verify the update
    const result = await pool.query(`
      SELECT
        fb.display_order,
        b.slug,
        COALESCE(fb.title_override, b.title) as title,
        COALESCE(fb.description_override, b.description) as description
      FROM featured_blinks fb
      JOIN blinks b ON fb.blink_id = b.id
      ORDER BY fb.display_order
    `)

    console.log('\n📌 New featured blinks:')
    console.log('=' + '='.repeat(60))

    result.rows.forEach(row => {
      console.log(`${row.display_order}. ${row.title} (${row.slug})`)
      console.log(`   ${row.description.substring(0, 80)}...`)
      console.log('-' + '-'.repeat(60))
    })

  } catch (error) {
    console.error('❌ Error updating featured blinks:', error.message)
    process.exit(1)
  } finally {
    await pool.end()
  }
}

// Run the update
updateFeaturedBlinks().catch(console.error)