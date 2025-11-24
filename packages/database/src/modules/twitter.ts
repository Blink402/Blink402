/**
 * @blink402/database - Twitter Module
 *
 * Functions for managing Twitter OAuth credentials and activity logging.
 * Supports Twitter API integration for automated posting and engagement.
 */

import { createLogger } from '@blink402/config'
import { getPool } from './connection.js'

const logger = createLogger('@blink402/database:twitter')

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

/**
 * Get Twitter credentials for a creator by creator ID
 */
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

/**
 * Get Twitter credentials by wallet address
 */
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

/**
 * Save or update Twitter credentials
 */
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

/**
 * Update last used timestamp for Twitter credentials
 */
export async function updateTwitterLastUsed(credentialId: string): Promise<void> {
  await getPool().query(
    `UPDATE twitter_credentials SET last_used_at = NOW() WHERE id = $1`,
    [credentialId]
  )
}

/**
 * Disconnect Twitter account (soft delete - marks as inactive)
 */
export async function disconnectTwitter(creatorId: string): Promise<void> {
  await getPool().query(
    `UPDATE twitter_credentials SET is_active = false WHERE creator_id = $1`,
    [creatorId]
  )
}

/**
 * Log Twitter activity (posts, likes, etc.)
 */
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

/**
 * Get Twitter activity history for a creator
 */
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
