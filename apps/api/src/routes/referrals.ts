// Referral System API Routes
// Handles referral code generation, tracking, stats, and leaderboards

import { FastifyPluginAsync } from 'fastify'
import {
  getOrCreateReferralCode,
  trackReferral,
  getReferralStats,
  getReferralLeaderboard
} from '@blink402/database'

export const referralRoutes: FastifyPluginAsync = async (fastify) => {
  // POST /referrals/generate - Generate or get existing referral code for a wallet
  fastify.post<{
    Body: { wallet: string }
  }>('/generate', async (request, reply) => {
    const { wallet } = request.body

    if (!wallet || typeof wallet !== 'string') {
      return reply.code(400).send({ error: 'wallet is required' })
    }

    // Basic Solana wallet validation (44 characters, base58)
    if (wallet.length < 32 || wallet.length > 44) {
      return reply.code(400).send({ error: 'Invalid Solana wallet address' })
    }

    try {
      const result = await getOrCreateReferralCode(wallet)

      return reply.code(200).send({
        success: true,
        data: {
          code: result.code,
          tier: result.tier,
          total_referrals: result.totalReferrals,
          total_earnings_usdc: result.totalEarningsUsdc,
          share_url: `${process.env.APP_URL || 'https://blink402.dev'}?ref=${result.code}`
        }
      })
    } catch (error) {
      fastify.log.error({ error, wallet }, 'Failed to generate referral code')
      return reply.code(500).send({ error: 'Failed to generate referral code' })
    }
  })

  // POST /referrals/track - Track a new referral (called when user visits with ?ref=CODE)
  fastify.post<{
    Body: { code: string; wallet: string }
  }>('/track', async (request, reply) => {
    const { code, wallet } = request.body

    if (!code || !wallet) {
      return reply.code(400).send({ error: 'code and wallet are required' })
    }

    // Basic validation
    if (typeof code !== 'string' || code.length < 3 || code.length > 20) {
      return reply.code(400).send({ error: 'Invalid referral code format' })
    }

    if (wallet.length < 32 || wallet.length > 44) {
      return reply.code(400).send({ error: 'Invalid Solana wallet address' })
    }

    try {
      const success = await trackReferral({
        referralCode: code,
        refereeWallet: wallet
      })

      return reply.code(200).send({
        success,
        message: success ? 'Referral tracked successfully' : 'Referral already exists or invalid code'
      })
    } catch (error) {
      fastify.log.error({ error, code, wallet }, 'Failed to track referral')
      return reply.code(500).send({ error: 'Failed to track referral' })
    }
  })

  // GET /referrals/stats?wallet=<wallet> - Get referral stats for a user
  fastify.get<{
    Querystring: { wallet: string }
  }>('/stats', async (request, reply) => {
    const { wallet } = request.query

    if (!wallet) {
      return reply.code(400).send({ error: 'wallet query parameter is required' })
    }

    if (wallet.length < 32 || wallet.length > 44) {
      return reply.code(400).send({ error: 'Invalid Solana wallet address' })
    }

    try {
      const stats = await getReferralStats(wallet)

      return reply.code(200).send({
        success: true,
        data: {
          code: stats.code,
          tier: stats.tier,
          total_referrals: stats.totalReferrals,
          total_earnings_usdc: stats.totalEarningsUsdc,
          share_url: stats.code ? `${process.env.APP_URL || 'https://blink402.dev'}?ref=${stats.code}` : null,
          referrals: stats.referrals.map(r => ({
            referee_wallet: r.refereeWallet,
            referred_at: r.referredAt,
            first_call_at: r.firstCallAt,
            total_spent_usdc: r.totalSpentUsdc,
            commission_paid_usdc: r.commissionPaidUsdc,
            status: r.firstCallAt ? 'active' : 'pending'
          }))
        }
      })
    } catch (error) {
      fastify.log.error({ error, wallet }, 'Failed to get referral stats')
      return reply.code(500).send({ error: 'Failed to get referral stats' })
    }
  })

  // GET /referrals/leaderboard?period=all&limit=20 - Get top referrers
  fastify.get<{
    Querystring: { period?: 'all' | 'month' | 'week'; limit?: number }
  }>('/leaderboard', async (request, reply) => {
    const { period = 'all', limit = 20 } = request.query

    // Validate period
    if (period && !['all', 'month', 'week'].includes(period)) {
      return reply.code(400).send({ error: 'period must be "all", "month", or "week"' })
    }

    // Validate limit
    const limitNum = Number(limit)
    if (isNaN(limitNum) || limitNum < 1 || limitNum > 100) {
      return reply.code(400).send({ error: 'limit must be between 1 and 100' })
    }

    try {
      const leaderboard = await getReferralLeaderboard({
        period,
        limit: limitNum
      })

      return reply.code(200).send({
        success: true,
        data: {
          period,
          count: leaderboard.length,
          leaderboard: leaderboard.map((entry, index) => ({
            rank: index + 1,
            wallet: entry.userWallet,
            code: entry.code,
            tier: entry.tier,
            total_referrals: entry.totalReferrals,
            total_earnings_usdc: entry.totalEarningsUsdc,
            creator_name: entry.creatorName || null,
            creator_avatar: entry.creatorAvatar || null
          }))
        }
      })
    } catch (error) {
      fastify.log.error({ error, period, limit }, 'Failed to get referral leaderboard')
      return reply.code(500).send({ error: 'Failed to get referral leaderboard' })
    }
  })

  // GET /referrals/tiers - Get tier information (reference data)
  fastify.get('/tiers', async (request, reply) => {
    return reply.code(200).send({
      success: true,
      data: {
        tiers: [
          {
            name: 'bronze',
            min_referrals: 0,
            max_referrals: 10,
            commission_rate: 0.05,
            spending_cap: 10.00,
            benefits: [
              '5% commission on first $10 spent per referral',
              'Basic referral tracking',
              'Access to leaderboard'
            ]
          },
          {
            name: 'silver',
            min_referrals: 11,
            max_referrals: 50,
            commission_rate: 0.10,
            spending_cap: 20.00,
            benefits: [
              '10% commission on first $20 spent per referral',
              'Enhanced referral analytics',
              'Silver badge on leaderboard',
              'Priority support'
            ]
          },
          {
            name: 'gold',
            min_referrals: 51,
            max_referrals: null,
            commission_rate: 0.15,
            spending_cap: 50.00,
            lifetime_rate: 0.02,
            benefits: [
              '15% commission on first $50 spent per referral',
              '2% lifetime commission after $50 cap',
              'Gold badge on leaderboard',
              'VIP support',
              'Early access to new features'
            ]
          }
        ],
        note: 'Tiers automatically upgrade as you reach referral thresholds. Commission caps apply per referee, not total.'
      }
    })
  })
}
