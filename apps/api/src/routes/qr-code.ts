/**
 * QR Code Generator API
 * Generates QR codes from text or URLs
 */

import { FastifyPluginAsync } from 'fastify'
import QRCode from 'qrcode'

export const qrCodeRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.post<{
    Body: {
      text?: string
      wallet?: string // Alternative parameter name (some blinks use this)
      reference?: string
      signature?: string
      payer?: string
    }
  }>('/', async (request, reply) => {
    const { text, wallet, reference, signature, payer } = request.body

    try {
      // Accept either text or wallet parameter
      const content = text || wallet

      if (!content) {
        return reply.code(400).send({
          success: false,
          error: 'Missing text parameter',
          message: 'Please provide text or URL to encode in QR code',
        })
      }

      // Validate text length (QR codes have limits)
      if (content.length > 2000) {
        return reply.code(400).send({
          success: false,
          error: 'Text too long',
          message: 'QR code text must be less than 2000 characters',
        })
      }

      fastify.log.info({
        textLength: content.length,
        reference,
        payer,
      }, 'Generating QR code')

      // Generate QR code as Data URL (base64 encoded PNG)
      const qrCodeDataUrl = await QRCode.toDataURL(content, {
        errorCorrectionLevel: 'M', // Medium error correction
        type: 'image/png',
        width: 512, // 512x512 px
        margin: 2, // Margin around QR code
        color: {
          dark: '#000000', // Black foreground
          light: '#FFFFFF', // White background
        },
      })

      // Generate a preview of the text (first 50 chars)
      const textPreview = content.length > 50
        ? content.substring(0, 50) + '...'
        : content

      const result = {
        success: true,
        data: {
          qrCode: qrCodeDataUrl, // Data URL: data:image/png;base64,iVBOR...
          text: content,
          textPreview,
          size: 512,
          format: 'png',
        },
        // Include reference and signature for receipt tracking
        ...(reference ? { reference } : {}),
        ...(signature ? { signature } : {}),
        timestamp: new Date().toISOString(),
      }

      fastify.log.info({
        textLength: content.length,
        qrCodeSize: qrCodeDataUrl.length,
      }, 'QR code generation successful')

      return reply.code(200).send(result)
    } catch (error) {
      fastify.log.error({ error, text }, 'QR code generation failed')
      return reply.code(500).send({
        success: false,
        error: 'Internal server error',
        message: 'An unexpected error occurred while generating QR code',
        details: error instanceof Error ? error.message : String(error),
      })
    }
  })
}
