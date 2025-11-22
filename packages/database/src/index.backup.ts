// Database module for PostgreSQL operations
// Replaces in-memory storage with persistent database

import { Pool, QueryResult } from 'pg'
import type { BlinkData, DashboardData, DashboardBlink, Activity } from '@blink402/types'
import { createLogger } from '@blink402/config'

const logger = createLogger('@blink402/database')

// Re-export publishing functions
export {
  validateBlinkForPublishing,
  publishBlinkToCatalog,
  unpublishBlinkFromCatalog,
  getBlinkPublishingStatus,
  type PublishingValidationResult
} from './publishing.js'

// Re-export encryption utilities
export {
  encrypt,
  decrypt,
  maskSensitive,
  isValidPrivateKeyFormat
} from './encryption.js'

// Re-export lottery functions
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

/**
 * PostgreSQL error interface
 * Extends the standard Error with PostgreSQL-specific properties
 */
interface PostgresError extends Error {
  code?: string // PostgreSQL error code (e.g., '23505' for unique violation)
  detail?: string
  table?: string
  constraint?: string
}

/**
 * Type guard to check if an error is a PostgreSQL error
 */
function isPostgresError(error: unknown): error is PostgresError {
  return error instanceof Error && 'code' in error
}

// Lazy connection pool - only created when first query is run
// This prevents database connection attempts during Next.js build time
let pool: Pool | null = null

export function getPool(): Pool {
  // Skip pool creation entirely if no DATABASE_URL (happens during build)
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL not configured - cannot connect to database')
  }

  if (!pool) {
    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      max: 40, // CRITICAL FIX: Increased from 20 for production load
      min: 5,  // CRITICAL FIX: Maintain minimum idle connections
      idleTimeoutMillis: 60000,         // Keep idle connections longer (60s vs 30s)
      connectionTimeoutMillis: 10000,   // CRITICAL FIX: 10s timeout for queued clients (was 5s)
      query_timeout: 30000,             // CRITICAL FIX: 30s max query time
      statement_timeout: 30000,         // CRITICAL FIX: Server-side statement timeout
      allowExitOnIdle: false,           // Prevent process exit on idle
    })

    // Handle unexpected errors on idle clients (prevents unhandled rejections)
    pool.on('error', (err, client) => {
      logger.error('Unexpected error on idle database client', err, {
        code: isPostgresError(err) ? err.code : undefined,
        detail: isPostgresError(err) ? err.detail : undefined,
        poolMetrics: {
          total: pool!.totalCount,
          idle: pool!.idleCount,
          waiting: pool!.waitingCount,
        }
      })
      // Don't exit process - let connection pool handle recovery
      // Pool will remove bad clients and create new ones as needed
    })

    // CRITICAL FIX: Monitor pool health every 5 seconds
    setInterval(() => {
      const metrics = {
        totalCount: pool!.totalCount,
        idleCount: pool!.idleCount,
        waitingCount: pool!.waitingCount,
        lastMetricsUpdate: Date.now()
      }

      // Alert if pool is saturated (>15 waiting clients)
      if (pool!.waitingCount > 15) {
        logger.error('Database pool saturated!', undefined, {
          total: pool!.totalCount,
          idle: pool!.idleCount,
          waiting: pool!.waitingCount,
          severity: 'CRITICAL'
        })
      } else if (pool!.waitingCount > 5) {
        logger.warn('Database pool under pressure', {
          total: pool!.totalCount,
          idle: pool!.idleCount,
          waiting: pool!.waitingCount,
          severity: 'WARNING'
        })
      }

      // Log metrics at debug level for monitoring
      logger.debug('Database pool metrics', metrics)
    }, 5000)

    // Log when pool is created
    logger.info('Database connection pool created', {
      max: 40,
      min: 5,
      idleTimeout: 60000,
      connectionTimeout: 10000,
      queryTimeout: 30000,
    })
  }
  return pool
}

// Helper function to get or create a creator
export async function getOrCreateCreator(wallet: string): Promise<string> {
  const result = await getPool().query(
    'INSERT INTO creators (wallet) VALUES ($1) ON CONFLICT (wallet) DO UPDATE SET wallet = $1 RETURNING id',
    [wallet]
  )
  return result.rows[0].id
}

