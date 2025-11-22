import { FastifyPluginAsync } from 'fastify'
import { unlink } from 'fs/promises'
import { join } from 'path'
import {
  uploadGalleryImage,
  getGalleryImages,
  grantGalleryAccess,
  checkGalleryAccess,
  deleteGalleryImage,
  getBlinkBySlug,
  getRunByReference,
  createBlink,
  updateBlink,
  type GalleryImage,
  type GalleryAccess,
} from '@blink402/database'
import { processImage, validateImage } from '../utils/imageProcessor.js'

const UPLOAD_DIR = join(process.cwd(), 'uploads', 'galleries')
const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10MB
const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']

export const galleryRoutes: FastifyPluginAsync = async (fastify) => {
  // Note: Upload directory is created automatically by image processor

  // POST /api/gallery/upload - Upload image to creator's gallery
  fastify.post<{
    Querystring: { wallet: string; uploaderWallet?: string }
    Headers: { 'x-uploader-wallet'?: string }
  }>('/upload', async (request, reply) => {
    const { wallet, uploaderWallet } = request.query
    const headerWallet = request.headers['x-uploader-wallet']

    if (!wallet) {
      return reply.code(400).send({ error: 'wallet query parameter required' })
    }

    // Validate wallet format (Solana addresses are 32-44 base58 characters)
    const walletRegex = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/
    if (!walletRegex.test(wallet)) {
      return reply.code(400).send({ error: 'Invalid wallet address format' })
    }

    // Verify uploader owns the gallery
    const actualUploader = headerWallet || uploaderWallet || wallet
    if (actualUploader !== wallet) {
      fastify.log.warn({ wallet, actualUploader }, 'Unauthorized upload attempt to gallery')
      return reply.code(403).send({ error: 'Unauthorized: You can only upload to your own gallery' })
    }

    try {
      const data = await request.file({
        limits: {
          fileSize: MAX_FILE_SIZE,
          files: 1,
        },
      })

      if (!data) {
        return reply.code(400).send({ error: 'No file uploaded' })
      }

      // Validate mime type
      if (!ALLOWED_MIME_TYPES.includes(data.mimetype)) {
        return reply.code(400).send({
          error: `Invalid file type. Allowed types: ${ALLOWED_MIME_TYPES.join(', ')}`,
        })
      }

      // Read file into buffer for processing
      const chunks: Buffer[] = []
      for await (const chunk of data.file) {
        chunks.push(chunk)
      }
      const buffer = Buffer.concat(chunks)

      // Validate image before processing
      const isValid = await validateImage(buffer)
      if (!isValid) {
        return reply.code(400).send({
          error: 'Invalid image file. File may be corrupted or not a supported image format.',
        })
      }

      // Process image (resize, generate thumbnail, convert to WebP)
      const processed = await processImage(buffer, wallet)

      // Extract caption from fields if present
      let caption: string | undefined
      if (data.fields && 'caption' in data.fields) {
        const captionField = data.fields.caption
        if (typeof captionField === 'object' && 'value' in captionField) {
          caption = captionField.value as string
        }
      }

      // Save to database with both full-size and thumbnail paths
      const image = await uploadGalleryImage({
        creatorWallet: wallet,
        filePath: processed.filePath,
        thumbnailPath: processed.thumbnailPath,
        caption,
      })

      fastify.log.info(
        {
          wallet,
          filename: processed.filename,
          thumbnailFilename: processed.thumbnailFilename,
          imageId: image.id,
          size: processed.size,
          dimensions: `${processed.width}x${processed.height}`,
        },
        'Image uploaded and processed for gallery'
      )

      return reply.code(201).send({
        success: true,
        image: {
          id: image.id,
          filePath: processed.filePath,
          thumbnailPath: processed.thumbnailPath,
          caption: image.caption,
          uploadedAt: image.uploaded_at,
          width: processed.width,
          height: processed.height,
        },
      })
    } catch (error) {
      const err = error as Error
      fastify.log.error(
        {
          errorMessage: err.message,
          errorName: err.name,
          errorStack: err.stack,
          wallet,
        },
        'Gallery upload failed'
      )
      return reply.code(500).send({ error: 'Failed to upload image' })
    }
  })

  // GET /api/gallery/:wallet/images - Get all images for a creator
  fastify.get<{
    Params: { wallet: string }
  }>('/:wallet/images', async (request, reply) => {
    const { wallet } = request.params

    try {
      const images = await getGalleryImages(wallet)

      return reply.code(200).send({
        wallet,
        images: images.map((img) => ({
          id: img.id,
          filePath: img.file_path,
          thumbnailPath: img.thumbnail_path,
          caption: img.caption,
          uploadedAt: img.uploaded_at,
        })),
      })
    } catch (error) {
      fastify.log.error({ error, wallet }, 'Failed to fetch gallery images')
      return reply.code(500).send({ error: 'Failed to fetch gallery images' })
    }
  })

  // POST /api/gallery/:wallet/unlock - Process payment and grant access
  fastify.post<{
    Params: { wallet: string }
    Body: {
      reference: string
      viewerWallet: string
      blinkSlug: string
    }
  }>('/:wallet/unlock', async (request, reply) => {
    const { wallet: creatorWallet } = request.params
    const { reference, viewerWallet, blinkSlug } = request.body

    if (!reference || !viewerWallet || !blinkSlug) {
      return reply.code(400).send({
        error: 'reference, viewerWallet, and blinkSlug are required',
      })
    }

    try {
      // 1. Verify the reference exists and is paid
      const run = await getRunByReference(reference)
      if (!run) {
        return reply.code(404).send({ error: 'Payment reference not found' })
      }

      if (run.status !== 'paid' && run.status !== 'executed') {
        return reply.code(402).send({ error: 'Payment not confirmed' })
      }

      // 2. Get the blink to determine access duration
      const blink = await getBlinkBySlug(blinkSlug)
      if (!blink) {
        return reply.code(404).send({ error: 'Blink not found' })
      }

      // Get access duration from blink (defaults to 30 if not set)
      const durationDays = blink.access_duration_days || 30

      // 3. Grant access
      const access = await grantGalleryAccess({
        viewerWallet,
        creatorWallet,
        blinkSlug,
        durationDays,
        reference,
      })

      fastify.log.info(
        { viewerWallet, creatorWallet, blinkSlug, expiresAt: access.expires_at },
        'Gallery access granted'
      )

      return reply.code(200).send({
        success: true,
        access: {
          expiresAt: access.expires_at,
          durationDays,
        },
      })
    } catch (error) {
      fastify.log.error({ error, creatorWallet, viewerWallet }, 'Failed to grant gallery access')
      return reply.code(500).send({ error: 'Failed to grant access' })
    }
  })

  // GET /api/gallery/:wallet/check-access - Check if viewer has access
  fastify.get<{
    Params: { wallet: string }
    Querystring: { viewer: string }
  }>('/:wallet/check-access', async (request, reply) => {
    const { wallet: creatorWallet } = request.params
    const { viewer: viewerWallet } = request.query

    if (!viewerWallet) {
      return reply.code(400).send({ error: 'viewer query parameter required' })
    }

    try {
      const access = await checkGalleryAccess({
        viewerWallet,
        creatorWallet,
      })

      if (!access) {
        return reply.code(200).send({
          hasAccess: false,
          expiresAt: null,
        })
      }

      return reply.code(200).send({
        hasAccess: true,
        expiresAt: access.expires_at,
        paidAt: access.paid_at,
      })
    } catch (error) {
      fastify.log.error({ error, creatorWallet, viewerWallet }, 'Failed to check gallery access')
      return reply.code(500).send({ error: 'Failed to check access' })
    }
  })

  // DELETE /api/gallery/:wallet/images/:id - Delete an image (creator only)
  fastify.delete<{
    Params: { wallet: string; id: string }
    Headers: { 'x-request-wallet'?: string }
  }>('/:wallet/images/:id', async (request, reply) => {
    const { wallet, id } = request.params
    const requestWallet = request.headers['x-request-wallet']

    // Validate wallet format
    const walletRegex = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/
    if (!walletRegex.test(wallet)) {
      return reply.code(400).send({ error: 'Invalid wallet address format' })
    }

    // Verify the requester owns the gallery
    if (!requestWallet || requestWallet !== wallet) {
      fastify.log.warn({ wallet, requestWallet, imageId: id }, 'Unauthorized delete attempt')
      return reply.code(403).send({ error: 'Unauthorized: You can only delete images from your own gallery' })
    }

    // Validate UUID format for image ID
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    if (!uuidRegex.test(id)) {
      return reply.code(400).send({ error: 'Invalid image ID format' })
    }

    try {
      // Get image before deletion to clean up file
      const images = await getGalleryImages(wallet)
      const image = images.find((img) => img.id === id)

      if (!image) {
        return reply.code(404).send({ error: 'Image not found' })
      }

      // Delete from database
      const deleted = await deleteGalleryImage({
        id,
        creatorWallet: wallet,
      })

      if (!deleted) {
        return reply.code(404).send({ error: 'Image not found or unauthorized' })
      }

          // Clean up file from disk (best effort, don't fail if it doesn't exist)
      try {
        const filePath = join(process.cwd(), 'uploads', image.file_path)
        await unlink(filePath)
      } catch (err) {
        fastify.log.warn({ error: err, filePath: image.file_path }, 'Failed to delete file from disk')
      }

      fastify.log.info({ wallet, imageId: id }, 'Gallery image deleted')

      return reply.code(200).send({ success: true })
    } catch (error) {
      fastify.log.error({ error, wallet, id }, 'Failed to delete gallery image')
      return reply.code(500).send({ error: 'Failed to delete image' })
    }
  })

  // POST /api/gallery/:wallet/configure - Configure gallery blink (simplified auth for gallery)
  fastify.post<{
    Params: { wallet: string }
    Body: {
      price_usdc: string
      payment_token: 'SOL' | 'USDC'
      access_duration_days: number
      walletAddress?: string
    }
  }>('/:wallet/configure', async (request, reply) => {
    const { wallet } = request.params
    const { price_usdc, payment_token, access_duration_days, walletAddress } = request.body

    // Validate wallet format
    const walletRegex = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/
    if (!walletRegex.test(wallet)) {
      return reply.code(400).send({ error: 'Invalid wallet address format' })
    }

    // Basic ownership check - wallet in body must match URL param
    if (walletAddress && walletAddress !== wallet) {
      fastify.log.warn({ wallet, walletAddress }, 'Gallery configuration mismatch')
      return reply.code(403).send({ error: 'Wallet mismatch' })
    }

    // Validate price
    const priceNum = parseFloat(price_usdc)
    if (isNaN(priceNum) || priceNum <= 0) {
      return reply.code(400).send({ error: 'Invalid price' })
    }

    try {
      // Create or update gallery blink
      const slug = `gallery-${wallet.slice(0, 8)}`
      const existingBlink = await getBlinkBySlug(slug)

      // IMPORTANT: Gallery blinks always use SOL, not USDC
      // This prevents "Attempt to debit an account but found no record of a prior credit" errors
      // when users don't have USDC token accounts
      const blinkData = {
        slug,
        title: `${wallet.slice(0, 8)}'s Gallery`,
        description: `Exclusive access to premium gallery content for ${access_duration_days} days`,
        price_usdc,
        payment_token: 'USDC' as const, // Force USDC for PayAI x402 compatibility
        payment_mode: 'charge' as const, // Gallery uses charge mode (user pays)
        icon_url: '/gallery-icon.svg',
        endpoint_url: `/gallery/${wallet}`,
        method: 'GET',
        category: 'gallery',
        status: 'active' as const,
        payout_wallet: wallet,
        access_duration_days,
        creator: { wallet }
      }

      let result
      if (existingBlink) {
        // Update existing blink
        result = await updateBlink(slug, blinkData)
      } else {
        // Create new blink
        result = await createBlink(blinkData)
      }

      fastify.log.info({ wallet, slug }, 'Gallery blink configured')
      return reply.code(200).send({ success: true, blink: result })
    } catch (error) {
      fastify.log.error({ error, wallet }, 'Failed to configure gallery blink')
      return reply.code(500).send({ error: 'Failed to configure gallery' })
    }
  })
}
