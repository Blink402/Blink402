// Endpoint health checking and reliability utilities
import type { FastifyInstance } from 'fastify'
import { fetch } from 'undici'

// Configuration (can be overridden via env vars)
const config = {
  ENDPOINT_VALIDATION_TIMEOUT: parseInt(process.env.ENDPOINT_VALIDATION_TIMEOUT || '5000'),
  PREFLIGHT_CHECK_TIMEOUT: parseInt(process.env.PREFLIGHT_CHECK_TIMEOUT || '3000'),
  API_RETRY_MAX_ATTEMPTS: parseInt(process.env.API_RETRY_MAX_ATTEMPTS || '3'),
  API_RETRY_BASE_DELAY: parseInt(process.env.API_RETRY_BASE_DELAY || '1000'),
  CIRCUIT_BREAKER_FAILURE_THRESHOLD: parseFloat(process.env.CIRCUIT_BREAKER_FAILURE_THRESHOLD || '0.5'), // 50%
  CIRCUIT_BREAKER_MIN_ATTEMPTS: parseInt(process.env.CIRCUIT_BREAKER_MIN_ATTEMPTS || '10'),
  CIRCUIT_BREAKER_RESET_TIMEOUT: parseInt(process.env.CIRCUIT_BREAKER_RESET_TIMEOUT || '300000'), // 5 min
}

export interface EndpointValidationResult {
  valid: boolean
  error?: string
  statusCode?: number
  responseTime?: number
}

export interface HealthCheckResult {
  healthy: boolean
  error?: string
  statusCode?: number
  responseTime?: number
}

/**
 * Validates an endpoint during blink creation
 * Performs a thorough check to ensure the endpoint is reachable and responds correctly
 *
 * IMPORTANT: We now test the ACTUAL method (POST/GET) to catch cases where:
 * - OPTIONS/HEAD work but POST is blocked (IP-based blocking, anti-bot)
 * - 403/401 responses indicate the endpoint won't work from our servers
 */
export async function validateEndpoint(
  url: string,
  method: string = 'POST',
  logger?: FastifyInstance['log']
): Promise<EndpointValidationResult> {
  const startTime = Date.now()

  try {
    // Validate URL format
    let parsedUrl: URL
    try {
      parsedUrl = new URL(url)
    } catch (err) {
      return {
        valid: false,
        error: 'Invalid URL format'
      }
    }

    // Only allow HTTP/HTTPS
    if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
      return {
        valid: false,
        error: 'Only HTTP and HTTPS protocols are allowed'
      }
    }

    // Blocked status codes that indicate the endpoint won't work from our servers
    const blockedStatusCodes = [403, 401, 407]

    // For POST methods, actually test with POST (with empty/minimal body)
    // This catches cases where OPTIONS works but POST is blocked
    if (method === 'POST' || method === 'PUT' || method === 'PATCH') {
      try {
        const testResponse = await fetch(url, {
          method: method,
          headers: {
            'Content-Type': 'application/json',
            'User-Agent': 'Blink402-Validator/1.0'
          },
          body: JSON.stringify({}), // Empty body for validation
          signal: AbortSignal.timeout(config.ENDPOINT_VALIDATION_TIMEOUT)
        })

        const responseTime = Date.now() - startTime

        // Reject blocked status codes
        if (blockedStatusCodes.includes(testResponse.status)) {
          logger?.warn({ url, method, statusCode: testResponse.status }, 'Endpoint blocked our request')
          return {
            valid: false,
            error: `Endpoint returned ${testResponse.status} - this usually means the API blocks requests from our servers. Try a different API endpoint.`,
            statusCode: testResponse.status,
            responseTime
          }
        }

        // Accept 2xx, 3xx, 4xx (except blocked) - they mean endpoint exists
        if (testResponse.status < 500) {
          logger?.info({ url, method, responseTime, statusCode: testResponse.status }, `Endpoint validation passed (${method})`)
          return {
            valid: true,
            statusCode: testResponse.status,
            responseTime
          }
        }
      } catch (postError) {
        logger?.debug({ url, method, error: postError }, `${method} test failed, trying fallbacks`)
      }
    }

    // For GET methods or fallback: test with actual GET
    try {
      const getResponse = await fetch(url, {
        method: 'GET',
        headers: {
          'User-Agent': 'Blink402-Validator/1.0'
        },
        signal: AbortSignal.timeout(config.ENDPOINT_VALIDATION_TIMEOUT)
      })

      const responseTime = Date.now() - startTime

      // Reject blocked status codes
      if (blockedStatusCodes.includes(getResponse.status)) {
        logger?.warn({ url, method, statusCode: getResponse.status }, 'Endpoint blocked our request')
        return {
          valid: false,
          error: `Endpoint returned ${getResponse.status} - this usually means the API blocks requests from our servers. Try a different API endpoint.`,
          statusCode: getResponse.status,
          responseTime
        }
      }

      if (getResponse.status < 500) {
        logger?.info({ url, method, responseTime, statusCode: getResponse.status }, 'Endpoint validation passed (GET)')
        return {
          valid: true,
          statusCode: getResponse.status,
          responseTime
        }
      }

      return {
        valid: false,
        error: `Endpoint returned ${getResponse.status} status`,
        statusCode: getResponse.status,
        responseTime
      }
    } catch (getError) {
      // Final fallback: try OPTIONS (some APIs only allow this)
      logger?.debug({ url, error: getError }, 'GET failed, trying OPTIONS')
    }

    // Last resort: OPTIONS request
    const optionsResponse = await fetch(url, {
      method: 'OPTIONS',
      signal: AbortSignal.timeout(config.ENDPOINT_VALIDATION_TIMEOUT)
    })

    const responseTime = Date.now() - startTime

    if (optionsResponse.status < 500 && !blockedStatusCodes.includes(optionsResponse.status)) {
      logger?.info({ url, method, responseTime, statusCode: optionsResponse.status }, 'Endpoint validation passed (OPTIONS fallback)')
      return {
        valid: true,
        statusCode: optionsResponse.status,
        responseTime
      }
    }

    return {
      valid: false,
      error: `Endpoint returned ${optionsResponse.status} status`,
      statusCode: optionsResponse.status,
      responseTime
    }

  } catch (error) {
    const responseTime = Date.now() - startTime
    const errorMessage = error instanceof Error ? error.message : String(error)

    logger?.warn({ url, error: errorMessage, responseTime }, 'Endpoint validation failed')

    return {
      valid: false,
      error: errorMessage,
      responseTime
    }
  }
}

