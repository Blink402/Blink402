import { FastifyPluginAsync } from 'fastify'
import { getRedis, isRedisConnected } from '@blink402/redis'

export const adminRoutes: FastifyPluginAsync = async (fastify) => {
  // Clear all payment locks
  fastify.post('/clear-locks', async (request, reply) => {
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
