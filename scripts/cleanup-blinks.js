// Script to clean up low-quality blinks from the catalog
// Run with: node scripts/cleanup-blinks.js

import pg from 'pg'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const { Pool } = pg
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

async function cleanupBlinks() {
  // Use the provided database URL or environment variable
  const databaseUrl = process.env.DATABASE_URL ||
    'postgresql://postgres:NajctWeCLYaSywSNHKxkWElcSbTsDSPc@postgres-7_oq.railway.internal:5432/railway'

  const pool = new Pool({
    connectionString: databaseUrl
  })

  try {
    console.log('🧹 Starting cleanup of low-quality blinks...')
    console.log('=' + '='.repeat(50))

    // Get current stats
    const beforeStats = await pool.query(`
      SELECT
        COUNT(*) as total,
        COUNT(CASE WHEN is_public = TRUE AND publish_to_catalog = TRUE THEN 1 END) as public_count,
        COUNT(CASE WHEN is_public = FALSE OR publish_to_catalog = FALSE THEN 1 END) as private_count
      FROM blinks
    `)

    console.log('\n📊 Before cleanup:')
    console.log(`  Total blinks: ${beforeStats.rows[0].total}`)
    console.log(`  Public: ${beforeStats.rows[0].public_count}`)
    console.log(`  Private: ${beforeStats.rows[0].private_count}`)

    // Read and execute the migration
    const migrationPath = path.join(__dirname, '..', 'migrations', '005_cleanup_low_quality_blinks.sql')
    const migrationSQL = fs.readFileSync(migrationPath, 'utf-8')

    console.log('\n🔄 Running migration...')
    await pool.query(migrationSQL)

    // Get after stats
    const afterStats = await pool.query(`
      SELECT
        COUNT(*) as total,
        COUNT(CASE WHEN is_public = TRUE AND publish_to_catalog = TRUE THEN 1 END) as public_count,
        COUNT(CASE WHEN is_public = FALSE OR publish_to_catalog = FALSE THEN 1 END) as private_count
      FROM blinks
    `)

    console.log('\n✅ After cleanup:')
    console.log(`  Total blinks: ${afterStats.rows[0].total}`)
    console.log(`  Public: ${afterStats.rows[0].public_count} (${beforeStats.rows[0].public_count - afterStats.rows[0].public_count} hidden)`)
    console.log(`  Private: ${afterStats.rows[0].private_count}`)

    // Show some of the blinks that are still public
    const publicBlinks = await pool.query(`
      SELECT slug, title, runs, success_rate_percent
      FROM blinks
      WHERE is_public = TRUE AND publish_to_catalog = TRUE
      ORDER BY runs DESC
      LIMIT 10
    `)

    console.log('\n📌 Top public blinks after cleanup:')
    console.log('-' + '-'.repeat(50))
    publicBlinks.rows.forEach((blink, i) => {
      const successRate = blink.success_rate_percent
        ? `${parseFloat(blink.success_rate_percent).toFixed(1)}%`
        : 'N/A'
      console.log(`${i + 1}. ${blink.title} (${blink.slug})`)
      console.log(`   Runs: ${blink.runs}, Success: ${successRate}`)
    })

    // Show some blinks that were hidden
    const hiddenBlinks = await pool.query(`
      SELECT slug, title,
        CASE
          WHEN title ~ '^\\d+$' THEN 'Invalid title (just numbers)'
          WHEN LENGTH(description) < 20 THEN 'Description too short'
          WHEN success_rate_percent < 70 THEN 'Low success rate'
          WHEN reported_count > 5 THEN 'Too many reports'
          ELSE 'Other quality issues'
        END as reason
      FROM blinks
      WHERE is_public = FALSE OR publish_to_catalog = FALSE
      ORDER BY created_at DESC
      LIMIT 5
    `)

    if (hiddenBlinks.rows.length > 0) {
      console.log('\n🚫 Examples of hidden blinks:')
      console.log('-' + '-'.repeat(50))
      hiddenBlinks.rows.forEach((blink) => {
        console.log(`• ${blink.title || 'Untitled'} (${blink.slug}): ${blink.reason}`)
      })
    }

    console.log('\n🎉 Cleanup complete! Low-quality blinks have been hidden.')
    console.log('\n💡 Next steps:')
    console.log('1. Clear Redis cache or restart the API server')
    console.log('2. Refresh the website to see the cleaned catalog')

  } catch (error) {
    console.error('❌ Error during cleanup:', error.message)
    if (error.message.includes('could not translate host name')) {
      console.log('\n💡 This script needs to run in the Railway environment:')
      console.log('   railway run node scripts/cleanup-blinks.js')
    }
    process.exit(1)
  } finally {
    await pool.end()
  }
}

// Run the cleanup
cleanupBlinks().catch(console.error)