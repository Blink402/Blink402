/**
 * @blink402/database - Database Module Index
 *
 * This module has been modularized for better maintainability.
 *
 * STRUCTURE:
 * - Modularized functions are re-exported from domain-specific modules
 * - Legacy functions (not yet modularized) are kept inline for backward compatibility
 *
 * MODULAR EXPORTS (from domain modules):
 * - Connection: getPool, testConnection, closePool, getPoolHealth, getPoolMetrics, isPostgresError
 * - Creators: getOrCreateCreator, getCreatorProfile, updateCreatorProfile, saveCreatorPayoutKey,
 *            getCreatorPayoutKey, hasCreatorPayoutKey, deleteCreatorPayoutKey, getBlinksByCreator
 * - Blinks: getAllBlinks, getBlinkBySlug, getBlinkById, createBlink, updateBlink, deleteBlink,
 *          updateBlinkHealth, updateBlinkBadges
 * - Runs: createRun, getRunByReference, getRunBySignature, updateRunPayment, updateRunPaymentAtomic,
 *        markRunExecuted, markRunFailed, cleanupExpiredRuns
 * - Dashboard: getDashboardData
 * - Rewards: createRewardClaim, getRewardClaimCount, hasUserClaimedReward, getRewardClaimsByBlink,
 *           getRewardClaimByReference
 * - Publishing: validateBlinkForPublishing, publishBlinkToCatalog, unpublishBlinkFromCatalog,
 *              getBlinkPublishingStatus
 * - Encryption: encrypt, decrypt, maskSensitive, isValidPrivateKeyFormat
 * - Lottery: All lottery functions (rounds, entries, winners, stats)
 *
 * LEGACY EXPORTS (inline implementations, to be modularized):
 * - Receipts: getReceiptByRunId
 * - Refunds: createRefund, markRefundIssued, markRefundFailed, getRefundByRunId
 * - Creator Debt: createCreatorDebt, getCreatorOutstandingDebt, getCreatorUnsettledDebts, settleCreatorDebt
 * - Platform Config: getPlatformConfig, setPlatformConfig
 * - Twitter Integration: getTwitterCredentialByCreatorId, getTwitterCredentialByWallet, upsertTwitterCredential,
 *                       updateTwitterLastUsed, disconnectTwitter, logTwitterActivity, getTwitterActivityByCreator
 * - Gallery: uploadGalleryImage, getGalleryImages, grantGalleryAccess, checkGalleryAccess, deleteGalleryImage
 * - Catalog: getPublicBlinks, getFeaturedBlinks, getTrendingBlinks, toggleBlinkPublic, reportBlink
 * - Referrals: getOrCreateReferralCode, trackReferral, getReferralStats, getReferralLeaderboard,
 *             calculateReferralCommission, markCommissionPaid, getPendingCommissions
 */

import { createLogger } from '@blink402/config'
import type { BlinkData } from '@blink402/types'

const logger = createLogger('@blink402/database')

// ========================================
// MODULAR EXPORTS
// ========================================

// Connection module
export {
  getPool,
  testConnection,
  closePool,
  getPoolHealth,
  getPoolMetrics,
  isPostgresError,
  type PostgresError
} from './modules/connection.js'

// Creators module
export {
  getOrCreateCreator,
  getCreatorProfile,
  updateCreatorProfile,
  saveCreatorPayoutKey,
  getCreatorPayoutKey,
  hasCreatorPayoutKey,
  deleteCreatorPayoutKey,
  getBlinksByCreator
} from './modules/creators.js'

// Blinks module
export {
  getAllBlinks,
  getBlinkBySlug,
  getBlinkById,
  createBlink,
  updateBlink,
  deleteBlink,
  updateBlinkHealth,
  updateBlinkBadges
} from './modules/blinks.js'

// Runs module
export {
  createRun,
  getRunByReference,
  getRunBySignature,
  updateRunPayment,
  updateRunPaymentAtomic,
  markRunExecuted,
  markRunFailed,
  cleanupExpiredRuns,
  type RunData
} from './modules/runs.js'

