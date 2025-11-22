/**
 * Redis utilities for Blink402
 *
 * Provides:
 * - Connection management with automatic reconnection
 * - Distributed locking (prevents race conditions)
 * - Caching layer (blink metadata, dashboard data)
 * - Session storage (OAuth tokens, wallet sessions)
 * - Idempotency tracking (payment deduplication)
 * - Pub/sub for real-time updates
 */

import Redis, { Redis as RedisClient } from 'ioredis'
import { createLogger } from '@blink402/config'

const logger = createLogger('@blink402/redis')

// Singleton Redis client
let redisClient: RedisClient | null = null
let isConnected = false

/**
 * Initialize Redis connection
 * Call this once at app startup
 * Returns RedisClient on success, null on failure (for graceful degradation)
 */
export async function initRedis(url?: string): Promise<RedisClient | null> {
  if (redisClient && isConnected) {
    return redisClient
  }

  // Try multiple Redis URL sources in order of preference
  const redisUrl = url ||
                   process.env.REDIS_URL ||
                   process.env.REDIS_PUBLIC_URL ||
                   process.env.REDIS_PRIVATE_URL

  if (!redisUrl) {
    logger.warn('Redis URL not provided - server will continue without Redis')
    logger.warn('Set REDIS_URL, REDIS_PUBLIC_URL, or REDIS_PRIVATE_URL to enable Redis features')
    return null
  }

  logger.info(`Attempting to connect to Redis`, {
    url: redisUrl.replace(/:[^:@]+@/, ':***@')
  })

  redisClient = new Redis(redisUrl, {
    maxRetriesPerRequest: 3,
    enableOfflineQueue: true,
    connectTimeout: 15000, // Increased from 10s to 15s
    retryStrategy: (times) => {
      if (times > 3) { // Reduced retries for faster failure
        logger.error(`Redis retry limit exceeded`, undefined, { attempts: times })
        return null
      }
      const delay = Math.min(times * 1000, 3000)
      logger.info(`Redis reconnecting`, { delay, attempt: times })
      return delay
    },
    lazyConnect: true,
    // Additional Railway-specific options
    keepAlive: 30000, // Keep connection alive
    family: 4, // Force IPv4 (Railway uses IPv4)
    enableReadyCheck: true,
  })

  // Event handlers
  redisClient.on('connect', () => {
    logger.info('Redis connected')
  })

  redisClient.on('ready', () => {
    logger.info('Redis ready')
    isConnected = true
  })

  redisClient.on('error', (err) => {
    logger.error('Redis error', err)
    isConnected = false
  })

  redisClient.on('close', () => {
    logger.warn('Redis connection closed')
    isConnected = false
  })

  redisClient.on('reconnecting', () => {
    logger.info('Redis reconnecting')
  })

  // Connect and wait for ready state
  try {
    await redisClient.connect()

    // Wait for ready event (with extended timeout for Railway)
    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Redis connection timeout (20s). Check Redis service status in Railway.'))
      }, 20000) // Extended timeout for Railway networking

      const client = redisClient!

      if (client.status === 'ready') {
        clearTimeout(timeout)
        resolve()
      } else {
        client.once('ready', () => {
          clearTimeout(timeout)
          resolve()
        })
        client.once('error', (err) => {
          clearTimeout(timeout)
          reject(err)
        })
      }
    })

    // Verify with ping
    await redisClient!.ping()
    logger.info('Redis connection verified')
  } catch (error) {
    logger.error('Redis connection failed', error)
    // Clean up on failure
    try {
      if (redisClient) {
        await redisClient.disconnect()
      }
    } catch {}
    redisClient = null
    isConnected = false
    // Return null instead of throwing - allows graceful degradation
    logger.warn('Redis unavailable - server will continue with degraded functionality')
    return null
  }

  return redisClient
}

/**
 * Get existing Redis client
 */
export function getRedis(): RedisClient {
  if (!redisClient) {
    throw new Error('Redis not initialized. Call initRedis() first.')
  }
  return redisClient
}

/**
 * Close Redis connection gracefully
 */
