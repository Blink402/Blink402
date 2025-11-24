/**
 * @blink402/database - Catalog Module
 *
 * Functions for public catalog display, featured blinks, trending blinks,
 * and catalog publishing management.
 */

import { createLogger } from '@blink402/config'
import type { BlinkData } from '@blink402/types'
import { getPool, isPostgresError } from './connection.js'

const logger = createLogger('@blink402/database:catalog')

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
