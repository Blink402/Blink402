/**
 * @blink402/database - Referrals Module
 *
 * Functions for managing referral codes, tracking referrals, calculating commissions,
 * and leaderboard functionality.
 */

import { createLogger } from '@blink402/config'
import { getPool, isPostgresError } from './connection.js'

const logger = createLogger('@blink402/database:referrals')

/**
 * Generate or get existing referral code for a user
 * Creates a new code if one doesn't exist
 */
export async function getOrCreateReferralCode(userWallet: string): Promise<{
  code: string
  tier: string
  totalReferrals: number
  totalEarningsUsdc: string
}> {
  try {
    // Check if code already exists
    const existing = await getPool().query(
      `SELECT code, tier, total_referrals, total_earnings_usdc
       FROM referral_codes
       WHERE user_wallet = $1`,
      [userWallet]
    )

    if (existing.rows.length > 0) {
      return {
        code: existing.rows[0].code,
        tier: existing.rows[0].tier,
        totalReferrals: existing.rows[0].total_referrals,
        totalEarningsUsdc: existing.rows[0].total_earnings_usdc
      }
    }

    // Generate new code
    const result = await getPool().query(
      `INSERT INTO referral_codes (user_wallet, code)
       VALUES ($1, generate_referral_code($1))
       RETURNING code, tier, total_referrals, total_earnings_usdc`,
      [userWallet]
    )

    logger.info('Created new referral code', { userWallet, code: result.rows[0].code })

    return {
      code: result.rows[0].code,
      tier: result.rows[0].tier,
      totalReferrals: result.rows[0].total_referrals,
      totalEarningsUsdc: result.rows[0].total_earnings_usdc
    }
  } catch (error) {
    logger.error('Error getting/creating referral code', error, { userWallet })
    throw error
  }
}

/**
 * Track a new referral when someone uses a referral code
 */
export async function trackReferral(params: {
  referralCode: string
  refereeWallet: string
}): Promise<boolean> {
  const { referralCode, refereeWallet } = params

  try {
    // Get referrer wallet from code
    const codeResult = await getPool().query(
      `SELECT user_wallet FROM referral_codes WHERE code = $1`,
      [referralCode]
    )

    if (codeResult.rows.length === 0) {
      logger.warn('Invalid referral code', { referralCode })
      return false
    }

    const referrerWallet = codeResult.rows[0].user_wallet

    // Don't allow self-referrals
    if (referrerWallet === refereeWallet) {
      logger.warn('Attempted self-referral', { referrerWallet, refereeWallet })
      return false
    }

    // Insert referral (unique constraint prevents duplicates)
    await getPool().query(
      `INSERT INTO referrals (referrer_wallet, referee_wallet, referral_code)
       VALUES ($1, $2, $3)
       ON CONFLICT (referrer_wallet, referee_wallet) DO NOTHING`,
      [referrerWallet, refereeWallet, referralCode]
    )

    // Update total_referrals count
    await getPool().query(
      `UPDATE referral_codes
       SET total_referrals = (
         SELECT COUNT(*) FROM referrals WHERE referral_code = $1
       )
       WHERE code = $1`,
      [referralCode]
    )

    logger.info('Referral tracked', { referralCode, referrerWallet, refereeWallet })
    return true
  } catch (error) {
    if (isPostgresError(error) && error.code === '23505') {
      // Duplicate referral, silently ignore
      return false
    }
    logger.error('Error tracking referral', error, params)
    throw error
  }
}

/**
 * Get referral stats for a user
 */
