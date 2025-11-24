/**
 * @blink402/database - Refunds Module
 *
 * Functions for managing refunds when API execution fails after payment,
 * and tracking creator debts for refunds issued by the platform.
 */

import { createLogger } from '@blink402/config'
import { getPool } from './connection.js'

const logger = createLogger('@blink402/database:refunds')

export interface RefundData {
  id: string
  run_id: string
  amount_usdc: string
  refund_signature: string | null
  status: 'pending' | 'issued' | 'failed'
  reason: string | null
  creator_debt_id: string | null
  created_at: Date
  processed_at: Date | null
}

export interface CreatorDebtData {
  id: string
  creator_id: string
  blink_id: string
  refund_id: string
  amount_usdc: string
  settled: boolean
  settled_at: Date | null
  settlement_notes: string | null
  created_at: Date
}

/**
 * Create a refund record when API execution fails after successful payment
 * This creates a pending refund that needs to be processed
 */
export async function createRefund(params: {
  runId: string
  amountUsdc: string
  reason?: string
}): Promise<RefundData> {
  const { runId, amountUsdc, reason } = params

  const result = await getPool().query(
    `INSERT INTO refunds (run_id, amount_usdc, reason, status)
     VALUES ($1, $2, $3, 'pending')
     RETURNING id, run_id, amount_usdc, refund_signature, status, reason, creator_debt_id, created_at, processed_at`,
    [runId, amountUsdc, reason || null]
  )

  logger.info('Refund record created', {
    refundId: result.rows[0].id,
    runId,
    amount: amountUsdc,
  })

  return result.rows[0]
}

/**
 * Mark refund as issued after successful on-chain transaction
 */
export async function markRefundIssued(params: {
  refundId: string
  signature: string
}): Promise<RefundData> {
  const { refundId, signature } = params

  const result = await getPool().query(
    `UPDATE refunds
     SET status = 'issued', refund_signature = $1, processed_at = NOW()
     WHERE id = $2
     RETURNING id, run_id, amount_usdc, refund_signature, status, reason, creator_debt_id, created_at, processed_at`,
    [signature, refundId]
  )

  if (result.rows.length === 0) {
    throw new Error(`Refund ${refundId} not found`)
  }

  logger.info('Refund marked as issued', { refundId, signature })

  return result.rows[0]
}

/**
 * Mark refund as failed if on-chain transaction fails
 */
export async function markRefundFailed(params: {
  refundId: string
  error: string
}): Promise<RefundData> {
  const { refundId, error } = params

  const result = await getPool().query(
    `UPDATE refunds
     SET status = 'failed', reason = COALESCE(reason || ' | ', '') || $1, processed_at = NOW()
     WHERE id = $2
     RETURNING id, run_id, amount_usdc, refund_signature, status, reason, creator_debt_id, created_at, processed_at`,
    [error, refundId]
  )

  if (result.rows.length === 0) {
    throw new Error(`Refund ${refundId} not found`)
  }

  logger.error('Refund marked as failed', { refundId, error })

  return result.rows[0]
}

/**
 * Get refund by run ID
 */
export async function getRefundByRunId(runId: string): Promise<RefundData | null> {
  const result = await getPool().query(
    `SELECT id, run_id, amount_usdc, refund_signature, status, reason, creator_debt_id, created_at, processed_at
     FROM refunds
     WHERE run_id = $1`,
    [runId]
  )

  if (result.rows.length === 0) return null
  return result.rows[0]
}

/**
 * Create a creator debt record when platform issues a refund
 * This tracks the amount the creator owes back to the platform
 */
export async function createCreatorDebt(params: {
  creatorId: string
  blinkId: string
  refundId: string
  amountUsdc: string
}): Promise<CreatorDebtData> {
  const { creatorId, blinkId, refundId, amountUsdc } = params

  const result = await getPool().query(
    `INSERT INTO creator_debts (creator_id, blink_id, refund_id, amount_usdc, settled)
     VALUES ($1, $2, $3, $4, false)
     RETURNING id, creator_id, blink_id, refund_id, amount_usdc, settled, settled_at, settlement_notes, created_at`,
    [creatorId, blinkId, refundId, amountUsdc]
  )

  // Update refund record to link to debt
  await getPool().query(
    `UPDATE refunds SET creator_debt_id = $1 WHERE id = $2`,
    [result.rows[0].id, refundId]
  )

  logger.info('Creator debt created', {
    debtId: result.rows[0].id,
    creatorId,
    blinkId,
    amount: amountUsdc,
  })

  return result.rows[0]
}

/**
 * Get total outstanding debt for a creator
 */
export async function getCreatorOutstandingDebt(creatorId: string): Promise<string> {
  const result = await getPool().query(
    `SELECT COALESCE(SUM(amount_usdc), 0)::text as total_debt
     FROM creator_debts
     WHERE creator_id = $1 AND settled = false`,
    [creatorId]
  )

  return result.rows[0].total_debt
}

/**
 * Get all unsettled debts for a creator
 */
export async function getCreatorUnsettledDebts(creatorId: string): Promise<CreatorDebtData[]> {
  const result = await getPool().query(
    `SELECT id, creator_id, blink_id, refund_id, amount_usdc, settled, settled_at, settlement_notes, created_at
     FROM creator_debts
     WHERE creator_id = $1 AND settled = false
     ORDER BY created_at DESC`,
    [creatorId]
  )

  return result.rows
}

/**
 * Mark creator debt as settled
 */
export async function settleCreatorDebt(params: {
  debtId: string
  notes?: string
}): Promise<CreatorDebtData> {
  const { debtId, notes } = params

  const result = await getPool().query(
    `UPDATE creator_debts
     SET settled = true, settled_at = NOW(), settlement_notes = $1
     WHERE id = $2
     RETURNING id, creator_id, blink_id, refund_id, amount_usdc, settled, settled_at, settlement_notes, created_at`,
    [notes || null, debtId]
  )

  if (result.rows.length === 0) {
    throw new Error(`Creator debt ${debtId} not found`)
  }

  logger.info('Creator debt settled', { debtId, notes })

  return result.rows[0]
}