// ========== CREATOR PROFILE OPERATIONS ==========

import type { CreatorProfile, SocialLinks, UpdateCreatorProfilePayload } from '@blink402/types'

/**
 * Get creator profile by wallet address or custom slug
 * Returns null if creator doesn't exist
 */
export async function getCreatorProfile(walletOrSlug: string): Promise<CreatorProfile | null> {
  // Check if it's a wallet address (44 chars) or custom slug
  const isWallet = walletOrSlug.length === 44

  const query = isWallet
    ? `SELECT
        c.id, c.wallet, c.display_name, c.bio, c.avatar_url, c.banner_url,
        c.profile_slug, c.social_links, c.created_at, c.updated_at,
        COUNT(DISTINCT b.id) as total_blinks,
        COALESCE(SUM(CASE WHEN r.status = 'executed' THEN b.price_usdc ELSE 0 END), 0)::text as total_earnings,
        COUNT(DISTINCT r.id) FILTER (WHERE r.status = 'executed') as total_runs
      FROM creators c
      LEFT JOIN blinks b ON c.id = b.creator_id
      LEFT JOIN runs r ON b.id = r.blink_id
      WHERE c.wallet = $1
      GROUP BY c.id`
    : `SELECT
        c.id, c.wallet, c.display_name, c.bio, c.avatar_url, c.banner_url,
        c.profile_slug, c.social_links, c.created_at, c.updated_at,
        COUNT(DISTINCT b.id) as total_blinks,
        COALESCE(SUM(CASE WHEN r.status = 'executed' THEN b.price_usdc ELSE 0 END), 0)::text as total_earnings,
        COUNT(DISTINCT r.id) FILTER (WHERE r.status = 'executed') as total_runs
      FROM creators c
      LEFT JOIN blinks b ON c.id = b.creator_id
      LEFT JOIN runs r ON b.id = r.blink_id
      WHERE c.profile_slug = $1
      GROUP BY c.id`

  const result = await getPool().query(query, [walletOrSlug])

  if (result.rows.length === 0) return null

  const row = result.rows[0]
  return {
    id: row.id,
    wallet: row.wallet,
    display_name: row.display_name,
    bio: row.bio,
    avatar_url: row.avatar_url,
    banner_url: row.banner_url,
    profile_slug: row.profile_slug,
    social_links: row.social_links,
    created_at: row.created_at,
    updated_at: row.updated_at,
    total_blinks: parseInt(row.total_blinks, 10),
    total_earnings: row.total_earnings,
    total_runs: parseInt(row.total_runs, 10)
  }
}

/**
 * Update creator profile information
 * Only updates fields that are provided
 */
export async function updateCreatorProfile(
  wallet: string,
  updates: UpdateCreatorProfilePayload
): Promise<CreatorProfile | null> {
  // Build dynamic UPDATE query based on provided fields
  const fields: string[] = []
  const values: any[] = []
  let paramCount = 1

  if (updates.display_name !== undefined) {
    fields.push(`display_name = $${paramCount++}`)
    values.push(updates.display_name)
  }
  if (updates.bio !== undefined) {
    fields.push(`bio = $${paramCount++}`)
    values.push(updates.bio)
  }
  if (updates.avatar_url !== undefined) {
    fields.push(`avatar_url = $${paramCount++}`)
    values.push(updates.avatar_url)
  }
  if (updates.banner_url !== undefined) {
    fields.push(`banner_url = $${paramCount++}`)
    values.push(updates.banner_url)
  }
  if (updates.profile_slug !== undefined) {
    fields.push(`profile_slug = $${paramCount++}`)
    values.push(updates.profile_slug)
  }
  if (updates.social_links !== undefined) {
    fields.push(`social_links = $${paramCount++}`)
    values.push(JSON.stringify(updates.social_links))
  }

  // Always update updated_at timestamp
  fields.push(`updated_at = NOW()`)

  if (fields.length === 1) {
    // Only updated_at, no actual changes
    return getCreatorProfile(wallet)
  }

  values.push(wallet) // Add wallet for WHERE clause

  try {
    await getPool().query(
      `UPDATE creators
       SET ${fields.join(', ')}
       WHERE wallet = $${paramCount}`,
      values
    )

    return getCreatorProfile(wallet)
  } catch (error) {
    if (isPostgresError(error) && error.code === '23505') {
      // Unique constraint violation (profile_slug already taken)
      throw new Error('Profile slug is already taken')
    }
    throw error
  }
}

