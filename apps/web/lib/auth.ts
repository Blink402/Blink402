// Wallet-based authentication utilities for Blink402
// Uses Solana wallet signature verification (SIWS - Sign In With Solana pattern)

import { PublicKey } from '@solana/web3.js'
import nacl from 'tweetnacl'
import bs58 from 'bs58'
import { logger } from './logger'

export interface AuthMessage {
  domain: string
  address: string
  statement: string
  uri: string
  version: string
  chainId: string
  nonce: string
  issuedAt: string
  expirationTime?: string
}

export interface AuthToken {
  wallet: string
  signature: string
  message: string
  expiresAt: number
}

/**
 * Generate a message for the wallet to sign
 * Follows SIWS (Sign In With Solana) pattern
 */
export function generateAuthMessage(walletAddress: string): { message: string; nonce: string } {
  const domain = process.env.NEXT_PUBLIC_APP_DOMAIN || 'blink402.com'
  const uri = process.env.NEXT_PUBLIC_APP_URL || 'https://blink402.com'
  const nonce = generateNonce()
  const issuedAt = new Date().toISOString()
  const expirationTime = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString() // 24 hours

  const message = `${domain} wants you to sign in with your Solana account:
${walletAddress}

Sign in to Blink402 Creator Dashboard

URI: ${uri}
Version: 1
Chain ID: solana:mainnet
Nonce: ${nonce}
Issued At: ${issuedAt}
Expiration Time: ${expirationTime}`

  return { message, nonce }
}

/**
 * Verify a signed message from a Solana wallet
 */
export function verifyWalletSignature(
  message: string,
  signature: string,
  walletAddress: string
): boolean {
  try {
    // Decode the signature from base58
    const signatureBytes = bs58.decode(signature)

    // Encode the message as bytes
    const messageBytes = new TextEncoder().encode(message)

    // Get the public key
    const publicKey = new PublicKey(walletAddress)

    // Verify the signature
    const verified = nacl.sign.detached.verify(
      messageBytes,
      signatureBytes,
      publicKey.toBytes()
    )

    return verified
  } catch (error) {
    logger.error('Error verifying wallet signature:', error)
    return false
  }
}

/**
 * Verify an auth token is valid and not expired
 */
export function verifyAuthToken(token: AuthToken): { valid: boolean; wallet?: string } {
  // Check expiration
  if (Date.now() > token.expiresAt) {
    return { valid: false }
  }

  // Verify signature
  const verified = verifyWalletSignature(token.message, token.signature, token.wallet)

  if (!verified) {
    return { valid: false }
  }

  return { valid: true, wallet: token.wallet }
}

/**
 * Generate a random nonce for the auth message
 */
function generateNonce(): string {
  const array = new Uint8Array(16)
  crypto.getRandomValues(array)
  return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('')
}

/**
 * Create an auth token from a verified signature
 */
export function createAuthToken(
  walletAddress: string,
  signature: string,
  message: string
): AuthToken {
  return {
    wallet: walletAddress,
    signature,
    message,
    expiresAt: Date.now() + 24 * 60 * 60 * 1000, // 24 hours
  }
}

/**
 * Extract wallet address from request Authorization header
 * Returns null if no valid auth token found
 */
export function getWalletFromRequest(authHeader: string | null): string | null {
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null
  }

  try {
    const token = authHeader.substring(7) // Remove 'Bearer ' prefix
    const authToken: AuthToken = JSON.parse(Buffer.from(token, 'base64').toString('utf-8'))

    const verification = verifyAuthToken(authToken)

    return verification.valid ? verification.wallet || null : null
  } catch (error) {
    logger.error('Error parsing auth token:', error)
    return null
  }
}

/**
 * Encode an auth token to base64 for use in Authorization header
 */
export function encodeAuthToken(token: AuthToken): string {
  return Buffer.from(JSON.stringify(token)).toString('base64')
}
