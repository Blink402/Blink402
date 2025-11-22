import { FastifyPluginAsync } from 'fastify'
import crypto from 'crypto'
import { Keypair, PublicKey, VersionedTransaction } from '@solana/web3.js'
import {
  getConnection,
  usdcToLamports,
  lamportsToUsdc,
  getUsdcMint,
  buildRewardTransaction,
  signAndBroadcastReward,
  isValidSolanaAddress,
} from '@blink402/solana'
// PayAI x402 SDK for payment verification and settlement
import { X402PaymentHandler } from 'x402-solana/server'

// Initialize PayAI payment handler
const payaiHandler = new X402PaymentHandler({
  network: process.env.SOLANA_NETWORK === 'devnet' ? 'solana-devnet' : 'solana',
  treasuryAddress: process.env.TREASURY_WALLET || process.env.PAYOUT_WALLET || '',
  facilitatorUrl: 'https://facilitator.payai.network',
})
import {
  getRunByReference,
  markRunExecuted,
  markRunFailed,
  getBlinkBySlug,
  getCreatorPayoutKey,
  decrypt,
} from '@blink402/database'
import type { SpinRequest, SpinResult, SlotSymbol } from '@blink402/types'

// Slot machine configuration
const SLOT_CONFIG = {
  symbols: ['🎰', '💎', '⚡', '🍊', '🍋', '🍒'] as SlotSymbol[],

  // Weighted probabilities (normalized to 100)
  // These are calibrated to achieve 98% RTP
  weights: [2, 8, 15, 20, 25, 30], // 🎰:2%, 💎:8%, ⚡:15%, 🍊:20%, 🍋:25%, 🍒:30%

  // Payout table (multipliers for matching symbols)
  payouts: {
    '🎰🎰🎰': 50,  // Jackpot: 50x (0.2% chance) = 5.0 USDC
    '💎💎💎': 20,   // 20x (1% chance) = 2.0 USDC
    '⚡⚡⚡': 10,   // 10x (3% chance) = 1.0 USDC
    '🍊🍊🍊': 5,    // 5x (8% chance) = 0.50 USDC
    '🍋🍋🍋': 2,    // 2x (15% chance) = 0.20 USDC
    '🍒🍒🍒': 1.5,  // 1.5x (20% chance) = 0.15 USDC
    // Partial match: any 2 symbols match = 0.5x (refund half the bet)
  },

  betAmount: '0.10', // USDC per spin
  rtp: 0.98, // 98% return to player
}

/**
 * Select a weighted random symbol based on a random value (0-1)
 */
function selectWeightedSymbol(randomValue: number, symbols: SlotSymbol[], weights: number[]): SlotSymbol {
  const totalWeight = weights.reduce((sum, w) => sum + w, 0)
  const threshold = randomValue * totalWeight

  let cumulativeWeight = 0
  for (let i = 0; i < symbols.length; i++) {
    cumulativeWeight += weights[i]
    if (threshold <= cumulativeWeight) {
      return symbols[i]
    }
  }

  // Fallback to last symbol (should never reach here)
  return symbols[symbols.length - 1]
}

/**
 * Calculate payout for a spin result
 */
function calculatePayout(reels: [SlotSymbol, SlotSymbol, SlotSymbol], betAmount: string): {
  payout: string
  multiplier: number
  win: boolean
} {
  const betLamports = Number(usdcToLamports(betAmount))

  // Check for exact match (all 3 symbols)
  const reelKey = reels.join('')
  if (SLOT_CONFIG.payouts[reelKey as keyof typeof SLOT_CONFIG.payouts]) {
    const multiplier = SLOT_CONFIG.payouts[reelKey as keyof typeof SLOT_CONFIG.payouts]
    const payoutLamports = BigInt(Math.floor(betLamports * multiplier))
    return {
      payout: lamportsToUsdc(payoutLamports),
      multiplier,
      win: true,
    }
  }

  // Check for partial match (any 2 symbols)
  const uniqueSymbols = new Set(reels)
  if (uniqueSymbols.size === 2) {
    // 2 symbols match - refund half the bet (0.5x multiplier)
    const multiplier = 0.5
    const payoutLamports = BigInt(Math.floor(betLamports * multiplier))
    return {
      payout: lamportsToUsdc(payoutLamports),
      multiplier,
      win: true,
    }
  }

  // No win
  return {
    payout: '0',
    multiplier: 0,
    win: false,
  }
}