// Dashboard module
export {
  getDashboardData
} from './modules/dashboard.js'

// Rewards module
export {
  createRewardClaim,
  getRewardClaimCount,
  hasUserClaimedReward,
  getRewardClaimsByBlink,
  getRewardClaimByReference,
  type RewardClaimData
} from './modules/rewards.js'

// Publishing module
export {
  validateBlinkForPublishing,
  publishBlinkToCatalog,
  unpublishBlinkFromCatalog,
  getBlinkPublishingStatus,
  type PublishingValidationResult
} from './publishing.js'

// Encryption module
export {
  encrypt,
  decrypt,
  maskSensitive,
  isValidPrivateKeyFormat
} from './encryption.js'

// Lottery module
export {
  createLotteryRound,
  getActiveRound,
  getRoundById,
  getMaxRoundNumber,
  getRoundsEndingBefore,
  updateRoundStatus,
  updateRoundStats,
  createLotteryEntry,
  getRoundEntries,
  getUserEntriesInRound,
  getEntryByRunId,
  createWinner,
  getRoundWinners,
  getPendingPayouts,
  updatePayoutStatus,
  getLotteryStatsByBlink,
  getLotteryHistory
} from './lottery.js'

// ========================================
// LEGACY INLINE IMPLEMENTATIONS
// TODO: Modularize these functions into domain modules
// ========================================

import { getPool, isPostgresError } from './modules/connection.js'

// ========== RECEIPTS OPERATIONS ==========

// Get receipt by run ID
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

// ========== REFUNDS OPERATIONS ==========

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

  logger.info('Refund marked as issued', {
    refundId,
    signature,
  })

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

  logger.error('Refund marked as failed', {
    refundId,
    error,
  })

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

  logger.info('Creator debt settled', {
    debtId,
    notes,
  })

  return result.rows[0]
}

/**
 * Get platform config value by key
 */
export async function getPlatformConfig(key: string): Promise<string | null> {
  const result = await getPool().query(
    `SELECT value FROM platform_config WHERE key = $1`,
    [key]
  )

  if (result.rows.length === 0) return null
  return result.rows[0].value
}

/**
 * Set platform config value
 */
export async function setPlatformConfig(params: {
  key: string
  value: string
  description?: string
}): Promise<void> {
  const { key, value, description } = params

  await getPool().query(
    `INSERT INTO platform_config (key, value, description, updated_at)
     VALUES ($1, $2, $3, NOW())
     ON CONFLICT (key) DO UPDATE SET value = $2, description = $3, updated_at = NOW()`,
    [key, value, description || null]
  )

  logger.info('Platform config updated', { key })
}

// ========== TWITTER CREDENTIALS OPERATIONS ==========

export interface TwitterCredential {
  id: string
  creator_id: string
  twitter_user_id: string
  twitter_username: string
  access_token: string
  refresh_token: string
  token_expires_at: Date
  connected_at: Date
  last_used_at: Date | null
  is_active: boolean
}

export interface TwitterActivity {
  id: string
  credential_id: string
  run_id: string
  action_type: string
  tweet_id: string | null
  tweet_text: string | null
  status: string
  error_message: string | null
  created_at: Date
}

// Get Twitter credentials for a creator
export async function getTwitterCredentialByCreatorId(creatorId: string): Promise<TwitterCredential | null> {
  const result = await getPool().query(
    `SELECT id, creator_id, twitter_user_id, twitter_username,
            access_token, refresh_token, token_expires_at,
            connected_at, last_used_at, is_active
     FROM twitter_credentials
     WHERE creator_id = $1 AND is_active = true`,
    [creatorId]
  )

  if (result.rows.length === 0) return null
  return result.rows[0]
}

