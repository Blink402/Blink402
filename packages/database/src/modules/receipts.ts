/**
 * @blink402/database - Receipts Module
 *
 * Functions for managing optional cNFT receipts for completed runs.
 */

import { createLogger } from '@blink402/config'
import { getPool } from './connection.js'

const logger = createLogger('@blink402/database:receipts')

/**
 * Get receipt by run ID
 * Returns cNFT receipt information if one was minted for this run
 */
export async function getReceiptByRunId(runId: string) {
  const result = await getPool().query(
    `SELECT id, run_id, tree, leaf, created_at
    FROM receipts
    WHERE run_id = $1`,
    [runId]
  )

  if (result.rows.length === 0) return null
  return result.rows[0]
}