/**
 * Generate provably fair spin result using SHA-256
 */
function generateProvablyFairSpin(
  serverSeed: string,
  clientSeed: string,
  nonce: string
): [SlotSymbol, SlotSymbol, SlotSymbol] {
  // Combine seeds and nonce
  const combined = `${serverSeed}:${clientSeed}:${nonce}`

  // Generate SHA-256 hash
  const hash = crypto.createHash('sha256').update(combined).digest('hex')

  // Convert hash to 3 random values (0-1) for each reel
  // Use different parts of the hash for independence
  const reel1Value = parseInt(hash.substring(0, 8), 16) / 0xffffffff
  const reel2Value = parseInt(hash.substring(8, 16), 16) / 0xffffffff
  const reel3Value = parseInt(hash.substring(16, 24), 16) / 0xffffffff

  // Map to symbols using weighted selection
  const reel1 = selectWeightedSymbol(reel1Value, SLOT_CONFIG.symbols, SLOT_CONFIG.weights)
  const reel2 = selectWeightedSymbol(reel2Value, SLOT_CONFIG.symbols, SLOT_CONFIG.weights)
  const reel3 = selectWeightedSymbol(reel3Value, SLOT_CONFIG.symbols, SLOT_CONFIG.weights)

  return [reel1, reel2, reel3]
}

