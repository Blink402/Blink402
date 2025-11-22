/**
 * Retry utility with exponential backoff
 *
 * Implements a robust retry mechanism for handling transient failures
 * in network requests, particularly for payment processing.
 *
 * Features:
 * - Exponential backoff to avoid overwhelming failing services
 * - Configurable max retries and delay bounds
 * - Jitter to prevent thundering herd
 * - Detailed logging for observability
 */

export interface RetryOptions {
  /** Maximum number of retry attempts (default: 3) */
  maxRetries?: number
  /** Initial delay in milliseconds (default: 1000ms) */
  initialDelayMs?: number
  /** Maximum delay cap in milliseconds (default: 10000ms) */
  maxDelayMs?: number
  /** Backoff multiplier (default: 2 for exponential) */
  backoffMultiplier?: number
  /** Add random jitter to prevent thundering herd (default: true) */
  enableJitter?: boolean
  /** Optional predicate to determine if error is retryable */
  shouldRetry?: (error: Error) => boolean
  /** Optional callback for retry attempts */
  onRetry?: (attempt: number, error: Error, delayMs: number) => void
}

/**
 * Retry a function with exponential backoff
 *
 * @example
 * ```typescript
 * const result = await retryWithBackoff(
 *   () => fetch('/api/payment'),
 *   { maxRetries: 3, initialDelayMs: 1000 }
 * )
 * ```
 */
export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const {
    maxRetries = 3,
    initialDelayMs = 1000,
    maxDelayMs = 10000,
    backoffMultiplier = 2,
    enableJitter = true,
    shouldRetry,
    onRetry,
  } = options

  let lastError: Error

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      // Attempt the operation
      const result = await fn()

      // Log success if this was a retry
      if (attempt > 0) {
        console.log(`✅ Retry successful after ${attempt} attempt(s)`)
      }

      return result
    } catch (error) {
      lastError = error as Error

      // Check if we should retry this error
      if (shouldRetry && !shouldRetry(lastError)) {
        console.error(`❌ Non-retryable error:`, lastError.message)
        throw lastError
      }

      // Don't retry on last attempt
      if (attempt === maxRetries) {
        console.error(`❌ All ${maxRetries + 1} attempts failed:`, lastError.message)
        throw lastError
      }

      // Calculate delay with exponential backoff
      let delay = Math.min(
        initialDelayMs * Math.pow(backoffMultiplier, attempt),
        maxDelayMs
      )

      // Add jitter (±25% randomness)
      if (enableJitter) {
        const jitter = delay * 0.25 * (Math.random() * 2 - 1)
        delay = Math.max(0, delay + jitter)
      }

      console.log(
        `🔄 Retry attempt ${attempt + 1}/${maxRetries} after ${Math.round(delay)}ms`,
        { error: lastError.message }
      )

      // Call retry callback if provided
      if (onRetry) {
        onRetry(attempt + 1, lastError, delay)
      }

      // Wait before retry
      await new Promise(resolve => setTimeout(resolve, delay))
    }
  }

  // This should never be reached, but TypeScript doesn't know that
  throw lastError!
}

/**
 * Common error predicates for shouldRetry option
 */
export const retryPredicates = {
  /** Retry on network errors and 5xx responses */
  networkErrors: (error: Error): boolean => {
    const message = error.message.toLowerCase()
    return (
      message.includes('network') ||
      message.includes('timeout') ||
      message.includes('econnrefused') ||
      message.includes('enotfound') ||
      message.includes('etimedout') ||
      message.includes('fetch failed') ||
      message.includes('5')  // 500-level errors
    )
  },

  /** Retry on specific HTTP status codes */
  httpStatus: (retryCodes: number[]) => (error: Error): boolean => {
    const match = error.message.match(/status[:\s]+(\d+)/i)
    if (match) {
      const statusCode = parseInt(match[1], 10)
      return retryCodes.includes(statusCode)
    }
    return false
  },

  /** Never retry (useful for testing) */
  never: (): boolean => false,

  /** Always retry (default behavior) */
  always: (): boolean => true,
}

/**
 * Specialized retry for fetch requests
 * Automatically handles common HTTP error cases
 */
export async function retryFetch(
  input: RequestInfo | URL,
  init?: RequestInit,
  options?: RetryOptions
): Promise<Response> {
  return retryWithBackoff(
    async () => {
      const response = await fetch(input, init)

      // Throw on non-OK responses so they get retried
      if (!response.ok) {
        // HTTP 402 Payment Required is expected - not an error
        if (response.status === 402) {
          return response
        }

        // Don't retry 4xx errors (client errors) except 408, 429
        const shouldRetry4xx = [408, 429].includes(response.status)
        if (response.status >= 400 && response.status < 500 && !shouldRetry4xx) {
          throw new Error(
            `HTTP ${response.status}: ${response.statusText} (non-retryable)`
          )
        }

        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }

      return response
    },
    {
      ...options,
      shouldRetry: (error) => {
        // Don't retry explicit non-retryable errors
        if (error.message.includes('(non-retryable)')) {
          return false
        }
        // Use custom predicate if provided, otherwise use default
        return options?.shouldRetry
          ? options.shouldRetry(error)
          : retryPredicates.networkErrors(error)
      },
    }
  )
}
