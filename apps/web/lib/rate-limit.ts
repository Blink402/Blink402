// Simple in-memory rate limiting for API routes
// For production scale, consider Redis-based solution (upstash-ratelimit)

interface RateLimitEntry {
  count: number
  resetAt: number
}

class RateLimiter {
  private limits: Map<string, RateLimitEntry> = new Map()
  private cleanupInterval: NodeJS.Timeout | null = null

  constructor() {
    // Cleanup expired entries every minute
    // DISABLED: setInterval prevents build completion on Windows
    // The cleanup will happen naturally as old entries expire when checked
    // Uncomment if memory usage becomes an issue in production:
    // if (typeof window === 'undefined' && process.env.NODE_ENV === 'production') {
    //   this.cleanupInterval = setInterval(() => {
    //     this.cleanup()
    //   }, 60 * 1000)
    // }
  }

  /**
   * Check if a request should be rate limited
   * @param identifier - IP address or wallet address
   * @param maxRequests - Maximum requests allowed
   * @param windowMs - Time window in milliseconds
   * @returns {allowed: boolean, remaining: number, resetAt: number}
   */
  check(
    identifier: string,
    maxRequests: number,
    windowMs: number
  ): { allowed: boolean; remaining: number; resetAt: number } {
    const now = Date.now()
    const entry = this.limits.get(identifier)

    if (!entry || now >= entry.resetAt) {
      // Create new entry
      const resetAt = now + windowMs
      this.limits.set(identifier, { count: 1, resetAt })
      return { allowed: true, remaining: maxRequests - 1, resetAt }
    }

    if (entry.count >= maxRequests) {
      // Rate limit exceeded
      return { allowed: false, remaining: 0, resetAt: entry.resetAt }
    }

    // Increment count
    entry.count++
    this.limits.set(identifier, entry)
    return { allowed: true, remaining: maxRequests - entry.count, resetAt: entry.resetAt }
  }

  /**
   * Clear rate limit for an identifier
   */
  clear(identifier: string): void {
    this.limits.delete(identifier)
  }

  /**
   * Remove expired entries
   */
  private cleanup(): void {
    const now = Date.now()
    for (const [key, entry] of this.limits.entries()) {
      if (now >= entry.resetAt) {
        this.limits.delete(key)
      }
    }
  }

  /**
   * Stop cleanup interval
   */
  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval)
      this.cleanupInterval = null
    }
  }
}

// Lazy-initialized rate limiter instance
// This prevents setInterval from running during Next.js build
let rateLimiter: RateLimiter | null = null

function getRateLimiter(): RateLimiter {
  if (!rateLimiter) {
    rateLimiter = new RateLimiter()
  }
  return rateLimiter
}

/**
 * Rate limit presets for different endpoints
 */
export const RATE_LIMITS = {
  // Actions endpoints - higher limit for public access
  ACTIONS: { maxRequests: 60, windowMs: 60 * 1000 }, // 60 requests per minute

  // x402 proxy - moderate limit
  PROXY: { maxRequests: 30, windowMs: 60 * 1000 }, // 30 requests per minute

  // API mutations - stricter limit
  CREATE: { maxRequests: 10, windowMs: 60 * 1000 }, // 10 creates per minute
  UPDATE: { maxRequests: 20, windowMs: 60 * 1000 }, // 20 updates per minute
  DELETE: { maxRequests: 10, windowMs: 60 * 1000 }, // 10 deletes per minute

  // Auth - very strict
  AUTH: { maxRequests: 5, windowMs: 60 * 1000 }, // 5 attempts per minute

  // General API - moderate
  API: { maxRequests: 100, windowMs: 60 * 1000 }, // 100 requests per minute
}

/**
 * Get client identifier from request
 * Prioritizes wallet address from auth, falls back to IP
 */
export function getClientIdentifier(
  wallet: string | null,
  ip: string | null
): string {
  if (wallet) return `wallet:${wallet}`
  if (ip) return `ip:${ip}`
  return 'anonymous'
}

/**
 * Get IP address from request headers
 */
export function getIpFromRequest(headers: Headers): string | null {
  // Check common proxy headers
  const forwarded = headers.get('x-forwarded-for')
  if (forwarded) {
    return forwarded.split(',')[0].trim()
  }

  const realIp = headers.get('x-real-ip')
  if (realIp) {
    return realIp
  }

  return null
}

/**
 * Apply rate limiting to a request
 * Returns null if allowed, or a Response if rate limited
 */
export function applyRateLimit(
  identifier: string,
  preset: { maxRequests: number; windowMs: number }
): { allowed: boolean; remaining: number; resetAt: number } {
  return getRateLimiter().check(identifier, preset.maxRequests, preset.windowMs)
}

/**
 * Create a rate limit response
 */
export function createRateLimitResponse(resetAt: number): Response {
  const retryAfter = Math.ceil((resetAt - Date.now()) / 1000)

  return new Response(
    JSON.stringify({
      success: false,
      error: 'Too many requests, please try again later',
    }),
    {
      status: 429,
      headers: {
        'Content-Type': 'application/json',
        'Retry-After': retryAfter.toString(),
        'X-RateLimit-Limit': '0',
        'X-RateLimit-Remaining': '0',
        'X-RateLimit-Reset': resetAt.toString(),
      },
    }
  )
}

/**
 * Add rate limit headers to response
 */
export function addRateLimitHeaders(
  headers: HeadersInit,
  limit: { maxRequests: number; remaining: number; resetAt: number }
): HeadersInit {
  return {
    ...headers,
    'X-RateLimit-Limit': limit.maxRequests.toString(),
    'X-RateLimit-Remaining': limit.remaining.toString(),
    'X-RateLimit-Reset': limit.resetAt.toString(),
  }
}

export default rateLimiter
