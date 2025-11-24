/**
 * @blink402/database - Burns Module
 *
 * Functions for tracking B402 token burns (deflationary tokenomics).
 * Records burn transactions and provides statistics for dashboard display.
 */

import { createLogger } from '@blink402/config'
import { getPool } from './connection.js'

const logger = createLogger('@blink402/database:burns')

/**
 * Record a B402 token burn
 * Called after successful burn transaction
 */
export async function recordBurn(params: {
  runId: string
  amountB402: bigint
  txSignature: string
}): Promise<void> {
  const { runId, amountB402, txSignature } = params

  try {
    await getPool().query(
      `INSERT INTO burns (run_id, amount_b402, tx_signature)
       VALUES ($1, $2, $3)`,
      [runId, amountB402.toString(), txSignature]
    )

    logger.info('Burn recorded successfully', {
      runId,
      amountB402: amountB402.toString(),
      txSignature
    })
  } catch (error: any) {
    // If duplicate tx_signature, log but don't throw (idempotency)
    if (error.code === '23505') { // unique violation
      logger.warn('Duplicate burn transaction signature - skipping', { txSignature })
      return
    }

    logger.error('Error recording burn', error, params)
    throw error
  }
}

/**
 * Get total B402 tokens burned (all-time)
 */
export async function getTotalBurned(): Promise<bigint> {
  try {
    const result = await getPool().query(
      `SELECT COALESCE(SUM(amount_b402), 0) as total_burned
       FROM burns`
    )

    return BigInt(result.rows[0].total_burned)
  } catch (error) {
    logger.error('Error getting total burned', error)
    throw error
  }
}

/**
 * Get burn statistics for different time periods
 */
export async function getBurnStats(): Promise<{
  totalBurned: string
  burned24h: string
  burned7d: string
  burned30d: string
  burnCount: number
  burnCount24h: number
  lastBurnAt: Date | null
}> {
  try {
    const result = await getPool().query(
      `SELECT
        COALESCE(SUM(amount_b402), 0) as total_burned,
        COALESCE(SUM(CASE WHEN created_at >= NOW() - INTERVAL '24 hours' THEN amount_b402 ELSE 0 END), 0) as burned_24h,
        COALESCE(SUM(CASE WHEN created_at >= NOW() - INTERVAL '7 days' THEN amount_b402 ELSE 0 END), 0) as burned_7d,
        COALESCE(SUM(CASE WHEN created_at >= NOW() - INTERVAL '30 days' THEN amount_b402 ELSE 0 END), 0) as burned_30d,
        COUNT(*) as burn_count,
        COUNT(CASE WHEN created_at >= NOW() - INTERVAL '24 hours' THEN 1 END) as burn_count_24h,
        MAX(created_at) as last_burn_at
       FROM burns`
    )

    const row = result.rows[0]

    return {
      totalBurned: row.total_burned,
      burned24h: row.burned_24h,
      burned7d: row.burned_7d,
      burned30d: row.burned_30d,
      burnCount: parseInt(row.burn_count, 10),
      burnCount24h: parseInt(row.burn_count_24h, 10),
      lastBurnAt: row.last_burn_at
    }
  } catch (error) {
    logger.error('Error getting burn stats', error)
    throw error
  }
}

/**
 * Get recent burn transactions
 * Returns most recent burns with blink information
 */
export async function getRecentBurns(limit = 10): Promise<Array<{
  id: string
  runId: string
  amountB402: string
  txSignature: string
  createdAt: Date
  blinkTitle: string
  blinkSlug: string
}>> {
  try {
    const result = await getPool().query(
      `SELECT
        b.id,
        b.run_id,
        b.amount_b402,
        b.tx_signature,
        b.created_at,
        bl.title as blink_title,
        bl.slug as blink_slug
       FROM burns b
       JOIN runs r ON b.run_id = r.id
       JOIN blinks bl ON r.blink_id = bl.id
       ORDER BY b.created_at DESC
       LIMIT $1`,
      [limit]
    )

    return result.rows.map(row => ({
      id: row.id,
      runId: row.run_id,
      amountB402: row.amount_b402,
      txSignature: row.tx_signature,
      createdAt: row.created_at,
      blinkTitle: row.blink_title,
      blinkSlug: row.blink_slug
    }))
  } catch (error) {
    logger.error('Error getting recent burns', error)
    throw error
  }
}

/**
 * Get burn information for a specific run
 */
export async function getBurnByRunId(runId: string): Promise<{
  id: string
  amountB402: string
  txSignature: string
  createdAt: Date
} | null> {
  try {
    const result = await getPool().query(
      `SELECT id, amount_b402, tx_signature, created_at
       FROM burns
       WHERE run_id = $1`,
      [runId]
    )

    if (result.rows.length === 0) {
      return null
    }

    const row = result.rows[0]
    return {
      id: row.id,
      amountB402: row.amount_b402,
      txSignature: row.tx_signature,
      createdAt: row.created_at
    }
  } catch (error) {
    logger.error('Error getting burn by run ID', error, { runId })
    throw error
  }
}