export async function getReferralStats(userWallet: string): Promise<{
  code: string | null
  tier: string
  totalReferrals: number
  totalEarningsUsdc: string
  referrals: Array<{
    refereeWallet: string
    referredAt: Date
    firstCallAt: Date | null
    totalSpentUsdc: string
    commissionPaidUsdc: string
  }>
}> {
  try {
    // Get referral code info
    const codeResult = await getPool().query(
      `SELECT code, tier, total_referrals, total_earnings_usdc
       FROM referral_codes
       WHERE user_wallet = $1`,
      [userWallet]
    )

    if (codeResult.rows.length === 0) {
      return {
        code: null,
        tier: 'bronze',
        totalReferrals: 0,
        totalEarningsUsdc: '0',
        referrals: []
      }
    }

    const { code, tier, total_referrals, total_earnings_usdc } = codeResult.rows[0]

    // Get referral details
    const referralsResult = await getPool().query(
      `SELECT referee_wallet, referred_at, first_call_at, total_spent_usdc, commission_paid_usdc
       FROM referrals
       WHERE referrer_wallet = $1
       ORDER BY referred_at DESC`,
      [userWallet]
    )

    return {
      code,
      tier,
      totalReferrals: total_referrals,
      totalEarningsUsdc: total_earnings_usdc,
      referrals: referralsResult.rows
    }
  } catch (error) {
    logger.error('Error getting referral stats', error, { userWallet })
    throw error
  }
}

/**
 * Get referral leaderboard (top referrers)
 */
export async function getReferralLeaderboard(params: {
  limit?: number
  period?: 'all' | 'month' | 'week'
}): Promise<Array<{
  userWallet: string
  code: string
  tier: string
  totalReferrals: number
  totalEarningsUsdc: string
  creatorName?: string
  creatorAvatar?: string
}>> {
  const { limit = 20, period = 'all' } = params

  try {
    let query = `
      SELECT
        rc.user_wallet,
        rc.code,
        rc.tier,
        rc.total_referrals,
        rc.total_earnings_usdc,
        c.display_name as creator_name,
        c.avatar_url as creator_avatar
      FROM referral_codes rc
      LEFT JOIN creators c ON rc.user_wallet = c.wallet
    `

    if (period === 'month') {
      query += ` WHERE rc.updated_at > NOW() - INTERVAL '30 days'`
    } else if (period === 'week') {
      query += ` WHERE rc.updated_at > NOW() - INTERVAL '7 days'`
    }

    query += `
      ORDER BY rc.total_earnings_usdc DESC, rc.total_referrals DESC
      LIMIT $1
    `

    const result = await getPool().query(query, [limit])

    return result.rows.map(row => ({
      userWallet: row.user_wallet,
      code: row.code,
      tier: row.tier,
      totalReferrals: row.total_referrals,
      totalEarningsUsdc: row.total_earnings_usdc,
      creatorName: row.creator_name,
      creatorAvatar: row.creator_avatar
    }))
  } catch (error) {
    logger.error('Error getting referral leaderboard', error, params)
    throw error
  }
}

/**
 * Calculate and record commission payout for a referral
 * Returns commission amount and whether payout is allowed
 */
