/**
 * Blinks Module
 * Handles Blink CRUD operations, status management, and health tracking
 */

import type { BlinkData } from '@blink402/types'
import { getPool } from './connection.js'
import { getOrCreateCreator } from './creators.js'

/**
 * Map database row to BlinkData type
 * Centralizes the row mapping logic to reduce duplication
 */
function mapRowToBlinkData(row: any): BlinkData {
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
      is_verified: row.creator_is_verified || false,
      display_name: row.creator_display_name,
      avatar_url: row.creator_avatar_url,
      profile_slug: row.creator_profile_slug,
    },
  }
}

/**
 * Common SELECT clause for blink queries
 */
const BLINK_SELECT_FIELDS = `
  b.id, b.slug, b.title, b.description, b.price_usdc::text,
  b.icon_url, b.endpoint_url, b.method, b.category,
  b.runs, b.status, b.payment_token, b.payout_wallet, b.access_duration_days,
  b.payment_mode, b.reward_amount::text, b.funded_wallet, b.max_claims_per_user,
  b.is_public, b.is_featured, b.publish_to_catalog, b.media_type,
  b.avg_latency_ms, b.success_rate_percent, b.badges, b.catalog_published_at,
  b.reported_count, b.is_forkable, b.health_status,
  b.lottery_enabled, b.lottery_round_duration_minutes,
  b.parameters,
  b.creator_id,
  c.wallet as creator_wallet,
  c.is_verified as creator_is_verified,
  c.display_name as creator_display_name,
  c.avatar_url as creator_avatar_url,
  c.profile_slug as creator_profile_slug
`

/**
 * Get all blinks (admin/debugging only - not paginated)
 * @returns Array of all blinks
 */
export async function getAllBlinks(): Promise<BlinkData[]> {
  const result = await getPool().query(
    `SELECT ${BLINK_SELECT_FIELDS}
    FROM blinks b
    JOIN creators c ON b.creator_id = c.id
    ORDER BY b.created_at DESC`
  )

  return result.rows.map(mapRowToBlinkData)
}

/**
 * Get blink by slug
 * @param slug - Unique blink slug
 * @returns Blink data or null if not found
 */
export async function getBlinkBySlug(slug: string): Promise<BlinkData | null> {
  const result = await getPool().query(
    `SELECT ${BLINK_SELECT_FIELDS}
    FROM blinks b
    JOIN creators c ON b.creator_id = c.id
    WHERE b.slug = $1`,
    [slug]
  )

  if (result.rows.length === 0) return null

  return mapRowToBlinkData(result.rows[0])
}

/**
 * Get blink by ID
 * @param id - Blink UUID
 * @returns Blink data or null if not found
 */
export async function getBlinkById(id: string): Promise<BlinkData | null> {
  const result = await getPool().query(
    `SELECT ${BLINK_SELECT_FIELDS}
    FROM blinks b
    JOIN creators c ON b.creator_id = c.id
    WHERE b.id = $1`,
    [id]
  )

  if (result.rows.length === 0) return null

  return mapRowToBlinkData(result.rows[0])
}

/**
 * Create a new blink
 * Uses transaction to ensure atomicity with creator creation
 * @param data - Blink data (without id, runs, creator_id)
 * @returns Created blink data
 */
export async function createBlink(data: Omit<BlinkData, 'id' | 'runs' | 'creator_id'>): Promise<BlinkData> {
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
        data.payout_wallet,
        data.icon_url,
        data.category,
        data.status,
        creatorId,
        data.payment_token || 'SOL',
        data.payment_mode || 'charge',
        data.reward_amount || null,
        data.funded_wallet || null,
        data.max_claims_per_user || 1,
        data.parameters ? JSON.stringify(data.parameters) : null,
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
      creator: data.creator,
    }
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  } finally {
    client.release()
  }
}

/**
 * Allowed fields for blink updates (whitelist for security)
 */
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

/**
 * Update blink by slug
 * Only allows updating whitelisted fields for security
 * @param slug - Blink slug
 * @param updates - Partial blink data to update
 * @returns Updated blink data or null if not found
 * @throws Error if attempting to update disallowed fields
 */
export async function updateBlink(slug: string, updates: Partial<BlinkData>): Promise<BlinkData | null> {
  // Validate that no disallowed fields are being updated
  const updateKeys = Object.keys(updates)
  const disallowedFields = updateKeys.filter((key) => !ALLOWED_UPDATE_FIELDS.includes(key as any))
  if (disallowedFields.length > 0) {
    throw new Error(
      `Cannot update fields: ${disallowedFields.join(', ')}. Only these fields can be updated: ${ALLOWED_UPDATE_FIELDS.join(', ')}`
    )
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

  values.push(slug)

  const result = await getPool().query(
    `UPDATE blinks
    SET ${fields.join(', ')}
    WHERE slug = $${paramCount}
    RETURNING id, slug, title, description, price_usdc::text, payout_wallet, icon_url, endpoint_url, method, category, runs, status, payment_token, payment_mode, reward_amount::text, funded_wallet, max_claims_per_user, creator_id`,
    values
  )

  if (result.rows.length === 0) return null

  const row = result.rows[0]

  // Get creator info
  const creatorResult = await getPool().query('SELECT wallet FROM creators WHERE id = $1', [row.creator_id])

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
    creator: { wallet: creatorResult.rows[0].wallet },
  }
}

/**
 * Delete blink by slug
 * @param slug - Blink slug
 * @returns True if deleted, false if not found
 */
export async function deleteBlink(slug: string): Promise<boolean> {
  const result = await getPool().query('DELETE FROM blinks WHERE slug = $1', [slug])
  return result.rowCount !== null && result.rowCount > 0
}

/**
 * Update blink health status
 * @param blinkId - Blink UUID
 * @param healthStatus - Health status ('healthy', 'degraded', 'unhealthy')
 * @returns True if updated successfully
 */
export async function updateBlinkHealth(blinkId: string, healthStatus: 'healthy' | 'degraded' | 'unhealthy'): Promise<boolean> {
  const result = await getPool().query(
    `UPDATE blinks
     SET health_status = $1, updated_at = NOW()
     WHERE id = $2`,
    [healthStatus, blinkId]
  )

  return result.rowCount !== null && result.rowCount > 0
}

/**
 * Update blink badges based on performance metrics
 * Badges: 'verified', 'trending', 'fast', 'reliable'
 * @param blinkId - Blink UUID
 * @returns True if updated successfully
 */
export async function updateBlinkBadges(blinkId: string): Promise<boolean> {
  // Get blink metrics
  const result = await getPool().query(
    `SELECT avg_latency_ms, success_rate_percent, runs, is_public
     FROM blinks
     WHERE id = $1`,
    [blinkId]
  )

  if (result.rows.length === 0) return false

  const blink = result.rows[0]
  const badges: string[] = []

  // Fast badge: avg latency < 500ms
  if (blink.avg_latency_ms && blink.avg_latency_ms < 500) {
    badges.push('fast')
  }

  // Reliable badge: success rate > 95%
  if (blink.success_rate_percent && parseFloat(blink.success_rate_percent) > 95) {
    badges.push('reliable')
  }

  // Trending badge: >100 runs and public
  if (blink.runs > 100 && blink.is_public) {
    badges.push('trending')
  }

  // Update badges
  const updateResult = await getPool().query(
    `UPDATE blinks
     SET badges = $1, updated_at = NOW()
     WHERE id = $2`,
    [JSON.stringify(badges), blinkId]
  )

  return updateResult.rowCount !== null && updateResult.rowCount > 0
}
