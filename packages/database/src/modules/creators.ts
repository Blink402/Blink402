/**
 * Creators Module
 * Handles creator CRUD operations, profiles, and payout key management
 */

import type { CreatorProfile, UpdateCreatorProfilePayload, BlinkData } from '@blink402/types'
import { getPool, isPostgresError } from './connection.js'
import { createLogger } from '@blink402/config'

const logger = createLogger('@blink402/database:creators')

/**
 * Get or create a creator by wallet address
 * @returns Creator ID
 */
export async function getOrCreateCreator(wallet: string): Promise<string> {
  const result = await getPool().query(
    'INSERT INTO creators (wallet) VALUES ($1) ON CONFLICT (wallet) DO UPDATE SET wallet = $1 RETURNING id',
    [wallet]
  )
  return result.rows[0].id
}

/**
 * Get creator profile by wallet address or custom slug
 * @param walletOrSlug - Wallet address (44 chars) or custom profile slug
 * @returns Creator profile with stats, or null if not found
 */
export async function getCreatorProfile(walletOrSlug: string): Promise<CreatorProfile | null> {
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
    total_runs: parseInt(row.total_runs, 10),
  }
}

/**
 * Update creator profile information
 * Only updates fields that are provided
 * @throws Error if profile_slug is already taken
 */
export async function updateCreatorProfile(
  wallet: string,
  updates: UpdateCreatorProfilePayload
): Promise<CreatorProfile | null> {
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

  fields.push(`updated_at = NOW()`)

  if (fields.length === 1) {
    return getCreatorProfile(wallet)
  }

  values.push(wallet)

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
 * @param wallet - Creator wallet address
 * @param limit - Maximum number of results
 * @param offset - Pagination offset
 * @returns Array of blink data
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

  return result.rows.map((row) => ({
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
      profile_slug: row.creator_profile_slug,
    },
  }))
}
