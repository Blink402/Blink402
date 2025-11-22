import { FastifyPluginAsync } from 'fastify'
import { getPool, createRun, getRunByReference } from '@blink402/database'
import {
  trackView,
  getViewData,
  deleteViewData
} from '@blink402/redis'

/**
 * Social View Tracking for Reverse Blink
 *
 * This endpoint validates that a user viewed the project's social media page
 * before claiming a reward. Used for the "View Socials - Earn USDC" reverse blink.
 *
 * Tiered reward structure:
 * - First 50 claims: $1.00 USDC
 * - Claims 51-200: $0.10 USDC
 * - Claims 201+: $0.02 USDC
 */

// Tiered reward configuration
const REWARD_TIERS = [
  { maxClaims: 50, amount: '1.00', label: 'Early Bird' },
  { maxClaims: 200, amount: '0.10', label: 'Standard' },
  { maxClaims: Infinity, amount: '0.02', label: 'Base' }
]

/**
 * Get current reward tier based on total claims
 */
async function getCurrentRewardTier(blinkId: string): Promise<{
  amount: string
  tier: string
  claimsInTier: number
  remainingInTier: number
  totalClaims: number
}> {
  const pool = getPool()

  // Count total claims for this blink
  const result = await pool.query(
    'SELECT COUNT(*) as total FROM reward_claims WHERE blink_id = $1',
    [blinkId]
  )

  const totalClaims = parseInt(result.rows[0]?.total || '0', 10)

  // Find current tier
  let currentTier = REWARD_TIERS[REWARD_TIERS.length - 1]
  let previousMax = 0

  for (const tier of REWARD_TIERS) {
    if (totalClaims < tier.maxClaims) {
      currentTier = tier
      break
    }
    previousMax = tier.maxClaims
  }

  const claimsInTier = totalClaims - previousMax
  const remainingInTier = currentTier.maxClaims - totalClaims

  return {
    amount: currentTier.amount,
    tier: currentTier.label,
    claimsInTier,
    remainingInTier: remainingInTier === Infinity ? -1 : remainingInTier,
    totalClaims
  }
}