export async function closeRedis(): Promise<void> {
  if (redisClient) {
    await redisClient.quit()
    redisClient = null
    isConnected = false
    logger.info('Redis connection closed')
  }
}

/**
 * Check if Redis is connected
 */
export function isRedisConnected(): boolean {
  return isConnected && redisClient !== null
}

// ========== DISTRIBUTED LOCKING ==========

export interface LockOptions {
  ttl?: number // Lock TTL in milliseconds (default: 10000 = 10s)
  retries?: number // Number of retries (default: 3)
  retryDelay?: number // Delay between retries in ms (default: 100)
}

/**
 * Acquire a distributed lock using Redis
 *
 * Example:
 * ```ts
 * const lock = await acquireLock('payment:ref123', { ttl: 5000 })
 * if (lock) {
 *   try {
 *     // Critical section - only one instance executes this
 *     await processPayment()
 *   } finally {
 *     await releaseLock('payment:ref123', lock)
 *   }
 * }
 * ```
 */
export async function acquireLock(
  key: string,
  options: LockOptions = {}
): Promise<string | null> {
  const { ttl = 10000, retries = 3, retryDelay = 100 } = options
  const redis = getRedis()
  const lockValue = `${Date.now()}-${Math.random()}`

  for (let i = 0; i < retries; i++) {
    try {
      // CRITICAL FIX: Use sendCommand to bypass TypeScript overload issues
      // ioredis TypeScript definitions don't properly support SET with NX + PX
      const result = await redis.call(
        'SET',
        `lock:${key}`,
        lockValue,
        'NX', // only set if not exists
        'PX', // milliseconds
        ttl.toString()
      ) as string | null

      logger.debug('Lock acquisition attempt', {
        key,
        attempt: i + 1,
        retries,
        result,
        resultType: typeof result
      })

      if (result === 'OK') {
        logger.debug('Lock acquired', { key, ttl })
        return lockValue
      }

      if (result === null) {
        logger.debug('Lock exists', { key })
      } else {
        logger.warn('Unexpected lock result', { key, result })
      }
    } catch (error) {
      logger.error('Error acquiring lock', error, { key })
    }

    // Wait before retry
    if (i < retries - 1) {
      await new Promise(resolve => setTimeout(resolve, retryDelay))
    }
  }

  logger.warn('Failed to acquire lock after retries', { key, retries })
  return null // Failed to acquire lock
}

/**
 * Release a distributed lock
 */
export async function releaseLock(key: string, lockValue: string): Promise<boolean> {
  const redis = getRedis()

  // Lua script to ensure we only delete our own lock
  const script = `
    if redis.call("get", KEYS[1]) == ARGV[1] then
      return redis.call("del", KEYS[1])
    else
      return 0
    end
  `

  const result = await redis.eval(script, 1, `lock:${key}`, lockValue)
  return result === 1
}

/**
 * CRITICAL FIX: Queue-based lock acquisition to prevent race conditions
 *
 * This function eliminates the race window in acquireLock() by using a Redis sorted set (ZADD)
 * to create an ordered queue of lock requests. This ensures only one process at a time can
 * attempt lock acquisition, preventing duplicate payments and execution.
 *
 * How it works:
 * 1. Add lock request to queue with timestamp score
 * 2. Check if we're first in queue (ZRANGE 0 0)
 * 3. Only attempt lock acquisition if we're first
 * 4. On success, remove from queue
 * 5. On failure or timeout, cleanup queue entry
 *
 * Example:
 * ```ts
 * const lock = await acquireLockSafe('payment:ref123', { ttl: 5000, retries: 5 })
 * if (lock) {
 *   try {
 *     await processPayment()
 *   } finally {
 *     await releaseLock('payment:ref123', lock)
 *   }
 * }
 * ```
 */
