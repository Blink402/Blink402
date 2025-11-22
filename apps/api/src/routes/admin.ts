import { FastifyPluginAsync } from 'fastify'
import { getRedis, isRedisConnected } from '@blink402/redis'
import { getAdminConfig } from '@blink402/config'

/**
 * Verify admin API key from request headers
 */
function verifyAdminAuth(request: any, reply: any): boolean {
  const adminConfig = getAdminConfig()

  // If no admin key is configured, reject all requests
  if (!adminConfig.isEnabled) {
    reply.code(503).send({
      error: 'Admin endpoints disabled',
      message: 'ADMIN_API_KEY environment variable not configured'
    })
    return false
  }

  const providedKey = request.headers['x-admin-key']

  if (!providedKey) {
    reply.code(401).send({
      error: 'Unauthorized',
      message: 'Missing X-Admin-Key header'
    })
    return false
  }

  if (providedKey !== adminConfig.apiKey) {
    reply.code(403).send({
      error: 'Forbidden',
      message: 'Invalid admin API key'
    })
    return false
  }

  return true
}

export const adminRoutes: FastifyPluginAsync = async (fastify) => {
  // Clear all payment locks
  fastify.post('/clear-locks', async (request, reply) => {
    // Verify authentication
    if (!verifyAdminAuth(request, reply)) {
      return
    }

    if (!isRedisConnected()) {
      return reply.code(503).send({ error: 'Redis not connected' })
    }

    try {
      const redis = getRedis()
      const keys = await redis.keys('lock:payment:*')

      if (keys.length === 0) {
        return reply.send({ message: 'No locks found', cleared: 0 })
      }

      let cleared = 0
      for (const key of keys) {
        await redis.del(key)
        cleared++
      }

      fastify.log.info({ cleared }, 'Cleared payment locks')
      return reply.send({
        message: `Cleared ${cleared} payment locks`,
        cleared,
        keys: keys.map(k => k.replace('lock:payment:', ''))
      })
    } catch (error) {
      fastify.log.error({ error }, 'Failed to clear locks')
      return reply.code(500).send({ error: 'Failed to clear locks' })
    }
  })

  // Clear all blink cache
  fastify.post('/clear-cache', async (request, reply) => {
    // Verify authentication
    if (!verifyAdminAuth(request, reply)) {
      return
    }

    if (!isRedisConnected()) {
      return reply.code(503).send({ error: 'Redis not connected' })
    }

    try {
      const redis = getRedis()
      const keys = await redis.keys('cache:blink:*')

      if (keys.length === 0) {
        return reply.send({ message: 'No cached blinks found', cleared: 0 })
      }

      let cleared = 0
      for (const key of keys) {
        await redis.del(key)
        cleared++
      }

      fastify.log.info({ cleared }, 'Cleared blink cache')
      return reply.send({
        message: `Cleared ${cleared} cached blink(s)`,
        cleared,
        keys: keys.map(k => k.replace('cache:blink:', ''))
      })
    } catch (error) {
      fastify.log.error({ error }, 'Failed to clear cache')
      return reply.code(500).send({ error: 'Failed to clear cache' })
    }
  })
}
