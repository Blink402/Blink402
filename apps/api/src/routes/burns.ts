/**
 * Burns API Routes
 * Provides burn statistics and transparency data for B402 deflationary tokenomics
 */

import { FastifyPluginAsync } from 'fastify'
import {
  getBurnStats,
  getRecentBurns,
  getTotalBurned,
} from '@blink402/database'
import { getBurnerWalletAddress, B402_DECIMALS } from '@blink402/solana'

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
}
