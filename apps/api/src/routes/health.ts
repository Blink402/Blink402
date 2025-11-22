import { FastifyPluginAsync } from 'fastify'
import { getPool, getPoolHealth } from '@blink402/database'
import { isRedisConnected, getRedis } from '@blink402/redis'

// ========== IN-MEMORY METRICS TRACKING ==========
// Simple in-memory metrics for uptime calculations
// For production, consider using Redis or a time-series database
interface RequestMetrics {
  totalRequests: number
  successfulRequests: number
  failedRequests: number
  latencies: number[] // Last 100 request latencies
  startTime: Date
}

const metrics: RequestMetrics = {
  totalRequests: 0,
  successfulRequests: 0,
  failedRequests: 0,
  latencies: [],
  startTime: new Date()
}

// Helper to calculate percentiles
function calculatePercentile(sorted: number[], percentile: number): number {
  if (sorted.length === 0) return 0
  const index = Math.ceil((percentile / 100) * sorted.length) - 1
  return sorted[Math.max(0, index)]
}

// Helper to format bytes to MB
function formatMemory(bytes: number): string {
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`
}

export const healthRoutes: FastifyPluginAsync = async (fastify) => {
  // Register hooks to track request metrics
  fastify.addHook('onRequest', async (request, reply) => {
    ;(request as any).startTime = Date.now()
    metrics.totalRequests++
  })

  fastify.addHook('onResponse', async (request, reply) => {
    const latency = Date.now() - ((request as any).startTime || Date.now())

    // Track latency (keep last 100 requests)
    metrics.latencies.push(latency)
    if (metrics.latencies.length > 100) {
      metrics.latencies.shift()
    }

    // Track success/failure
    if (reply.statusCode >= 200 && reply.statusCode < 400) {
      metrics.successfulRequests++
    } else if (reply.statusCode >= 500) {
      metrics.failedRequests++
    }
  })

  // Basic health check
  fastify.get('/', {
    schema: {
      description: 'Basic health check endpoint',
      tags: ['health'],
      response: {
        200: {
          type: 'object',
          properties: {
            status: { type: 'string', example: 'healthy' },
            timestamp: { type: 'string', format: 'date-time' },
            uptime: { type: 'number', description: 'Server uptime in seconds' },
            redis: { type: 'string', enum: ['connected', 'disconnected'] }
          }
        }
      }
    }
  }, async (request, reply) => {
    return {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      redis: isRedisConnected() ? 'connected' : 'disconnected',
    }
  })

  // Detailed health check with DB and Redis
  fastify.get('/detailed', {
    schema: {
      description: 'Production health dashboard with detailed metrics',
      tags: ['health'],
      response: {
        200: {
          type: 'object',
          properties: {
            status: { type: 'string', enum: ['healthy', 'degraded'] },
            timestamp: { type: 'string', format: 'date-time' },
            uptime: {
              type: 'object',
              properties: {
                seconds: { type: 'number' },
                formatted: { type: 'string', example: '1d 2h 34m 56s' }
              }
            },
            memory: {
              type: 'object',
              properties: {
                heapUsed: { type: 'string', example: '45.23 MB' },
                heapTotal: { type: 'string', example: '128.00 MB' },
                heapUsedPercent: { type: 'string', example: '35.34%' },
                rss: { type: 'string' },
                external: { type: 'string' },
                arrayBuffers: { type: 'string' }
              }
            },
            database: {
              type: 'object',
              properties: {
                connected: { type: 'boolean' },
                latency: { type: 'number', description: 'Database query latency in ms' },
                pool: {
                  type: 'object',
                  properties: {
                    total: { type: 'number', description: 'Total connections in pool' },
                    idle: { type: 'number', description: 'Idle connections' },
                    waiting: { type: 'number', description: 'Waiting connections' },
                    max: { type: 'number', description: 'Max pool size' }
                  }
                }
              }
            },
            redis: {
              type: 'object',
              properties: {
                connected: { type: 'boolean' },
                latency: { type: 'number', description: 'Redis PING latency in ms' }
              }
            },
            requests: {
              type: 'object',
              properties: {
                total: { type: 'number' },
                successful: { type: 'number' },
                failed: { type: 'number' },
                errorRate: { type: 'string', example: '1.23%' },
                uptime: { type: 'string', example: '99.87%', description: 'Success rate' },
                latency: {
                  type: 'object',
                  properties: {
                    p50: { type: 'number', description: 'Median latency in ms' },
                    p95: { type: 'number', description: '95th percentile latency' },
                    p99: { type: 'number', description: '99th percentile latency' },
                    samples: { type: 'number', description: 'Number of samples (last 100 requests)' }
                  }
                }
              }
            }
          }
        },
        503: {
          type: 'object',
          description: 'Service degraded (DB or Redis unavailable)',
          properties: {
            status: { type: 'string', enum: ['degraded'] }
          }
        }
      }
    }
  }, async (request, reply) => {
    const memUsage = process.memoryUsage()
    const sortedLatencies = [...metrics.latencies].sort((a, b) => a - b)
    const uptimeSeconds = Date.now() - metrics.startTime.getTime() / 1000

    const health: any = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: {
        seconds: Math.floor(process.uptime()),
        formatted: formatUptime(process.uptime())
      },
      memory: {
        heapUsed: formatMemory(memUsage.heapUsed),
        heapTotal: formatMemory(memUsage.heapTotal),
        heapUsedPercent: ((memUsage.heapUsed / memUsage.heapTotal) * 100).toFixed(2) + '%',
        rss: formatMemory(memUsage.rss),
        external: formatMemory(memUsage.external),
        arrayBuffers: formatMemory(memUsage.arrayBuffers || 0)
      },
      database: {
        connected: false,
        latency: 0,
        pool: {
          total: 0,
          idle: 0,
          waiting: 0,
          max: 0
        }
      },
      redis: {
        connected: false,
        latency: 0,
      },
      requests: {
        total: metrics.totalRequests,
        successful: metrics.successfulRequests,
        failed: metrics.failedRequests,
        errorRate: metrics.totalRequests > 0
          ? ((metrics.failedRequests / metrics.totalRequests) * 100).toFixed(2) + '%'
          : '0%',
        uptime: metrics.totalRequests > 0
          ? (((metrics.successfulRequests / metrics.totalRequests) * 100).toFixed(2) + '%')
          : '100%',
        latency: {
          p50: sortedLatencies.length > 0 ? calculatePercentile(sortedLatencies, 50) : 0,
          p95: sortedLatencies.length > 0 ? calculatePercentile(sortedLatencies, 95) : 0,
          p99: sortedLatencies.length > 0 ? calculatePercentile(sortedLatencies, 99) : 0,
          samples: sortedLatencies.length
        }
      }
    }

    // Check database connection + pool stats
    try {
      const start = Date.now()
      const pool = getPool()
      await pool.query('SELECT 1')
      health.database.connected = true
      health.database.latency = Date.now() - start

      // Get connection pool stats using the new health function
      const poolHealth = getPoolHealth()
      health.database.pool = {
        total: poolHealth.metrics?.totalCount || 0,
        idle: poolHealth.metrics?.idleCount || 0,
        waiting: poolHealth.metrics?.waitingCount || 0,
        max: 40 // Pool max connections from connection module config
      }
    } catch (error) {
      health.status = 'degraded'
      health.database.connected = false
      fastify.log.error({ error }, 'Database health check failed')
    }

    // Check Redis connection
    try {
      if (isRedisConnected()) {
        const start = Date.now()
        const redis = getRedis()
        await redis.ping()
        health.redis.connected = true
        health.redis.latency = Date.now() - start
      }
    } catch (error) {
      health.status = 'degraded'
      health.redis.connected = false
      fastify.log.error({ error }, 'Redis health check failed')
    }

    const statusCode = health.status === 'healthy' ? 200 : 503
    return reply.code(statusCode).send(health)
  })
}

// Helper to format uptime in human-readable format
function formatUptime(seconds: number): string {
  const days = Math.floor(seconds / 86400)
  const hours = Math.floor((seconds % 86400) / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  const secs = Math.floor(seconds % 60)

  const parts = []
  if (days > 0) parts.push(`${days}d`)
  if (hours > 0) parts.push(`${hours}h`)
  if (minutes > 0) parts.push(`${minutes}m`)
  parts.push(`${secs}s`)

  return parts.join(' ')
}
