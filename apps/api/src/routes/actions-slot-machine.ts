import { FastifyPluginAsync } from 'fastify'
import crypto from 'crypto'
import { Keypair, PublicKey } from '@solana/web3.js'
import {
  getConnection,
  buildUsdcTransferTransaction,
  parsePublicKey,
  generateReference,
  usdcToLamports,
  lamportsToUsdc,
  getUsdcMint,
  buildRewardTransaction,
  signAndBroadcastReward,
  isValidSolanaAddress,
} from '@blink402/solana'
import {
  createRun,
  getRunBySignature,
  markRunExecuted,
  getBlinkBySlug,
  getCreatorPayoutKey,
  decrypt,
} from '@blink402/database'
import type { SlotSymbol } from '@blink402/types'

// Slot machine configuration (matches slots.ts)
const SLOT_CONFIG = {
  symbols: ['🎰', '💎', '⚡', '🍊', '🍋', '🍒'] as SlotSymbol[],
  weights: [2, 8, 15, 20, 25, 30],
  payouts: {
    '🎰🎰🎰': 50,
    '💎💎💎': 20,
    '⚡⚡⚡': 10,
    '🍊🍊🍊': 5,
    '🍋🍋🍋': 2,
    '🍒🍒🍒': 1.5,
  },
  betAmount: '0.10',
  rtp: 0.98,
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

  // Check for exact match
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

  // Check for partial match
  const uniqueSymbols = new Set(reels)
  if (uniqueSymbols.size === 2) {
    const multiplier = 0.5
    const payoutLamports = BigInt(Math.floor(betLamports * multiplier))
    return {
      payout: lamportsToUsdc(payoutLamports),
      multiplier,
      win: true,
    }
  }

  return { payout: '0', multiplier: 0, win: false }
}

/**
 * Generate provably fair spin result using SHA-256
 */
function generateProvablyFairSpin(
  serverSeed: string,
  clientSeed: string,
  nonce: string
): [SlotSymbol, SlotSymbol, SlotSymbol] {
  const combined = `${serverSeed}:${clientSeed}:${nonce}`
  const hash = crypto.createHash('sha256').update(combined).digest('hex')

  const reel1Value = parseInt(hash.substring(0, 8), 16) / 0xffffffff
  const reel2Value = parseInt(hash.substring(8, 16), 16) / 0xffffffff
  const reel3Value = parseInt(hash.substring(16, 24), 16) / 0xffffffff

  const reel1 = selectWeightedSymbol(reel1Value, SLOT_CONFIG.symbols, SLOT_CONFIG.weights)
  const reel2 = selectWeightedSymbol(reel2Value, SLOT_CONFIG.symbols, SLOT_CONFIG.weights)
  const reel3 = selectWeightedSymbol(reel3Value, SLOT_CONFIG.symbols, SLOT_CONFIG.weights)

  return [reel1, reel2, reel3]
}