// Get Twitter credentials by wallet address
export async function getTwitterCredentialByWallet(wallet: string): Promise<TwitterCredential | null> {
  const result = await getPool().query(
    `SELECT tc.id, tc.creator_id, tc.twitter_user_id, tc.twitter_username,
            tc.access_token, tc.refresh_token, tc.token_expires_at,
            tc.connected_at, tc.last_used_at, tc.is_active
     FROM twitter_credentials tc
     JOIN creators c ON tc.creator_id = c.id
     WHERE c.wallet = $1 AND tc.is_active = true`,
    [wallet]
  )

  if (result.rows.length === 0) return null
  return result.rows[0]
}

// Save or update Twitter credentials
export async function upsertTwitterCredential(data: {
  creatorId: string
  twitterUserId: string
  twitterUsername: string
  accessToken: string
  refreshToken: string
  expiresAt: Date
}): Promise<TwitterCredential> {
  const result = await getPool().query(
    `INSERT INTO twitter_credentials
      (creator_id, twitter_user_id, twitter_username, access_token, refresh_token, token_expires_at)
     VALUES ($1, $2, $3, $4, $5, $6)
     ON CONFLICT (creator_id)
     DO UPDATE SET
       twitter_user_id = EXCLUDED.twitter_user_id,
       twitter_username = EXCLUDED.twitter_username,
       access_token = EXCLUDED.access_token,
       refresh_token = EXCLUDED.refresh_token,
       token_expires_at = EXCLUDED.token_expires_at,
       connected_at = NOW(),
       is_active = true
     RETURNING id, creator_id, twitter_user_id, twitter_username,
               access_token, refresh_token, token_expires_at,
               connected_at, last_used_at, is_active`,
    [data.creatorId, data.twitterUserId, data.twitterUsername, data.accessToken, data.refreshToken, data.expiresAt]
  )

  return result.rows[0]
}

// Update last used timestamp
export async function updateTwitterLastUsed(credentialId: string): Promise<void> {
  await getPool().query(
    `UPDATE twitter_credentials SET last_used_at = NOW() WHERE id = $1`,
    [credentialId]
  )
}

// Disconnect Twitter account
export async function disconnectTwitter(creatorId: string): Promise<void> {
  await getPool().query(
    `UPDATE twitter_credentials SET is_active = false WHERE creator_id = $1`,
    [creatorId]
  )
}

// Log Twitter activity
export async function logTwitterActivity(data: {
  credentialId: string
  runId: string
  actionType: string
  tweetId?: string
  tweetText?: string
  status: 'pending' | 'success' | 'failed'
  errorMessage?: string
}): Promise<TwitterActivity> {
  const result = await getPool().query(
    `INSERT INTO twitter_activity
      (credential_id, run_id, action_type, tweet_id, tweet_text, status, error_message)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING id, credential_id, run_id, action_type, tweet_id, tweet_text, status, error_message, created_at`,
    [
      data.credentialId,
      data.runId,
      data.actionType,
      data.tweetId || null,
      data.tweetText || null,
      data.status,
      data.errorMessage || null,
    ]
  )

  return result.rows[0]
}

// Get Twitter activity for a creator
export async function getTwitterActivityByCreator(creatorId: string, limit: number = 50): Promise<TwitterActivity[]> {
  const result = await getPool().query(
    `SELECT ta.id, ta.credential_id, ta.run_id, ta.action_type, ta.tweet_id,
            ta.tweet_text, ta.status, ta.error_message, ta.created_at
     FROM twitter_activity ta
     JOIN twitter_credentials tc ON ta.credential_id = tc.id
     WHERE tc.creator_id = $1
     ORDER BY ta.created_at DESC
     LIMIT $2`,
    [creatorId, limit]
  )

  return result.rows
}

// ========== GALLERY OPERATIONS ==========

export interface GalleryImage {
  id: string
  creator_wallet: string
  file_path: string
  thumbnail_path: string | null
  caption: string | null
  uploaded_at: Date
}