export const socialViewRoutes: FastifyPluginAsync = async (fastify) => {
  /**
   * POST /a/track-view
   * Called automatically when user loads the social view page
   * Stores timestamp and IP to verify user actually visited and prevent abuse
   */
  fastify.post<{
    Body: { reference: string; wallet?: string }
  }>('/track-view', {
    config: {
      rateLimit: {
        max: 500, // Higher limit for public endpoint (500 req/min)
        timeWindow: '1 minute'
      }
    }
  }, async (request, reply) => {
    const { reference, wallet } = request.body

    if (!reference) {
      return reply.code(400).send({
        error: 'Missing reference',
        message: 'Reference is required'
      })
    }

    // Extract IP address (handles proxies/load balancers)
    const ip = request.headers['x-forwarded-for']?.toString().split(',')[0].trim() ||
               request.headers['x-real-ip']?.toString() ||
               request.ip

    // NOTE: We don't check IP claims here anymore - that happens during actual claim validation
    // This allows multiple users behind same IP (NAT/VPN/mobile carriers) to view the page
    // IP claim check is enforced in /a/validate-view endpoint

    try {
      // Get the blink ID for the view-socials-earn reverse blink
      const pool = getPool()
      const blinkResult = await pool.query(
        'SELECT id FROM blinks WHERE slug = $1 AND payment_mode = $2',
        ['view-socials-earn', 'reward']
      )

      if (blinkResult.rows.length === 0) {
        fastify.log.error('view-socials-earn blink not found in database')
        return reply.code(500).send({
          error: 'Configuration error',
          message: 'Reverse blink not properly configured'
        })
      }

      const blinkId = blinkResult.rows[0].id

      // Check if run already exists (in case of page refresh)
      const existingRun = await getRunByReference(reference)
      if (!existingRun) {
        // Create a run in the database for this reference
        // This is required for the reward claim flow
        await createRun({
          blinkId,
          reference,
          metadata: { flow: 'reward', wallet, ip }
        })
        fastify.log.info({ reference, blinkId }, 'Created new run for reward claim')
      } else {
        fastify.log.info({ reference, blinkId }, 'Run already exists, skipping creation')
      }

      // Record the view with timestamp and IP in Redis (survives restarts!)
      await trackView({ reference, wallet, ip })

      fastify.log.info({ reference, wallet, ip, blinkId }, 'Social view tracked and run created')

      return reply.code(200).send({
        success: true,
        message: 'View tracked successfully',
        reference
      })
    } catch (error) {
      fastify.log.error({ error, reference }, 'Error tracking view')
      return reply.code(500).send({
        error: 'Internal server error',
        message: 'Failed to track view'
      })
    }
  })

  /**
   * GET /a/reward-info/:slug
   * Get current reward tier information for display on frontend
   */
  fastify.get<{
    Params: { slug: string }
  }>('/reward-info/:slug', {
    config: {
      rateLimit: {
        max: 500, // Higher limit for public endpoint (500 req/min)
        timeWindow: '1 minute'
      }
    }
  }, async (request, reply) => {
    const { slug } = request.params

    try {
      const pool = getPool()

      // Get blink by slug (include expires_at)
      const blinkResult = await pool.query(
        'SELECT id, reward_amount, expires_at FROM blinks WHERE slug = $1 AND payment_mode = $2',
        [slug, 'reward']
      )

      if (blinkResult.rows.length === 0) {
        return reply.code(404).send({
          error: 'Blink not found',
          message: 'Reverse blink not found'
        })
      }

      const blink = blinkResult.rows[0]
      const isExpired = blink.expires_at && new Date(blink.expires_at) < new Date()
      const tierInfo = await getCurrentRewardTier(blink.id)

      return reply.code(200).send({
        success: true,
        current_amount: tierInfo.amount,
        tier: tierInfo.tier,
        total_claims: tierInfo.totalClaims,
        remaining_in_tier: tierInfo.remainingInTier,
        expired: isExpired,
        expires_at: blink.expires_at,
        tiers: REWARD_TIERS.map(t => ({
          max_claims: t.maxClaims === Infinity ? null : t.maxClaims,
          amount: t.amount,
          label: t.label
        }))
      })
    } catch (error) {
      fastify.log.error({ error, slug }, 'Error fetching reward info')
      return reply.code(500).send({
        error: 'Internal server error',
        message: 'Failed to fetch reward information'
      })
    }
  })

  /**
   * POST /a/validate-view
   * Called by proxy.ts reward mode to validate user completed the view action
   * Returns 200 if view was recorded recently, 400 otherwise
   * Also returns current reward tier info
   */
  fastify.post<{
    Body: { reference: string; signature: string; user_wallet: string; blink_id?: string }
  }>('/validate-view', {
    config: {
      rateLimit: {
        max: 300, // Moderate limit since this is called during claim (300 req/min)
        timeWindow: '1 minute'
      }
    }
  }, async (request, reply) => {
    const { reference, user_wallet } = request.body

    if (!reference) {
      return reply.code(400).send({
        error: 'Missing reference',
        message: 'Reference is required for validation'
      })
    }

    // Check if view was tracked (in Redis - survives restarts!)
    const viewData = await getViewData(reference)

    if (!viewData) {
      fastify.log.warn({ reference, user_wallet }, 'View validation failed: No view record found')
      return reply.code(400).send({
        error: 'View not recorded',
        message: 'You must visit the social page before claiming your reward'
      })
    }

    // IP-based blocking removed - database unique constraint on (blink_id, user_wallet, reference) prevents duplicates
    // This allows multiple users behind same IP (mobile carriers, VPNs, corporate NAT) to claim

    // Check if view is recent (within 10 minutes)
    const now = Date.now()
    const tenMinutes = 10 * 60 * 1000
    const timeSinceView = now - viewData.timestamp

    if (timeSinceView > tenMinutes) {
      fastify.log.warn({ reference, user_wallet, timeSinceView }, 'View validation failed: View too old')
      return reply.code(400).send({
        error: 'View expired',
        message: 'Your view session has expired. Please visit the social page again.'
      })
    }

    // Get current reward tier info
    try {
      const pool = getPool()

      // Get blink info (we know the slug for this specific reverse blink)
      const blinkResult = await pool.query(
        'SELECT id, expires_at FROM blinks WHERE slug = $1 AND payment_mode = $2',
        ['view-socials-earn', 'reward']
      )

      if (blinkResult.rows.length === 0) {
        fastify.log.error('view-socials-earn blink not found in database')
        return reply.code(500).send({
          error: 'Configuration error',
          message: 'Reverse blink not properly configured'
        })
      }

      const blink = blinkResult.rows[0]

      // Check if campaign has expired
      if (blink.expires_at && new Date(blink.expires_at) < new Date()) {
        fastify.log.warn({ reference, user_wallet }, 'Claim rejected: Campaign has expired')
        return reply.code(400).send({
          error: 'Campaign expired',
          message: 'This campaign has ended. Thank you for your interest!'
        })
      }

      const blinkId = blink.id
      const tierInfo = await getCurrentRewardTier(blinkId)

      // Validation passed!
      fastify.log.info({
        reference,
        user_wallet,
        timeSinceView: Math.round(timeSinceView / 1000) + 's',
        tier: tierInfo.tier,
        reward_amount: tierInfo.amount,
        total_claims: tierInfo.totalClaims,
        ip: viewData.ip
      }, 'View validation successful')

      // Clean up the tracking entry (one-time use)
      await deleteViewData(reference)

      return reply.code(200).send({
        success: true,
        message: 'View validated successfully',
        time_since_view_seconds: Math.round(timeSinceView / 1000),
        // Include tier info for proxy.ts to use
        reward_amount: tierInfo.amount,
        tier: tierInfo.tier,
        total_claims: tierInfo.totalClaims,
        remaining_in_tier: tierInfo.remainingInTier
      })
    } catch (error) {
      fastify.log.error({ error, reference, user_wallet }, 'Error getting reward tier info')
      return reply.code(500).send({
        error: 'Internal server error',
        message: 'Failed to process reward validation'
      })
    }
  })

  /**
   * GET /a/view-stats
   * Optional: See current view tracking stats (for debugging)
   * Note: With Redis, we can't easily count all views, so this returns basic info
   */
  fastify.get('/view-stats', {
    config: {
      rateLimit: {
        max: 200, // Moderate limit for debugging endpoint (200 req/min)
        timeWindow: '1 minute'
      }
    }
  }, async (request, reply) => {
    return reply.code(200).send({
      message: 'View tracking now uses Redis for persistence',
      storage: 'Redis',
      ttl: '15 minutes',
      note: 'Views persist across deployments and container restarts'
    })
  })
}
