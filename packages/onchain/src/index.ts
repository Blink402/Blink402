/**
 * ONCHAIN x402 API Client
 *
 * Provides functions to verify and settle payments using ONCHAIN's
 * facilitator-based payment processing protocol.
 *
 * Features:
 * - Automatic retry with exponential backoff for transient failures
 * - 30-second timeout for all API requests
 * - Detailed logging for debugging
 *
 * @see https://onchain.fi/docs
 */

import { fetch } from 'undici'

// ========== RETRY UTILITIES ==========

interface RetryOptions {
  maxRetries?: number
  initialDelayMs?: number
  maxDelayMs?: number
  backoffMultiplier?: number
}

/**
 * Sleep for specified milliseconds
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

/**
 * Execute a function with exponential backoff retry logic
 * Handles transient failures like network timeouts, rate limits, and 5xx errors
 */
async function withRetry<T>(
  fn: () => Promise<T>,
  operation: string,
  options: RetryOptions = {}
): Promise<T> {
  const {
    maxRetries = 3,
    initialDelayMs = 1000,
    maxDelayMs = 10000,
    backoffMultiplier = 2,
  } = options

  let lastError: Error

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn()
    } catch (error) {
      lastError = error as Error

      // Check if error is retryable
      const isRetryable = isRetryableError(error as Error)

      // Don't retry on last attempt or non-retryable errors
      if (attempt === maxRetries || !isRetryable) {
        if (!isRetryable) {
          console.error(`[ONCHAIN] Non-retryable error in ${operation}:`, lastError.message)
        } else {
          console.error(`[ONCHAIN] All ${maxRetries + 1} attempts failed for ${operation}:`, lastError.message)
        }
        throw lastError
      }

      // Calculate delay with exponential backoff + jitter
      const baseDelay = initialDelayMs * Math.pow(backoffMultiplier, attempt)
      const jitter = baseDelay * 0.25 * (Math.random() * 2 - 1)
      const delay = Math.min(Math.max(0, baseDelay + jitter), maxDelayMs)

      console.log(
        `[ONCHAIN] Retry attempt ${attempt + 1}/${maxRetries} for ${operation} after ${Math.round(delay)}ms`,
        { error: lastError.message }
      )

      await sleep(delay)
    }
  }

  throw lastError!
}

/**
 * Determine if an error should be retried
 */
function isRetryableError(error: Error): boolean {
  const message = error.message.toLowerCase()

  // Retry on network errors
  if (
    message.includes('timeout') ||
    message.includes('network') ||
    message.includes('econnreset') ||
    message.includes('enotfound') ||
    message.includes('etimedout')
  ) {
    return true
  }

  // Retry on specific HTTP status codes
  if (
    message.includes('429') ||  // Rate limit
    message.includes('500') ||  // Internal server error
    message.includes('502') ||  // Bad gateway
    message.includes('503') ||  // Service unavailable
    message.includes('504')     // Gateway timeout
  ) {
    return true
  }

  // Don't retry 4xx client errors (except 429)
  if (message.match(/4\d{2}/)) {
    return false
  }

  // Don't retry validation failures
  if (
    message.includes('invalid') ||
    message.includes('verification failed') ||
    message.includes('settlement failed')
  ) {
    return false
  }

  // Default: retry unknown errors
  return true
}

// ========== TYPE DEFINITIONS ==========

/**
 * Request payload for ONCHAIN /v1/verify endpoint
 */
export interface OnchainVerifyRequest {
  paymentHeader: string // base64-encoded x402 payment header
  sourceNetwork: 'base' | 'base-sepolia' | 'solana' | 'solana-devnet'
  destinationNetwork: 'base' | 'base-sepolia' | 'solana' | 'solana-devnet'
  recipientAddress: string // Expected recipient wallet
  expectedAmount: string // Expected amount in USD format (e.g., "1.50" for $1.50 USDC, "0.01" for $0.01)
  expectedToken: 'USDC' | 'SOL'
  priority?: 'speed' | 'cost' | 'reliability' | 'balanced'
}

/**
 * Request payload for ONCHAIN /v1/settle endpoint
 */
export interface OnchainSettleRequest {
  paymentHeader: string // base64-encoded x402 payment header
  sourceNetwork: 'base' | 'base-sepolia' | 'solana' | 'solana-devnet'
  destinationNetwork: 'base' | 'base-sepolia' | 'solana' | 'solana-devnet'
  priority?: 'speed' | 'cost' | 'reliability' | 'balanced'
}

/**
 * Response from ONCHAIN verify endpoint
 */
export interface OnchainVerifyResponse {
  status: 'success' | 'failure'
  data: {
    valid: boolean
    facilitator: string // e.g., 'OctonetAI', 'PayAI', 'Coinbase CDP'
    amount?: string
    token?: string
    txHash?: string
  }
  error?: string
}

/**
 * Response from ONCHAIN settle endpoint
 */
export interface OnchainSettleResponse {
  status: 'success' | 'failure'
  data: {
    txHash: string
    facilitator: string
  }
  error?: string
}

/**
 * Configuration for ONCHAIN API client
 */
export interface OnchainConfig {
  apiKey: string
  apiUrl?: string // Defaults to https://api.onchain.fi/v1
}

// ========== API CLIENT ==========

/**
 * Default PayAI Facilitator API base URL
 *
 * IMPORTANT: Switched from ONCHAIN aggregator to PayAI direct integration
 * PayAI is the actual facilitator that was working on Nov 12, 2025
 * Going direct removes middleman and potential points of failure
 */
const DEFAULT_API_URL = 'https://facilitator.payai.network'