export async function acquireLockSafe(
  key: string,
  options: LockOptions = {}
): Promise<string | null> {
  const { ttl = 10000, retries = 5, retryDelay = 200 } = options
  const redis = getRedis()
  const lockValue = `${Date.now()}-${Math.random()}`
  const queueKey = `queue:${key}`

  try {
    // Add self to queue with score = timestamp
    const queuePosition = await redis.zadd(queueKey, Date.now(), lockValue)

    logger.debug('Added to lock queue', { key, lockValue, queuePosition })

    for (let i = 0; i < retries; i++) {
      // Check if we're first in queue
      const firstInQueue = await redis.zrange(queueKey, 0, 0)

      if (!firstInQueue || firstInQueue.length === 0 || firstInQueue[0] !== lockValue) {
        // Not our turn yet - wait based on queue position
        const currentPosition = await redis.zrank(queueKey, lockValue)
        const delay = retryDelay * ((currentPosition || 0) + 1)

        logger.debug('Not first in queue, waiting', {
          key,
          currentPosition,
          firstInQueue: firstInQueue[0],
          delay
        })

        await new Promise(resolve => setTimeout(resolve, delay))
        continue
      }

      // We're first in queue - try to acquire lock atomically
      const result = await redis.call(
        'SET',
        `lock:${key}`,
        lockValue,
        'NX',
        'PX',
        ttl.toString()
      ) as string | null

      if (result === 'OK') {
        // Successfully acquired - remove from queue
        await redis.zrem(queueKey, lockValue)

        // Clean up queue after 60s (in case of stale entries)
        await redis.expire(queueKey, 60)

        logger.debug('Lock acquired safely (queue-based)', { key, ttl, attempt: i + 1 })
        return lockValue
      }

      // Lock still held by someone else - wait and retry
      logger.debug('Lock held, retrying', { key, attempt: i + 1, retries })

      if (i < retries - 1) {
        await new Promise(resolve => setTimeout(resolve, retryDelay))
      }
    }

    // Failed to acquire after all retries
    logger.warn('Failed to acquire safe lock after retries', { key, retries })
    return null

  } catch (error) {
    logger.error('Error in safe lock acquisition', error, { key })
    return null
  } finally {
    // Always clean up our queue entry if we failed
    try {
      await redis.zrem(queueKey, lockValue)
    } catch (cleanupError) {
      logger.error('Error cleaning up queue entry', cleanupError, { key, lockValue })
    }
  }
}

/**
 * Execute a function with distributed lock (original implementation)
 */
export async function withLock<T>(
  key: string,
  fn: () => Promise<T>,
  options?: LockOptions
): Promise<T | null> {
  const lock = await acquireLock(key, options)

  if (!lock) {
    logger.warn('Failed to acquire lock', { key })
    return null
  }

  try {
    return await fn()
  } finally {
    await releaseLock(key, lock)
  }
}

/**
 * CRITICAL FIX: Execute function with safe queue-based lock
 *
 * This is the production-safe version that prevents race conditions.
 * Use this for critical operations like payment processing.
 */
export async function withLockSafe<T>(
  key: string,
  fn: () => Promise<T>,
  options?: LockOptions
): Promise<T | null> {
  const lock = await acquireLockSafe(key, options)

  if (!lock) {
    logger.warn('Failed to acquire safe lock', { key })
    return null
  }

  try {
    return await fn()
  } finally {
    await releaseLock(key, lock)
  }
}

// ========== CACHING ==========

/**
 * Cache a value with optional TTL
 */
export async function setCache<T = unknown>(
  key: string,
  value: T,
  ttlSeconds?: number
): Promise<void> {
  const redis = getRedis()
  const serialized = JSON.stringify(value)

  if (ttlSeconds) {
    await redis.setex(`cache:${key}`, ttlSeconds, serialized)
  } else {
    await redis.set(`cache:${key}`, serialized)
  }
}

/**
 * Get a cached value
 */
export async function getCache<T>(key: string): Promise<T | null> {
  const redis = getRedis()
  const value = await redis.get(`cache:${key}`)

  if (!value) return null

  try {
    return JSON.parse(value) as T
  } catch {
    return null
  }
}

/**
 * Delete a cached value
 */
export async function deleteCache(key: string): Promise<void> {
  const redis = getRedis()
  await redis.del(`cache:${key}`)
}

/**
 * Cache with automatic revalidation
 */
