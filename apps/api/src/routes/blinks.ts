import { FastifyPluginAsync } from 'fastify'
import {
  getAllBlinks,
  getBlinkBySlug,
  getBlinkById,
  createBlink,
  updateBlink,
  deleteBlink,
} from '@blink402/database'
import { verifyWalletAuth, verifyOwnership, type WalletAuthBody } from '../auth.js'
import { getCacheOrFetch, deleteCache, setCache, isRedisConnected } from '@blink402/redis'

export const blinksRoutes: FastifyPluginAsync = async (fastify) => {
  // GET /blinks - Get all blinks (with caching)
  fastify.get('/', async (request, reply) => {
    try {
      let blinks
      if (isRedisConnected()) {
        blinks = await getCacheOrFetch(
          'blinks:all',
          () => getAllBlinks(),
          300 // 5 minutes cache
        )
      } else {
        blinks = await getAllBlinks()
      }
      return reply.code(200).send({ success: true, data: blinks })
    } catch (error) {
      fastify.log.error({ error }, 'Error fetching blinks')
      return reply.code(500).send({ success: false, error: 'Failed to fetch blinks' })
    }
  })

  // GET /blinks/:slug - Get blink by slug (with caching)
  fastify.get<{ Params: { slug: string } }>('/:slug', async (request, reply) => {
    const { slug } = request.params

    try {
      let blink
      if (isRedisConnected()) {
        blink = await getCacheOrFetch(
          `blink:${slug}`,
          () => getBlinkBySlug(slug),
          300 // 5 minutes cache
        )
      } else {
        blink = await getBlinkBySlug(slug)
      }

      if (!blink) {
        return reply.code(404).send({ success: false, error: 'Blink not found' })
      }
      return reply.code(200).send({ success: true, data: blink })
    } catch (error) {
      fastify.log.error({ error, slug }, 'Error fetching blink')
      return reply.code(500).send({ success: false, error: 'Failed to fetch blink' })
    }
  })

  // POST /blinks - Create new blink (requires authentication)
  fastify.post<{
    Body: WalletAuthBody & {
      slug: string
      title: string
      description: string
      endpoint_url: string
      method: string
      price_usdc: string
      category?: string
      icon_url?: string
      status?: 'active' | 'paused' | 'archived'
      payment_token?: 'SOL' | 'USDC'
      payout_wallet?: string
      creator_wallet?: string
      creator?: { wallet: string }
    }
  }>('/', {
    preHandler: verifyWalletAuth,
  }, async (request, reply) => {
    const {
      slug,
      title,
      description,
      endpoint_url,
      method,
      price_usdc,
      category,
      icon_url,
      status,
      payment_token,
      payout_wallet,
      creator_wallet,
      creator,
    } = request.body

    try {
      // Get authenticated wallet (guaranteed by verifyWalletAuth preHandler)
      const authenticatedWallet = request.authenticatedWallet!

      // Support both creator_wallet and creator.wallet formats
      const creatorAddress = creator_wallet || creator?.wallet || authenticatedWallet

      // Validate required fields
      if (!slug || !title || !description || !endpoint_url || !method || !price_usdc) {
        return reply.code(400).send({ success: false, error: 'Missing required fields' })
      }

      // Validate price is a valid positive number
      const priceNum = parseFloat(price_usdc)
      if (isNaN(priceNum) || priceNum <= 0) {
        return reply.code(400).send({
          success: false,
          error: 'Invalid price',
          details: 'Price must be a positive number greater than 0'
        })
      }

      // Verify authenticated wallet matches creator wallet
      if (!verifyOwnership(authenticatedWallet, creatorAddress)) {
        return reply.code(403).send({ success: false, error: 'Wallet mismatch: You can only create blinks for your own wallet' })
      }

      // Payout wallet defaults to creator wallet if not specified
      const payoutAddress = payout_wallet || creatorAddress

      // Create blink
      const blink = await createBlink({
        slug,
        title,
        description,
        endpoint_url,
        method,
        price_usdc,
        category: category || 'general',
        icon_url: icon_url || '/blink-402-webpreview.png',
        status: status || 'active',
        payment_token: payment_token || 'SOL', // Default to SOL
        payout_wallet: payoutAddress, // Can differ from creator wallet
        creator: {
          wallet: creatorAddress
        }
      })

      // Invalidate caches (if Redis is connected)
      if (isRedisConnected()) {
        await deleteCache('blinks:all')
        await setCache(`blink:${slug}`, blink, 300)
      }

      return reply.code(201).send({ success: true, data: blink })
    } catch (error) {
      fastify.log.error({ error }, 'Error creating blink')
      return reply.code(500).send({
        success: false,
        error: 'Failed to create blink',
        details: error instanceof Error ? error.message : 'Unknown error',
      })
    }
  })

  // PUT /blinks/:slug - Update blink (requires authentication and ownership)
  fastify.put<{
    Params: { slug: string }
    Body: WalletAuthBody & {
      title?: string
      description?: string
      price_usdc?: string
      status?: 'active' | 'paused' | 'archived'
      icon_url?: string
    }
  }>('/:slug', {
    preHandler: verifyWalletAuth,
  }, async (request, reply) => {
    const { slug } = request.params
    const updates = request.body
    // Get authenticated wallet (guaranteed by verifyWalletAuth preHandler)
    const authenticatedWallet = request.authenticatedWallet!

    try {
      // Check if blink exists
      const existing = await getBlinkBySlug(slug)
      if (!existing) {
        return reply.code(404).send({ success: false, error: 'Blink not found' })
      }

      // Verify ownership
      if (!verifyOwnership(authenticatedWallet, existing.creator.wallet)) {
        return reply.code(403).send({ success: false, error: 'Forbidden: You can only update your own blinks' })
      }

      // Validate price if being updated
      if (updates.price_usdc !== undefined) {
        const priceNum = parseFloat(updates.price_usdc)
        if (isNaN(priceNum) || priceNum <= 0) {
          return reply.code(400).send({
            success: false,
            error: 'Invalid price',
            details: 'Price must be a positive number greater than 0'
          })
        }
      }

      // Update blink
      const blink = await updateBlink(slug, updates)

      // Invalidate caches (if Redis is connected)
      if (isRedisConnected()) {
        await deleteCache(`blink:${slug}`)
        await deleteCache('blinks:all')
      }

      return reply.code(200).send({ success: true, data: blink })
    } catch (error) {
      fastify.log.error({ error, slug }, 'Error updating blink')
      return reply.code(500).send({
        success: false,
        error: 'Failed to update blink',
        details: error instanceof Error ? error.message : 'Unknown error',
      })
    }
  })

  // DELETE /blinks/:slug - Delete blink (requires authentication and ownership)
  fastify.delete<{
    Params: { slug: string }
    Body: WalletAuthBody
  }>('/:slug', {
    preHandler: verifyWalletAuth,
  }, async (request, reply) => {
    const { slug } = request.params
    // Get authenticated wallet (guaranteed by verifyWalletAuth preHandler)
    const authenticatedWallet = request.authenticatedWallet!

    try {
      // Check if blink exists
      const existing = await getBlinkBySlug(slug)
      if (!existing) {
        return reply.code(404).send({ success: false, error: 'Blink not found' })
      }

      // Verify ownership
      if (!verifyOwnership(authenticatedWallet, existing.creator.wallet)) {
        return reply.code(403).send({ success: false, error: 'Forbidden: You can only delete your own blinks' })
      }

      // Delete blink
      await deleteBlink(slug)

      // Invalidate caches (if Redis is connected)
      if (isRedisConnected()) {
        await deleteCache(`blink:${slug}`)
        await deleteCache('blinks:all')
      }

      return reply.code(200).send({ success: true, data: { message: 'Blink deleted successfully' } })
    } catch (error) {
      fastify.log.error({ error, slug }, 'Error deleting blink')
      return reply.code(500).send({
        success: false,
        error: 'Failed to delete blink',
        details: error instanceof Error ? error.message : 'Unknown error',
      })
    }
  })
}
