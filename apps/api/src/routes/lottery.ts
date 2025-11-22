import { FastifyPluginAsync } from 'fastify'
import crypto from 'crypto'
import { VersionedTransaction } from '@solana/web3.js'
import {
  getBlinkBySlug,
  getActiveRound,
  getMaxRoundNumber,
  createLotteryRound,
  createLotteryEntry,
  getRoundEntries,
  getUserEntriesInRound,
  getRoundWinners,
  getLotteryStatsByBlink,
  getLotteryHistory,
  getRoundById,
  getRunByReference,
  createRun,
  updateRunPaymentAtomic
} from '@blink402/database'
import { getConnection, getUsdcMint } from '@blink402/solana'
// PayAI x402 SDK for payment verification and settlement
import { X402PaymentHandler } from 'x402-solana/server'

// Initialize PayAI payment handler
const payaiHandler = new X402PaymentHandler({
  network: process.env.SOLANA_NETWORK === 'devnet' ? 'solana-devnet' : 'solana',
  treasuryAddress: process.env.TREASURY_WALLET || process.env.PAYOUT_WALLET || '',
  facilitatorUrl: 'https://facilitator.payai.network',
})
import type {
  LotteryEntryRequest,
  LotteryEntryResponse,
  LotteryCurrentRoundResponse,
  LotteryWinnersResponse
} from '@blink402/types'

/**
 * Internal function to create a lottery entry after payment verification
 * Can be called from both /lottery/:slug/enter and /actions/:slug endpoints
 */
export async function createLotteryEntryInternal(
  blink: any,
  run: any,
  payer: string,
  logger: any
): Promise<LotteryEntryResponse> {
  // 1. Get or create active round
  let activeRound = await getActiveRound(blink.id)
  if (!activeRound) {
    // Get max round number and create next round
    const maxRoundNumber = await getMaxRoundNumber(blink.id)
    const nextRoundNumber = maxRoundNumber + 1
    activeRound = await createLotteryRound(blink.id, nextRoundNumber)
    logger.info({ blinkId: blink.id, roundId: activeRound.id, roundNumber: nextRoundNumber }, 'Created new lottery round')
  }

  // 2. Create lottery entry
  const entry = await createLotteryEntry(
    activeRound.id,
    run.id,
    payer,
    blink.price_usdc // Entry fee (typically 1.00 USDC)
  )

  // 3. Get user's total entries in this round
  const userEntries = await getUserEntriesInRound(activeRound.id, payer)

  // 4. Get updated round stats
  const allEntries = await getRoundEntries(activeRound.id)
  const roundDurationMinutes = blink.lottery_round_duration_minutes || 15
  // Special case: if duration is 1, treat as seconds for testing
  const durationMs = roundDurationMinutes === 1
    ? 15 * 1000  // 15 seconds for testing
    : roundDurationMinutes * 60 * 1000  // Normal minutes
  const nextDrawAt = new Date(activeRound.started_at.getTime() + durationMs)

  const response: LotteryEntryResponse = {
    success: true,
    entry_id: entry.id,
    round_id: activeRound.id,
    round_number: activeRound.round_number,
    total_entries: allEntries.length,
    user_entries_in_round: userEntries,
    next_draw_at: nextDrawAt,
    message: roundDurationMinutes === 1
      ? `Entry #${allEntries.length} recorded! Draw in ${Math.ceil((nextDrawAt.getTime() - Date.now()) / 1000)} seconds.`
      : `Entry #${allEntries.length} recorded! Draw in ${Math.ceil((nextDrawAt.getTime() - Date.now()) / 1000 / 60)} minutes.`
  }

  logger.info({
    entryId: entry.id,
    roundId: activeRound.id,
    payer,
    totalEntries: allEntries.length
  }, 'Lottery entry created')

  return response
}

