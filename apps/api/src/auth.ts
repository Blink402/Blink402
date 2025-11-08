/**
 * Solana Wallet Authentication Middleware
 *
 * Verifies that requests are signed by the claimed wallet address.
 * Uses the Solana wallet signature standard for message verification.
 */

import { FastifyRequest, FastifyReply } from 'fastify'
import { PublicKey } from '@solana/web3.js'
import nacl from 'tweetnacl'
import bs58 from 'bs58'

export interface WalletAuthBody {
  wallet: string
  signature: string
  message: string
  timestamp?: number
  nonce?: string
}

// In-memory nonce store for replay attack prevention
// Maps signature -> expiry timestamp
const usedNonces = new Map<string, number>()

// Cleanup interval for expired nonces (runs every minute)
setInterval(() => {
  const now = Date.now()
  for (const [nonce, expiry] of usedNonces.entries()) {
    if (expiry < now) {
      usedNonces.delete(nonce)
    }
  }
}, 60 * 1000) // 1 minute

/**
 * Check if a nonce/signature has been used before
 * @param signature - The signature to check
 * @returns true if already used, false if new
 */
function isNonceUsed(signature: string): boolean {
  const expiry = usedNonces.get(signature)
  if (!expiry) return false

  // Check if expired
  if (expiry < Date.now()) {
    usedNonces.delete(signature)
    return false
  }

  return true
}

/**
 * Mark a nonce/signature as used
 * @param signature - The signature to mark as used
 * @param ttlMs - Time to live in milliseconds (default: 5 minutes)
 */
function markNonceUsed(signature: string, ttlMs: number = 5 * 60 * 1000): void {
  const expiry = Date.now() + ttlMs
  usedNonces.set(signature, expiry)
}

/**
 * Verify that a message was signed by the claimed wallet
 *
 * @param wallet - The wallet address (base58 string)
 * @param signature - The signature (base58 string)
 * @param message - The message that was signed
 * @returns true if signature is valid
 */
export function verifyWalletSignature(
  wallet: string,
  signature: string,
  message: string
): boolean {
  try {
    // Parse wallet public key
    const publicKey = new PublicKey(wallet)

    // Decode signature from base58
    const signatureBytes = bs58.decode(signature)

    // Convert message to bytes
    const messageBytes = new TextEncoder().encode(message)

    // Verify signature
    return nacl.sign.detached.verify(
      messageBytes,
      signatureBytes,
      publicKey.toBytes()
    )
  } catch (error) {
    return false
  }
}

/**
 * Verify message timestamp to prevent replay attacks
 *
 * @param timestamp - Unix timestamp in milliseconds
 * @param maxAgeMs - Maximum age of message in milliseconds (default: 5 minutes)
 * @returns true if timestamp is recent enough
 */
export function verifyTimestamp(timestamp: number, maxAgeMs: number = 5 * 60 * 1000): boolean {
  const now = Date.now()
  const age = now - timestamp
  return age >= 0 && age <= maxAgeMs
}

/**
 * Auth token structure (matches frontend)
 */
interface AuthToken {
  wallet: string
  signature: string
  message: string
  expiresAt: number
}

/**
 * Fastify middleware to verify wallet signature on requests
 *
 * Supports two authentication methods:
 * 1. Authorization header: Bearer <base64-encoded-token>
 * 2. Request body: { wallet, signature, message, timestamp }
 *
 * The Authorization header method is preferred and used by the frontend.
 */
export async function verifyWalletAuth(
  request: FastifyRequest<{ Body: WalletAuthBody }>,
  reply: FastifyReply
): Promise<void> {
  let wallet: string | undefined
  let signature: string | undefined
  let message: string | undefined
  let timestamp: number | undefined

  // Try to extract from Authorization header first (preferred method)
  const authHeader = request.headers.authorization
  if (authHeader && authHeader.startsWith('Bearer ')) {
    try {
      const token = authHeader.substring(7) // Remove 'Bearer ' prefix
      const authToken: AuthToken = JSON.parse(Buffer.from(token, 'base64').toString('utf-8'))

      // Check token expiration
      if (Date.now() > authToken.expiresAt) {
        return reply.code(401).send({
          error: 'Authentication failed',
          details: 'Auth token has expired',
        })
      }

      wallet = authToken.wallet
      signature = authToken.signature
      message = authToken.message
    } catch (error) {
      return reply.code(401).send({
        error: 'Authentication failed',
        details: 'Invalid auth token format',
      })
    }
  } else {
    // Fall back to request body (legacy method)
    const body = request.body
    wallet = body?.wallet
    signature = body?.signature
    message = body?.message
    timestamp = body?.timestamp
  }

  // Check required fields
  if (!wallet || !signature || !message) {
    return reply.code(401).send({
      error: 'Authentication required',
      details: 'Missing wallet, signature, or message',
    })
  }

  // Verify timestamp if provided
  if (timestamp !== undefined) {
    if (!verifyTimestamp(timestamp)) {
      return reply.code(401).send({
        error: 'Authentication failed',
        details: 'Message timestamp too old or invalid',
      })
    }

    // Verify message format includes timestamp
    const expectedMessagePattern = `Blink402 Auth: ${wallet} at ${timestamp}`
    if (message !== expectedMessagePattern) {
      return reply.code(401).send({
        error: 'Authentication failed',
        details: 'Message format invalid',
      })
    }
  }

  // Check for replay attack (nonce reuse)
  if (isNonceUsed(signature)) {
    return reply.code(401).send({
      error: 'Authentication failed',
      details: 'This signature has already been used (replay attack prevented)',
    })
  }

  // Verify signature
  const isValid = verifyWalletSignature(wallet, signature, message)
  if (!isValid) {
    return reply.code(401).send({
      error: 'Authentication failed',
      details: 'Invalid wallet signature',
    })
  }

  // Mark signature as used to prevent replay attacks
  markNonceUsed(signature)

  // Signature verified - attach wallet to request for downstream use
  request.authenticatedWallet = wallet
}

/**
 * Helper to verify a specific wallet owns a resource
 *
 * @param requestWallet - The authenticated wallet from the request
 * @param resourceOwnerWallet - The wallet that owns the resource
 * @returns true if wallets match
 */
export function verifyOwnership(requestWallet: string, resourceOwnerWallet: string): boolean {
  return requestWallet === resourceOwnerWallet
}