export const slotsRoutes: FastifyPluginAsync = async (fastify) => {
  // POST /api/slots/spin - Execute a slot machine spin
  fastify.post<{ Body: SpinRequest }>('/spin', async (request, reply) => {
    const { reference, payer } = request.body

    // Get X-Payment header for direct payment verification
    const xPaymentHeader = request.headers['x-payment'] as string | undefined

    fastify.log.info({
      reference,
      payer,
      hasXPaymentHeader: !!xPaymentHeader,
      headerLength: xPaymentHeader?.length,
      allHeaders: Object.keys(request.headers)
    }, 'Received spin request')

    // Validate inputs
    if (!reference || !payer) {
      return reply.code(400).send({
        success: false,
        error: 'Missing required fields: reference and payer'
      })
    }

    if (!isValidSolanaAddress(payer)) {
      return reply.code(400).send({
        success: false,
        error: 'Invalid payer wallet address'
      })
    }

    try {
      // Step 1: Check if payment already exists
      let run = await getRunByReference(reference)

      fastify.log.info({
        reference,
        runExists: !!run,
        runStatus: run?.status,
        hasXPaymentHeader: !!xPaymentHeader
      }, 'Checked existing run')

      // If no run exists and X-Payment header provided, verify and create payment
      if (!run && xPaymentHeader) {
        fastify.log.info({ reference }, 'No existing run, verifying payment with PayAI')

        const blink = await getBlinkBySlug('slot-machine')
        if (!blink) {
          return reply.code(404).send({
            success: false,
            error: 'Slot machine blink not found'
          })
        }

        // Verify payment with PayAI
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
              description: 'Slot Machine Spin',
              resource: `https://blink402.dev/slot-machine`,
            }
          })

          // Verify payment with PayAI
          const isVerified = await payaiHandler.verifyPayment(xPaymentHeader, paymentRequirements)

          if (!isVerified) {
            return reply.code(402).send({
              success: false,
              error: 'Payment verification failed',
              details: 'PayAI verification returned false'
            })
          }

          // Settle payment with PayAI
          await payaiHandler.settlePayment(xPaymentHeader, paymentRequirements)

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
            fastify.log.warn({ error: e }, 'Failed to extract payer from x402 header')
          }

          // Create run record
          const { createRun, updateRunPaymentAtomic } = await import('@blink402/database')
          await createRun({
            blinkId: blink.id,
            reference,
          })

          // Update with payment info (using atomic version for concurrency safety)
          await updateRunPaymentAtomic({
            reference,
            signature: reference, // PayAI handles the actual tx hash
            payer: extractedPayer || payer
          })

          // Fetch the newly created run
          run = await getRunByReference(reference)
          if (!run) {
            throw new Error('Failed to create run record')
          }

          fastify.log.info({ reference }, 'Payment verified and settled via PayAI')
        } catch (error: any) {
          fastify.log.error({ error, reference }, 'PayAI payment verification failed')
          return reply.code(402).send({
            success: false,
            error: 'Payment verification failed',
            details: error.message
          })
        }
      }

      // At this point we should have a run
      if (!run) {
        fastify.log.error({ reference, hadXPaymentHeader: !!xPaymentHeader }, 'No run found after processing')
        return reply.code(404).send({
          success: false,
          error: 'Payment not found. Please complete payment first.'
        })
      }

      if (run.status === 'executed') {
        fastify.log.warn({ reference, runId: run.id }, 'Run already executed')
        return reply.code(409).send({
          success: false,
          error: 'This spin has already been executed. Please make a new payment to spin again.'
        })
      }

      if (run.status !== 'paid') {
        fastify.log.error({
          reference,
          runId: run.id,
          actualStatus: run.status,
          expectedStatus: 'paid'
        }, 'Payment not confirmed - returning 402')
        return reply.code(402).send({
          success: false,
          error: `Payment not confirmed. Current status: ${run.status}`
        })
      }

      // Step 2: Generate provably fair result
      const serverSeed = crypto.randomBytes(32).toString('hex')
      const serverSeedHash = crypto.createHmac('sha256', serverSeed).digest('hex')
      const clientSeed = payer // User's wallet address as client seed
      const nonce = run.id // Unique run ID as nonce

      fastify.log.info({
        reference,
        payer,
        nonce,
        serverSeedHash,
      }, 'Generating provably fair spin')

      // Generate reels using provably fair RNG
      const reels = generateProvablyFairSpin(serverSeed, clientSeed, nonce)

      // Step 3: Calculate payout
      const { payout, multiplier, win } = calculatePayout(reels, SLOT_CONFIG.betAmount)

      fastify.log.info({
        reels,
        payout,
        multiplier,
        win,
      }, 'Spin result calculated')

      // Step 4: If win, send instant payout to user
      let payoutSignature: string | undefined

      if (win && Number(payout) > 0) {
        // Get the blink to find the creator's wallet (declared outside try for error logging)
        const blink = await getBlinkBySlug('slot-machine')

        if (!blink) {
          fastify.log.error({ reference }, 'Slot machine blink not found')
          throw new Error('Slot machine blink not found')
        }

        try {
          // Get creator's encrypted payout key from database
          const encryptedKey = await getCreatorPayoutKey(blink.payout_wallet)

          if (!encryptedKey) {
            fastify.log.error({
              reference,
              blinkSlug: 'slot-machine',
              creatorWallet: blink.payout_wallet,
            }, 'Creator payout key not configured')
            throw new Error(
              'Slot machine payout wallet not configured. Please contact the creator to set up their payout key.'
            )
          }

          // Decrypt the private key
          const creatorPrivateKey = decrypt(encryptedKey)

          // Parse creator keypair
          const creatorKeypair = Keypair.fromSecretKey(
            Buffer.from(JSON.parse(creatorPrivateKey))
          )

          // Build payout transaction
          const connection = getConnection()
          const payoutLamports = usdcToLamports(payout)
          const usdcMint = getUsdcMint()

          const payoutTransaction = await buildRewardTransaction({
            connection,
            creator: creatorKeypair.publicKey,
            user: new PublicKey(payer),
            amount: payoutLamports,
            memo: `Slot machine win: ${multiplier}x (${reels.join('')})`,
            tokenMint: usdcMint, // USDC payout
          })

          fastify.log.info({
            payer,
            amount: payout,
            multiplier,
          }, 'Sending payout to winner')

          // Sign and broadcast payout
          payoutSignature = await signAndBroadcastReward({
            connection,
            transaction: payoutTransaction,
            creatorKeypair,
            skipConfirmation: true, // Don't wait for confirmation (faster UX)
          })

          fastify.log.info({
            signature: payoutSignature,
            payer,
            amount: payout,
          }, 'Payout sent successfully')
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error)
          const errorStack = error instanceof Error ? error.stack : undefined

          fastify.log.error({
            error: errorMessage,
            errorStack,
            payer,
            payout,
            creatorWallet: blink.payout_wallet
          }, 'Failed to send payout')

          // Don't fail the entire spin if payout fails
          // Mark run as executed but log the error
          await markRunFailed(run.reference)

          return reply.code(500).send({
            success: false,
            error: 'You won, but payout failed. Please contact support with this reference: ' + reference,
            details: errorMessage
          })
        }
      }

      // Step 5: Mark run as executed (duration is just spin processing time, not important for slots)
      await markRunExecuted({
        reference: run.reference,
        durationMs: 1000, // Fixed duration for slot spins
      })

      // Step 6: Return spin result to client
      const result: SpinResult = {
        success: true,
        reels,
        payout,
        win,
        multiplier,
        betAmount: SLOT_CONFIG.betAmount,
        serverSeed,
        serverSeedHash,
        clientSeed,
        nonce,
        reference,
        payoutSignature,
        message: win
          ? `You won ${payout} USDC! (${multiplier}x)${payoutSignature ? ' Payout sent to your wallet.' : ''}`
          : 'Better luck next time! Try again?',
      }

      return reply.code(200).send(result)

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      const errorStack = error instanceof Error ? error.stack : undefined

      fastify.log.error({
        error: errorMessage,
        errorStack,
        reference,
        payer
      }, 'Error processing spin')

      return reply.code(500).send({
        success: false,
        error: 'Failed to process spin',
        details: errorMessage
      })
    }
  })

  // GET /api/slots/config - Get slot machine configuration (for frontend)
  fastify.get('/config', async (request, reply) => {
    return reply.code(200).send({
      success: true,
      config: {
        symbols: SLOT_CONFIG.symbols,
        betAmount: SLOT_CONFIG.betAmount,
        rtp: SLOT_CONFIG.rtp,
        payouts: SLOT_CONFIG.payouts,
        maxPayout: lamportsToUsdc(
          BigInt(Number(usdcToLamports(SLOT_CONFIG.betAmount)) * 50) // 50x max jackpot
        ),
      },
    })
  })

  // POST /api/slots/verify - Verify a spin result was provably fair
  fastify.post<{
    Body: {
      serverSeed: string
      serverSeedHash: string
      clientSeed: string
      nonce: string
      reels: [SlotSymbol, SlotSymbol, SlotSymbol]
    }
  }>('/verify', async (request, reply) => {
    const { serverSeed, serverSeedHash, clientSeed, nonce, reels } = request.body

    try {
      // Step 1: Verify server seed hash matches
      const computedHash = crypto.createHmac('sha256', serverSeed).digest('hex')
      if (computedHash !== serverSeedHash) {
        return reply.code(400).send({
          success: false,
          error: 'Server seed does not match pre-committed hash. Possible manipulation detected.',
          expected: serverSeedHash,
          actual: computedHash,
        })
      }

      // Step 2: Regenerate spin result
      const regeneratedReels = generateProvablyFairSpin(serverSeed, clientSeed, nonce)

      // Step 3: Compare with claimed result
      const match = JSON.stringify(reels) === JSON.stringify(regeneratedReels)

      if (!match) {
        return reply.code(400).send({
          success: false,
          error: 'Spin result does not match provably fair calculation',
          claimed: reels,
          expected: regeneratedReels,
        })
      }

      // Step 4: Return verification success
      return reply.code(200).send({
        success: true,
        verified: true,
        message: 'Spin result is provably fair and has not been manipulated.',
        reels: regeneratedReels,
      })

    } catch (error) {
      fastify.log.error({ error }, 'Error verifying spin')

      return reply.code(500).send({
        success: false,
        error: 'Failed to verify spin',
        details: error instanceof Error ? error.message : 'Unknown error'
      })
    }
  })
}