export interface GalleryAccess {
  id: string
  viewer_wallet: string
  creator_wallet: string
  blink_slug: string
  paid_at: Date
  expires_at: Date
  reference: string
}

// Upload a new image to creator's gallery
export async function uploadGalleryImage(params: {
  creatorWallet: string
  filePath: string
  thumbnailPath?: string
  caption?: string
}): Promise<GalleryImage> {
  const { creatorWallet, filePath, thumbnailPath, caption } = params

  const result = await getPool().query(
    `INSERT INTO gallery_images (id, creator_wallet, file_path, thumbnail_path, caption)
    VALUES (gen_random_uuid(), $1, $2, $3, $4)
    RETURNING id, creator_wallet, file_path, thumbnail_path, caption, uploaded_at`,
    [creatorWallet, filePath, thumbnailPath || null, caption || null]
  )

  return result.rows[0]
}

// Get all images for a creator's gallery
export async function getGalleryImages(creatorWallet: string): Promise<GalleryImage[]> {
  const result = await getPool().query(
    `SELECT id, creator_wallet, file_path, thumbnail_path, caption, uploaded_at
    FROM gallery_images
    WHERE creator_wallet = $1
    ORDER BY uploaded_at DESC`,
    [creatorWallet]
  )

  return result.rows
}

// Grant gallery access to a viewer (after payment)
export async function grantGalleryAccess(params: {
  viewerWallet: string
  creatorWallet: string
  blinkSlug: string
  durationDays: number
  reference: string
}): Promise<GalleryAccess> {
  const { viewerWallet, creatorWallet, blinkSlug, durationDays, reference } = params

  const result = await getPool().query(
    `INSERT INTO gallery_access (id, viewer_wallet, creator_wallet, blink_slug, expires_at, reference)
    VALUES (gen_random_uuid(), $1, $2, $3, NOW() + ($4 || ' days')::INTERVAL, $5)
    RETURNING id, viewer_wallet, creator_wallet, blink_slug, paid_at, expires_at, reference`,
    [viewerWallet, creatorWallet, blinkSlug, durationDays.toString(), reference]
  )

  return result.rows[0]
}

// Check if a viewer has active access to a creator's gallery
export async function checkGalleryAccess(params: {
  viewerWallet: string
  creatorWallet: string
}): Promise<GalleryAccess | null> {
  const { viewerWallet, creatorWallet } = params

  const result = await getPool().query(
    `SELECT id, viewer_wallet, creator_wallet, blink_slug, paid_at, expires_at, reference
    FROM gallery_access
    WHERE viewer_wallet = $1
      AND creator_wallet = $2
      AND expires_at > NOW()
    ORDER BY expires_at DESC
    LIMIT 1`,
    [viewerWallet, creatorWallet]
  )

  if (result.rows.length === 0) return null
  return result.rows[0]
}

// Delete a gallery image (creator only)
export async function deleteGalleryImage(params: {
  id: string
  creatorWallet: string
}): Promise<boolean> {
  const { id, creatorWallet } = params

  const result = await getPool().query(
    `DELETE FROM gallery_images
    WHERE id = $1 AND creator_wallet = $2`,
    [id, creatorWallet]
  )

  return result.rowCount !== null && result.rowCount > 0
}

// ========== CATALOG-SPECIFIC OPERATIONS ==========

/**
 * Get public blinks for catalog display
 * Filters by is_public=true and status='active'
 * Excludes unhealthy blinks
 */
