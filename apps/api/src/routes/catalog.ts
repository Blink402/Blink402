import { FastifyPluginAsync } from 'fastify'
import {
  getPublicBlinks,
  getFeaturedBlinks,
  getTrendingBlinks,
  toggleBlinkPublic,
  reportBlink,
  getBlinkBySlug,
  updateBlinkBadges,
  updateBlinkHealth
} from '@blink402/database'
import { getCacheOrFetch, deleteCache, setCache, isRedisConnected } from '@blink402/redis'
import type { CatalogFilters } from '@blink402/types'

// Define query parameters for catalog endpoint
interface CatalogQuery {
  category?: string
  price_min?: string
  price_max?: string
  badges?: string
  media_type?: string
  search?: string
  limit?: string
  offset?: string
  sort?: 'newest' | 'popular' | 'price_low' | 'price_high'
}

interface ReportBody {
  blink_id: string
  reporter_wallet?: string
  reason: 'spam' | 'scam' | 'broken' | 'inappropriate' | 'copyright' | 'other'
  details?: string
}

export const catalogRoutes: FastifyPluginAsync = async (fastify) => {
  // Get public catalog blinks with filters
  fastify.get<{ Querystring: CatalogQuery }>('/catalog', async (request, reply) => {
    const {
      category,
      price_min,
      price_max,
      badges,
      media_type,
      search,
      limit = '20',
      offset = '0',
      sort = 'newest'
    } = request.query

    try {
      const filters: CatalogFilters = {
        category,
        price_min: price_min ? parseFloat(price_min) : undefined,
        price_max: price_max ? parseFloat(price_max) : undefined,
        badges: badges ? badges.split(',') : undefined,
        media_type,
        search
      }

      const limitNum = Math.min(parseInt(limit, 10), 100) // Max 100 items
      const offsetNum = parseInt(offset, 10)

      const blinks = await getPublicBlinks(filters, limitNum, offsetNum)

      // Apply sorting
      if (sort === 'popular') {
        blinks.sort((a, b) => b.runs - a.runs)
      } else if (sort === 'price_low') {
        blinks.sort((a, b) => parseFloat(a.price_usdc) - parseFloat(b.price_usdc))
      } else if (sort === 'price_high') {
        blinks.sort((a, b) => parseFloat(b.price_usdc) - parseFloat(a.price_usdc))
      }
      // Default 'newest' sorting is already applied in database query

      return reply.code(200).send({
        success: true,
        data: blinks,
        pagination: {
          limit: limitNum,
          offset: offsetNum,
          total: blinks.length // Note: This is the current page count, not total count
        }
      })
    } catch (error) {
      fastify.log.error({ error, query: request.query }, 'Error fetching catalog')
      return reply.code(500).send({
        success: false,
        error: 'Failed to fetch catalog'
      })
    }
  })

  // Get featured blinks for homepage
  fastify.get('/catalog/featured', async (request, reply) => {
    try {
      let blinks

      if (isRedisConnected()) {
        blinks = await getCacheOrFetch(
          'featured_blinks',
          async () => getFeaturedBlinks(5),
          3600 // Cache for 1 hour
        )
      } else {
        blinks = await getFeaturedBlinks(5)
      }

      return reply.code(200).send({
        success: true,
        data: blinks
      })
    } catch (error) {
      fastify.log.error({ error }, 'Error fetching featured blinks')
      return reply.code(500).send({
        success: false,
        error: 'Failed to fetch featured blinks'
      })
    }
  })

  // Get trending blinks
  fastify.get<{ Querystring: { days?: string } }>('/catalog/trending', async (request, reply) => {
    const { days = '1' } = request.query

    try {
      const daysNum = Math.min(parseInt(days, 10), 7) // Max 7 days
      let blinks

      if (isRedisConnected()) {
        blinks = await getCacheOrFetch(
          `trending_blinks_${days}`,
          async () => getTrendingBlinks(10, daysNum),
          900 // Cache for 15 minutes
        )
      } else {
        blinks = await getTrendingBlinks(10, daysNum)
      }

      return reply.code(200).send({
        success: true,
        data: blinks
      })
    } catch (error) {
      fastify.log.error({ error, days: request.query.days }, 'Error fetching trending blinks')
      return reply.code(500).send({
        success: false,
        error: 'Failed to fetch trending blinks'
      })
    }
  })

  // Toggle blink public visibility (creator only)
  fastify.put<{
    Params: { slug: string }
    Body: { is_public: boolean; publish_to_catalog?: boolean }
  }>('/catalog/:slug/publish', async (request, reply) => {
    const { slug } = request.params
    const { is_public, publish_to_catalog = false } = request.body

    try {
      // TODO: Add authentication check here to ensure only creator can toggle
      // For now, we'll skip auth as it's not implemented yet

      const blink = await getBlinkBySlug(slug)
      if (!blink) {
        return reply.code(404).send({
          success: false,
          error: 'Blink not found'
        })
      }

      // If trying to publish, validate first
      if (is_public && publish_to_catalog) {
        const { validateBlinkForPublishing, publishBlinkToCatalog, getPool } = await import('@blink402/database')
        const pool = getPool()
        const validation = await validateBlinkForPublishing(pool, blink.id)

        if (!validation.canPublish) {
          return reply.code(400).send({
            success: false,
            error: 'Blink does not meet publishing requirements',
            validation: {
              errors: validation.errors,
              warnings: validation.warnings,
              metrics: validation.metrics
            }
          })
        }

        // Use the new publishing function
        const result = await publishBlinkToCatalog(pool, slug)

        if (result.success) {
          // Clear cache if Redis is connected
          if (isRedisConnected()) {
            await deleteCache('featured_blinks')
            await deleteCache('trending_blinks_1')
          }

          return reply.code(200).send({
            success: true,
            message: 'Blink published to catalog',
            warnings: validation.warnings
          })
        } else {
          return reply.code(500).send({
            success: false,
            error: result.error || 'Failed to publish blink'
          })
        }
      } else {
        // Unpublishing - use the old function or new unpublish function
        const { unpublishBlinkFromCatalog, getPool } = await import('@blink402/database')
        const pool = getPool()
        const result = await unpublishBlinkFromCatalog(pool, slug)

        if (result.success) {
          // Clear cache if Redis is connected
          if (isRedisConnected()) {
            await deleteCache('featured_blinks')
            await deleteCache('trending_blinks_1')
          }

          return reply.code(200).send({
            success: true,
            message: 'Blink removed from catalog'
          })
        } else {
          return reply.code(500).send({
            success: false,
            error: result.error || 'Failed to unpublish blink'
          })
        }
      }
    } catch (error) {
      fastify.log.error({ error, slug }, 'Error toggling blink visibility')
      return reply.code(500).send({
        success: false,
        error: 'Failed to update blink visibility'
      })
    }
  })

  // Get publishing status and validation for a blink
  fastify.get<{ Params: { slug: string } }>('/catalog/:slug/publish-status', async (request, reply) => {
    const { slug } = request.params

    try {
      const { getBlinkPublishingStatus, getPool } = await import('@blink402/database')
      const pool = getPool()
      const status = await getBlinkPublishingStatus(pool, slug)

      if (!status.validation) {
        return reply.code(404).send({
          success: false,
          error: 'Blink not found'
        })
      }

      return reply.code(200).send({
        success: true,
        isPublished: status.isPublished,
        canPublish: status.validation.canPublish,
        validation: {
          errors: status.validation.errors,
          warnings: status.validation.warnings,
          metrics: status.validation.metrics
        }
      })
    } catch (error) {
      fastify.log.error({ error, slug }, 'Error getting publishing status')
      return reply.code(500).send({
        success: false,
        error: 'Failed to get publishing status'
      })
    }
  })

  // Report a blink
  fastify.post<{ Body: ReportBody }>('/catalog/report', async (request, reply) => {
    const { blink_id, reporter_wallet, reason, details } = request.body

    // Validate required fields
    if (!blink_id || !reason) {
      return reply.code(400).send({
        success: false,
        error: 'Missing required fields: blink_id and reason'
      })
    }

    try {
      const success = await reportBlink(blink_id, reporter_wallet || null, reason, details || null)

      if (success) {
        return reply.code(200).send({
          success: true,
          message: 'Report submitted successfully'
        })
      } else {
        return reply.code(500).send({
          success: false,
          error: 'Failed to submit report'
        })
      }
    } catch (error) {
      fastify.log.error({ error, blink_id, reason }, 'Error reporting blink')
      return reply.code(500).send({
        success: false,
        error: 'Failed to submit report'
      })
    }
  })

  // Update blink badges (internal endpoint for background job)
  fastify.post<{ Params: { id: string } }>('/catalog/:id/badges', async (request, reply) => {
    const { id } = request.params

    try {
      // TODO: Add internal API key check for security

      const success = await updateBlinkBadges(id)

      if (success) {
        return reply.code(200).send({
          success: true,
          message: 'Badges updated successfully'
        })
      } else {
        return reply.code(500).send({
          success: false,
          error: 'Failed to update badges'
        })
      }
    } catch (error) {
      fastify.log.error({ error, id }, 'Error updating badges')
      return reply.code(500).send({
        success: false,
        error: 'Failed to update badges'
      })
    }
  })

  // Update blink health status (internal endpoint for background job)
  fastify.post<{
    Params: { id: string }
    Body: { status: 'healthy' | 'degraded' | 'unhealthy' }
  }>('/catalog/:id/health', async (request, reply) => {
    const { id } = request.params
    const { status } = request.body

    try {
      // TODO: Add internal API key check for security

      const success = await updateBlinkHealth(id, status)

      if (success) {
        return reply.code(200).send({
          success: true,
          message: 'Health status updated successfully'
        })
      } else {
        return reply.code(500).send({
          success: false,
          error: 'Failed to update health status'
        })
      }
    } catch (error) {
      fastify.log.error({ error, id, status }, 'Error updating health status')
      return reply.code(500).send({
        success: false,
        error: 'Failed to update health status'
      })
    }
  })
}