export async function getCacheOrFetch<T>(
  key: string,
  fetchFn: () => Promise<T>,
  ttlSeconds: number = 300 // 5 minutes default
): Promise<T> {
  const cached = await getCache<T>(key)

  if (cached !== null) {
    return cached
  }

  const fresh = await fetchFn()
  await setCache(key, fresh, ttlSeconds)
  return fresh
}

// ========== SESSION STORAGE ==========

/**
 * Store session data (OAuth tokens, wallet sessions)
 */
export async function setSession<T = unknown>(
  sessionId: string,
  data: T,
  ttlSeconds: number = 86400 // 24 hours default
): Promise<void> {
  const redis = getRedis()
  await redis.setex(`session:${sessionId}`, ttlSeconds, JSON.stringify(data))
}

/**
 * Get session data
 */
export async function getSession<T>(sessionId: string): Promise<T | null> {
  const redis = getRedis()
  const data = await redis.get(`session:${sessionId}`)

  if (!data) return null

  try {
    return JSON.parse(data) as T
  } catch {
    return null
  }
}

/**
 * Delete session
 */
export async function deleteSession(sessionId: string): Promise<void> {
  const redis = getRedis()
  await redis.del(`session:${sessionId}`)
}

/**
 * Extend session TTL
 */
export async function extendSession(sessionId: string, ttlSeconds: number): Promise<void> {
  const redis = getRedis()
  await redis.expire(`session:${sessionId}`, ttlSeconds)
}

// ========== IDEMPOTENCY TRACKING ==========

/**
 * Check if request is duplicate (for idempotency)
 */
export async function isDuplicate(
  idempotencyKey: string,
  ttlSeconds: number = 3600 // 1 hour
): Promise<boolean> {
  const redis = getRedis()
  const result = await redis.set(
    `idempotency:${idempotencyKey}`,
    '1',
    'EX',
    ttlSeconds,
    'NX'
  )

  return result !== 'OK' // Returns true if already exists
}

/**
 * Store idempotent response
 */
export async function setIdempotentResponse<T = unknown>(
  idempotencyKey: string,
  response: T,
  ttlSeconds: number = 3600
): Promise<void> {
  const redis = getRedis()
  await redis.setex(
    `idempotency:response:${idempotencyKey}`,
    ttlSeconds,
    JSON.stringify(response)
  )
}

/**
 * Get idempotent response
 */
export async function getIdempotentResponse<T>(
  idempotencyKey: string
): Promise<T | null> {
  const redis = getRedis()
  const response = await redis.get(`idempotency:response:${idempotencyKey}`)

  if (!response) return null

  try {
    return JSON.parse(response) as T
  } catch {
    return null
  }
}

// ========== PUB/SUB ==========

/**
 * Publish message to channel
 */
export async function publish(channel: string, message: any): Promise<void> {
  const redis = getRedis()
  await redis.publish(channel, JSON.stringify(message))
}

/**
 * Subscribe to channel
 */
export async function subscribe(
  channel: string,
  callback: (message: any) => void
): Promise<RedisClient> {
  const subscriber = new Redis(process.env.REDIS_URL!)

  await subscriber.subscribe(channel)

  subscriber.on('message', (ch, msg) => {
    if (ch === channel) {
      try {
        callback(JSON.parse(msg))
      } catch {
        callback(msg)
      }
    }
  })

  return subscriber
}

// ========== COUNTER & ANALYTICS ==========

/**
 * Increment counter
 */
export async function incrementCounter(key: string, amount: number = 1): Promise<number> {
  const redis = getRedis()
  return await redis.incrby(`counter:${key}`, amount)
}

/**
 * Get counter value
 */
export async function getCounter(key: string): Promise<number> {
  const redis = getRedis()
  const value = await redis.get(`counter:${key}`)
  return value ? parseInt(value, 10) : 0
}

/**
 * Track rate limit (sliding window)
 */
