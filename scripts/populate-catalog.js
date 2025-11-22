// Script to populate catalog with public and featured blinks
import { getPool } from '../packages/database/dist/index.js'
import dotenv from 'dotenv'

// Load environment variables
dotenv.config({ path: './apps/api/.env' })

async function populateCatalog() {
  const pool = getPool()

  try {
    console.log('Starting catalog population...')

    // 1. Make top active blinks public
    const publicResult = await pool.query(`
      UPDATE blinks
      SET
        is_public = true,
        publish_to_catalog = true,
        catalog_published_at = NOW(),
        media_type = CASE
          WHEN category = 'AI/ML' THEN 'ai'
          WHEN category = 'Data' THEN 'data'
          WHEN category = 'Utilities' THEN 'utility'
          ELSE 'text'
        END
      WHERE id IN (
        SELECT id FROM blinks
        WHERE status = 'active'
        ORDER BY runs DESC
        LIMIT 20
      )
      RETURNING slug, title
    `)
    console.log(`Made ${publicResult.rowCount} blinks public`)

    // 2. Set top 5 as featured
    const featuredResult = await pool.query(`
      UPDATE blinks
      SET is_featured = true, is_forkable = true
      WHERE id IN (
        SELECT id FROM blinks
        WHERE status = 'active' AND is_public = true
        ORDER BY runs DESC
        LIMIT 5
      )
      RETURNING slug, title
    `)
    console.log(`Made ${featuredResult.rowCount} blinks featured`)

    // 3. Clear and populate featured_blinks table
    await pool.query('DELETE FROM featured_blinks')

    const featuredTableResult = await pool.query(`
      INSERT INTO featured_blinks (blink_id, display_order, created_by)
      SELECT
        id as blink_id,
        ROW_NUMBER() OVER (ORDER BY runs DESC) as display_order,
        'system' as created_by
      FROM blinks
      WHERE is_featured = true
      ORDER BY runs DESC
      LIMIT 5
      RETURNING *
    `)
    console.log(`Added ${featuredTableResult.rowCount} entries to featured_blinks table`)

    // 4. Update metrics for public blinks
    await pool.query(`
      UPDATE blinks
      SET
        avg_latency_ms = FLOOR(RANDOM() * 1000 + 500)::INTEGER,
        success_rate_percent = (90 + RANDOM() * 10)::DECIMAL(5,2),
        badges = '[]'::jsonb
      WHERE is_public = true
    `)

    // 5. Add badges based on metrics
    await pool.query(`
      UPDATE blinks
      SET badges = badges || '["fast"]'::jsonb
      WHERE avg_latency_ms < 1500 AND is_public = true
    `)

    await pool.query(`
      UPDATE blinks
      SET badges = badges || '["reliable"]'::jsonb
      WHERE success_rate_percent > 99 AND is_public = true
    `)

    await pool.query(`
      UPDATE blinks
      SET badges = badges || '["reverse"]'::jsonb
      WHERE payment_mode = 'reward' AND is_public = true
    `)

    await pool.query(`
      UPDATE blinks
      SET badges = badges || '["forkable"]'::jsonb
      WHERE is_forkable = true
    `)

    // 6. Add some trending metrics
    await pool.query('DELETE FROM blink_trending_metrics WHERE metric_date = CURRENT_DATE')

    const trendingResult = await pool.query(`
      INSERT INTO blink_trending_metrics (blink_id, metric_date, runs_count, unique_users, total_volume_usdc, avg_latency_ms, success_rate)
      SELECT
        id as blink_id,
        CURRENT_DATE as metric_date,
        FLOOR(RANDOM() * 100 + 10)::INTEGER as runs_count,
        FLOOR(RANDOM() * 50 + 5)::INTEGER as unique_users,
        (RANDOM() * 10)::DECIMAL(15,6) as total_volume_usdc,
        FLOOR(RANDOM() * 1000 + 500)::INTEGER as avg_latency_ms,
        (90 + RANDOM() * 10)::DECIMAL(5,2) as success_rate
      FROM blinks
      WHERE is_public = true
      LIMIT 10
      ON CONFLICT (blink_id, metric_date) DO NOTHING
      RETURNING *
    `)
    console.log(`Added ${trendingResult.rowCount} trending metrics`)

    // 7. Show summary
    const summary = await pool.query(`
      SELECT
        'Public Blinks' as category,
        COUNT(*) as count
      FROM blinks
      WHERE is_public = true
      UNION ALL
      SELECT
        'Featured Blinks' as category,
        COUNT(*) as count
      FROM blinks
      WHERE is_featured = true
      UNION ALL
      SELECT
        'Blinks with badges' as category,
        COUNT(*) as count
      FROM blinks
      WHERE badges != '[]'::jsonb AND is_public = true
    `)

    console.log('\n=== Summary ===')
    summary.rows.forEach(row => {
      console.log(`${row.category}: ${row.count}`)
    })

    // Show featured blinks
    const featuredBlinks = await pool.query(`
      SELECT b.slug, b.title, b.badges
      FROM blinks b
      WHERE b.is_featured = true
      ORDER BY b.runs DESC
    `)

    console.log('\n=== Featured Blinks ===')
    featuredBlinks.rows.forEach(row => {
      console.log(`- ${row.title} (${row.slug}) - Badges: ${JSON.stringify(row.badges)}`)
    })

    console.log('\n✅ Catalog population complete!')

  } catch (error) {
    console.error('Error populating catalog:', error)
  } finally {
    await pool.end()
  }
}

populateCatalog()