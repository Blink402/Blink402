/**
 * Encryption utilities for sensitive data (e.g., private keys)
 * Uses AES-256-GCM for authenticated encryption
 */

import crypto from 'crypto'

const ALGORITHM = 'aes-256-gcm'
const IV_LENGTH = 16
const SALT_LENGTH = 64
const TAG_LENGTH = 16
const TAG_POSITION = SALT_LENGTH + IV_LENGTH
const ENCRYPTED_POSITION = TAG_POSITION + TAG_LENGTH

/**
 * Get encryption key from environment
 * CRITICAL: This must be a 32-byte hex string stored in ENCRYPTION_KEY env var
 */
function getEncryptionKey(): Buffer {
  const key = process.env.ENCRYPTION_KEY

  if (!key) {
    throw new Error(
      'ENCRYPTION_KEY environment variable not set. Generate with: node -e "console.log(crypto.randomBytes(32).toString(\'hex\'))"'
    )
  }

  if (key.length !== 64) {
    throw new Error('ENCRYPTION_KEY must be 64 hex characters (32 bytes)')
  }

  return Buffer.from(key, 'hex')
}

/**
 * Encrypt sensitive text (e.g., private key JSON array)
 * @param text - Plain text to encrypt
 * @returns Base64-encoded encrypted string
 */
export function encrypt(text: string): string {
  try {
    const key = getEncryptionKey()

    // Generate random salt and IV
    const salt = crypto.randomBytes(SALT_LENGTH)
    const iv = crypto.randomBytes(IV_LENGTH)

    // Create cipher
    const cipher = crypto.createCipheriv(ALGORITHM, key, iv)

    // Encrypt text
    const encrypted = Buffer.concat([
      cipher.update(text, 'utf8'),
      cipher.final(),
    ])

    // Get authentication tag
    const tag = cipher.getAuthTag()

    // Combine salt + IV + tag + encrypted data
    const result = Buffer.concat([salt, iv, tag, encrypted])

    // Return as base64
    return result.toString('base64')
  } catch (error) {
    throw new Error(`Encryption failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }
}

/**
 * Decrypt sensitive text
 * @param encryptedText - Base64-encoded encrypted string
 * @returns Decrypted plain text
 */
export function decrypt(encryptedText: string): string {
  try {
    const key = getEncryptionKey()

    // Decode from base64
    const data = Buffer.from(encryptedText, 'base64')

    // Extract salt, IV, tag, and encrypted data
    const salt = data.slice(0, SALT_LENGTH)
    const iv = data.slice(SALT_LENGTH, TAG_POSITION)
    const tag = data.slice(TAG_POSITION, ENCRYPTED_POSITION)
    const encrypted = data.slice(ENCRYPTED_POSITION)

    // Create decipher
    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv)
    decipher.setAuthTag(tag)

    // Decrypt
    const decrypted = Buffer.concat([
      decipher.update(encrypted),
      decipher.final(),
    ])

    return decrypted.toString('utf8')
  } catch (error) {
    throw new Error(`Decryption failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }
}

/**
 * Mask a sensitive string for display (shows only last 6 characters)
 * @param text - Text to mask
 * @returns Masked text like "***...abc123"
 */
export function maskSensitive(text: string): string {
  if (text.length <= 10) {
    return '***'
  }
  return `***...${text.slice(-6)}`
}

/**
 * Validate that a string is a valid Solana private key (JSON array format)
 * @param keyString - String to validate
 * @returns True if valid format
 */
export function isValidPrivateKeyFormat(keyString: string): boolean {
  try {
    const parsed = JSON.parse(keyString)

    // Must be an array of exactly 64 numbers
    if (!Array.isArray(parsed) || parsed.length !== 64) {
      return false
    }

    // All elements must be numbers between 0-255
    return parsed.every((n) => typeof n === 'number' && n >= 0 && n <= 255)
  } catch {
    return false
  }
}