/**
 * Save encrypted payout private key for a creator
 * @param wallet - Creator wallet address
 * @param encryptedKey - AES-256-GCM encrypted private key (base64)
 */
export async function saveCreatorPayoutKey(wallet: string, encryptedKey: string): Promise<void> {
  const creatorId = await getOrCreateCreator(wallet)

  await getPool().query(
    `UPDATE creators
     SET encrypted_payout_key = $1, updated_at = NOW()
     WHERE id = $2`,
    [encryptedKey, creatorId]
  )

  logger.info('Saved encrypted payout key for creator', { wallet, creatorId })
}

/**
 * Get encrypted payout private key for a creator
 * @param wallet - Creator wallet address
 * @returns Encrypted private key or null if not set
 */
export async function getCreatorPayoutKey(wallet: string): Promise<string | null> {
  const result = await getPool().query<{ encrypted_payout_key: string | null }>(
    `SELECT encrypted_payout_key
     FROM creators
     WHERE wallet = $1`,
    [wallet]
  )

  return result.rows[0]?.encrypted_payout_key || null
}

/**
 * Check if creator has a payout key configured
 * @param wallet - Creator wallet address
 * @returns True if payout key is set
 */
export async function hasCreatorPayoutKey(wallet: string): Promise<boolean> {
  const key = await getCreatorPayoutKey(wallet)
  return key !== null
}

/**
 * Remove payout key for a creator
 * @param wallet - Creator wallet address
 */
export async function deleteCreatorPayoutKey(wallet: string): Promise<void> {
  await getPool().query(
    `UPDATE creators
     SET encrypted_payout_key = NULL, updated_at = NOW()
     WHERE wallet = $1`,
    [wallet]
  )

  logger.info('Deleted payout key for creator', { wallet })
}

/**
 * Get all blinks created by a specific creator
 * Supports pagination
 */
export async function getBlinksByCreator(
  wallet: string,
  limit: number = 20,
  offset: number = 0
): Promise<BlinkData[]> {
  const result = await getPool().query(
    `SELECT
      b.id, b.slug, b.title, b.description, b.price_usdc::text,
      b.icon_url, b.endpoint_url, b.method, b.category,
      b.runs, b.status, b.payment_token, b.payout_wallet, b.access_duration_days,
      b.payment_mode, b.reward_amount::text, b.funded_wallet, b.max_claims_per_user,
      b.creator_id, c.wallet as creator_wallet, c.display_name as creator_display_name,
      c.avatar_url as creator_avatar_url, c.profile_slug as creator_profile_slug
    FROM blinks b
    JOIN creators c ON b.creator_id = c.id
    WHERE c.wallet = $1
    ORDER BY b.created_at DESC
    LIMIT $2 OFFSET $3`,
    [wallet, limit, offset]
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
    creator_id: row.creator_id,
    creator: {
      wallet: row.creator_wallet,
      display_name: row.creator_display_name,
      avatar_url: row.creator_avatar_url,
      profile_slug: row.creator_profile_slug
    }
  }))
}

// ========== BLINKS CRUD OPERATIONS ==========

export async function getAllBlinks(): Promise<BlinkData[]> {
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
      b.creator_id, c.wallet as creator_wallet, c.is_verified as creator_is_verified
    FROM blinks b
    JOIN creators c ON b.creator_id = c.id
    ORDER BY b.created_at DESC`
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

export async function getBlinkBySlug(slug: string): Promise<BlinkData | null> {
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
      b.parameters,
      b.creator_id, c.wallet as creator_wallet, c.is_verified as creator_is_verified
    FROM blinks b
    JOIN creators c ON b.creator_id = c.id
    WHERE b.slug = $1`,
    [slug]
  )

  if (result.rows.length === 0) return null

  const row = result.rows[0]
  return {
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
    parameters: row.parameters || undefined,
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
  }
}

