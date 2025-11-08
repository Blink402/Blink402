import { FastifyPluginAsync } from 'fastify'
import { getPool } from '@blink402/database'
import { isRedisConnected, getRedis } from '@blink402/redis'

export const healthRoutes: FastifyPluginAsync = async (fastify) => {
  // Basic health check
  fastify.get('/', async (request, reply) => {
    return {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      redis: isRedisConnected() ? 'connected' : 'disconnected',
    }
  })

  // Detailed health check with DB and Redis
  fastify.get('/detailed', async (request, reply) => {
    const health: any = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      database: {
        connected: false,
        latency: 0,
      },
      redis: {
        connected: false,
        latency: 0,
      },
    }

    // Check database connection
    try {
      const start = Date.now()
      const pool = getPool()
      await pool.query('SELECT 1')
      health.database.connected = true
      health.database.latency = Date.now() - start
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
