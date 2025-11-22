import { FastifyPluginAsync } from 'fastify'
import { analyzeWallet, isValidSolanaAddress } from '@blink402/helius'
import { getCache, setCache, isRedisConnected } from '@blink402/redis'
import {
  getB402HolderTier,
  getTierDisplayInfo,
  getTierThresholds,
  type TokenHolderInfo,
} from '@blink402/solana'

export const walletAnalysisRoutes: FastifyPluginAsync = async (fastify) => {
  /**
   * POST /wallet-analysis
   * Analyze a Solana wallet and return comprehensive statistics
   */
  fastify.post<{
    Body: {
      wallet?: string
      target_wallet?: string
      payer?: string      // Payer wallet passed from proxy
      signature?: string  // Transaction signature from payment
      reference?: string  // Payment reference
    }
  }>('/wallet-analysis', async (request, reply) => {
    const { wallet, target_wallet, payer, signature, reference } = request.body

    // Priority: target_wallet (user input) > wallet > payer (fallback)
    // The target_wallet is what the user specifically wants to analyze
    // Skip empty string payer (happens when extraction fails)
    let walletAddress = target_wallet || wallet || (payer && payer !== '' ? payer : null)

    if (!walletAddress) {
      fastify.log.warn({
        wallet,
        target_wallet,
        payer,
        payerIsEmpty: payer === '',
        signature,
        reference,
      }, 'Wallet analysis requested without wallet address')
      return reply.code(400).send({
        error: 'Missing wallet address',
        message: 'No wallet address provided. The target_wallet parameter should be set when using the wallet-analyzer Blink. If payer extraction also failed, no wallet can be analyzed.',
        details: {
          target_wallet_provided: !!target_wallet,
          wallet_provided: !!wallet,
          payer_provided: !!payer && payer !== ''
        }
      })
    }

    fastify.log.info({
      walletAddress,
      source: target_wallet ? 'target_wallet (user input)' : wallet ? 'wallet' : 'payer (fallback)',
      reference,
      target_wallet,
      payer
    }, 'Analyzing wallet')

    // Validate wallet address
    if (!isValidSolanaAddress(walletAddress)) {
      fastify.log.warn({ walletAddress }, 'Invalid wallet address provided')
      return reply.code(400).send({
        error: 'Invalid wallet address',
        message: 'The provided wallet address is not a valid Solana address',
      })
    }

    try {
      // OPTIMIZATION: Check cache first (60-second TTL)
      // Cache key includes minute timestamp for 1-minute buckets
      const cacheMinute = Math.floor(Date.now() / 60000)
      const cacheKey = `wallet-analysis:${walletAddress}:${cacheMinute}`

      if (isRedisConnected()) {
        const cached = await getCache<any>(cacheKey)
        if (cached) {
          fastify.log.info({
            walletAddress,
            cacheHit: true,
            cacheKey
          }, 'Returning cached wallet analysis')

          return reply.code(200).send({
            success: true,
            data: cached,
            duration_ms: 0,
            cached: true
          })
        }
      }

      fastify.log.info({ walletAddress }, 'Analyzing wallet')

      const startTime = Date.now()

      // Check B402 tier first to determine feature availability
      const b402Info = await getB402HolderTier(walletAddress).catch(err => {
        fastify.log.warn({ error: err, walletAddress }, 'Failed to get B402 tier - defaulting to NONE')
        // Return default NONE tier on error
        return {
          tier: 'NONE' as const,
          balance: 0,
          rawBalance: BigInt(0),
          benefits: {
            slotMachine: { discountPercent: 0, bonusMultiplier: 1.0, freeSpinsDaily: 0 },
            lottery: { discountPercent: 0, bonusEntries: 0, winBoostPercent: 0 },
            blinks: { creatorFeeDiscount: 0, priorityExecution: false, customBranding: false }
          }
        }
      })

      // Run wallet analysis with spam detection enabled for BRONZE+ tiers
      const includeSpamDetection = b402Info.tier !== 'NONE'
      const analysis = await analyzeWallet(walletAddress, { includeSpamDetection })

      const duration = Date.now() - startTime

      // Get tier display info and thresholds
      const tierDisplay = getTierDisplayInfo(b402Info.tier)
      const tierThresholds = getTierThresholds()

      // Calculate next tier upgrade info
      let upgrade: any = null
      if (b402Info.tier !== 'DIAMOND') {
        const tiers: Array<'BRONZE' | 'SILVER' | 'GOLD' | 'DIAMOND'> = ['BRONZE', 'SILVER', 'GOLD', 'DIAMOND']
        const currentTierIndex = b402Info.tier === 'NONE' ? -1 : tiers.indexOf(b402Info.tier as any)
        const nextTier = tiers[currentTierIndex + 1]
        const nextTierThreshold = tierThresholds[nextTier]
        const tokensNeeded = Math.max(0, nextTierThreshold - b402Info.balance)

        upgrade = {
          nextTier,
          tokensNeeded,
          currentBalance: b402Info.balance,
          nextTierThreshold,
          message: tokensNeeded > 0
            ? `Hold ${tokensNeeded.toLocaleString()} more B402 tokens to unlock ${nextTier} tier`
            : `You have enough B402 for ${nextTier} tier!`
        }
      }

      // Build feature availability map
      const features = {
        basicStats: true, // Always available
        tokenUsdValues: true, // BRONZE+ (but we show partial for FREE)
        spamDetection: b402Info.tier !== 'NONE', // BRONZE+
        portfolioHealth: ['SILVER', 'GOLD', 'DIAMOND'].includes(b402Info.tier), // SILVER+
        rugPullDetection: ['GOLD', 'DIAMOND'].includes(b402Info.tier), // GOLD+
        aiInsights: b402Info.tier === 'DIAMOND', // DIAMOND only
      }

      // Build response with B402 integration
      const responseData = {
        ...analysis,
        b402: {
          tier: b402Info.tier,
          balance: b402Info.balance,
          display: tierDisplay,
          features,
          upgrade,
          benefits: b402Info.benefits
        }
      }

      // Calculate spam stats if spam detection was enabled
      const spamStats = includeSpamDetection && analysis.tokens.length > 0
        ? {
            totalTokens: analysis.tokens.length,
            spamTokens: analysis.tokens.filter(t => t.spamDetection?.isSpam).length,
            criticalRisk: analysis.tokens.filter(t => t.spamDetection?.riskLevel === 'critical').length,
            highRisk: analysis.tokens.filter(t => t.spamDetection?.riskLevel === 'high').length,
          }
        : null

      fastify.log.info({
        walletAddress,
        duration,
        tokensCount: analysis.tokens.length,
        tokensCreatedCount: analysis.tokensCreated.length,
        b402Tier: b402Info.tier,
        b402Balance: b402Info.balance,
        spamDetection: spamStats,
      }, 'Wallet analysis completed')

      // OPTIMIZATION: Cache the result for tier-based duration
      // Higher tiers get longer cache to reduce API costs
      const cacheTTL = {
        'NONE': 60,      // 1 minute
        'BRONZE': 120,   // 2 minutes
        'SILVER': 300,   // 5 minutes
        'GOLD': 600,     // 10 minutes
        'DIAMOND': 1800  // 30 minutes
      }[b402Info.tier]

      if (isRedisConnected()) {
        await setCache(cacheKey, responseData, cacheTTL).catch(err => {
          fastify.log.warn({ error: err, walletAddress }, 'Failed to cache wallet analysis')
        })
      }

      return reply.code(200).send({
        success: true,
        data: responseData,
        duration_ms: duration,
        cached: false
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
