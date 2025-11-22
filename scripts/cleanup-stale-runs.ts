#!/usr/bin/env node
/**
 * Cleanup Stale Pending Runs
 *
 * This script marks runs that have been pending for more than 15 minutes as failed.
 * It should be run periodically (every 30 minutes recommended) via cron job or scheduler.
 *
 * Usage:
 *   node scripts/cleanup-stale-runs.ts
 *   or
 *   tsx scripts/cleanup-stale-runs.ts
 */

import { Pool } from 'pg'

// Database connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
})

const EXPIRATION_MINUTES = 15

async function cleanupStaleRuns() {
  const client = await pool.connect()

  try {
    console.log(`[${new Date().toISOString()}] Starting stale runs cleanup...`)

    // Count stale runs before cleanup
    const countResult = await client.query(
      `SELECT COUNT(*) as stale_count
       FROM runs
       WHERE status = 'pending'
       AND created_at < NOW() - INTERVAL '${EXPIRATION_MINUTES} minutes'`
    )

    const staleCount = parseInt(countResult.rows[0].stale_count)

    if (staleCount === 0) {
      console.log('[INFO] No stale runs found. Database is clean.')
      return
    }

    console.log(`[INFO] Found ${staleCount} stale pending runs to clean up.`)

    // Mark stale runs as failed
    const updateResult = await client.query(
      `UPDATE runs
       SET
         status = 'failed',
         error_message = 'Payment expired - no confirmation received within ${EXPIRATION_MINUTES} minutes'
       WHERE status = 'pending'
       AND created_at < NOW() - INTERVAL '${EXPIRATION_MINUTES} minutes'
       RETURNING id`
    )

    console.log(`[SUCCESS] Cleaned up ${updateResult.rowCount} stale runs.`)

    // Log summary statistics
    const statsResult = await client.query(
      `SELECT
         status,
         COUNT(*) as count
       FROM runs
       GROUP BY status
       ORDER BY count DESC`
    )

    console.log('\n[STATS] Current runs by status:')
    statsResult.rows.forEach(row => {
      console.log(`  ${row.status}: ${row.count}`)
    })

  } catch (error) {
    console.error('[ERROR] Failed to cleanup stale runs:', error)
    process.exit(1)
  } finally {
    client.release()
    await pool.end()
  }
}

// Run cleanup
cleanupStaleRuns()
  .then(() => {
    console.log(`\n[${new Date().toISOString()}] Cleanup completed successfully.`)
    process.exit(0)
  })
  .catch((error) => {
    console.error('[FATAL] Cleanup failed:', error)
    process.exit(1)
  })
