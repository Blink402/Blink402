import { FastifyPluginAsync } from 'fastify'
import {
  getB402HolderTier,
  applyB402Discount,
  getTierDisplayInfo,
  getTierThresholds,
  getAllTierBenefits,
  validateB402Mint,
  type TokenHolderTier,
} from '@blink402/solana'

export const tokenRoutes: FastifyPluginAsync = async (fastify) => {

  // GET /token/tier?wallet=<address> - Get B402 holder tier and benefits
  fastify.get<{
    Querystring: { wallet: string }
  }>('/tier', async (request, reply) => {
    const { wallet } = request.query

    if (!wallet || typeof wallet !== 'string') {
      return reply.code(400).send({
        error: 'Missing wallet address',
        message: 'Please provide a wallet address as query parameter'
      })
    }

    // Validate wallet address format (basic check)
    if (wallet.length < 32 || wallet.length > 44) {
      return reply.code(400).send({
        error: 'Invalid wallet address',
        message: 'Wallet address must be 32-44 characters'
      })
    }

    try {
      // Check if B402 mint is configured
      const isMintValid = validateB402Mint()
      if (!isMintValid) {
        fastify.log.warn('B402 mint address not configured - using placeholder')
      }

      // Get holder tier and benefits
      const holderInfo = await getB402HolderTier(wallet)
      const displayInfo = getTierDisplayInfo(holderInfo.tier)

      fastify.log.info({
        wallet,
        tier: holderInfo.tier,
        balance: holderInfo.balance
      }, 'B402 tier retrieved')

      return reply.code(200).send({
        success: true,
        data: {
          wallet,
          tier: holderInfo.tier,
          balance: holderInfo.balance,
          benefits: holderInfo.benefits,
          display: displayInfo,
          timestamp: Date.now()
        }
      })
    } catch (error: any) {
      fastify.log.error({
        wallet,
        error: error.message
      }, 'Failed to get B402 tier')

      return reply.code(500).send({
        error: 'Failed to check B402 tier',
        message: error.message || 'Internal server error'
      })
    }
  })

  // GET /token/discount?wallet=<address>&basePrice=<price>&gameType=<type>
  // Calculate discounted price for B402 holders
  fastify.get<{
    Querystring: {
      wallet: string
      basePrice: string
      gameType: 'slotMachine' | 'lottery' | 'blinks'
    }
  }>('/discount', async (request, reply) => {
    const { wallet, basePrice, gameType } = request.query

    // Validation
    if (!wallet) {
      return reply.code(400).send({
        error: 'Missing wallet address'
      })
    }

    if (!basePrice || isNaN(parseFloat(basePrice))) {
      return reply.code(400).send({
        error: 'Invalid base price',
        message: 'basePrice must be a valid number'
      })
    }

    if (!gameType || !['slotMachine', 'lottery', 'blinks'].includes(gameType)) {
      return reply.code(400).send({
        error: 'Invalid game type',
        message: 'gameType must be slotMachine, lottery, or blinks'
      })
    }

    try {
      const price = parseFloat(basePrice)
      const discountInfo = await applyB402Discount(price, wallet, gameType)

      fastify.log.info({
        wallet,
        gameType,
        basePrice: price,
        discountedPrice: discountInfo.discountedPrice,
        tier: discountInfo.tier,
        savings: discountInfo.savings
      }, 'B402 discount calculated')

      return reply.code(200).send({
        success: true,
        data: discountInfo
      })
    } catch (error: any) {
      fastify.log.error({
        wallet,
        gameType,
        basePrice,
        error: error.message
      }, 'Failed to calculate discount')

      return reply.code(500).send({
        error: 'Failed to calculate discount',
        message: error.message || 'Internal server error'
      })
    }
  })

  // GET /token/tiers - Get all tier thresholds and benefits (for UI display)
  fastify.get('/tiers', async (request, reply) => {
    try {
      const thresholds = getTierThresholds()
      const benefits = getAllTierBenefits()

      const tiersInfo = Object.keys(benefits).map(tierKey => {
        const tier = tierKey as TokenHolderTier
        const displayInfo = getTierDisplayInfo(tier)
        const threshold = tier === 'NONE' ? 0 : thresholds[tier as Exclude<TokenHolderTier, 'NONE'>]

        return {
          tier,
          threshold,
          benefits: benefits[tier],
          display: displayInfo
        }
      })

      return reply.code(200).send({
        success: true,
        data: {
          tiers: tiersInfo,
          timestamp: Date.now()
        }
      })
    } catch (error: any) {
      fastify.log.error({
        error: error.message
      }, 'Failed to get tiers info')

      return reply.code(500).send({
        error: 'Failed to get tiers',
        message: error.message || 'Internal server error'
      })
    }
  })

  // GET /token/config - Get B402 token configuration
  fastify.get('/config', async (request, reply) => {
    try {
      const isMintValid = validateB402Mint()

      return reply.code(200).send({
        success: true,
        data: {
          mintConfigured: isMintValid,
          message: isMintValid
            ? 'B402 mint address is configured'
            : 'B402 mint address not configured - using placeholder'
        }
      })
    } catch (error: any) {
      fastify.log.error({
        error: error.message
      }, 'Failed to get token config')

      return reply.code(500).send({
        error: 'Failed to get config',
        message: error.message || 'Internal server error'
      })
    }
  })
}
