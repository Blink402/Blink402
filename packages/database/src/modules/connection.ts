/**
 * Database Connection Module
 * Handles PostgreSQL pool management, health checks, and cleanup
 */

import { Pool } from 'pg'
import { createLogger } from '@blink402/config'

const logger = createLogger('@blink402/database:connection')

// PostgreSQL error interface
export interface PostgresError extends Error {
  code?: string
  detail?: string
  table?: string
  constraint?: string
}

// Type guard for PostgreSQL errors
export function isPostgresError(error: unknown): error is PostgresError {
  return error instanceof Error && 'code' in error
}

// Singleton pool instance
let pool: Pool | null = null

// Pool configuration constants
const POOL_CONFIG = {
  max: 40,
  min: 5,
  idleTimeoutMillis: 60000,
  connectionTimeoutMillis: 10000,
  query_timeout: 30000,
  statement_timeout: 30000,
  allowExitOnIdle: false,
} as const

// Health check interval (5 seconds)
const HEALTH_CHECK_INTERVAL = 5000

// Pool saturation thresholds
const SATURATION_WARNING_THRESHOLD = 5
const SATURATION_CRITICAL_THRESHOLD = 15

/**
 * Get or create the PostgreSQL connection pool
 * Lazy initialization prevents database connection during build time
 */
export function getPool(): Pool {
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL not configured - cannot connect to database')
  }

  if (!pool) {
    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ...POOL_CONFIG,
    })

    // Handle unexpected errors on idle clients
    pool.on('error', (err, client) => {
      logger.error('Unexpected error on idle database client', err, {
        code: isPostgresError(err) ? err.code : undefined,
        detail: isPostgresError(err) ? err.detail : undefined,
        poolMetrics: getPoolMetrics(),
      })
    })

    // Monitor pool health
    startHealthMonitoring()

    logger.info('Database connection pool created', POOL_CONFIG)
  }

  return pool
}

/**
 * Get current pool metrics
 */
export function getPoolMetrics() {
  if (!pool) return null

  return {
    totalCount: pool.totalCount,
    idleCount: pool.idleCount,
    waitingCount: pool.waitingCount,
    lastMetricsUpdate: Date.now(),
  }
}

/**
 * Get pool health status
 */
export function getPoolHealth(): {
  connected: boolean
  metrics: ReturnType<typeof getPoolMetrics>
  status: 'healthy' | 'degraded' | 'saturated'
} {
  if (!pool) {
    return {
      connected: false,
      metrics: null,
      status: 'degraded',
    }
  }

  const metrics = getPoolMetrics()!
  let status: 'healthy' | 'degraded' | 'saturated' = 'healthy'

  if (metrics.waitingCount > SATURATION_CRITICAL_THRESHOLD) {
    status = 'saturated'
  } else if (metrics.waitingCount > SATURATION_WARNING_THRESHOLD) {
    status = 'degraded'
  }

  return {
    connected: true,
    metrics,
    status,
  }
}

/**
 * Start health monitoring interval
 */
function startHealthMonitoring() {
  setInterval(() => {
    const metrics = getPoolMetrics()
    if (!metrics) return

    if (metrics.waitingCount > SATURATION_CRITICAL_THRESHOLD) {
      logger.error('Database pool saturated!', undefined, {
        ...metrics,
        severity: 'CRITICAL',
      })
    } else if (metrics.waitingCount > SATURATION_WARNING_THRESHOLD) {
      logger.warn('Database pool under pressure', {
        ...metrics,
        severity: 'WARNING',
      })
    } else {
      logger.debug('Database pool metrics', metrics)
    }
  }, HEALTH_CHECK_INTERVAL)
}

/**
 * Test database connection
 */
export async function testConnection(): Promise<boolean> {
  try {
    const result = await getPool().query('SELECT NOW()')
    return result.rows.length > 0
  } catch (error) {
    logger.error('Database connection test failed', error as Error)
    return false
  }
}

/**
 * Close the database pool
 * Should only be called during graceful shutdown
 */
export async function closePool(): Promise<void> {
  if (pool) {
    await pool.end()
    pool = null
    logger.info('Database connection pool closed')
  }
}
