/**
 * Runs Module
 * Handles payment run tracking, status updates, and execution lifecycle
 */

import { getPool } from './connection.js'
import { createLogger } from '@blink402/config'

const logger = createLogger('@blink402/database:runs')

/**
 * Run data interface
 * Represents a payment tracking record
 */
export interface RunData {
  id: string
  blink_id: string
  reference: string
  signature: string | null
  payer: string | null
  status: 'pending' | 'paid' | 'executed' | 'failed'
  duration_ms: number | null
  created_at: Date
  expires_at?: Date
  paid_at?: Date | null
  executed_at?: Date | null
  metadata?: Record<string, any>
}

/**
 * Create a new run (payment tracking record)
 * Reference expires after 15 minutes by default (set in database schema)
 * @param params - Run creation parameters
 * @returns Created run data
 */
export async function createRun(params: {
  blinkId: string
  reference: string
  metadata?: Record<string, any>
}): Promise<RunData> {
  const { blinkId, reference, metadata } = params

  const result = await getPool().query(
    `INSERT INTO runs (blink_id, reference, status, metadata)
    VALUES ($1, $2, 'pending', $3)
    RETURNING id, blink_id, reference, signature, payer, status, duration_ms, created_at, expires_at, metadata`,
    [blinkId, reference, metadata ? JSON.stringify(metadata) : null]
  )

  return result.rows[0]
}

/**
 * Get run by reference
 * Includes automatic expiration check for pending runs
 * @param reference - Run reference UUID
 * @returns Run data or null if not found
 */
export async function getRunByReference(reference: string): Promise<RunData | null> {
  const result = await getPool().query(
    `SELECT id, blink_id, reference, signature, payer, status, duration_ms, created_at, expires_at, paid_at, executed_at, metadata
    FROM runs
    WHERE reference = $1`,
    [reference]
  )

  if (result.rows.length === 0) return null

  const run = result.rows[0]

  // Check if reference has expired (only for pending runs)
  if (run.status === 'pending' && run.expires_at) {
    const now = new Date()
    const expiresAt = new Date(run.expires_at)
    if (now > expiresAt) {
      // Mark as failed if expired
      await getPool().query(`UPDATE runs SET status = 'failed' WHERE reference = $1`, [reference])
      run.status = 'failed'
    }
  }

  return run
}

/**
 * Get run by signature
 * Used to check for duplicate payments
 * @param signature - Transaction signature
 * @returns Run data or null if not found
 */
export async function getRunBySignature(signature: string): Promise<RunData | null> {
  const result = await getPool().query(
    `SELECT id, blink_id, reference, signature, payer, status, duration_ms, created_at, expires_at
    FROM runs
    WHERE signature = $1`,
    [signature]
  )

  if (result.rows.length === 0) return null
  return result.rows[0]
}

/**
 * Update run with payment details
 * Simple update without locking (use updateRunPaymentAtomic for concurrent safety)
 * @param params - Payment update parameters
 * @returns Updated run data or null if not found
 */
export async function updateRunPayment(params: {
  reference: string
  signature: string
  payer: string
}): Promise<RunData | null> {
  const { reference, signature, payer } = params

  const result = await getPool().query(
    `UPDATE runs
    SET signature = $1, payer = $2, status = 'paid', paid_at = NOW()
    WHERE reference = $3
    RETURNING id, blink_id, reference, signature, payer, status, duration_ms, created_at, paid_at, metadata`,
    [signature, payer, reference]
  )

  if (result.rows.length === 0) return null
  return result.rows[0]
}

/**
 * Atomically update run payment with row-level locking
 * Prevents race conditions and signature reuse
 * @param params - Payment update parameters
 * @returns Updated run data or null if not found
 * @throws Error if run already processed or signature already used
 */
