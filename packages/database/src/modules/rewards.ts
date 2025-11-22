/**
 * Rewards Module
 * Handles reward claim tracking and validation
 */

import { getPool, isPostgresError } from './connection.js'

/**
 * Reward claim data interface
 */
export interface RewardClaimData {
  id: string
  blink_id: string
  user_wallet: string
  reference: string
  signature: string | null
  claimed_at: Date
  claim_count?: number
}

/**
 * Create a reward claim record
 * Prevents duplicate claims via UNIQUE constraint on (blink_id, user_wallet, reference)
 * @param params - Reward claim parameters
 * @returns Created reward claim data
 * @throws Error if user already claimed this reward
 */
export async function createRewardClaim(params: {
  blinkId: string
  userWallet: string
  reference: string
  signature: string
}): Promise<RewardClaimData> {
  const { blinkId, userWallet, reference, signature } = params

  try {
    const result = await getPool().query(
      `INSERT INTO reward_claims (blink_id, user_wallet, reference, signature)
      VALUES ($1, $2, $3, $4)
      RETURNING id, blink_id, user_wallet, reference, signature, claimed_at`,
      [blinkId, userWallet, reference, signature]
    )

    return result.rows[0]
  } catch (error) {
    if (isPostgresError(error) && error.code === '23505') {
      throw new Error('Reward already claimed by this wallet')
    }
    throw error
  }
}

/**
 * Get the number of times a user has claimed from a specific blink
 * @param blinkId - Blink UUID
 * @param userWallet - User wallet address
 * @returns Number of claims (0 if none)
 */
export async function getRewardClaimCount(blinkId: string, userWallet: string): Promise<number> {
  const result = await getPool().query(
    `SELECT COUNT(*) as count
    FROM reward_claims
    WHERE blink_id = $1 AND user_wallet = $2`,
    [blinkId, userWallet]
  )

  return parseInt(result.rows[0].count, 10)
}

/**
 * Check if a user has already claimed a reward from a specific blink
 * @param blinkId - Blink UUID
 * @param userWallet - User wallet address
 * @returns True if user has claimed
 */
export async function hasUserClaimedReward(blinkId: string, userWallet: string): Promise<boolean> {
  const result = await getPool().query(
    `SELECT EXISTS(
      SELECT 1 FROM reward_claims
      WHERE blink_id = $1 AND user_wallet = $2
    ) as has_claimed`,
    [blinkId, userWallet]
  )

  return result.rows[0].has_claimed
}

/**
 * Get all reward claims for a specific blink
 * @param blinkId - Blink UUID
 * @param limit - Maximum number of results
 * @param offset - Pagination offset
 * @returns Array of reward claims
 */
export async function getRewardClaimsByBlink(
  blinkId: string,
  limit: number = 100,
  offset: number = 0
): Promise<RewardClaimData[]> {
  const result = await getPool().query(
    `SELECT id, blink_id, user_wallet, reference, signature, claim_count, claimed_at
    FROM reward_claims
    WHERE blink_id = $1
    ORDER BY claimed_at DESC
    LIMIT $2 OFFSET $3`,
    [blinkId, limit, offset]
  )

  return result.rows
}

/**
 * Get reward claim by reference
 * @param reference - Claim reference UUID
 * @returns Reward claim data or null if not found
 */
export async function getRewardClaimByReference(reference: string): Promise<RewardClaimData | null> {
  const result = await getPool().query(
    `SELECT id, blink_id, user_wallet, reference, signature, claim_count, claimed_at
    FROM reward_claims
    WHERE reference = $1`,
    [reference]
  )

  if (result.rows.length === 0) return null
  return result.rows[0]
}