export async function getBlinkById(id: string): Promise<BlinkData | null> {
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
      b.creator_id, c.wallet as creator_wallet, c.is_verified as creator_is_verified
    FROM blinks b
    JOIN creators c ON b.creator_id = c.id
    WHERE b.id = $1`,
    [id]
  )

  if (result.rows.length === 0) {
    return null
  }

  const row = result.rows[0]
  return {
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
  }
}

export async function createBlink(data: Omit<BlinkData, 'id' | 'runs' | 'creator_id'>): Promise<BlinkData> {
  // Use transaction to ensure atomicity between creator creation and blink creation
  const client = await getPool().connect()

  try {
    await client.query('BEGIN')

    // Get or create creator within transaction
    const creatorResult = await client.query(
      'INSERT INTO creators (wallet) VALUES ($1) ON CONFLICT (wallet) DO UPDATE SET wallet = $1 RETURNING id',
      [data.creator.wallet]
    )
    const creatorId = creatorResult.rows[0].id

    // Create blink within same transaction
    const result = await client.query(
      `INSERT INTO blinks
        (slug, title, description, endpoint_url, method, price_usdc, payout_wallet, icon_url, category, status, creator_id, payment_token, payment_mode, reward_amount, funded_wallet, max_claims_per_user, parameters)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
      RETURNING id, slug, title, description, price_usdc::text, payout_wallet, icon_url, endpoint_url, method, category, runs, status, payment_token, payment_mode, reward_amount::text, funded_wallet, max_claims_per_user, parameters`,
      [
        data.slug,
        data.title,
        data.description,
        data.endpoint_url,
        data.method,
        data.price_usdc,
        data.payout_wallet, // Use provided payout_wallet instead of creator.wallet
        data.icon_url,
        data.category,
        data.status,
        creatorId,
        data.payment_token || 'SOL', // Default to SOL, not USDC
        data.payment_mode || 'charge', // Default to charge mode
        data.reward_amount || null,
        data.funded_wallet || null,
        data.max_claims_per_user || 1,
        data.parameters ? JSON.stringify(data.parameters) : null
      ]
    )

    await client.query('COMMIT')

    const row = result.rows[0]
    return {
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
      parameters: row.parameters || undefined,
      creator_id: creatorId,
      creator: data.creator
    }
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  } finally {
    client.release()
  }
}

export async function updateBlink(slug: string, updates: Partial<BlinkData>): Promise<BlinkData | null> {
  // Whitelist of allowed fields for security
  const ALLOWED_UPDATE_FIELDS = [
    'title',
    'description',
    'price_usdc',
    'status',
    'endpoint_url',
    'method',
    'category',
    'icon_url',
  ] as const

  // Validate that no disallowed fields are being updated
  const updateKeys = Object.keys(updates)
  const disallowedFields = updateKeys.filter(key => !ALLOWED_UPDATE_FIELDS.includes(key as any))
  if (disallowedFields.length > 0) {
    throw new Error(`Cannot update fields: ${disallowedFields.join(', ')}. Only these fields can be updated: ${ALLOWED_UPDATE_FIELDS.join(', ')}`)
  }

  // Build dynamic UPDATE query
  const fields: string[] = []
  const values: any[] = []
  let paramCount = 1

  if (updates.title !== undefined) {
    fields.push(`title = $${paramCount++}`)
    values.push(updates.title)
  }
  if (updates.description !== undefined) {
    fields.push(`description = $${paramCount++}`)
    values.push(updates.description)
  }
  if (updates.price_usdc !== undefined) {
    fields.push(`price_usdc = $${paramCount++}`)
    values.push(updates.price_usdc)
  }
  if (updates.status !== undefined) {
    fields.push(`status = $${paramCount++}`)
    values.push(updates.status)
  }
  if (updates.endpoint_url !== undefined) {
    fields.push(`endpoint_url = $${paramCount++}`)
    values.push(updates.endpoint_url)
  }
  if (updates.method !== undefined) {
    fields.push(`method = $${paramCount++}`)
    values.push(updates.method)
  }
  if (updates.category !== undefined) {
    fields.push(`category = $${paramCount++}`)
    values.push(updates.category)
  }
  if (updates.icon_url !== undefined) {
    fields.push(`icon_url = $${paramCount++}`)
    values.push(updates.icon_url)
  }

  if (fields.length === 0) {
    return getBlinkBySlug(slug)
  }

  values.push(slug) // Add slug as last parameter

  const result = await getPool().query(
    `UPDATE blinks
    SET ${fields.join(', ')}
    WHERE slug = $${paramCount}
    RETURNING id, slug, title, description, price_usdc::text, payout_wallet, icon_url, endpoint_url, method, category, runs, status, payment_token, payment_mode, reward_amount::text, funded_wallet, max_claims_per_user, creator_id`,
    values
  )

  if (result.rows.length === 0) return null

  const row = result.rows[0]

  // Get creator wallet
  const creatorResult = await getPool().query(
    'SELECT c.wallet FROM creators c WHERE c.id = $1',
    [row.creator_id]
  )

  return {
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
    creator_id: row.creator_id,
    creator: { wallet: creatorResult.rows[0].wallet }
  }
}

export async function deleteBlink(slug: string): Promise<boolean> {
  const result = await getPool().query('DELETE FROM blinks WHERE slug = $1', [slug])
  return result.rowCount !== null && result.rowCount > 0
}

// ========== DASHBOARD OPERATIONS ==========

export async function getDashboardData(wallet: string): Promise<DashboardData> {
  // Get creator ID
  const creatorResult = await getPool().query('SELECT id FROM creators WHERE wallet = $1', [wallet])

  if (creatorResult.rows.length === 0) {
    // Return empty dashboard if creator doesn't exist
    return {
      wallet,
      totalEarnings: '0.00',
      totalRuns: 0,
      activeBlinks: 0,
      avgPrice: '0.000',
      blinks: [],
      recentActivity: []
    }
  }

  const creatorId = creatorResult.rows[0].id

  // Get all blinks for this creator with stats
  const blinksResult = await getPool().query(
    `SELECT
      b.id, b.slug, b.title, b.description, b.price_usdc::text,
      b.icon_url, b.endpoint_url, b.method, b.category,
      b.runs, b.status, b.payment_token, b.payout_wallet, b.creator_id,
      b.payment_mode, b.reward_amount::text, b.funded_wallet, b.max_claims_per_user,
      (b.price_usdc * b.runs)::text as revenue,
      COALESCE(
        (SELECT COUNT(*) * 100.0 / NULLIF(b.runs, 0)
         FROM runs r
         WHERE r.blink_id = b.id AND r.status = 'executed'),
        0
      ) as success_rate
    FROM blinks b
    WHERE b.creator_id = $1
    ORDER BY b.created_at DESC`,
    [creatorId]
  )

  const blinks: DashboardBlink[] = blinksResult.rows.map(row => ({
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
    creator_id: row.creator_id,
    revenue: row.revenue,
    successRate: parseFloat(row.success_rate) || 98,
    lastRun: row.runs > 0 ? 'Recently' : 'Never'
  }))

  // Calculate totals
  const totalRuns = blinks.reduce((sum, b) => sum + b.runs, 0)
  const totalEarnings = blinks.reduce((sum, b) => sum + parseFloat(b.revenue), 0)
  const activeBlinks = blinks.filter(b => b.status === 'active').length
  const avgPrice = blinks.length > 0
    ? (blinks.reduce((sum, b) => sum + parseFloat(b.price_usdc), 0) / blinks.length).toFixed(3)
    : '0.000'

  // Get recent activity (mock for now - will be real when runs are tracked)
  const recentActivity: Activity[] = [
    { id: 1, blink: blinks[0]?.title || 'Sample Blink', amount: '0.03', time: '2 min ago', status: 'success' as const },
    { id: 2, blink: blinks[1]?.title || 'Sample Blink', amount: '0.02', time: '5 min ago', status: 'success' as const },
    { id: 3, blink: blinks[0]?.title || 'Sample Blink', amount: '0.03', time: '12 min ago', status: 'success' as const },
  ].filter(a => blinks.length > 0) // Only show if there are blinks

  return {
    wallet,
    totalEarnings: totalEarnings.toFixed(2),
    totalRuns,
    activeBlinks,
    avgPrice,
    blinks,
    recentActivity
  }
}

// ========== RUNS (PAYMENT TRACKING) OPERATIONS ==========

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

// Create a new run (payment tracking record)
// Reference expires after 15 minutes by default (set in database schema)
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

// Get run by reference (includes expiration check)
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
      await getPool().query(
        `UPDATE runs SET status = 'failed' WHERE reference = $1`,
        [reference]
      )
      run.status = 'failed'
    }
  }

  return run
}

// Update run with payment details
export async function updateRunPayment(params: {
  reference: string
  signature: string
  payer: string
}): Promise<RunData | null> {
  const { reference, signature, payer } = params

  const result = await getPool().query(
    `UPDATE runs
    SET signature = $1, payer = $2, status = 'paid'
    WHERE reference = $3
    RETURNING id, blink_id, reference, signature, payer, status, duration_ms, created_at, metadata`,
    [signature, payer, reference]
  )

  if (result.rows.length === 0) return null
  return result.rows[0]
}

// Mark run as executed (atomic with blink run count increment)
export async function markRunExecuted(params: {
  reference: string
  durationMs: number
  responseData?: any // API response data to store
}): Promise<RunData | null> {
  const { reference, durationMs, responseData } = params

  // Use transaction to ensure atomicity between run update and blink counter increment
  const client = await getPool().connect()
  let transactionStarted = false

  try {
    await client.query('BEGIN')
    transactionStarted = true

    // Prepare response preview (truncated version for quick display)
    const responsePreview = responseData
      ? JSON.stringify(responseData).substring(0, 500)
      : null

    // Get existing metadata to preserve it
    const existingRunResult = await client.query(
      `SELECT metadata FROM runs WHERE reference = $1`,
      [reference]
    )

    // Merge response data into existing metadata (preserve targetWallet, payer, text, etc.)
    const existingMetadata = existingRunResult.rows[0]?.metadata || {}
    const metadata = {
      ...existingMetadata,
      flow: 'x402',
      response: responseData
    }

    // Update run status and store response data
    const result = await client.query(
      `UPDATE runs
      SET status = 'executed', duration_ms = $1, executed_at = NOW(),
          response_preview = $3, metadata = $4
      WHERE reference = $2
      RETURNING id, blink_id, reference, signature, payer, status, duration_ms, created_at, paid_at, executed_at`,
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
    // Attempt rollback if transaction was started
    if (transactionStarted) {
      try {
        await client.query('ROLLBACK')
      } catch (rollbackError) {
        // Log rollback failure but throw original error
        logger.error('Failed to rollback transaction', rollbackError)
      }
    }
    throw error
  } finally {
    // Always release client back to pool
    try {
      client.release()
    } catch (releaseError) {
      logger.error('Failed to release database client', releaseError)
    }
  }
}

// Mark run as failed
export async function markRunFailed(reference: string): Promise<RunData | null> {
  const result = await getPool().query(
    `UPDATE runs
    SET status = 'failed'
    WHERE reference = $1
    RETURNING id, blink_id, reference, signature, payer, status, duration_ms, created_at`,
    [reference]
  )

  if (result.rows.length === 0) return null
  return result.rows[0]
}

// Get run by signature to check for duplicates
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

// Atomically update run payment with proper locking
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
        logger.error('Failed to rollback transaction', rollbackError)
      }
    }
    throw error
  } finally {
    try {
      client.release()
    } catch (releaseError) {
      logger.error('Failed to release database client', releaseError)
    }
  }
}

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

// ========== REWARD CLAIMS OPERATIONS ==========

export interface RewardClaimData {
  id: string
  blink_id: string
  user_wallet: string
  reference: string
  signature: string | null
  claimed_at: Date
}

/**
 * Create a reward claim record (after successfully paying user)
 * Prevents duplicate claims via UNIQUE constraint on (blink_id, user_wallet, reference)
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
      // Unique constraint violation - user already claimed
      throw new Error('Reward already claimed by this wallet')
    }
    throw error
  }
}

/**
 * Get the number of times a user has claimed from a specific blink
 * Returns 0 if no claims found
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
 * Useful for quick checks before processing claim
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
 * Useful for analytics and debugging
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
 * Get reward claim by reference (for verification)
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

// ========== UTILITY FUNCTIONS ==========

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
      WHERE metric_date >= CURRENT_DATE - INTERVAL '${days} days'
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
    [limit]
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

/**
 * Update blink health status based on recent performance
 */
export async function updateBlinkHealth(
  blinkId: string,
  status: 'healthy' | 'degraded' | 'unhealthy'
): Promise<boolean> {
  try {
    const result = await getPool().query(
      `UPDATE blinks
      SET
        health_status = $2,
        last_health_check = NOW()
      WHERE id = $1`,
      [blinkId, status]
    )

    return (result.rowCount ?? 0) > 0
  } catch (error) {
    logger.error('Error updating blink health', error, { blinkId, status })
    return false
  }
}

/**
 * Calculate and update badges for a blink
 */
export async function updateBlinkBadges(blinkId: string): Promise<boolean> {
  try {
    const result = await getPool().query(
      `UPDATE blinks
      SET badges = calculate_blink_badges(id)
      WHERE id = $1`,
      [blinkId]
    )

    return (result.rowCount ?? 0) > 0
  } catch (error) {
    logger.error('Error updating blink badges', error, { blinkId })
    return false
  }
}

// Test database connection
export async function testConnection(): Promise<boolean> {
  try {
    const result = await getPool().query('SELECT NOW()')
    return true
  } catch (error) {
    logger.error('Database connection test failed', error)
    return false
  }
}

/**
 * Cleanup expired pending runs
 * Should be called periodically (e.g., every hour via cron job)
 * Marks all expired pending runs as 'failed'
 */
export async function cleanupExpiredRuns(): Promise<number> {
  try {
    const result = await getPool().query(
      `UPDATE runs
      SET status = 'failed'
      WHERE status = 'pending'
      AND expires_at < NOW()
      RETURNING id`
    )

    const count = result.rows.length
    if (count > 0) {
      logger.info(`Cleaned up ${count} expired pending runs`, { count })
    }

    return count
  } catch (error) {
    logger.error('Error cleaning up expired runs', error)
    return 0
  }
}

// Close all connections (for graceful shutdown)
export async function closePool(): Promise<void> {
  if (pool) {
    await pool.end()
  }
}

/**
 * CRITICAL FIX: Get database pool health metrics
 * Returns current pool status for monitoring and alerting
 */
export function getPoolHealth(): {
  healthy: boolean
  metrics: {
    totalCount: number
    idleCount: number
    waitingCount: number
  }
  maxConnections: number
  utilization: number
} {
  if (!pool) {
    return {
      healthy: false,
      metrics: { totalCount: 0, idleCount: 0, waitingCount: 0 },
      maxConnections: 0,
      utilization: 0
    }
  }

  const metrics = {
    totalCount: pool.totalCount,
    idleCount: pool.idleCount,
    waitingCount: pool.waitingCount
  }

  const maxConnections = 40
  const utilization = (metrics.totalCount / maxConnections) * 100

  // Pool is unhealthy if >15 clients waiting or >90% utilization
  const healthy = metrics.waitingCount < 15 && utilization < 90

  return {
    healthy,
    metrics,
    maxConnections,
    utilization: Math.round(utilization * 10) / 10  // Round to 1 decimal
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

// Export pool getter for health checks and external use
// getPool is already exported above as a named export
// Force rebuild for Railway deployment - cache bust v2
