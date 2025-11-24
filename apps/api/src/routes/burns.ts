/**
 * Burns API Routes
 * Provides burn statistics and transparency data for B402 deflationary tokenomics
 */

import { FastifyPluginAsync } from 'fastify'
import {
  getBurnStats,
  getRecentBurns,
  getTotalBurned,
  recordBurn,
  createRun,
  getBlinkBySlug,
} from '@blink402/database'
import {
  getBurnerWalletAddress,
  B402_DECIMALS,
  burnB402Tokens,
  isBurnEnabled,
  getBurnAmount,
} from '@blink402/solana'

export const burnsRoutes: FastifyPluginAsync = async (fastify) => {
  /**
   * GET /burns/stats
   * Get burn statistics (total, 24h, 7d, counts, last burn)
   */
  fastify.get('/stats', async (request, reply) => {
    try {
      const stats = await getBurnStats()

      // Convert from base units to tokens with decimals
      const formatAmount = (amount: string) => {
        const num = BigInt(amount)
        const tokens = Number(num) / Math.pow(10, B402_DECIMALS)
        return tokens.toFixed(2)
      }

      // Calculate burn rate (tokens per day)
      const burned24h = parseFloat(formatAmount(stats.burned24h))
      const burnRate24h = burned24h.toFixed(2)

      return reply.code(200).send({
        success: true,
        data: {
          totalBurned: formatAmount(stats.totalBurned),
          burned24h: formatAmount(stats.burned24h),
          burned7d: formatAmount(stats.burned7d),
          burned30d: formatAmount(stats.burned30d),
          burnCount: stats.burnCount,
          burnCount24h: stats.burnCount24h,
          lastBurnAt: stats.lastBurnAt,
          burnRate: burnRate24h, // tokens/day
        },
      })
    } catch (error) {
      fastify.log.error({ error }, 'Failed to get burn stats')
      return reply.code(500).send({
        success: false,
        error: 'Failed to fetch burn statistics',
      })
    }
  })

  /**
   * GET /burns/recent
   * Get recent burn transactions
   * Query params:
   *  - limit: Number of burns to return (default: 10, max: 50)
   */
  fastify.get<{
    Querystring: { limit?: string }
  }>('/recent', async (request, reply) => {
    try {
      const limit = Math.min(
        parseInt(request.query.limit || '10', 10),
        50
      )

      const recentBurns = await getRecentBurns(limit)

      // Format amounts
      const formattedBurns = recentBurns.map((burn) => ({
        id: burn.id,
        runId: burn.runId,
        amountB402: (
          Number(burn.amountB402) / Math.pow(10, B402_DECIMALS)
        ).toFixed(2),
        txSignature: burn.txSignature,
        solscanUrl: `https://solscan.io/tx/${burn.txSignature}`,
        createdAt: burn.createdAt,
        blinkTitle: burn.blinkTitle,
        blinkSlug: burn.blinkSlug,
      }))

      return reply.code(200).send({
        success: true,
        data: formattedBurns,
      })
    } catch (error) {
      fastify.log.error({ error }, 'Failed to get recent burns')
      return reply.code(500).send({
        success: false,
        error: 'Failed to fetch recent burns',
      })
    }
  })

  /**
   * GET /burns/wallet
   * Get burner wallet address for transparency
   */
  fastify.get('/wallet', async (request, reply) => {
    try {
      const walletAddress = getBurnerWalletAddress()

      if (!walletAddress) {
        return reply.code(503).send({
          success: false,
          error: 'Burner wallet not configured',
        })
      }

      return reply.code(200).send({
        success: true,
        data: {
          address: walletAddress,
          solscanUrl: `https://solscan.io/account/${walletAddress}`,
          explorerUrl: `https://explorer.solana.com/address/${walletAddress}`,
        },
      })
    } catch (error) {
      fastify.log.error({ error }, 'Failed to get burner wallet address')
      return reply.code(500).send({
        success: false,
        error: 'Failed to fetch burner wallet address',
      })
    }
  })

  /**
   * GET /burns/health
   * Health check for burn system
   * Returns whether burns are enabled and configured
   */
  fastify.get('/health', async (request, reply) => {
    try {
      const walletAddress = getBurnerWalletAddress()
      const isConfigured = !!walletAddress

      return reply.code(200).send({
        success: true,
        data: {
          configured: isConfigured,
          walletAddress: isConfigured ? walletAddress : null,
        },
      })
    } catch (error) {
      return reply.code(200).send({
        success: true,
        data: {
          configured: false,
          walletAddress: null,
          error: 'Burner wallet not configured',
        },
      })
    }
  })

  /**
   * POST /burns/test
   * Test endpoint to trigger a burn (for testing purposes)
   * This will burn B402 tokens and record in database
   */
  fastify.post('/test', async (request, reply) => {
    try {
      if (!isBurnEnabled()) {
        return reply.code(503).send({
          success: false,
          error: 'Burns are not enabled',
        })
      }

      fastify.log.info('🔥 Test burn requested...')

      const burnAmount = getBurnAmount()
      fastify.log.info(`Burning ${burnAmount} B402 tokens...`)

      // Execute burn
      const burnSignature = await burnB402Tokens(burnAmount)
      fastify.log.info({ burnSignature }, 'Burn transaction sent')

      // Create a test run entry
      const blink = await getBlinkBySlug('criptonews') // Use any existing blink
      if (!blink) {
        throw new Error('No blinks available for test run')
      }

      const testRun = await createRun({
        blinkId: blink.id,
        reference: `test-burn-${Date.now()}`,
        metadata: {
          testBurn: true,
          burnerWallet: getBurnerWalletAddress(),
        },
      })

      // Record burn in database
      const burnAmountBaseUnits = BigInt(
        Math.floor(burnAmount * Math.pow(10, B402_DECIMALS))
      )

      await recordBurn({
        runId: testRun.id,
        amountB402: burnAmountBaseUnits,
        txSignature: burnSignature,
      })

      fastify.log.info('✅ Test burn completed successfully')

      return reply.code(200).send({
        success: true,
        data: {
          burnAmount: burnAmount.toFixed(2),
          txSignature: burnSignature,
          solscanUrl: `https://solscan.io/tx/${burnSignature}`,
          runId: testRun.id,
          message: 'Test burn completed successfully',
        },
      })
    } catch (error) {
      fastify.log.error({ error }, 'Test burn failed')
      return reply.code(500).send({
        success: false,
        error: error instanceof Error ? error.message : 'Test burn failed',
      })
    }
  })
}
