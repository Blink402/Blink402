import { FastifyPluginAsync } from 'fastify'
import { Keypair } from '@solana/web3.js'
import { getPool, createRun, createRewardClaim, markRunExecuted } from '@blink402/database'
import {
  getConnection,
  usdcToLamports,
  parsePublicKey,
  getUsdcMint,
  buildRewardTransaction,
  signAndBroadcastReward,
} from '@blink402/solana'

/**
 * Thank You Claim Endpoint
 *
 * This endpoint handles USDC reward claims for the thank-you campaign.
 * - Max 500 total claims
 * - Backend determines random payout (1st = 0.5, 2-6 = 0.1, rest = random 0.001-0.03)
 * - One claim per wallet (enforced by DB UNIQUE constraint)
 * - Immediate claim (no view tracking required)
 */

const MAX_CLAIMS = 500

/**
 * Get random reward amount based on claim number
 * IMPORTANT: This logic is NEVER exposed to frontend
 *
 * Payout structure:
 * - Claim 1: 50 USDC (fixed - guaranteed winner!)
 * - Claims 2-500: Random 0.001-0.009 USDC (less than 1 cent)
 */
function getRandomRewardAmount(claimNumber: number): string {
  if (claimNumber === 1) {
    // First claimer gets 50 USDC
    return '50.00'
  }

  // Claims 2-500: All get random small amounts (less than 1 cent)
  const min = 0.001
  const max = 0.009
  const random = Math.random() * (max - min) + min
  return random.toFixed(3)
}

