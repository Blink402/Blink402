// Script to update featured blinks using database package
// Run with: node scripts/update-featured-simple.js

import pg from 'pg'
const { Pool } = pg

async function updateFeaturedBlinks() {
  // Use the provided database URL
  const databaseUrl = 'postgresql://postgres:NajctWeCLYaSywSNHKxkWElcSbTsDSPc@postgres-7_oq.railway.internal:5432/railway'

  const pool = new Pool({
    connectionString: databaseUrl
  })

  try {
    console.log('Connecting to database...')

    // Clear existing featured blinks
    console.log('Clearing existing featured blinks...')
    await pool.query('DELETE FROM featured_blinks')

    // Insert new featured blinks
    console.log('Adding new featured blinks...')

    const featuredBlinks = [
      {
        id: 'bbee3379-ee89-48f8-b870-e8066783ce56',
        order: 1,
        title: 'Wallet Analyzer',
        desc: 'Deep dive into any Solana wallet with comprehensive analytics, token holdings, and transaction history'
      },
      {
        id: '5b939817-a7bb-4ce5-a4e5-6f8c6b1b60c1',
        order: 2,
        title: 'Social Media Post',
        desc: 'Instantly post to Twitter/X with a single micropayment - no API keys needed'
      },
      {
        id: '17c7431e-4fe1-43e9-a13e-7584a7e3fcbf',
        order: 3,
        title: 'Random Images',
        desc: 'Generate beautiful placeholder images on demand for your projects'
      },
      {
        id: '519a4ebf-4110-414f-a3d3-cbf06df0f975',
        order: 4,
        title: 'Token Prices',
        desc: 'Real-time Solana token prices from Jupiter aggregator - DeFi data at your fingertips'
      },
      {
        id: '0d6b648f-44d9-45bc-a154-d70f9af8a7f0',
        order: 5,
        title: 'Daily Inspiration',
        desc: 'Get motivational quotes to brighten your day - perfect for apps and bots'
      }
    ]

    for (const blink of featuredBlinks) {
      await pool.query(
        `INSERT INTO featured_blinks (blink_id, display_order, title_override, description_override, created_by)
         VALUES ($1, $2, $3, $4, 'admin')`,
        [blink.id, blink.order, blink.title, blink.desc]
      )
    }

    // Update is_featured flags
    console.log('Updating is_featured flags...')

    // Set featured = true for selected blinks
    await pool.query(
      `UPDATE blinks SET is_featured = TRUE WHERE id = ANY($1)`,
      [featuredBlinks.map(b => b.id)]
    )

    // Set featured = false for all others
    await pool.query(
      `UPDATE blinks SET is_featured = FALSE WHERE id != ALL($1)`,
      [featuredBlinks.map(b => b.id)]
    )

    console.log('✅ Featured blinks updated successfully!')

    // Verify the update
    const result = await pool.query(`
      SELECT
        fb.display_order,
        b.slug,
        COALESCE(fb.title_override, b.title) as title
      FROM featured_blinks fb
      JOIN blinks b ON fb.blink_id = b.id
      ORDER BY fb.display_order
    `)

    console.log('\n📌 New featured blinks:')
    result.rows.forEach(row => {
      console.log(`${row.display_order}. ${row.title} (${row.slug})`)
    })

  } catch (error) {
    console.error('❌ Error:', error.message)
    if (error.message.includes('could not translate host name')) {
      console.log('\n💡 Note: This script needs to run in the Railway environment or use Railway CLI:')
      console.log('   railway run node scripts/update-featured-simple.js')
    }
    process.exit(1)
  } finally {
    await pool.end()
  }
}

// Run the update
updateFeaturedBlinks().catch(console.error)