export async function checkRateLimit(
  key: string,
  limit: number,
  windowSeconds: number
): Promise<{ allowed: boolean; remaining: number }> {
  const redis = getRedis()
  const now = Date.now()
  const windowStart = now - (windowSeconds * 1000)

  // Remove old entries
  await redis.zremrangebyscore(`ratelimit:${key}`, 0, windowStart)

  // Count entries in window
  const count = await redis.zcard(`ratelimit:${key}`)

  if (count >= limit) {
    return { allowed: false, remaining: 0 }
  }

  // Add new entry
  await redis.zadd(`ratelimit:${key}`, now, `${now}-${Math.random()}`)
  await redis.expire(`ratelimit:${key}`, windowSeconds)

  return { allowed: true, remaining: limit - count - 1 }
}

// ========== VIEW TRACKING (REWARD BLINKS) ==========

/**
 * Track view for reward blinks - survives container restarts
 * Stores view data with 15 minute expiration
 */
export async function trackView(params: {
  reference: string
  wallet?: string
  ip?: string
}): Promise<void> {
  const redis = getRedis()
  const { reference, wallet, ip } = params

  const data = {
    timestamp: Date.now(),
    wallet,
    ip
  }

  await redis.setex(
    `view:${reference}`,
    15 * 60, // 15 minutes TTL
    JSON.stringify(data)
  )
}

/**
 * Get view tracking data for a reference
 * Returns null if view not found or expired
 */
export async function getViewData(reference: string): Promise<{
  timestamp: number
  wallet?: string
  ip?: string
} | null> {
  const redis = getRedis()
  const data = await redis.get(`view:${reference}`)

  if (!data) return null

  try {
    return JSON.parse(data)
  } catch {
    return null
  }
}

/**
 * Delete view tracking data after successful claim (one-time use)
 */
export async function deleteViewData(reference: string): Promise<void> {
  const redis = getRedis()
  await redis.del(`view:${reference}`)
}

/**
 * Check if IP has already claimed (abuse prevention)
 * Returns true if IP has claimed, false otherwise
 */
export async function hasIPClaimed(ip: string): Promise<boolean> {
  const redis = getRedis()
  const claimed = await redis.get(`ip:claimed:${ip}`)
  return claimed === '1'
}

/**
 * Mark IP as claimed (24 hour expiration for abuse prevention)
 */
export async function markIPClaimed(ip: string): Promise<void> {
  const redis = getRedis()
  await redis.setex(
    `ip:claimed:${ip}`,
    24 * 60 * 60, // 24 hours TTL
    '1'
  )
}

// ========== FIX PACK 7: CHALLENGE/NONCE TRACKING FOR ANTI-SPAM ==========

/**
 * Store challenge nonce with expiration (prevents replay attacks)
 * Returns true if nonce was stored (first use), false if already exists
 */
export async function storeChallenge(nonce: string, data: {
  wallet: string
  blinkId: string | number
  timestamp: number
}, ttlSeconds: number = 600): Promise<boolean> {
  const redis = getRedis()
  const result = await redis.set(
    `challenge:${nonce}`,
    JSON.stringify(data),
    'EX',
    ttlSeconds,
    'NX'
  )
  return result === 'OK'
}

/**
 * Get challenge data by nonce (for verification)
 */
export async function getChallenge(nonce: string): Promise<{
  wallet: string
  blinkId: string | number
  timestamp: number
} | null> {
  const redis = getRedis()
  const data = await redis.get(`challenge:${nonce}`)
  if (!data) return null
  try {
    return JSON.parse(data)
  } catch {
    return null
  }
}

/**
 * Mark nonce as used (prevent replay attacks)
 * Returns true if nonce was marked (first use), false if already used
 */
export async function markNonceUsed(nonce: string, ttlSeconds: number = 3600): Promise<boolean> {
  const redis = getRedis()
  const result = await redis.set(
    `nonce:used:${nonce}`,
    '1',
    'EX',
    ttlSeconds,
    'NX'
  )
  return result === 'OK'
}

/**
 * Check if nonce has been used
 */
export async function isNonceUsed(nonce: string): Promise<boolean> {
  const redis = getRedis()
  const used = await redis.get(`nonce:used:${nonce}`)
  return used === '1'
}
