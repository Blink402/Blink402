import { FastifyPluginAsync } from 'fastify'
import { analyzeWallet, isValidSolanaAddress } from '@blink402/helius'

export const walletAnalysisRoutes: FastifyPluginAsync = async (fastify) => {
  /**
   * POST /wallet-analysis
   * Analyze a Solana wallet and return comprehensive statistics
   */
  fastify.post<{
    Body: {
      wallet?: string
      target_wallet?: string
    }
  }>('/wallet-analysis', async (request, reply) => {
    const { wallet, target_wallet } = request.body

    // Support both 'wallet' and 'target_wallet' parameter names
    const walletAddress = target_wallet || wallet

    if (!walletAddress) {
      fastify.log.warn('Wallet analysis requested without wallet address')
      return reply.code(400).send({
        error: 'Missing wallet address',
        message: 'Please provide a wallet address to analyze',
      })
    }

    // Validate wallet address
    if (!isValidSolanaAddress(walletAddress)) {
      fastify.log.warn({ walletAddress }, 'Invalid wallet address provided')
      return reply.code(400).send({
        error: 'Invalid wallet address',
        message: 'The provided wallet address is not a valid Solana address',
      })
    }

    try {
      fastify.log.info({ walletAddress }, 'Analyzing wallet')

      const startTime = Date.now()
      const analysis = await analyzeWallet(walletAddress)
      const duration = Date.now() - startTime

      fastify.log.info({
        walletAddress,
        duration,
        tokensCount: analysis.tokens.length,
        tokensCreatedCount: analysis.tokensCreated.length,
      }, 'Wallet analysis completed')

      return reply.code(200).send({
        success: true,
        data: analysis,
        duration_ms: duration,
      })
    } catch (error) {
      fastify.log.error({
        error,
        walletAddress,
      }, 'Error analyzing wallet')

      // Check if it's a Helius API error
      if (error instanceof Error && error.message.includes('Helius API')) {
        return reply.code(503).send({
          error: 'Service temporarily unavailable',
          message: 'Unable to fetch wallet data. Please try again later.',
        })
      }

      return reply.code(500).send({
        error: 'Internal server error',
        message: 'An error occurred while analyzing the wallet',
      })
    }
  })
}
