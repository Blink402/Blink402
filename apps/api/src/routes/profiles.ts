import { FastifyPluginAsync } from 'fastify'
import {
  getCreatorProfile,
  updateCreatorProfile,
  getBlinksByCreator,
} from '@blink402/database'
import { verifyWalletAuth, verifyWalletSignature, type WalletAuthBody } from '../auth.js'
import { getCacheOrFetch, deleteCache, isRedisConnected } from '@blink402/redis'
import type { UpdateCreatorProfilePayload } from '@blink402/types'
import { processAvatar, processBanner, validateImage } from '../utils/imageProcessor.js'

const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10MB
const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']

export const profilesRoutes: FastifyPluginAsync = async (fastify) => {
  // GET /profiles/:walletOrSlug - Get public creator profile (with caching)
  fastify.get<{ Params: { walletOrSlug: string } }>(
    '/:walletOrSlug',
    async (request, reply) => {
      const { walletOrSlug } = request.params

      try {
        let profile
        if (isRedisConnected()) {
          profile = await getCacheOrFetch(
            `profile:${walletOrSlug}`,
            () => getCreatorProfile(walletOrSlug),
            300 // 5 minutes cache
          )
        } else {
          profile = await getCreatorProfile(walletOrSlug)
        }

        if (!profile) {
          return reply.code(404).send({
            success: false,
            error: 'Creator profile not found'
          })
        }

        return reply.code(200).send({ success: true, data: profile })
      } catch (error) {
        fastify.log.error({ error, walletOrSlug }, 'Error fetching creator profile')
        return reply.code(500).send({
          success: false,
          error: 'Failed to fetch creator profile'
        })
      }
    }
  )

  // GET /profiles/:wallet/blinks - Get all blinks by creator (with pagination)
  fastify.get<{
    Params: { wallet: string }
    Querystring: { limit?: string; offset?: string }
  }>(
    '/:wallet/blinks',
    async (request, reply) => {
      const { wallet } = request.params
      const limit = parseInt(request.query.limit || '20', 10)
      const offset = parseInt(request.query.offset || '0', 10)

      try {
        const blinks = await getBlinksByCreator(wallet, limit, offset)
        return reply.code(200).send({ success: true, data: blinks })
      } catch (error) {
        fastify.log.error({ error, wallet }, 'Error fetching creator blinks')
        return reply.code(500).send({
          success: false,
          error: 'Failed to fetch creator blinks'
        })
      }
    }
  )

  // POST /profiles/upload-avatar - Upload avatar image
  fastify.post<{
    Querystring: { wallet: string }
  }>(
    '/upload-avatar',
    async (request, reply) => {
      const { wallet } = request.query

      if (!wallet) {
        return reply.code(400).send({ success: false, error: 'wallet query parameter required' })
      }

      // Validate wallet format (Solana addresses are 32-44 base58 characters)
      const walletRegex = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/
      if (!walletRegex.test(wallet)) {
        return reply.code(400).send({ success: false, error: 'Invalid wallet address format' })
      }

      try {
        const data = await request.file({
          limits: {
            fileSize: MAX_FILE_SIZE,
            files: 1,
          },
        })

        if (!data) {
          return reply.code(400).send({ success: false, error: 'No file uploaded' })
        }

        // Validate mime type
        if (!ALLOWED_MIME_TYPES.includes(data.mimetype)) {
          return reply.code(400).send({
            success: false,
            error: `Invalid file type. Allowed types: ${ALLOWED_MIME_TYPES.join(', ')}`,
          })
        }

        // Read file into buffer
        const chunks: Buffer[] = []
        for await (const chunk of data.file) {
          chunks.push(chunk)
        }
        const buffer = Buffer.concat(chunks)

        // Validate image
        const imageValid = await validateImage(buffer)
        if (!imageValid) {
          return reply.code(400).send({
            success: false,
            error: 'Invalid image file',
          })
        }

        // Process avatar (resize to 512x512 square)
        const processed = await processAvatar(buffer, wallet)

        // Get base URL for absolute path
        const protocol = request.headers['x-forwarded-proto'] || 'http'
        const host = request.headers['x-forwarded-host'] || request.headers.host
        const baseUrl = `${protocol}://${host}`
        const avatarUrl = `${baseUrl}/uploads/${processed.filePath}`

        await updateCreatorProfile(wallet, { avatar_url: avatarUrl })

        // Invalidate cache
        if (isRedisConnected()) {
          await deleteCache(`profile:${wallet}`)
        }

        fastify.log.info({ wallet, filename: processed.filename }, 'Avatar uploaded')

        return reply.code(200).send({
          success: true,
          avatarUrl,
        })
      } catch (error) {
        fastify.log.error({ error, wallet }, 'Avatar upload failed')
        return reply.code(500).send({ success: false, error: 'Failed to upload avatar' })
      }
    }
  )

  // POST /profiles/upload-banner - Upload banner image
  fastify.post<{
    Querystring: { wallet: string }
  }>(
    '/upload-banner',
    async (request, reply) => {
      const { wallet } = request.query

      if (!wallet) {
        return reply.code(400).send({ success: false, error: 'wallet query parameter required' })
      }

      // Validate wallet format (Solana addresses are 32-44 base58 characters)
      const walletRegex = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/
      if (!walletRegex.test(wallet)) {
        return reply.code(400).send({ success: false, error: 'Invalid wallet address format' })
      }

      try {
        const data = await request.file({
          limits: {
            fileSize: MAX_FILE_SIZE,
            files: 1,
          },
        })

        if (!data) {
          return reply.code(400).send({ success: false, error: 'No file uploaded' })
        }

        // Validate mime type
        if (!ALLOWED_MIME_TYPES.includes(data.mimetype)) {
          return reply.code(400).send({
            success: false,
            error: `Invalid file type. Allowed types: ${ALLOWED_MIME_TYPES.join(', ')}`,
          })
        }

        // Read file into buffer
        const chunks: Buffer[] = []
        for await (const chunk of data.file) {
          chunks.push(chunk)
        }
        const buffer = Buffer.concat(chunks)

        // Validate image
        const imageValid = await validateImage(buffer)
        if (!imageValid) {
          return reply.code(400).send({
            success: false,
            error: 'Invalid image file',
          })
        }

        // Process banner (resize to max 1500x500)
        const processed = await processBanner(buffer, wallet)

        // Get base URL for absolute path
        const protocol = request.headers['x-forwarded-proto'] || 'http'
        const host = request.headers['x-forwarded-host'] || request.headers.host
        const baseUrl = `${protocol}://${host}`
        const bannerUrl = `${baseUrl}/uploads/${processed.filePath}`

        await updateCreatorProfile(wallet, { banner_url: bannerUrl })

        // Invalidate cache
        if (isRedisConnected()) {
          await deleteCache(`profile:${wallet}`)
        }

        fastify.log.info({ wallet, filename: processed.filename, dimensions: `${processed.width}x${processed.height}` }, 'Banner uploaded')

        return reply.code(200).send({
          success: true,
          bannerUrl,
        })
      } catch (error) {
        fastify.log.error({ error, wallet }, 'Banner upload failed')
        return reply.code(500).send({ success: false, error: 'Failed to upload banner' })
      }
    }
  )

  // PUT /profiles - Update creator profile (requires authentication)
  fastify.put<{
    Body: WalletAuthBody & UpdateCreatorProfilePayload
  }>(
    '/',
    {
      preHandler: verifyWalletAuth,
    },
    async (request, reply) => {
      const {
        display_name,
        bio,
        avatar_url,
        banner_url,
        profile_slug,
        social_links,
      } = request.body

      try {
        // Get authenticated wallet (guaranteed by verifyWalletAuth preHandler)
        const authenticatedWallet = request.authenticatedWallet!

        const updates: UpdateCreatorProfilePayload = {}

        if (display_name !== undefined) updates.display_name = display_name
        if (bio !== undefined) updates.bio = bio
        if (avatar_url !== undefined) updates.avatar_url = avatar_url
        if (banner_url !== undefined) updates.banner_url = banner_url
        if (profile_slug !== undefined) updates.profile_slug = profile_slug
        if (social_links !== undefined) updates.social_links = social_links

        const updatedProfile = await updateCreatorProfile(authenticatedWallet, updates)

        if (!updatedProfile) {
          return reply.code(404).send({
            success: false,
            error: 'Creator profile not found'
          })
        }

        // Invalidate cache for this profile
        if (isRedisConnected()) {
          await deleteCache(`profile:${authenticatedWallet}`)
          if (updatedProfile.profile_slug) {
            await deleteCache(`profile:${updatedProfile.profile_slug}`)
          }
        }

        return reply.code(200).send({
          success: true,
          data: updatedProfile
        })
      } catch (error) {
        if (error instanceof Error && error.message === 'Profile slug is already taken') {
          return reply.code(409).send({
            success: false,
            error: 'Profile slug is already taken'
          })
        }

        fastify.log.error({ error }, 'Error updating creator profile')
        return reply.code(500).send({
          success: false,
          error: 'Failed to update creator profile'
        })
      }
    }
  )
}
