/**
 * @blink402/database - Config Module
 *
 * Functions for managing platform-wide configuration key-value pairs.
 * Used for feature flags, system settings, and other dynamic configuration.
 */

import { createLogger } from '@blink402/config'
import { getPool } from './connection.js'

const logger = createLogger('@blink402/database:config')

/**
 * Get platform config value by key
 * Returns null if key doesn't exist
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
 * Inserts new key or updates existing one
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