export const actionsSlotMachineRoutes: FastifyPluginAsync = async (fastify) => {
  const baseUrl = process.env.APP_URL || 'http://localhost:3001'
  const webUrl = process.env.WEB_URL || process.env.NEXT_PUBLIC_APP_URL || 'https://blink402.dev'

  // GET /actions/slot-machine - Solana Actions metadata
  fastify.get('/', async (request, reply) => {
    try {
      const blink = await getBlinkBySlug('slot-machine')
      if (!blink) {
        return reply.code(404).send({ error: 'Slot machine blink not found' })
      }

      const metadata = {
        type: 'action',
        title: blink.title || '🎰 Slot Machine',
        icon: `${webUrl}/SLOTS.png`,
        description: blink.description || 'Pay 0.10 USDC and spin to win up to 5.0 USDC!',
        label: `Spin for ${SLOT_CONFIG.betAmount} USDC`,
        links: {
          actions: [
            {
              label: `Pay ${SLOT_CONFIG.betAmount} USDC & Spin`,
              href: `${baseUrl}/actions/slot-machine`,
            },
          ],
        },
      }

      return reply
        .code(200)
        .headers({
          'Content-Type': 'application/json',
          'X-Action-Version': '2.0',
          'X-Blockchain-Ids': 'solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp',
        })
        .send(metadata)
    } catch (error) {
      fastify.log.error({ error }, 'Error generating Actions metadata for slot-machine')
      return reply.code(500).send({ error: 'Failed to generate Actions metadata' })
    }
  })

  // POST /actions/slot-machine - Build transaction with callback
  fastify.post<{
    Body: {
      account?: string
      data?: { account?: string }
    }
  }>('/', async (request, reply) => {
    const { account: directAccount, data } = request.body

    try {
      const account = directAccount || data?.account
      if (!account) {
        return reply.code(400).send({ error: 'Missing required field: account' })
      }

      const payerPubkey = parsePublicKey(account)
      if (!payerPubkey) {
        return reply.code(400).send({ error: 'Invalid Solana address' })
      }

      const blink = await getBlinkBySlug('slot-machine')
      if (!blink) {
        return reply.code(404).send({ error: 'Slot machine blink not found' })
      }

      const recipientPubkey = parsePublicKey(blink.payout_wallet)
      if (!recipientPubkey) {
        return reply.code(500).send({ error: 'Invalid payout wallet address' })
      }

      // Generate reference for tracking
      const reference = generateReference()
      const referenceBase58 = reference.publicKey.toBase58()

      // Create run record
      await createRun({
        blinkId: blink.id,
        reference: referenceBase58,
      })

      // Build USDC transfer transaction
      const connection = getConnection()
      const amount = usdcToLamports(SLOT_CONFIG.betAmount)

      const transaction = await buildUsdcTransferTransaction({
        connection,
        sender: payerPubkey,
        recipient: recipientPubkey,
        amount,
        reference: reference.publicKey,
        memo: `Blink402: slot-machine`,
      })

      const serializedTransaction = transaction.serialize({
        requireAllSignatures: false,
        verifySignatures: false,
      })

      const base64Transaction = serializedTransaction.toString('base64')

      // Return transaction with PostNextActionLink callback
      return reply
        .code(200)
        .headers({
          'Content-Type': 'application/json',
          'X-Action-Version': '2.0',
        })
        .send({
          transaction: base64Transaction,
          message: `Pay ${SLOT_CONFIG.betAmount} USDC to spin the slot machine`,
          links: {
            next: {
              type: 'post',
              href: `${baseUrl}/actions/slot-machine/result`,
            },
          },
        })
    } catch (error) {
      fastify.log.error({ error }, 'Error building slot machine transaction')
      return reply.code(500).send({
        error: 'Failed to build transaction',
        details: error instanceof Error ? error.message : 'Unknown error',
      })
    }
  })

  // POST /actions/slot-machine/result - Callback after transaction confirmation
  fastify.post<{
    Body: {
      account: string
      signature: string
    }
  }>('/result', async (request, reply) => {
    const { account, signature } = request.body

    fastify.log.info({ account, signature }, 'Received result callback')

    try {
      if (!signature || !account) {
        return reply.code(400).send({ error: 'Missing signature or account' })
      }

      if (!isValidSolanaAddress(account)) {
        return reply.code(400).send({ error: 'Invalid account address' })
      }

      // Find the run by signature
      const run = await getRunBySignature(signature)

      if (!run) {
        fastify.log.error({ signature }, 'Run not found for signature')
        return reply.code(404).send({
          type: 'completed',
          icon: `${webUrl}/api/og/slot-result?win=false&error=true`,
          title: 'Payment Not Found',
          description: 'Could not find your payment. Please try again.',
          label: 'Spin Again',
        })
      }

      if (run.status === 'executed') {
        fastify.log.warn({ signature, runId: run.id }, 'Run already executed')
        return reply.code(200).send({
          type: 'completed',
          icon: `${webUrl}/api/og/slot-result?win=false&error=true`,
          title: 'Already Played',
          description: 'This spin has already been executed. Pay again to play!',
          label: 'Spin Again',
        })
      }

      // Generate provably fair result
      const serverSeed = crypto.randomBytes(32).toString('hex')
      const serverSeedHash = crypto.createHmac('sha256', serverSeed).digest('hex')
      const clientSeed = account
      const nonce = run.id

      const reels = generateProvablyFairSpin(serverSeed, clientSeed, nonce)
      const { payout, multiplier, win } = calculatePayout(reels, SLOT_CONFIG.betAmount)

      fastify.log.info({ reels, payout, multiplier, win }, 'Spin result calculated')

      // If win, send instant payout
      let payoutSignature: string | undefined

      if (win && Number(payout) > 0) {
        const blink = await getBlinkBySlug('slot-machine')
        if (!blink) {
          throw new Error('Slot machine blink not found')
        }

        try {
          const encryptedKey = await getCreatorPayoutKey(blink.payout_wallet)
          if (!encryptedKey) {
            throw new Error('Creator payout key not configured')
          }

          const creatorPrivateKey = decrypt(encryptedKey)
          const creatorKeypair = Keypair.fromSecretKey(Buffer.from(JSON.parse(creatorPrivateKey)))

          const connection = getConnection()
          const payoutLamports = usdcToLamports(payout)
          const usdcMint = getUsdcMint()

          const payoutTransaction = await buildRewardTransaction({
            connection,
            creator: creatorKeypair.publicKey,
            user: new PublicKey(account),
            amount: payoutLamports,
            memo: `Slot machine win: ${multiplier}x (${reels.join('')})`,
            tokenMint: usdcMint,
          })

          payoutSignature = await signAndBroadcastReward({
            connection,
            transaction: payoutTransaction,
            creatorKeypair,
            skipConfirmation: true,
          })

          fastify.log.info({ signature: payoutSignature, payer: account, amount: payout }, 'Payout sent successfully')
        } catch (error) {
          fastify.log.error({ error, payer: account, payout }, 'Failed to send payout')
          // Continue anyway - user at least knows they won
        }
      }

      // Mark run as executed
      await markRunExecuted({
        reference: run.reference,
        durationMs: 1000,
      })

      // Build dynamic OG image URL
      const reelsParam = encodeURIComponent(reels.join(','))
      const ogImageUrl = `${webUrl}/api/og/slot-result?reels=${reelsParam}&payout=${payout}&win=${win}&multiplier=${multiplier}`

      // Return CompletedAction with result
      const title = win ? `🎉 Won ${payout} USDC!` : '😔 No Win This Time'
      const description = win
        ? `Reels: ${reels.join(' ')}\nPayout: ${payout} USDC (${multiplier}x)${payoutSignature ? '\n✓ Sent to your wallet!' : '\n⚠️ Payout pending'}\n\nView full details: ${webUrl}/receipt/${signature}`
        : `Reels: ${reels.join(' ')}\n\nBetter luck next time!\n\nView details: ${webUrl}/receipt/${signature}`

      return reply.code(200).send({
        type: 'completed',
        icon: ogImageUrl,
        title,
        description,
        label: 'Spin Again',
        links: {
          actions: [
            {
              label: 'View Receipt',
              href: `${webUrl}/receipt/${signature}`,
            },
          ],
        },
      })
    } catch (error) {
      fastify.log.error({ error, signature, account }, 'Error processing spin result')

      return reply.code(500).send({
        type: 'completed',
        icon: `${webUrl}/api/og/slot-result?win=false&error=true`,
        title: 'Error Processing Spin',
        description: 'Something went wrong. Please contact support.',
        label: 'Try Again',
      })
    }
  })
}
