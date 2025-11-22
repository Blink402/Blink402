import { FastifyPluginAsync, FastifyRequest, FastifyReply } from 'fastify'
import { getDashboardData } from '@blink402/database'
import { getCacheOrFetch, deleteCache, isRedisConnected } from '@blink402/redis'

export const dashboardRoutes: FastifyPluginAsync = async (fastify) => {
  // GET /dashboard - Get creator dashboard data (requires wallet ownership)
  // Query: ?wallet=<address>
  // Headers: Optional Authorization for authenticated data
  fastify.get<{
    Querystring: { wallet: string }
  }>('/', async (request, reply) => {
    const { wallet } = request.query

    if (!wallet) {
      return reply.code(400).send({ success: false, error: 'Missing wallet query parameter' })
    }

    // Check if request has authorization header for private data
    const authHeader = request.headers.authorization
    let isOwner = false

    if (authHeader && authHeader.startsWith('Bearer ')) {
      try {
        const token = authHeader.substring(7)
        const authToken = JSON.parse(Buffer.from(token, 'base64').toString('utf-8'))

        // Check if the authenticated wallet matches the requested wallet
        if (authToken.wallet === wallet) {
          isOwner = true
        }
      } catch (error) {
        // Invalid auth token, continue as public view
        fastify.log.debug({ error }, 'Invalid auth token in dashboard request')
      }
    }

    // For non-owners, only show limited public data
    if (!isOwner) {
      fastify.log.info({ wallet }, 'Public dashboard access')
      // Could return limited data here or require auth
      return reply.code(403).send({
        success: false,
        error: 'Authentication required to view dashboard',
        details: 'Dashboard contains private information and requires wallet ownership'
      })
    }

    try {
      // Cache dashboard data for 2 minutes (frequent updates from runs)
      let data
      if (isRedisConnected()) {
        data = await getCacheOrFetch(
          `dashboard:${wallet}`,
          () => getDashboardData(wallet),
          120 // 2 minutes cache
        )
      } else {
        data = await getDashboardData(wallet)
      }

      return reply.code(200).send({ success: true, data })
    } catch (error) {
      fastify.log.error({ error, wallet }, 'Error fetching dashboard data')
      return reply.code(500).send({
        success: false,
        error: 'Failed to fetch dashboard data',
        details: error instanceof Error ? error.message : 'Unknown error',
      })
    }
  })
}