export const lotteryRoutes: FastifyPluginAsync = async (fastify) => {

  // POST /lottery/:slug/enter - Enter the lottery
  fastify.post<{
    Params: { slug: string }
    Body: { reference?: string; txSignature?: string; payer: string }
  }>('/:slug/enter', async (request, reply) => {
    const { slug } = request.params
    const { reference, txSignature, payer } = request.body

    // Get X-Payment header for x402 payment verification
    const xPaymentHeader = request.headers['x-payment'] as string | undefined

    fastify.log.info({
      slug,
      payer,
      hasReference: !!reference,
      hasTxSignature: !!txSignature,
      hasXPaymentHeader: !!xPaymentHeader,
      headerLength: xPaymentHeader?.length
    }, 'Received lottery entry request')

    try {
      // 1. Validate blink exists and is lottery-enabled
      const blink = await getBlinkBySlug(slug)
      if (!blink) {
        return reply.code(404).send({ error: 'Lottery not found' })
      }

      if (!blink.lottery_enabled) {
        return reply.code(400).send({ error: 'This blink is not a lottery' })
      }

      // 2. Get or create run record for payment tracking
      let run: any

      // Priority 1: X-Payment header (PayAI x402 flow)
      if (xPaymentHeader && !run) {
        fastify.log.info({ slug, payer }, 'Processing x402 payment via PayAI')

        try {
          // Prepare PayAI x402 payment requirements
          const amountInMicroUnits = Math.floor(parseFloat(blink.price_usdc) * 1_000_000).toString()
          const usdcMint = getUsdcMint()

          const paymentRequirements = await payaiHandler.createPaymentRequirements({
            price: {
              amount: amountInMicroUnits,
              asset: {
                address: usdcMint.toBase58(),
                decimals: 6
              }
            },
            network: process.env.SOLANA_NETWORK === 'devnet' ? 'solana-devnet' : 'solana',
            config: {
              description: blink.title || 'Lottery Entry',
              resource: `https://blink402.dev/lottery/${slug}`,
            }
          })

          // Verify payment with PayAI
          const isVerified = await payaiHandler.verifyPayment(xPaymentHeader, paymentRequirements)

          if (!isVerified) {
            fastify.log.error({ slug }, 'PayAI payment verification failed')
            return reply.code(402).send({
              error: 'Payment verification failed',
              details: 'PayAI verification returned false'
            })
          }

          fastify.log.info({ slug }, 'Payment verified via PayAI, settling...')

          // Settle payment with PayAI
          await payaiHandler.settlePayment(xPaymentHeader, paymentRequirements)

          fastify.log.info({ slug }, 'Payment settled via PayAI')

          // Extract payer wallet from x402 header
          let extractedPayer = payer
          try {
            const headerData = JSON.parse(Buffer.from(xPaymentHeader, 'base64').toString('utf-8'))
            if (headerData.payload && headerData.payload.transaction) {
              const txBytes = Buffer.from(headerData.payload.transaction, 'base64')
              const tx = VersionedTransaction.deserialize(txBytes)
              if (tx.message.compiledInstructions && tx.message.compiledInstructions.length >= 3) {
                const transferIx = tx.message.compiledInstructions[2]
                if (transferIx.accountKeyIndexes && transferIx.accountKeyIndexes.length >= 4) {
                  const authorityIndex = transferIx.accountKeyIndexes[3]
                  extractedPayer = tx.message.staticAccountKeys[authorityIndex].toBase58()
                }
              }
            }
          } catch (e) {
            fastify.log.warn({ error: e }, 'Failed to extract payer from x402 header, using provided payer')
          }

          // Create run record with new reference
          const newReference = crypto.randomUUID()
          run = await createRun({
            blinkId: blink.id,
            reference: newReference,
          })

          // Update with payment info
          await updateRunPaymentAtomic({
            reference: newReference,
            signature: newReference, // PayAI handles the actual tx hash
            payer: extractedPayer || payer
          })

          // Reload run to get updated status
          run = await getRunByReference(newReference)

          if (!run) {
            throw new Error('Failed to create run record after PayAI settlement')
          }

        } catch (error: any) {
          fastify.log.error({ error, slug, payer }, 'PayAI payment processing failed')
          return reply.code(402).send({
            error: 'Payment verification failed',
            details: error.message
          })
        }
      }

      // Priority 2: Direct transaction signature (legacy flow)
      else if (txSignature && !run) {
        // Direct frontend payment - verify transaction and create run record
        fastify.log.info({ txSignature, payer, slug }, 'Processing direct payment via transaction signature')

        // Verify transaction exists on-chain
        try {
          const connection = getConnection()
          const txInfo = await connection.getTransaction(txSignature, {
            commitment: 'confirmed',
            maxSupportedTransactionVersion: 0
          })

          if (!txInfo) {
            fastify.log.error({ txSignature }, 'Transaction not found on-chain')
            return reply.code(402).send({ error: 'Transaction not found on blockchain' })
          }

          if (txInfo.meta?.err) {
            fastify.log.error({ txSignature, error: txInfo.meta.err }, 'Transaction failed on-chain')
            return reply.code(402).send({ error: 'Transaction failed on blockchain' })
          }

          fastify.log.info({ txSignature, slot: txInfo.slot }, 'Transaction verified successfully')
        } catch (verifyError) {
          fastify.log.error({ txSignature, error: verifyError }, 'Payment verification error')
          return reply.code(402).send({ error: 'Failed to verify payment on-chain' })
        }

        // Create run record
        const newReference = crypto.randomUUID()
        run = await createRun({
          blinkId: blink.id,
          reference: newReference,
        })

        // Mark as paid with signature and payer
        await updateRunPaymentAtomic({
          reference: newReference,
          signature: txSignature,
          payer
        })

        // Reload run to get updated status
        run = await getRunByReference(newReference)

      } else if (reference) {
        // Existing flow - validate payment via run reference
        run = await getRunByReference(reference)
        if (!run) {
          return reply.code(404).send({ error: 'Payment reference not found' })
        }

        if (run.status !== 'paid' && run.status !== 'executed') {
          return reply.code(402).send({ error: 'Payment not completed' })
        }

        if (run.payer !== payer) {
          return reply.code(403).send({ error: 'Payer wallet mismatch' })
        }
      } else {
        return reply.code(400).send({ error: 'Payment required: provide X-Payment header, txSignature, or reference' })
      }

      // 3. Create lottery entry using internal function
      const response = await createLotteryEntryInternal(blink, run, payer, fastify.log)

      return reply.code(200).send(response)

    } catch (error) {
      fastify.log.error({ error, slug, reference, txSignature, payer }, 'Error creating lottery entry')

      // Check for duplicate entry error (run already used)
      if (error instanceof Error && 'code' in error && (error as any).code === '23505') {
        return reply.code(409).send({ error: 'This payment has already been used for a lottery entry' })
      }

      return reply.code(500).send({ error: 'Internal server error' })
    }
  })

  // GET /lottery/:slug/current - Get current round info
  fastify.get<{
    Params: { slug: string }
    Querystring: { wallet?: string }
  }>('/:slug/current', async (request, reply) => {
    const { slug } = request.params
    const { wallet } = request.query

    try {
      // 1. Validate blink
      const blink = await getBlinkBySlug(slug)
      if (!blink) {
        return reply.code(404).send({ error: 'Lottery not found' })
      }

      if (!blink.lottery_enabled) {
        return reply.code(400).send({ error: 'This blink is not a lottery' })
      }

      // 2. Get active round
      const activeRound = await getActiveRound(blink.id)
      if (!activeRound) {
        return reply.code(404).send({ error: 'No active round. Waiting for first entry to start round 1.' })
      }

      // 3. Calculate timing
      const roundDurationMinutes = blink.lottery_round_duration_minutes || 15
      // Special case: if duration is 1, treat as seconds for testing
      const durationMs = roundDurationMinutes === 1
        ? 15 * 1000  // 15 seconds for testing
        : roundDurationMinutes * 60 * 1000  // Normal minutes
      const nextDrawAt = new Date(activeRound.started_at.getTime() + durationMs)
      const timeRemainingSeconds = Math.max(0, Math.floor((nextDrawAt.getTime() - Date.now()) / 1000))

      fastify.log.info({
        slug,
        startedAt: activeRound.started_at,
        startedAtMs: activeRound.started_at.getTime(),
        durationMs,
        nextDrawAtMs: nextDrawAt.getTime(),
        nowMs: Date.now(),
        timeRemainingSeconds
      }, 'Lottery timing calculation')

      // 4. Get entries
      const entries = await getRoundEntries(activeRound.id)
      const entriesPool = entries.length * parseFloat(blink.price_usdc)
      const bonusPool = parseFloat(activeRound.bonus_pool_usdc || '0')
      const totalPool = entriesPool + bonusPool

      // 5. Calculate prize breakdown (fixed percentages)
      const prizeBreakdown = {
        first_place: (totalPool * 0.50).toFixed(6),
        second_place: (totalPool * 0.20).toFixed(6),
        third_place: (totalPool * 0.15).toFixed(6),
        platform_fee: (totalPool * 0.15).toFixed(6)
      }

      // 6. Get user entries if wallet provided
      let userEntries: number | undefined
      if (wallet) {
        userEntries = await getUserEntriesInRound(activeRound.id, wallet)
      }

      const response: LotteryCurrentRoundResponse = {
        round_id: activeRound.id,
        round_number: activeRound.round_number,
        started_at: activeRound.started_at,
        total_entries: entries.length,
        prize_pool_usdc: totalPool.toFixed(6),
        bonus_pool_usdc: activeRound.bonus_pool_usdc,
        next_draw_at: nextDrawAt,
        time_remaining_seconds: timeRemainingSeconds,
        user_entries: userEntries,
        prize_breakdown: prizeBreakdown
      }

      return reply.code(200).send(response)

    } catch (error) {
      fastify.log.error({ error, slug }, 'Error fetching current lottery round')
      return reply.code(500).send({ error: 'Internal server error' })
    }
  })

  // GET /lottery/:slug/history - Get past rounds
  fastify.get<{
    Params: { slug: string }
    Querystring: { limit?: number; offset?: number }
  }>('/:slug/history', async (request, reply) => {
    const { slug } = request.params
    const limit = Math.min(request.query.limit || 20, 100) // Cap at 100
    const offset = request.query.offset || 0

    try {
      // 1. Validate blink
      const blink = await getBlinkBySlug(slug)
      if (!blink) {
        return reply.code(404).send({ error: 'Lottery not found' })
      }

      if (!blink.lottery_enabled) {
        return reply.code(400).send({ error: 'This blink is not a lottery' })
      }

      // 2. Get history
      const history = await getLotteryHistory(blink.id, limit, offset)

      return reply.code(200).send({
        slug,
        blink_id: blink.id,
        rounds: history,
        limit,
        offset
      })

    } catch (error) {
      fastify.log.error({ error, slug }, 'Error fetching lottery history')
      return reply.code(500).send({ error: 'Internal server error' })
    }
  })

  // GET /lottery/:slug/winners/:roundId - Get winners for specific round
  fastify.get<{
    Params: { slug: string; roundId: string }
  }>('/:slug/winners/:roundId', async (request, reply) => {
    const { slug, roundId } = request.params

    try {
      // 1. Validate blink
      const blink = await getBlinkBySlug(slug)
      if (!blink) {
        return reply.code(404).send({ error: 'Lottery not found' })
      }

      if (!blink.lottery_enabled) {
        return reply.code(400).send({ error: 'This blink is not a lottery' })
      }

      // 2. Get round
      const round = await getRoundById(roundId)
      if (!round) {
        return reply.code(404).send({ error: 'Round not found' })
      }

      if (round.blink_id !== blink.id) {
        return reply.code(403).send({ error: 'Round does not belong to this lottery' })
      }

      if (round.status === 'active') {
        return reply.code(400).send({ error: 'Round is still active. Winners not yet selected.' })
      }

      // 3. Get winners
      const winners = await getRoundWinners(roundId)

      // 4. Calculate platform fee
      const totalPool = parseFloat(round.total_entry_fee_usdc)
      const platformFee = (totalPool * 0.15).toFixed(6)

      const response: LotteryWinnersResponse = {
        round_id: round.id,
        round_number: round.round_number,
        ended_at: round.ended_at!,
        total_entries: round.total_entries,
        prize_pool_usdc: round.total_entry_fee_usdc,
        winners: winners.map(w => ({
          wallet: w.winner_wallet,
          rank: w.payout_rank,
          payout_amount_usdc: w.payout_amount_usdc,
          tx_signature: w.payout_tx_signature,
          completed_at: w.completed_at
        })),
        platform_fee_usdc: platformFee
      }

      return reply.code(200).send(response)

    } catch (error) {
      fastify.log.error({ error, slug, roundId }, 'Error fetching lottery winners')
      return reply.code(500).send({ error: 'Internal server error' })
    }
  })

  // GET /lottery/:slug/stats - Get overall lottery statistics
  fastify.get<{
    Params: { slug: string }
  }>('/:slug/stats', async (request, reply) => {
    const { slug } = request.params

    try {
      // 1. Validate blink
      const blink = await getBlinkBySlug(slug)
      if (!blink) {
        return reply.code(404).send({ error: 'Lottery not found' })
      }

      if (!blink.lottery_enabled) {
        return reply.code(400).send({ error: 'This blink is not a lottery' })
      }

      // 2. Get stats
      const stats = await getLotteryStatsByBlink(blink.id)

      return reply.code(200).send({
        slug,
        blink_id: blink.id,
        ...stats
      })

    } catch (error) {
      fastify.log.error({ error, slug }, 'Error fetching lottery stats')
      return reply.code(500).send({ error: 'Internal server error' })
    }
  })

  // GET /lottery/:slug/claim - Claim lottery entry with transaction signature
  // Recovery endpoint for users who paid but entry wasn't created (e.g., Twitter/X flow issues)
  fastify.get<{
    Params: { slug: string }
    Querystring: { signature?: string; reference?: string; payer?: string }
  }>('/:slug/claim', async (request, reply) => {
    const { slug } = request.params
    const { signature, reference, payer } = request.query

    try {
      // 1. Validate blink
      const blink = await getBlinkBySlug(slug)
      if (!blink) {
        return reply.code(404).send({ error: 'Lottery not found' })
      }

      if (!blink.lottery_enabled) {
        return reply.code(400).send({ error: 'This blink is not a lottery' })
      }

      // 2. Validate query parameters
      if (!signature && !reference) {
        return reply.code(400).send({
          error: 'Missing required parameter: signature or reference',
          message: 'Provide either transaction signature or payment reference to claim your entry'
        })
      }

      if (!payer) {
        return reply.code(400).send({
          error: 'Missing required parameter: payer',
          message: 'Provide your wallet address to claim your entry'
        })
      }

      // 3. Find or create run record
      let run: any

      if (reference) {
        // Try to find by reference first
        run = await getRunByReference(reference)
        if (!run) {
          return reply.code(404).send({ error: 'Payment reference not found' })
        }
      } else if (signature) {
        // Verify transaction on-chain
        const connection = getConnection()
        const txInfo = await connection.getTransaction(signature, {
          commitment: 'confirmed',
          maxSupportedTransactionVersion: 0
        })

        if (!txInfo) {
          return reply.code(404).send({ error: 'Transaction not found on blockchain' })
        }

        if (txInfo.meta?.err) {
          return reply.code(400).send({ error: 'Transaction failed on blockchain' })
        }

        // Create run record from transaction
        const newReference = crypto.randomUUID()
        run = await createRun({
          blinkId: blink.id,
          reference: newReference,
        })

        // Mark as paid
        await updateRunPaymentAtomic({
          reference: newReference,
          signature,
          payer
        })

        // Reload run
        run = await getRunByReference(newReference)
      }

      if (!run) {
        return reply.code(500).send({ error: 'Failed to create or find payment record' })
      }

      // 4. Check if entry already exists for this run
      // Note: This check happens in createLotteryEntry via unique constraint
      // We'll let it throw a duplicate error if entry exists

      // 5. Create lottery entry
      const response = await createLotteryEntryInternal(blink, run, payer, fastify.log)

      fastify.log.info({
        slug,
        signature,
        reference,
        payer,
        entryId: response.entry_id,
        roundId: response.round_id
      }, 'Lottery entry claimed successfully')

      return reply.code(200).send({
        ...response,
        message: `✅ Entry claimed successfully! ${response.message}`,
        claimed_via: signature ? 'signature' : 'reference'
      })

    } catch (error) {
      fastify.log.error({ error, slug, signature, reference, payer }, 'Error claiming lottery entry')

      // Check for duplicate entry error
      if (error instanceof Error && 'code' in error && (error as any).code === '23505') {
        return reply.code(409).send({
          error: 'Entry already exists',
          message: 'This payment has already been used for a lottery entry'
        })
      }

      return reply.code(500).send({ error: 'Internal server error' })
    }
  })
}