export async function getPublicBlinks(
  filters?: {
    category?: string
    price_min?: number
    price_max?: number
    badges?: string[]
    media_type?: string
    search?: string
  },
  limit: number = 20,
  offset: number = 0
): Promise<BlinkData[]> {
  let query = `
    SELECT
      b.id, b.slug, b.title, b.description, b.price_usdc::text,
      b.icon_url, b.endpoint_url, b.method, b.category,
      b.runs, b.status, b.payment_token, b.payout_wallet, b.access_duration_days,
      b.payment_mode, b.reward_amount::text, b.funded_wallet, b.max_claims_per_user,
      b.is_public, b.is_featured, b.publish_to_catalog, b.media_type,
      b.avg_latency_ms, b.success_rate_percent, b.badges, b.catalog_published_at,
      b.reported_count, b.is_forkable, b.health_status,
      b.lottery_enabled, b.lottery_round_duration_minutes,
      b.creator_id, c.wallet as creator_wallet, c.is_verified as creator_is_verified
    FROM blinks b
    JOIN creators c ON b.creator_id = c.id
    WHERE b.is_public = true
      AND b.publish_to_catalog = true
      AND b.status = 'active'
      AND b.health_status != 'unhealthy'
      AND b.title IS NOT NULL AND b.title != ''
      AND b.description IS NOT NULL AND LENGTH(b.description) >= 20
      AND (b.success_rate_percent IS NULL OR b.success_rate_percent >= 70)
      AND b.reported_count <= 5`

  const params: any[] = []
  let paramCount = 1

  if (filters) {
    if (filters.category) {
      query += ` AND b.category = $${paramCount++}`
      params.push(filters.category)
    }

    if (filters.price_min !== undefined) {
      query += ` AND b.price_usdc >= $${paramCount++}`
      params.push(filters.price_min)
    }

    if (filters.price_max !== undefined) {
      query += ` AND b.price_usdc <= $${paramCount++}`
      params.push(filters.price_max)
    }

    if (filters.media_type) {
      query += ` AND b.media_type = $${paramCount++}`
      params.push(filters.media_type)
    }

    if (filters.badges && filters.badges.length > 0) {
      query += ` AND b.badges @> $${paramCount++}::jsonb`
      params.push(JSON.stringify(filters.badges))
    }

    if (filters.search) {
      query += ` AND (
        LOWER(b.title) LIKE LOWER($${paramCount}) OR
        LOWER(b.description) LIKE LOWER($${paramCount})
      )`
      params.push(`%${filters.search}%`)
      paramCount++
    }
  }

  query += ` ORDER BY b.catalog_published_at DESC NULLS LAST, b.created_at DESC`
  query += ` LIMIT $${paramCount++} OFFSET $${paramCount++}`
  params.push(limit, offset)

  const result = await getPool().query(query, params)

  return result.rows.map(row => ({
    id: row.id,
    slug: row.slug,
    title: row.title,
    description: row.description,
    price_usdc: row.price_usdc,
    icon_url: row.icon_url,
    endpoint_url: row.endpoint_url,
    method: row.method,
    category: row.category,
    runs: row.runs,
    status: row.status,
    payment_token: row.payment_token || 'SOL',
    payout_wallet: row.payout_wallet,
    payment_mode: row.payment_mode || 'charge',
    reward_amount: row.reward_amount,
    funded_wallet: row.funded_wallet,
    max_claims_per_user: row.max_claims_per_user,
    access_duration_days: row.access_duration_days,
    is_public: row.is_public || false,
    is_featured: row.is_featured || false,
    publish_to_catalog: row.publish_to_catalog || false,
    media_type: row.media_type,
    avg_latency_ms: row.avg_latency_ms,
    success_rate_percent: row.success_rate_percent ? parseFloat(row.success_rate_percent) : undefined,
    badges: row.badges || [],
    catalog_published_at: row.catalog_published_at,
    reported_count: row.reported_count || 0,
    is_forkable: row.is_forkable || false,
    health_status: row.health_status || 'healthy',
    lottery_enabled: row.lottery_enabled || false,
    lottery_round_duration_minutes: row.lottery_round_duration_minutes,
    creator_id: row.creator_id,
    creator: {
      wallet: row.creator_wallet,
      is_verified: row.creator_is_verified || false
    }
  }))
}

/**
 * Get featured blinks for homepage
 * Only shows quality blinks that meet publishing standards
 */