/**
 * Get PayAI API configuration from environment
 *
 * NOTE: PayAI may not require an API key for public facilitator endpoints
 * Keeping the key check for now, but it might be optional
 */
function getConfig(): OnchainConfig {
  const apiKey = process.env.PAYAI_API_KEY || process.env.ONCHAIN_API_KEY || ''

  // PayAI might not require API key - log warning but don't fail
  if (!apiKey) {
    console.warn('[PayAI] No API key found - attempting unauthenticated request')
  }

  return {
    apiKey,
    // IMPORTANT: Only use PAYAI_API_URL, ignore ONCHAIN_API_URL
    // This prevents Railway env var from overriding PayAI default
    apiUrl: process.env.PAYAI_API_URL || DEFAULT_API_URL
  }
}

/**
 * Verify a payment with ONCHAIN facilitators
 *
 * This validates that the payment header contains a valid transaction
 * with the expected recipient, amount, and token.
 *
 * @param request - Verification request parameters
 * @returns Verification response with facilitator info
 * @throws Error if API call fails or payment is invalid
 */
export async function verifyPayment(
  request: OnchainVerifyRequest
): Promise<OnchainVerifyResponse> {
  return withRetry(
    async () => {
      const config = getConfig()
      const url = `${config.apiUrl}/verify`

      // Log the request body for debugging (without sensitive data)
      console.log('[PayAI] Verify request:', {
        url,
        request: {
          ...request,
          paymentHeader: request.paymentHeader.substring(0, 50) + '...'
        }
      })

      const requestBody = JSON.stringify(request)
      console.log('Request body length:', requestBody.length)

      // DEBUG: Decode and analyze the transaction
      try {
        const headerData = JSON.parse(Buffer.from(request.paymentHeader, 'base64').toString('utf-8'))
        console.log('Decoded X-PAYMENT header:', JSON.stringify(headerData, null, 2))

        if (headerData.payload?.transaction) {
          const { VersionedTransaction } = await import('@solana/web3.js')
          const txBytes = Buffer.from(headerData.payload.transaction, 'base64')
          const tx = VersionedTransaction.deserialize(txBytes)
          console.log('Transaction instruction count:', tx.message.compiledInstructions.length)
          tx.message.compiledInstructions.forEach((ix: any, i: number) => {
            const programId = tx.message.staticAccountKeys[ix.programIdIndex]
            console.log(`  Instruction ${i + 1}: Program ${programId.toBase58()}`)
          })
        }
      } catch (e) {
        console.log('Could not decode transaction for debugging:', e)
      }

      console.log('Sending ONCHAIN verify request')
      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), 30000) // 30 second timeout

      try {
        const response = await fetch(url, {
          method: 'POST',
          headers: {
            'X-API-Key': config.apiKey,
            'Content-Type': 'application/json'
          },
          body: requestBody,
          signal: controller.signal
        })

        clearTimeout(timeout)

        if (!response.ok) {
          const errorText = await response.text()
          console.error('[PayAI] Verify error response:', errorText)
          throw new Error(
            `PayAI verify failed: ${response.status} ${response.statusText} - ${errorText}`
          )
        }

        const data = await response.json() as OnchainVerifyResponse

        if (data.status === 'failure' || !data.data.valid) {
          throw new Error(
            `Payment verification failed: ${data.error || 'Invalid payment'}`
          )
        }

        return data
      } catch (fetchError: any) {
        clearTimeout(timeout)
        if (fetchError.name === 'AbortError') {
          throw new Error('ONCHAIN API request timed out after 30 seconds')
        }
        throw fetchError
      }
    },
    'verify payment',
    {
      maxRetries: 3,
      initialDelayMs: 1000,
      maxDelayMs: 10000,
    }
  )
}

/**
 * Settle a payment with ONCHAIN facilitators
 *
 * After verification succeeds, this finalizes the payment and returns
 * the transaction hash from the facilitator.
 *
 * @param request - Settlement request parameters
 * @returns Settlement response with transaction hash
 * @throws Error if API call fails or settlement fails
 */
export async function settlePayment(
  request: OnchainSettleRequest
): Promise<OnchainSettleResponse> {
  return withRetry(
    async () => {
      const config = getConfig()
      const url = `${config.apiUrl}/settle`

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'X-API-Key': config.apiKey,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(request)
      })

      if (!response.ok) {
        const errorText = await response.text()
        throw new Error(
          `PayAI settle failed: ${response.status} ${response.statusText} - ${errorText}`
        )
      }

      const data = await response.json() as OnchainSettleResponse

      if (data.status === 'failure') {
        throw new Error(
          `PayAI settlement failed: ${data.error || 'Unknown error'}`
        )
      }

      return data
    },
    'settle payment',
    {
      maxRetries: 3,
      initialDelayMs: 1000,
      maxDelayMs: 10000,
    }
  )
}

/**
 * Verify and settle a payment in one call
 *
 * Convenience function that combines verify + settle operations.
 *
 * @param request - Verification request parameters
 * @returns Object with verification and settlement responses
 * @throws Error if either verification or settlement fails
 */
export async function verifyAndSettle(
  request: OnchainVerifyRequest
): Promise<{
  verify: OnchainVerifyResponse
  settle: OnchainSettleResponse
}> {
  const verifyResponse = await verifyPayment(request)

  // Create settle request from verify request
  const settleRequest: OnchainSettleRequest = {
    paymentHeader: request.paymentHeader,
    sourceNetwork: request.sourceNetwork,
    destinationNetwork: request.destinationNetwork,
    priority: request.priority
  }

  const settleResponse = await settlePayment(settleRequest)

  return {
    verify: verifyResponse,
    settle: settleResponse
  }
}
