/**
 * Proxy Configuration Constants
 *
 * Shared constants for upstream API proxying, rate limiting,
 * and security configuration.
 */

// ========== RESPONSE SIZE & TIMEOUT LIMITS ==========
/** Maximum allowed response size from upstream APIs (10MB) */
export const MAX_RESPONSE_SIZE = 10 * 1024 * 1024 // 10MB

/** Timeout for upstream API calls (30 seconds) */
export const UPSTREAM_TIMEOUT = 30000 // 30 seconds

// ========== CACHING ==========
/** TTL for blink metadata cache (5 minutes) */
export const BLINK_CACHE_TTL = 300 // 5 minutes

// ========== RATE LIMITING ==========
/** Rate limit window duration (1 hour) */
export const RATE_LIMIT_WINDOW_SECONDS = 3600 // 1 hour

/** Max requests per wallet for charge mode blinks */
export const RATE_LIMIT_MAX_REQUESTS = 10 // 10 requests per hour

/** Max requests per wallet for reward mode blinks (stricter) */
export const RATE_LIMIT_REWARD_MAX = 5 // 5 requests per hour

// ========== PAYAI x402 CONFIGURATION ==========
/** PayAI facilitator URL for payment settlement */
export const PAYAI_FACILITATOR_URL = 'https://facilitator.payai.network'

/** Get PayAI network config based on environment */
export function getPayAINetwork(): 'solana' | 'solana-devnet' {
  return process.env.SOLANA_NETWORK === 'devnet' ? 'solana-devnet' : 'solana'
}

/** Get treasury wallet for PayAI handler */
export function getTreasuryWallet(): string {
  return process.env.TREASURY_WALLET || process.env.PAYOUT_WALLET || ''
}