export async function getFeaturedBlinks(limit: number = 5): Promise<BlinkData[]> {
  const result = await getPool().query(
    `SELECT
      b.id, b.slug, b.title, b.description, b.price_usdc::text,
      b.icon_url, b.endpoint_url, b.method, b.category,
      b.runs, b.status, b.payment_token, b.payout_wallet, b.access_duration_days,
      b.payment_mode, b.reward_amount::text, b.funded_wallet, b.max_claims_per_user,
      b.is_public, b.is_featured, b.publish_to_catalog, b.media_type,
      b.avg_latency_ms, b.success_rate_percent, b.badges, b.catalog_published_at,
      b.reported_count, b.is_forkable, b.health_status,
      b.lottery_enabled, b.lottery_round_duration_minutes,
      b.creator_id, c.wallet as creator_wallet, c.is_verified as creator_is_verified,
      fb.display_order, fb.title_override, fb.description_override
    FROM featured_blinks fb
    JOIN blinks b ON fb.blink_id = b.id
    JOIN creators c ON b.creator_id = c.id
    WHERE b.status = 'active'
      AND (fb.featured_until IS NULL OR fb.featured_until > NOW())
    ORDER BY fb.display_order
    LIMIT $1`,
    [limit]
  )

  return result.rows.map(row => ({
    id: row.id,
    slug: row.slug,
    title: row.title_override || row.title,
    description: row.description_override || row.description,
    price_usdc: row.price_usdc,
    icon_url: row.icon_url,
    endpoint_url: row.endpoint_url,
    method: row.method,
    category: row.category,
    runs: row.runs,
    status: row.status,
    payment_token: row.payment_token || 'SOL',
    payout_wallet: row.payout_wallet,
    payment_mode: row.payment_mode || 'charge',
    reward_amount: row.reward_amount,
    funded_wallet: row.funded_wallet,
    max_claims_per_user: row.max_claims_per_user,
    access_duration_days: row.access_duration_days,
    is_public: row.is_public || false,
    is_featured: true,
    publish_to_catalog: row.publish_to_catalog || false,
    media_type: row.media_type,
    avg_latency_ms: row.avg_latency_ms,
    success_rate_percent: row.success_rate_percent ? parseFloat(row.success_rate_percent) : undefined,
    badges: row.badges || [],
    catalog_published_at: row.catalog_published_at,
    reported_count: row.reported_count || 0,
    is_forkable: row.is_forkable || false,
    health_status: row.health_status || 'healthy',
    lottery_enabled: row.lottery_enabled || false,
    lottery_round_duration_minutes: row.lottery_round_duration_minutes,
    creator_id: row.creator_id,
    creator: {
      wallet: row.creator_wallet,
      is_verified: row.creator_is_verified || false
    }
  }))
}

/**
 * Get trending blinks based on recent activity
 * Only shows quality blinks that meet publishing standards
 */