export const thankYouClaimRoutes: FastifyPluginAsync = async (fastify) => {
  /**
   * POST /a/thank-you-claim
   * Main claim endpoint for thank-you campaign
   */
  fastify.post<{
    Body: { reference: string; user_wallet: string }
  }>('/thank-you-claim', {
    config: {
      rateLimit: {
        max: 500, // 500 req/min to handle high traffic (all 500 claims could happen fast)
        timeWindow: '1 minute'
      }
    }
  }, async (request, reply) => {
    const startTime = Date.now()
    const { reference, user_wallet } = request.body

    if (!reference || !user_wallet) {
      return reply.code(400).send({
        error: 'Missing required fields',
        message: 'Both reference and user_wallet are required'
      })
    }

    try {
      const pool = getPool()

      // Get the thank-you-claim blink
      const blinkResult = await pool.query(
        'SELECT id, payout_wallet, max_claims_per_user FROM blinks WHERE slug = $1 AND payment_mode = $2 AND status = $3',
        ['thank-you-claim', 'reward', 'active']
      )

      if (blinkResult.rows.length === 0) {
        fastify.log.error('thank-you-claim blink not found or inactive')
        return reply.code(500).send({
          error: 'Campaign not available',
          message: 'This campaign is not currently active'
        })
      }

      const blink = blinkResult.rows[0]
      const blinkId = blink.id
      const maxClaimsPerUser = blink.max_claims_per_user || 1

      // Count total claims for this blink
      const claimCountResult = await pool.query(
        'SELECT COUNT(*) as total FROM reward_claims WHERE blink_id = $1',
        [blinkId]
      )

      const totalClaims = parseInt(claimCountResult.rows[0]?.total || '0', 10)

      // Check if max claims reached
      if (totalClaims >= MAX_CLAIMS) {
        fastify.log.warn({ totalClaims, user_wallet }, 'Max claims reached')
        return reply.code(403).send({
          error: 'Campaign ended',
          message: 'All 500 rewards have been claimed. Thank you for your interest!'
        })
      }

      // Check if this wallet has reached their personal claim limit in the last 10 minutes
      const userClaimCountResult = await pool.query(
        `SELECT COUNT(*) as user_claims
         FROM reward_claims
         WHERE blink_id = $1
         AND user_wallet = $2
         AND claimed_at > NOW() - INTERVAL '10 minutes'`,
        [blinkId, user_wallet]
      )

      const userClaimCount = parseInt(userClaimCountResult.rows[0]?.user_claims || '0', 10)

      if (userClaimCount >= maxClaimsPerUser) {
        return reply.code(403).send({
          error: 'Claim limit reached',
          message: `You have reached the maximum of ${maxClaimsPerUser} claims per wallet. Try again in 10 minutes.`
        })
      }

      // Determine reward amount (backend only - NEVER exposed to frontend)
      const claimNumber = totalClaims + 1
      const rewardAmount = getRandomRewardAmount(claimNumber)

      fastify.log.info({
        claimNumber,
        rewardAmount,
        user_wallet,
        reference
      }, 'Determined reward amount')

      // Load giveaway wallet keypair (from env)
      const creatorKeypairSecret = process.env.REWARD_KEYPAIR_SECRET
      if (!creatorKeypairSecret) {
        fastify.log.error('REWARD_KEYPAIR_SECRET not configured')
        return reply.code(500).send({
          error: 'Server configuration error',
          message: 'Reward payments are not configured'
        })
      }

      const creatorKeypair = Keypair.fromSecretKey(
        Uint8Array.from(JSON.parse(creatorKeypairSecret))
      )

      // Verify keypair matches the giveaway wallet
      if (creatorKeypair.publicKey.toBase58() !== blink.payout_wallet) {
        fastify.log.error({
          loadedKeypair: creatorKeypair.publicKey.toBase58(),
          expectedWallet: blink.payout_wallet
        }, 'Keypair mismatch')
        return reply.code(500).send({
          error: 'Server configuration error',
          message: 'Giveaway wallet configuration mismatch'
        })
      }

      // Parse user wallet address
      const userPubkey = parsePublicKey(user_wallet)
      if (!userPubkey) {
        fastify.log.error({ user_wallet }, 'Invalid user wallet address')
        return reply.code(400).send({
          error: 'Invalid wallet address',
          message: 'The provided wallet address is not valid'
        })
      }

      // Get Solana connection
      const connection = getConnection()

      // Convert USDC amount to lamports (smallest unit)
      const amount = usdcToLamports(rewardAmount)

      // Build reward transaction
      const rewardTx = await buildRewardTransaction({
        connection,
        creator: creatorKeypair.publicKey,
        user: userPubkey,
        amount,
        reference: undefined, // No on-chain reference needed
        memo: `Blink402 thank you reward: ${rewardAmount} USDC`,
        tokenMint: getUsdcMint(),
      })

      // Sign and broadcast transaction
      const rewardSignature = await signAndBroadcastReward({
        connection,
        transaction: rewardTx,
        creatorKeypair,
        skipConfirmation: true, // Don't wait for confirmation to avoid timeouts during congestion
      })

      fastify.log.info({
        user_wallet,
        rewardSignature,
        rewardAmount,
        claimNumber,
        totalClaims: claimNumber
      }, 'Reward payment sent successfully')

      // Create run in database (if doesn't exist)
      try {
        await createRun({
          blinkId,
          reference,
          metadata: { flow: 'thank-you', wallet: user_wallet }
        })
      } catch (error) {
        // Run might already exist, that's ok
        fastify.log.debug({ reference, error }, 'Run creation skipped (may already exist)')
      }

      // Record claim in database
      await createRewardClaim({
        blinkId,
        userWallet: user_wallet,
        reference,
        signature: rewardSignature,
      })

      // Mark run as executed
      const duration = Date.now() - startTime
      await markRunExecuted({ reference, durationMs: duration })

      // Return success response
      return reply.code(200).send({
        success: true,
        signature: rewardSignature,
        reward_amount: rewardAmount,
        reward_token: 'USDC',
        message: `You received ${rewardAmount} USDC. Thank you for supporting Blink402!`
      })
    } catch (error: any) {
      fastify.log.error({
        error: error.message,
        errorStack: error.stack,
        errorName: error.name,
        reference,
        user_wallet
      }, 'Error processing claim')
      return reply.code(500).send({
        error: 'Internal server error',
        message: error.message || 'Failed to process reward claim'
      })
    }
  })

  /**
   * GET /a/campaign-info/:slug
   * Get campaign info (remaining claims, total claimed, max claims, active status)
   */
  fastify.get<{
    Params: { slug: string }
  }>('/campaign-info/:slug', {
    config: {
      rateLimit: {
        max: 500, // High limit for public endpoint
        timeWindow: '1 minute'
      }
    }
  }, async (request, reply) => {
    const { slug } = request.params

    try {
      const pool = getPool()

      // Get blink by slug
      const blinkResult = await pool.query(
        'SELECT id, status FROM blinks WHERE slug = $1 AND payment_mode = $2',
        [slug, 'reward']
      )

      if (blinkResult.rows.length === 0) {
        return reply.code(404).send({
          error: 'Campaign not found',
          message: 'Campaign does not exist'
        })
      }

      const blink = blinkResult.rows[0]
      const blinkId = blink.id
      const isActive = blink.status === 'active'

      // Count total claims
      const claimCountResult = await pool.query(
        'SELECT COUNT(*) as total FROM reward_claims WHERE blink_id = $1',
        [blinkId]
      )

      const totalClaimed = parseInt(claimCountResult.rows[0]?.total || '0', 10)
      const remainingClaims = Math.max(0, MAX_CLAIMS - totalClaimed)

      return reply.code(200).send({
        success: true,
        total_claimed: totalClaimed,
        remaining_claims: remainingClaims,
        max_claims: MAX_CLAIMS,
        active: isActive && totalClaimed < MAX_CLAIMS
      })
    } catch (error) {
      fastify.log.error({ error, slug }, 'Error fetching campaign info')
      return reply.code(500).send({
        error: 'Internal server error',
        message: 'Failed to fetch campaign information'
      })
    }
  })
}
