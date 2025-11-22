// Retry utilities for handling transient failures
// Provides exponential backoff and intelligent retry logic

import { createLogger } from '@blink402/config'

const logger = createLogger('@blink402/solana-retry')

export interface RetryOptions {
  maxRetries?: number
  initialDelayMs?: number
  maxDelayMs?: number
  backoffMultiplier?: number
  shouldRetry?: (error: unknown, attempt: number) => boolean
  onRetry?: (error: unknown, attempt: number, nextDelay: number) => void
}

/**
 * Execute a function with exponential backoff retry logic
 * @param fn - The async function to execute
 * @param options - Retry configuration options
 * @returns The result of the function if successful
 * @throws The last error if all retries are exhausted
 */
export async function withExponentialBackoff<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const {
    maxRetries = 3,
    initialDelayMs = 1000,
    maxDelayMs = 30000,
    backoffMultiplier = 2,
    shouldRetry = defaultShouldRetry,
    onRetry = defaultOnRetry,
  } = options

  let lastError: unknown

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn()
    } catch (error) {
      lastError = error

      // Check if this is the last attempt
      if (attempt === maxRetries) {
        logger.error('All retry attempts exhausted', {
          error: error instanceof Error ? error.message : String(error),
          attempts: attempt + 1,
          maxRetries: maxRetries + 1,
        })
        throw error
      }

      // Check if we should retry this error
      if (!shouldRetry(error, attempt)) {
        logger.warn('Error is not retryable, giving up', {
          error: error instanceof Error ? error.message : String(error),
          attempt: attempt + 1,
        })
        throw error
      }

      // Calculate next delay with exponential backoff
      const baseDelay = initialDelayMs * Math.pow(backoffMultiplier, attempt)
      const jitteredDelay = baseDelay * (0.5 + Math.random() * 0.5) // Add jitter
      const nextDelay = Math.min(jitteredDelay, maxDelayMs)

      // Notify about retry
      onRetry(error, attempt, nextDelay)

      // Wait before next attempt
      await sleep(nextDelay)
    }
  }

  // Should never reach here, but TypeScript needs this
  throw lastError
}

/**
 * Default function to determine if an error should be retried
 * @param error - The error that occurred
 * @param attempt - The current attempt number (0-based)
 * @returns true if the error should be retried
 */
function defaultShouldRetry(error: unknown, attempt: number): boolean {
  // Always retry on network errors
  if (error instanceof Error) {
    const message = error.message.toLowerCase()

    // Retry on RPC errors
    if (
      message.includes('429') || // Rate limit
      message.includes('500') || // Internal server error
      message.includes('502') || // Bad gateway
      message.includes('503') || // Service unavailable
      message.includes('504') || // Gateway timeout
      message.includes('timeout') ||
      message.includes('network') ||
      message.includes('econnreset') ||
      message.includes('enotfound') ||
      message.includes('blockhash not found') ||
      message.includes('node is behind') ||
      message.includes('rpc')
    ) {
      return true
    }

    // Don't retry on permanent failures
    if (
      message.includes('insufficient') || // Insufficient funds
      message.includes('invalid') || // Invalid parameters
      message.includes('not found') || // Account not found
      message.includes('already') || // Already processed
      message.includes('duplicate') // Duplicate transaction
    ) {
      return false
    }
  }

  // Default: retry on unknown errors up to max attempts
  return true
}

/**
 * Default retry notification function
 * @param error - The error that occurred
 * @param attempt - The current attempt number (0-based)
 * @param nextDelay - The delay before next retry in milliseconds
 */
function defaultOnRetry(error: unknown, attempt: number, nextDelay: number): void {
  logger.warn(`Retrying after error, waiting ${(nextDelay / 1000).toFixed(1)}s`, {
    error: error instanceof Error ? error.message : String(error),
    attempt: attempt + 1,
    nextDelayMs: nextDelay,
    nextDelaySeconds: (nextDelay / 1000).toFixed(1),
  })
}

/**
 * Sleep for a specified number of milliseconds
 * @param ms - The number of milliseconds to sleep
 * @returns A promise that resolves after the specified time
 */
export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

/**
 * Retry helper specifically for Solana RPC calls
 * Handles common Solana RPC errors with appropriate retry logic
 */
export async function retrySolanaRpc<T>(
  fn: () => Promise<T>,
  operation: string,
  options: Partial<RetryOptions> = {}
): Promise<T> {
  return withExponentialBackoff(fn, {
    maxRetries: 3,
    initialDelayMs: 500,
    maxDelayMs: 10000,
    ...options,
    onRetry: (error, attempt, nextDelay) => {
      logger.info(`Retrying Solana RPC operation: ${operation}`, {
        operation,
        error: error instanceof Error ? error.message : String(error),
        attempt: attempt + 1,
        nextDelayMs: nextDelay,
      })

      // Call custom onRetry if provided
      if (options.onRetry) {
        options.onRetry(error, attempt, nextDelay)
      }
    },
  })
}

/**
 * Create a timeout promise that rejects after specified milliseconds
 * @param ms - Timeout in milliseconds
 * @param operation - Description of the operation (for error message)
 * @returns A promise that rejects with a timeout error
 */
export function timeout<T>(ms: number, operation: string): Promise<T> {
  return new Promise((_, reject) => {
    setTimeout(() => {
      reject(new Error(`Operation '${operation}' timed out after ${ms}ms`))
    }, ms)
  })
}

/**
 * Execute a promise with a timeout
 * @param promise - The promise to execute
 * @param ms - Timeout in milliseconds
 * @param operation - Description of the operation
 * @returns The result of the promise if it completes before timeout
 * @throws Timeout error if the promise takes too long
 */
export async function withTimeout<T>(
  promise: Promise<T>,
  ms: number,
  operation: string
): Promise<T> {
  return Promise.race([
    promise,
    timeout<T>(ms, operation),
  ])
}