export async function getTrendingBlinks(limit: number = 10, days: number = 1): Promise<BlinkData[]> {
  const result = await getPool().query(
    `SELECT
      b.id, b.slug, b.title, b.description, b.price_usdc::text,
      b.icon_url, b.endpoint_url, b.method, b.category,
      b.runs, b.status, b.payment_token, b.payout_wallet, b.access_duration_days,
      b.payment_mode, b.reward_amount::text, b.funded_wallet, b.max_claims_per_user,
      b.is_public, b.is_featured, b.publish_to_catalog, b.media_type,
      b.avg_latency_ms, b.success_rate_percent, b.badges, b.catalog_published_at,
      b.reported_count, b.is_forkable, b.health_status,
      b.lottery_enabled, b.lottery_round_duration_minutes,
      b.creator_id, c.wallet as creator_wallet, c.is_verified as creator_is_verified,
      COALESCE(tm.runs_count, 0) as recent_runs
    FROM blinks b
    JOIN creators c ON b.creator_id = c.id
    LEFT JOIN (
      SELECT
        blink_id,
        SUM(runs_count) as runs_count
      FROM blink_trending_metrics
      WHERE metric_date >= CURRENT_DATE - make_interval(days => $2::int)
      GROUP BY blink_id
    ) tm ON b.id = tm.blink_id
    WHERE b.is_public = true
      AND b.publish_to_catalog = true
      AND b.status = 'active'
      AND (b.health_status != 'unhealthy' OR b.health_status IS NULL)
      AND b.title IS NOT NULL AND b.title != ''
      AND b.description IS NOT NULL AND LENGTH(b.description) >= 20
      AND (b.success_rate_percent IS NULL OR b.success_rate_percent >= 75)
      AND b.reported_count <= 5
    ORDER BY recent_runs DESC, b.runs DESC
    LIMIT $1`,
    [limit, days]
  )

  return result.rows.map(row => ({
    id: row.id,
    slug: row.slug,
    title: row.title,
    description: row.description,
    price_usdc: row.price_usdc,
    icon_url: row.icon_url,
    endpoint_url: row.endpoint_url,
    method: row.method,
    category: row.category,
    runs: row.runs,
    status: row.status,
    payment_token: row.payment_token || 'SOL',
    payout_wallet: row.payout_wallet,
    payment_mode: row.payment_mode || 'charge',
    reward_amount: row.reward_amount,
    funded_wallet: row.funded_wallet,
    max_claims_per_user: row.max_claims_per_user,
    access_duration_days: row.access_duration_days,
    is_public: row.is_public || false,
    is_featured: row.is_featured || false,
    publish_to_catalog: row.publish_to_catalog || false,
    media_type: row.media_type,
    avg_latency_ms: row.avg_latency_ms,
    success_rate_percent: row.success_rate_percent ? parseFloat(row.success_rate_percent) : undefined,
    badges: row.badges || [],
    catalog_published_at: row.catalog_published_at,
    reported_count: row.reported_count || 0,
    is_forkable: row.is_forkable || false,
    health_status: row.health_status || 'healthy',
    lottery_enabled: row.lottery_enabled || false,
    lottery_round_duration_minutes: row.lottery_round_duration_minutes,
    creator_id: row.creator_id,
    creator: {
      wallet: row.creator_wallet,
      is_verified: row.creator_is_verified || false
    }
  }))
}

/**
 * Toggle public/catalog visibility for a blink
 */
export async function toggleBlinkPublic(
  slug: string,
  isPublic: boolean,
  publishToCatalog: boolean = false
): Promise<boolean> {
  try {
    const result = await getPool().query(
      `UPDATE blinks
      SET
        is_public = $2,
        publish_to_catalog = $3,
        catalog_published_at = CASE
          WHEN $2 = true AND catalog_published_at IS NULL THEN NOW()
          ELSE catalog_published_at
        END
      WHERE slug = $1`,
      [slug, isPublic, publishToCatalog]
    )

    return (result.rowCount ?? 0) > 0
  } catch (error) {
    logger.error('Error toggling blink public status', error, { slug, isPublic })
    return false
  }
}

/**
 * Report a blink
 */
export async function reportBlink(
  blinkId: string,
  reporterWallet: string | null,
  reason: string,
  details: string | null = null
): Promise<boolean> {
  const client = await getPool().connect()

  try {
    await client.query('BEGIN')

    // Insert report
    await client.query(
      `INSERT INTO blink_reports (blink_id, reporter_wallet, reason, details)
      VALUES ($1, $2, $3, $4)`,
      [blinkId, reporterWallet, reason, details]
    )

    // Update reported count
    await client.query(
      `UPDATE blinks
      SET reported_count = reported_count + 1
      WHERE id = $1`,
      [blinkId]
    )

    await client.query('COMMIT')
    return true
  } catch (error) {
    await client.query('ROLLBACK')
    logger.error('Error reporting blink', error, { blinkId, reason })
    return false
  } finally {
    client.release()
  }
}

// ====================
// REFERRAL SYSTEM FUNCTIONS
// ====================

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