export async function calculateReferralCommission(params: {
  refereeWallet: string
  runId: string
  amountUsdc: string
}): Promise<{
  shouldPay: boolean
  commissionUsdc: string
  referrerWallet: string | null
  tier: string | null
}> {
  const { refereeWallet, runId, amountUsdc } = params

  try {
    // Check if referee was referred
    const referralResult = await getPool().query(
      `SELECT r.referrer_wallet, r.referral_code, r.total_spent_usdc, r.commission_paid_usdc, r.first_call_at,
              rc.tier
       FROM referrals r
       JOIN referral_codes rc ON r.referral_code = rc.code
       WHERE r.referee_wallet = $1`,
      [refereeWallet]
    )

    if (referralResult.rows.length === 0) {
      return { shouldPay: false, commissionUsdc: '0', referrerWallet: null, tier: null }
    }

    const referral = referralResult.rows[0]

    // Update first_call_at if this is their first call
    if (!referral.first_call_at) {
      await getPool().query(
        `UPDATE referrals SET first_call_at = NOW() WHERE referee_wallet = $1`,
        [refereeWallet]
      )
    }

    // Calculate commission limits based on tier
    const tier = referral.tier
    let commissionRate = 0.05 // 5% for bronze
    let spendingCap = 10.00 // $10 cap for bronze

    if (tier === 'silver') {
      commissionRate = 0.10 // 10%
      spendingCap = 20.00 // $20 cap
    } else if (tier === 'gold') {
      commissionRate = 0.15 // 15% on first $50, then 2% lifetime
      spendingCap = 50.00 // $50 cap, then switch to lifetime
    }

    const totalSpent = parseFloat(referral.total_spent_usdc) + parseFloat(amountUsdc)
    const commissionPaid = parseFloat(referral.commission_paid_usdc)

    let commissionUsdc = parseFloat(amountUsdc) * commissionRate

    // For gold tier, apply 2% lifetime rate after $50 cap
    if (tier === 'gold' && totalSpent > spendingCap) {
      const amountInCap = Math.max(0, spendingCap - parseFloat(referral.total_spent_usdc))
      const amountOverCap = parseFloat(amountUsdc) - amountInCap
      commissionUsdc = (amountInCap * 0.15) + (amountOverCap * 0.02)
    }

    // For non-gold tiers, stop paying commission after cap
    if (tier !== 'gold' && totalSpent > spendingCap) {
      const amountInCap = Math.max(0, spendingCap - parseFloat(referral.total_spent_usdc))
      commissionUsdc = amountInCap * commissionRate
    }

    // If commission is negligible, don't pay
    if (commissionUsdc < 0.01) {
      return {
        shouldPay: false,
        commissionUsdc: '0',
        referrerWallet: referral.referrer_wallet,
        tier
      }
    }

    // Record commission payout
    await getPool().query(
      `INSERT INTO commission_payouts (referrer_wallet, referee_wallet, run_id, amount_usdc, commission_rate, tier)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [referral.referrer_wallet, refereeWallet, runId, commissionUsdc.toFixed(6), commissionRate, tier]
    )

    // Update referral totals
    await getPool().query(
      `UPDATE referrals
       SET total_spent_usdc = total_spent_usdc + $1,
           commission_paid_usdc = commission_paid_usdc + $2
       WHERE referee_wallet = $3`,
      [amountUsdc, commissionUsdc.toFixed(6), refereeWallet]
    )

    // Update referral code total earnings
    await getPool().query(
      `UPDATE referral_codes
       SET total_earnings_usdc = total_earnings_usdc + $1
       WHERE code = $2`,
      [commissionUsdc.toFixed(6), referral.referral_code]
    )

    logger.info('Commission calculated', {
      referrerWallet: referral.referrer_wallet,
      refereeWallet,
      commissionUsdc: commissionUsdc.toFixed(6),
      tier
    })

    return {
      shouldPay: true,
      commissionUsdc: commissionUsdc.toFixed(6),
      referrerWallet: referral.referrer_wallet,
      tier
    }
  } catch (error) {
    logger.error('Error calculating referral commission', error, params)
    throw error
  }
}

/**
 * Mark commission payout as completed with transaction signature
 */
export async function markCommissionPaid(params: {
  payoutId: string
  signature: string
}): Promise<void> {
  const { payoutId, signature } = params

  try {
    await getPool().query(
      `UPDATE commission_payouts
       SET status = 'completed', transaction_signature = $1
       WHERE id = $2`,
      [signature, payoutId]
    )

    logger.info('Commission payout marked as completed', { payoutId, signature })
  } catch (error) {
    logger.error('Error marking commission as paid', error, params)
    throw error
  }
}

/**
 * Get pending commission payouts (for batch processing)
 */
export async function getPendingCommissions(limit = 100): Promise<Array<{
  id: string
  referrerWallet: string
  amountUsdc: string
  tier: string
}>> {
  try {
    const result = await getPool().query(
      `SELECT id, referrer_wallet, amount_usdc, tier
       FROM commission_payouts
       WHERE status = 'pending'
       ORDER BY paid_at ASC
       LIMIT $1`,
      [limit]
    )

    return result.rows.map(row => ({
      id: row.id,
      referrerWallet: row.referrer_wallet,
      amountUsdc: row.amount_usdc,
      tier: row.tier
    }))
  } catch (error) {
    logger.error('Error getting pending commissions', error)
    throw error
  }
}