/**
 * Quick pre-flight health check before allowing payment
 * Faster timeout to avoid slowing down the payment flow
 */
export async function checkEndpointHealth(
  url: string,
  logger?: FastifyInstance['log']
): Promise<HealthCheckResult> {
  const startTime = Date.now()

  try {
    // Quick OPTIONS check
    const response = await fetch(url, {
      method: 'OPTIONS',
      signal: AbortSignal.timeout(config.PREFLIGHT_CHECK_TIMEOUT)
    })

    const responseTime = Date.now() - startTime

    // Consider anything under 500 as healthy
    const healthy = response.status < 500

    if (!healthy) {
      logger?.warn({ url, statusCode: response.status, responseTime }, 'Pre-flight health check failed')
    }

    return {
      healthy,
      statusCode: response.status,
      responseTime
    }

  } catch (error) {
    const responseTime = Date.now() - startTime
    const errorMessage = error instanceof Error ? error.message : String(error)

    logger?.warn({ url, error: errorMessage, responseTime }, 'Pre-flight health check error')

    return {
      healthy: false,
      error: errorMessage,
      responseTime
    }
  }
}

/**
 * Determines if an error is retryable (transient failure) or permanent
 */
export function isRetryableError(error: any, statusCode?: number): boolean {
  // Network errors are retryable
  if (error instanceof TypeError && error.message.includes('fetch')) {
    return true
  }

  // Timeout errors are retryable
  if (error.name === 'AbortError' || error.message?.includes('timeout')) {
    return true
  }

  // Connection errors are retryable
  if (error.code === 'ECONNREFUSED' || error.code === 'ENOTFOUND' || error.code === 'ETIMEDOUT') {
    return true
  }

  // HTTP status codes that are retryable
  if (statusCode) {
    // 502 Bad Gateway, 503 Service Unavailable, 504 Gateway Timeout
    if ([502, 503, 504].includes(statusCode)) {
      return true
    }

    // 429 Too Many Requests (should retry with backoff)
    if (statusCode === 429) {
      return true
    }
  }

  // Non-retryable: 4xx client errors (except 429), SSL errors, etc.
  return false
}

/**
 * Generic retry wrapper with exponential backoff
 * Only retries on transient failures
 */
