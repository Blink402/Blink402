import { FastifyPluginAsync } from 'fastify'
import { Keypair } from '@solana/web3.js'
import {
  encrypt,
  decrypt,
  maskSensitive,
  isValidPrivateKeyFormat,
  saveCreatorPayoutKey,
  getCreatorPayoutKey,
  hasCreatorPayoutKey,
  deleteCreatorPayoutKey,
} from '@blink402/database'

export const creatorPayoutKeyRoutes: FastifyPluginAsync = async (fastify) => {
  /**
   * GET /api/creator/payout-key/status
   * Check if creator has a payout key configured
   * Returns masked version if exists
   */
  fastify.get<{
    Querystring: { wallet: string }
  }>('/status', async (request, reply) => {
    const { wallet } = request.query

    if (!wallet) {
      return reply.code(400).send({ error: 'Wallet address required' })
    }

    try {
      const hasKey = await hasCreatorPayoutKey(wallet)

      if (!hasKey) {
        return reply.code(200).send({
          configured: false,
          maskedKey: null,
        })
      }

      // Get encrypted key and decrypt to show masked version
      const encryptedKey = await getCreatorPayoutKey(wallet)

      if (!encryptedKey) {
        return reply.code(200).send({
          configured: false,
          maskedKey: null,
        })
      }

      try {
        const decryptedKey = decrypt(encryptedKey)
        const keypair = Keypair.fromSecretKey(
          Buffer.from(JSON.parse(decryptedKey))
        )
        const publicKey = keypair.publicKey.toBase58()

        return reply.code(200).send({
          configured: true,
          maskedKey: maskSensitive(publicKey),
          publicKey, // Return public key for display
        })
      } catch (error) {
        fastify.log.error({ error, wallet }, 'Failed to decrypt payout key')
        return reply.code(200).send({
          configured: true,
          maskedKey: '***...error',
          error: 'Key exists but failed to decrypt',
        })
      }
    } catch (error) {
      fastify.log.error({ error, wallet }, 'Failed to check payout key status')
      return reply.code(500).send({ error: 'Internal server error' })
    }
  })

  /**
   * POST /api/creator/payout-key
   * Save encrypted payout key for creator
   * Body: { wallet: string, privateKey: string }
   */
  fastify.post<{
    Body: { wallet: string; privateKey: string }
  }>('/', async (request, reply) => {
    const { wallet, privateKey } = request.body

    if (!wallet || !privateKey) {
      return reply.code(400).send({
        error: 'Wallet address and private key required',
      })
    }

    // Validate private key format
    if (!isValidPrivateKeyFormat(privateKey)) {
      return reply.code(400).send({
        error:
          'Invalid private key format. Must be JSON array of 64 numbers (0-255).',
      })
    }

    try {
      // Verify the private key is valid by trying to create a Keypair
      const keypair = Keypair.fromSecretKey(Buffer.from(JSON.parse(privateKey)))
      const publicKey = keypair.publicKey.toBase58()

      fastify.log.info({
        wallet,
        publicKey,
      }, 'Saving payout key for creator')

      // Encrypt and save
      const encryptedKey = encrypt(privateKey)
      await saveCreatorPayoutKey(wallet, encryptedKey)

      return reply.code(200).send({
        success: true,
        message: 'Payout key saved successfully',
        publicKey,
        maskedKey: maskSensitive(publicKey),
      })
    } catch (error) {
      fastify.log.error({ error, wallet }, 'Failed to save payout key')

      if (error instanceof Error && error.message.includes('Encryption')) {
        return reply.code(500).send({
          error:
            'Failed to encrypt private key. Please ensure ENCRYPTION_KEY is configured.',
        })
      }

      return reply.code(500).send({
        error: 'Failed to save payout key',
      })
    }
  })

  /**
   * POST /api/creator/payout-key/generate
   * Generate a new Solana keypair for the creator
   * Body: { wallet: string }
   * Returns: { privateKey: string, publicKey: string }
   */
  fastify.post<{
    Body: { wallet: string }
  }>('/generate', async (request, reply) => {
    const { wallet } = request.body

    if (!wallet) {
      return reply.code(400).send({ error: 'Wallet address required' })
    }

    try {
      // Generate new keypair
      const keypair = Keypair.generate()
      const publicKey = keypair.publicKey.toBase58()
      const privateKeyArray = Array.from(keypair.secretKey)
      const privateKeyJson = JSON.stringify(privateKeyArray)

      fastify.log.info({
        wallet,
        publicKey,
      }, 'Generated new keypair for creator')

      return reply.code(200).send({
        success: true,
        privateKey: privateKeyJson,
        publicKey,
        message:
          'Keypair generated! Save the private key securely - you will not see it again.',
      })
    } catch (error) {
      fastify.log.error({ error, wallet }, 'Failed to generate keypair')
      return reply.code(500).send({ error: 'Failed to generate keypair' })
    }
  })

  /**
   * DELETE /api/creator/payout-key
   * Remove payout key for creator
   * Body: { wallet: string }
   */
  fastify.delete<{
    Body: { wallet: string }
  }>('/', async (request, reply) => {
    const { wallet } = request.body

    if (!wallet) {
      return reply.code(400).send({ error: 'Wallet address required' })
    }

    try {
      await deleteCreatorPayoutKey(wallet)

      fastify.log.info({ wallet }, 'Deleted payout key for creator')

      return reply.code(200).send({
        success: true,
        message: 'Payout key removed successfully',
      })
    } catch (error) {
      fastify.log.error({ error, wallet }, 'Failed to delete payout key')
      return reply.code(500).send({ error: 'Failed to remove payout key' })
    }
  })
}
