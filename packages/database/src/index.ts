// Database module for PostgreSQL operations
// Replaces in-memory storage with persistent database

import { Pool, QueryResult } from 'pg'
import type { BlinkData, DashboardData, DashboardBlink, Activity } from '@blink402/types'
import { createLogger } from '@blink402/config'

const logger = createLogger('@blink402/database')

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

function getPool(): Pool {
  // Skip pool creation entirely if no DATABASE_URL (happens during build)
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL not configured - cannot connect to database')
  }

  if (!pool) {
    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      max: 20, // Maximum number of clients in the pool
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000, // 5 second timeout for connections
    })

    // Handle unexpected errors on idle clients (prevents unhandled rejections)
    pool.on('error', (err, client) => {
      logger.error('Unexpected error on idle database client', err, {
        code: isPostgresError(err) ? err.code : undefined,
        detail: isPostgresError(err) ? err.detail : undefined,
      })
      // Don't exit process - let connection pool handle recovery
      // Pool will remove bad clients and create new ones as needed
    })

    // Log when pool is created
    logger.info('Database connection pool created', {
      max: 20,
      idleTimeout: 30000,
      connectionTimeout: 5000,
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
      c.wallet as creator_wallet, c.display_name as creator_display_name,
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
    access_duration_days: row.access_duration_days,
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
      c.wallet as creator_wallet
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
    access_duration_days: row.access_duration_days,
    creator: { wallet: row.creator_wallet }
  }))
}

export async function getBlinkBySlug(slug: string): Promise<BlinkData | null> {
  const result = await getPool().query(
    `SELECT
      b.id, b.slug, b.title, b.description, b.price_usdc::text,
      b.icon_url, b.endpoint_url, b.method, b.category,
      b.runs, b.status, b.payment_token, b.payout_wallet, b.access_duration_days,
      c.wallet as creator_wallet
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
    access_duration_days: row.access_duration_days,
    creator: { wallet: row.creator_wallet }
  }
}

export async function getBlinkById(id: string): Promise<BlinkData | null> {
  const result = await getPool().query(
    `SELECT
      b.id, b.slug, b.title, b.description, b.price_usdc::text,
      b.icon_url, b.endpoint_url, b.method, b.category,
      b.runs, b.status, b.payment_token, b.payout_wallet, b.access_duration_days,
      c.wallet as creator_wallet
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
    access_duration_days: row.access_duration_days,
    creator: { wallet: row.creator_wallet }
  }
}

export async function createBlink(data: Omit<BlinkData, 'id' | 'runs'>): Promise<BlinkData> {
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
        (slug, title, description, endpoint_url, method, price_usdc, payout_wallet, icon_url, category, status, creator_id, payment_token)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      RETURNING id, slug, title, description, price_usdc::text, payout_wallet, icon_url, endpoint_url, method, category, runs, status, payment_token`,
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
        data.payment_token || 'SOL' // Default to SOL, not USDC
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
    RETURNING id, slug, title, description, price_usdc::text, payout_wallet, icon_url, endpoint_url, method, category, runs, status, payment_token`,
    values
  )

  if (result.rows.length === 0) return null

  const row = result.rows[0]

  // Get creator wallet
  const creatorResult = await getPool().query(
    'SELECT c.wallet FROM blinks b JOIN creators c ON b.creator_id = c.id WHERE b.slug = $1',
    [slug]
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
}

// Create a new run (payment tracking record)
// Reference expires after 15 minutes by default (set in database schema)
export async function createRun(params: {
  blinkId: string
  reference: string
}): Promise<RunData> {
  const { blinkId, reference } = params

  const result = await getPool().query(
    `INSERT INTO runs (blink_id, reference, status)
    VALUES ($1, $2, 'pending')
    RETURNING id, blink_id, reference, signature, payer, status, duration_ms, created_at, expires_at`,
    [blinkId, reference]
  )

  return result.rows[0]
}

// Get run by reference (includes expiration check)
export async function getRunByReference(reference: string): Promise<RunData | null> {
  const result = await getPool().query(
    `SELECT id, blink_id, reference, signature, payer, status, duration_ms, created_at, expires_at
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
    RETURNING id, blink_id, reference, signature, payer, status, duration_ms, created_at`,
    [signature, payer, reference]
  )

  if (result.rows.length === 0) return null
  return result.rows[0]
}

// Mark run as executed (atomic with blink run count increment)
export async function markRunExecuted(params: {
  reference: string
  durationMs: number
}): Promise<RunData | null> {
  const { reference, durationMs } = params

  // Use transaction to ensure atomicity between run update and blink counter increment
  const client = await getPool().connect()
  let transactionStarted = false

  try {
    await client.query('BEGIN')
    transactionStarted = true

    // Update run status
    const result = await client.query(
      `UPDATE runs
      SET status = 'executed', duration_ms = $1
      WHERE reference = $2
      RETURNING id, blink_id, reference, signature, payer, status, duration_ms, created_at`,
      [durationMs, reference]
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

// Export pool getter for health checks and external use
export { getPool, getPool as pool }