export async function retryWithBackoff<T>(
  operation: () => Promise<T>,
  options: {
    maxAttempts?: number
    baseDelay?: number
    logger?: FastifyInstance['log']
    operationName?: string
  } = {}
): Promise<T> {
  const maxAttempts = options.maxAttempts || config.API_RETRY_MAX_ATTEMPTS
  const baseDelay = options.baseDelay || config.API_RETRY_BASE_DELAY
  const logger = options.logger
  const operationName = options.operationName || 'operation'

  let lastError: any
  let lastStatusCode: number | undefined

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const result = await operation()

      if (attempt > 1) {
        logger?.info({ attempt, operationName }, 'Operation succeeded after retry')
      }

      return result
    } catch (error) {
      lastError = error
      lastStatusCode = (error as any).statusCode

      const isRetryable = isRetryableError(error, lastStatusCode)

      if (!isRetryable || attempt >= maxAttempts) {
        logger?.error({
          attempt,
          operationName,
          error: error instanceof Error ? error.message : String(error),
          statusCode: lastStatusCode,
          isRetryable
        }, 'Operation failed (no more retries)')
        throw error
      }

      // Calculate exponential backoff delay: baseDelay * 2^(attempt-1)
      const delay = baseDelay * Math.pow(2, attempt - 1)

      logger?.warn({
        attempt,
        maxAttempts,
        operationName,
        error: error instanceof Error ? error.message : String(error),
        statusCode: lastStatusCode,
        nextRetryIn: delay
      }, 'Operation failed, retrying with backoff')

      // Wait before retry
      await new Promise(resolve => setTimeout(resolve, delay))
    }
  }

  // Should never reach here, but TypeScript needs it
  throw lastError
}

/**
 * Updates circuit breaker state for a blink
 * Auto-pauses blinks with high failure rates
 */
export async function updateCircuitBreaker(
  blinkId: string,
  slug: string,
  success: boolean,
  db: any,  // PostgreSQL pool
  logger?: FastifyInstance['log']
): Promise<void> {
  try {
    // Increment attempt counters
    const updateQuery = success
      ? `UPDATE blinks
         SET total_attempts = total_attempts + 1,
             consecutive_failures = 0,
             health_status = CASE
               WHEN health_status = 'unhealthy' THEN 'degraded'
               ELSE 'healthy'
             END,
             last_health_check = NOW()
         WHERE id = $1
         RETURNING total_attempts, failed_attempts, health_status`
      : `UPDATE blinks
         SET total_attempts = total_attempts + 1,
             failed_attempts = failed_attempts + 1,
             consecutive_failures = consecutive_failures + 1,
             last_health_check = NOW()
         WHERE id = $1
         RETURNING total_attempts, failed_attempts, consecutive_failures, health_status`

    const result = await db.query(updateQuery, [blinkId])

    if (result.rows.length === 0) {
      logger?.warn({ blinkId, slug }, 'Blink not found for circuit breaker update')
      return
    }

    const blink = result.rows[0]

    // Check if we should trip the circuit breaker
    if (!success && blink.total_attempts >= config.CIRCUIT_BREAKER_MIN_ATTEMPTS) {
      const failureRate = blink.failed_attempts / blink.total_attempts

      logger?.info({
        blinkId,
        slug,
        failureRate,
        totalAttempts: blink.total_attempts,
        failedAttempts: blink.failed_attempts,
        consecutiveFailures: blink.consecutive_failures
      }, 'Circuit breaker analysis')

      // Trip circuit breaker if failure rate exceeds threshold
      if (failureRate >= config.CIRCUIT_BREAKER_FAILURE_THRESHOLD) {
        await db.query(
          `UPDATE blinks
           SET status = 'paused',
               health_status = 'unhealthy'
           WHERE id = $1`,
          [blinkId]
        )

        logger?.error({
          blinkId,
          slug,
          failureRate,
          threshold: config.CIRCUIT_BREAKER_FAILURE_THRESHOLD,
          totalAttempts: blink.total_attempts,
          failedAttempts: blink.failed_attempts
        }, '🚨 Circuit breaker tripped - blink auto-paused due to high failure rate')

        // TODO: Notify creator via email/webhook
      } else if (failureRate >= config.CIRCUIT_BREAKER_FAILURE_THRESHOLD * 0.7) {
        // Degraded state at 70% of threshold
        await db.query(
          `UPDATE blinks
           SET health_status = 'degraded'
           WHERE id = $1`,
          [blinkId]
        )

        logger?.warn({
          blinkId,
          slug,
          failureRate,
          threshold: config.CIRCUIT_BREAKER_FAILURE_THRESHOLD
        }, '⚠️ Blink entering degraded state')
      }
    }

  } catch (error) {
    logger?.error({
      blinkId,
      slug,
      error: error instanceof Error ? error.message : String(error)
    }, 'Failed to update circuit breaker state')
    // Don't throw - circuit breaker updates shouldn't break the main flow
  }
}

/**
 * Get circuit breaker configuration (for debugging/monitoring)
 */
export function getCircuitBreakerConfig() {
  return { ...config }
}