export async function updateRunPaymentAtomic(params: {
  reference: string
  signature: string
  payer: string
}): Promise<RunData | null> {
  const { reference, signature, payer } = params

  const client = await getPool().connect()
  let transactionStarted = false

  try {
    await client.query('BEGIN')
    transactionStarted = true

    // Lock the row for update to prevent concurrent modifications
    const lockResult = await client.query(
      `SELECT id, status, signature
      FROM runs
      WHERE reference = $1
      FOR UPDATE`,
      [reference]
    )

    if (lockResult.rows.length === 0) {
      await client.query('ROLLBACK')
      return null
    }

    const run = lockResult.rows[0]

    // Check if already processed
    if (run.status !== 'pending') {
      await client.query('ROLLBACK')
      throw new Error(`Run already processed with status: ${run.status}`)
    }

    // Check for signature reuse
    const sigCheckResult = await client.query(
      `SELECT id FROM runs WHERE signature = $1 AND reference != $2`,
      [signature, reference]
    )

    if (sigCheckResult.rows.length > 0) {
      await client.query('ROLLBACK')
      throw new Error('Signature already used for another payment')
    }

    // Update the run with payment details
    const updateResult = await client.query(
      `UPDATE runs
      SET signature = $1, payer = $2, status = 'paid', paid_at = NOW()
      WHERE reference = $3
      RETURNING id, blink_id, reference, signature, payer, status, duration_ms, created_at, paid_at, metadata`,
      [signature, payer, reference]
    )

    await client.query('COMMIT')
    transactionStarted = false

    return updateResult.rows[0]
  } catch (error) {
    if (transactionStarted) {
      try {
        await client.query('ROLLBACK')
      } catch (rollbackError) {
        logger.error('Failed to rollback transaction', rollbackError as Error)
      }
    }
    throw error
  } finally {
    try {
      client.release()
    } catch (releaseError) {
      logger.error('Failed to release database client', releaseError as Error)
    }
  }
}

/**
 * Mark run as executed
 * Atomically updates run status and increments blink run count
 * Stores API response data in metadata
 * @param params - Execution parameters
 * @returns Updated run data or null if not found
 */
export async function markRunExecuted(params: {
  reference: string
  durationMs: number
  responseData?: any
}): Promise<RunData | null> {
  const { reference, durationMs, responseData } = params

  const client = await getPool().connect()
  let transactionStarted = false

  try {
    await client.query('BEGIN')
    transactionStarted = true

    // Prepare response preview (truncated version for quick display)
    const responsePreview = responseData ? JSON.stringify(responseData).substring(0, 500) : null

    // Get existing metadata to preserve it
    const existingRunResult = await client.query(`SELECT metadata FROM runs WHERE reference = $1`, [reference])

    // Merge response data into existing metadata (preserve targetWallet, payer, text, etc.)
    const existingMetadata = existingRunResult.rows[0]?.metadata || {}
    const metadata = {
      ...existingMetadata,
      response: responseData,
    }

    // Update run status and store response data
    const result = await client.query(
      `UPDATE runs
      SET status = 'executed', duration_ms = $1, executed_at = NOW(),
          response_preview = $3, metadata = $4
      WHERE reference = $2
      RETURNING id, blink_id, reference, signature, payer, status, duration_ms, created_at, paid_at, executed_at, metadata`,
      [durationMs, reference, responsePreview, JSON.stringify(metadata)]
    )

    if (result.rows.length === 0) {
      await client.query('ROLLBACK')
      transactionStarted = false
      return null
    }

    // Increment run count for the blink atomically
    const run = result.rows[0]
    await client.query('UPDATE blinks SET runs = runs + 1 WHERE id = $1', [run.blink_id])

    await client.query('COMMIT')
    transactionStarted = false

    return run
  } catch (error) {
    if (transactionStarted) {
      try {
        await client.query('ROLLBACK')
      } catch (rollbackError) {
        logger.error('Failed to rollback transaction', rollbackError as Error)
      }
    }
    throw error
  } finally {
    try {
      client.release()
    } catch (releaseError) {
      logger.error('Failed to release database client', releaseError as Error)
    }
  }
}

/**
 * Mark run as failed
 * @param reference - Run reference UUID
 * @returns Updated run data or null if not found
 */
export async function markRunFailed(reference: string): Promise<RunData | null> {
  const result = await getPool().query(
    `UPDATE runs
    SET status = 'failed'
    WHERE reference = $1
    RETURNING id, blink_id, reference, signature, payer, status, duration_ms, created_at, metadata`,
    [reference]
  )

  if (result.rows.length === 0) return null
  return result.rows[0]
}

/**
 * Clean up expired runs
 * Deletes runs older than 30 days
 * @returns Number of deleted runs
 */
export async function cleanupExpiredRuns(): Promise<number> {
  const result = await getPool().query(`DELETE FROM runs WHERE created_at < NOW() - INTERVAL '30 days'`)

  return result.rowCount || 0
}
