/**
 * Solana Actions Metadata Endpoints (Dialect Standard)
 *
 * IMPORTANT: This is METADATA ONLY for Dialect unfurling support.
 * Actual payments use ONCHAIN x402 protocol via /bazaar/:slug
 *
 * These endpoints enable Twitter/X unfurling when sharing blink URLs.
 * Wallets will redirect to /checkout flow for actual transactions.
 */

import { FastifyPluginAsync } from 'fastify'
import { getBlinkBySlug, createRun, updateRunPaymentAtomic } from '@blink402/database'
import {
  getConnection,
  buildSolTransferTransaction,
  generateReference,
  parsePublicKey,
  usdcToLamports,
  solToLamports,
} from '@blink402/solana'
import {
  PublicKey,
  Transaction,
  ComputeBudgetProgram,
} from '@solana/web3.js'
import {
  getAssociatedTokenAddress,
  createTransferCheckedInstruction,
} from '@solana/spl-token'
import { createLotteryEntryInternal } from './lottery.js'

const USDC_MINT = new PublicKey("EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v")
const USDC_DECIMALS = 6

export const actionsMetadataRoutes: FastifyPluginAsync = async (fastify) => {
  /**
   * GET /actions/:slug
   * Returns Solana Actions metadata for Dialect unfurling
   * Redirects to /checkout flow for actual payments
   */
  fastify.get<{ Params: { slug: string } }>('/:slug', async (request, reply) => {
    const { slug } = request.params

    try {
      const blink = await getBlinkBySlug(slug)

      if (!blink) {
        return reply.code(404).send({ error: 'Blink not found' })
      }

      // Build Actions metadata (Dialect standard) for all blinks
      // Always use blink402.dev for production (custom domain)
      const webUrl = 'https://blink402.dev'

      // Build actions array with input parameters
      const actions: any[] = []

      // Lottery blinks - special handling
      if (blink.lottery_enabled || slug.includes('lottery')) {
        const entryPrice = parseFloat(blink.price_usdc)
        actions.push({
          label: `🎰 Buy Entry (${entryPrice} USDC)`,
          href: `/api/actions/${slug}`,
        })
      }
      // Dynamic parameter handling: Read from blink.parameters if defined
      // This allows any blink to declare input parameters via database
      else if (blink.parameters && blink.parameters.length > 0) {
        actions.push({
          label: blink.method === 'POST' ? 'Submit Request' : 'Get Data',
          href: `/api/actions/${slug}`,
          parameters: blink.parameters.map(param => ({
            name: param.name,
            label: param.label,
            type: param.type,
            required: param.required,
            pattern: param.pattern,
            patternDescription: param.patternDescription,
            placeholder: param.placeholder,
            min: param.min,
            max: param.max,
          })),
        })
      }
      // Legacy hardcoded parameters (fallback for existing blinks without parameters defined)
      else if (slug === 'wallet-tracker' || slug === 'wallet-snapshot' || slug === 'wallet-analyzer') {
        actions.push({
          label: 'Analyze Wallet',
          href: `/api/actions/${slug}`,
          parameters: [
            {
              name: 'wallet',
              label: 'Enter Solana wallet address',
              type: 'text',
              required: true,
              pattern: '^[1-9A-HJ-NP-Za-km-z]{32,44}$',
              patternDescription: 'Please enter a valid Solana address',
            },
          ],
        })
      }
      else if (slug === 'qr-code' || slug === 'qr-code-generator') {
        actions.push({
          label: 'Generate QR Code',
          href: `/api/actions/${slug}`,
          parameters: [
            {
              name: 'text',
              label: 'Enter text or URL for QR code',
              type: 'text',
              required: true,
            },
          ],
        })
      }
      else if (slug === 'token-price' || slug === 'dexscreener-token-data') {
        actions.push({
          label: slug === 'token-price' ? 'Get Token Price' : 'Get Token Data',
          href: `/api/actions/${slug}`,
          parameters: [
            {
              name: 'tokenAddress',
              label: 'Enter Solana token address',
              type: 'text',
              required: true,
              pattern: '^[1-9A-HJ-NP-Za-km-z]{32,44}$',
              patternDescription: 'Please enter a valid Solana token address',
            },
          ],
        })
      }
      // Buy B402 - Jupiter swap (user signs swap transaction directly)
      else if (slug === 'buy-b402') {
        actions.push(
          {
            label: '🪐 0.01 SOL → B402',
            href: `/api/actions/${slug}?amount=0.01`,
          },
          {
            label: '🪐 0.1 SOL → B402',
            href: `/api/actions/${slug}?amount=0.1`,
          },
          {
            label: '🪐 0.5 SOL → B402',
            href: `/api/actions/${slug}?amount=0.5`,
          },
          {
            label: '🪐 Custom Amount',
            href: `/api/actions/${slug}`,
            parameters: [
              {
                name: 'amount',
                label: 'Enter SOL amount to swap',
                type: 'number',
                required: true,
                min: 0.001,
                max: 100,
              },
            ],
          }
        )
      }
      // Burn B402 with multiple preset amounts + custom input
      else if (slug === 'burn-b402') {
        // Preset amount buttons
        actions.push(
          {
            label: '🔥 0.01 SOL',
            href: `/api/actions/${slug}?amount=0.01`,
          },
          {
            label: '🔥 0.1 SOL',
            href: `/api/actions/${slug}?amount=0.1`,
          },
          {
            label: '🔥 1 SOL',
            href: `/api/actions/${slug}?amount=1`,
          },
          {
            label: '🔥 Burn B402',
            href: `/api/actions/${slug}`,
            parameters: [
              {
                name: 'amount',
                label: 'Enter SOL amount to burn',
                type: 'number',
                required: true,
                min: 0.001,
                max: 100,
              },
            ],
          }
        )
      }
      // Default action for blinks without inputs
      else {
        actions.push({
          label: blink.method === 'POST' ? 'Submit Request' : 'Get Data',
          href: `/api/actions/${slug}`,
        })
      }

      // Use dynamic OG image with text overlay (blink name + description)
      // Falls back to static images for special blinks
      let iconUrl: string
      if (slug === 'buy-b402') {
        iconUrl = `${webUrl}/Buy-b402.png`
      } else if (slug === 'burn-b402') {
        iconUrl = `${webUrl}/Burn-b402.png`
      } else if (blink.lottery_enabled || slug.includes('lottery')) {
        iconUrl = `${webUrl}/LOTERRY.png`
      } else {
        // Use dynamic OG image endpoint with text overlay
        iconUrl = blink.icon_url || `${webUrl}/api/og/${slug}`
      }

      const metadata = {
        type: 'action',
        title: blink.title,
        icon: iconUrl,
        description: blink.description,
        label: `Use ${blink.title}`,
        links: {
          actions,
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
      fastify.log.error({ error, slug }, 'Error generating Actions metadata')
      return reply.code(500).send({ error: 'Failed to generate Actions metadata' })
    }
  })

  /**
   * POST /actions/:slug
   * Returns signable transaction for Dialect/Solana Actions wallets
   * Supports traditional Blinks flow
   */
  fastify.post<{
    Params: { slug: string }
    Body: {
      account: string
      type?: string            // 'transaction' for Solana Actions
      data?: {
        wallet?: string        // For wallet analyzer blinks
        text?: string          // For QR code and text-based blinks
        tokenAddress?: string  // For token price lookup blinks
        imagePrompt?: string   // For AI image generation blinks
        amount?: string        // For amount-based blinks
      }
    }
    Querystring: { amount?: string }
  }>('/:slug', async (request, reply) => {
    const { slug } = request.params
    const { account, data } = request.body
    const queryAmount = request.query.amount

    // Extract user input parameters from 'data' object (Solana Actions spec)
    const { wallet, text, tokenAddress, imagePrompt } = data || {}

    // Log full request body to debug Dialect parameter passing
    fastify.log.info({
      slug,
      requestBody: request.body,
      extractedParams: { account, wallet, text, tokenAddress, imagePrompt }
    }, 'POST /actions/:slug - Full request body')

    try {
      // Validate account
      if (!account) {
        return reply.code(400).send({ error: 'Missing account parameter' })
      }

      const blink = await getBlinkBySlug(slug)

      if (!blink) {
        return reply.code(404).send({ error: 'Blink not found' })
      }

      // Special handling for buy-b402 - Platform-mediated Jupiter swap
      // User pays SOL → Platform swaps via Jupiter → Platform sends B402 tokens
      if (slug === 'buy-b402') {
        // Extract amount from query string, data object, or default price
        const amountStr = queryAmount || data?.amount || blink.price_usdc
        const amountInSol = parseFloat(amountStr)

        fastify.log.info({
          slug,
          queryAmount,
          dataAmount: data?.amount,
          defaultPrice: blink.price_usdc,
          finalAmount: amountInSol
        }, 'Processing buy-b402 amount')

        if (isNaN(amountInSol) || amountInSol <= 0) {
          return reply.code(400).send({ error: 'Invalid amount' })
        }

        // Parse addresses
        const sender = parsePublicKey(account)
        const recipient = parsePublicKey(blink.payout_wallet) // Platform wallet for swap

        if (!sender || !recipient) {
          return reply.code(400).send({ error: 'Invalid wallet address' })
        }

        // Generate reference for payment tracking
        const referenceKeypair = generateReference()
        const reference = referenceKeypair.publicKey

        // Create run in database with amount metadata
        const run = await createRun({
          blinkId: blink.id,
          reference: reference.toBase58(),
          metadata: {
            payer: account,
            amountSol: amountInSol,
            token: 'B402',
            action: 'buy'
          },
        })

        fastify.log.info({
          slug,
          runId: run.id,
          reference: reference.toBase58(),
          account,
          amountSol: amountInSol,
          action: 'BUY'
        }, 'Created run for B402 purchase')

        // Build SOL transfer transaction (user pays platform)
        const connection = getConnection()
        const amountLamports = solToLamports(amountInSol)

        const transaction = await buildSolTransferTransaction({
          connection,
          sender,
          recipient,
          amount: amountLamports,
          reference,
          memo: `🪐 Buy B402: ${amountInSol} SOL`,
        })

        // Get recent blockhash
        const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash()
        transaction.recentBlockhash = blockhash
        transaction.feePayer = sender

        // Serialize transaction
        const serializedTransaction = transaction.serialize({
          requireAllSignatures: false,
          verifySignatures: false,
        })

        const base64Transaction = serializedTransaction.toString('base64')

        // Return transaction with message explaining the flow
        const message = `🪐 Payment confirmed! B402 tokens will be sent to your wallet shortly. Visit blink402.dev/blink/buy-b402 to track your swap.`

        return reply.code(200).send({
          transaction: base64Transaction,
          message,
        })
      }

      // Special handling for burn-b402 (SOL escrow flow)
      else if (slug === 'burn-b402') {
        // Extract amount from query string or body parameter
        const amountStr = queryAmount || (request.body as any).amount || blink.price_usdc
        const amountInSol = parseFloat(amountStr)

        fastify.log.info({
          slug,
          queryAmount,
          bodyAmount: (request.body as any).amount,
          defaultPrice: blink.price_usdc,
          finalAmount: amountInSol
        }, 'Processing burn amount')

        if (isNaN(amountInSol) || amountInSol <= 0) {
          return reply.code(400).send({ error: 'Invalid amount' })
        }

        // Parse addresses
        const sender = parsePublicKey(account)
        const recipient = parsePublicKey(blink.payout_wallet) // Escrow wallet

        if (!sender || !recipient) {
          return reply.code(400).send({ error: 'Invalid wallet address' })
        }

        // Generate reference for payment tracking
        const referenceKeypair = generateReference()
        const reference = referenceKeypair.publicKey

        // Create run in database with amount metadata
        const run = await createRun({
          blinkId: blink.id,
          reference: reference.toBase58(),
          metadata: {
            payer: account,
            amountSol: amountInSol,
            token: 'B402',
            action: 'burn'
          },
        })

        fastify.log.info({
          slug,
          runId: run.id,
          reference: reference.toBase58(),
          account,
          amountSol: amountInSol,
          action: 'BURN'
        }, 'Created run for B402 burn')

        // Build SOL transfer transaction
        const connection = getConnection()
        const amountLamports = solToLamports(amountInSol)

        const transaction = await buildSolTransferTransaction({
          connection,
          sender,
          recipient,
          amount: amountLamports,
          reference,
          memo: `🔥 Burn B402: ${amountInSol} SOL`,
        })

        // Get recent blockhash
        const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash()
        transaction.recentBlockhash = blockhash
        transaction.feePayer = sender

        // Serialize transaction
        const serializedTransaction = transaction.serialize({
          requireAllSignatures: false,
          verifySignatures: false,
        })

        const base64Transaction = serializedTransaction.toString('base64')

        // Return transaction with custom message
        const message = `🔥 Payment confirmed! Tokens will be burned. Visit blink402.dev/blink/burn-b402 to view status.`

        return reply.code(200).send({
          transaction: base64Transaction,
          message,
        })
      }

      // Validate payment token (Actions only support USDC for standard blinks)
      if (blink.payment_token !== 'USDC') {
        return reply.code(400).send({
          error: 'Only USDC payment is supported via Actions',
          message: 'Please use the checkout page for other payment methods',
        })
      }

      // Parse addresses
      const sender = parsePublicKey(account)
      const recipient = parsePublicKey(blink.payout_wallet)

      if (!sender || !recipient) {
        return reply.code(400).send({ error: 'Invalid wallet address' })
      }

      // Generate reference for payment tracking
      const referenceKeypair = generateReference()
      const reference = referenceKeypair.publicKey

      // Create run in database with user input parameters
      const run = await createRun({
        blinkId: blink.id,
        reference: reference.toBase58(),
        metadata: {
          payer: account,
          targetWallet: wallet,      // For wallet analyzer
          text,                      // For QR code/text blinks
          tokenAddress,              // For token price blinks
          imagePrompt,               // For AI image generation
        },
      })

      fastify.log.info({
        slug,
        runId: run.id,
        reference: reference.toBase58(),
        account,
      }, 'Created run for Actions transaction')

      // Build USDC transfer transaction (VersionedTransaction to prevent Phantom blocking)
      const connection = getConnection()
      const amount = BigInt(Math.round(parseFloat(blink.price_usdc) * 1_000_000))

      // Get token accounts
      const senderATA = await getAssociatedTokenAddress(USDC_MINT, sender)
      const recipientATA = await getAssociatedTokenAddress(USDC_MINT, recipient)

      // Get recent blockhash
      const { blockhash } = await connection.getLatestBlockhash('confirmed')

      // Build USDC transfer with Legacy Transaction (prevents Phantom blocking)
      // NOTE: Use Legacy Transaction (not VersionedTransaction) for Actions
      // VersionedTransaction with user as fee payer triggers Phantom Lighthouse security block
      const transaction = new Transaction()

      transaction.add(
        ComputeBudgetProgram.setComputeUnitLimit({ units: 40_000 }),
        ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 1 }),
        createTransferCheckedInstruction(
          senderATA,
          USDC_MINT,
          recipientATA,
          sender,
          amount,
          USDC_DECIMALS
        )
      )

      // Set transaction properties
      transaction.recentBlockhash = blockhash
      transaction.feePayer = sender

      // Serialize transaction (legacy format)
      const serializedTransaction = transaction.serialize({
        requireAllSignatures: false,
        verifySignatures: false,
      })
      const base64Transaction = serializedTransaction.toString('base64')

      // Return in Solana Actions format with custom message
      let message = `✅ Payment confirmed! API results will be displayed after transaction settles.`

      // Custom messages for specific blinks
      if (slug === 'slot-machine') {
        message = `🎰 Payment confirmed! Visit blink402.dev/slot-machine to see if you won!`
      } else if (blink.lottery_enabled || slug.includes('lottery')) {
        // CRITICAL FIX: Create lottery entry immediately after building transaction
        // This starts the round and ensures entry is created when user signs via Twitter/X
        try {
          fastify.log.info({ slug, account, reference: reference.toBase58() }, 'Creating lottery entry from Actions flow')

          // Mark run as paid optimistically (we assume user will sign and broadcast)
          // The transaction has already been built, and the reference tracks it
          await updateRunPaymentAtomic({
            reference: reference.toBase58(),
            signature: 'pending', // Placeholder until actual signature is available
            payer: account
          })

          // Reload run to get updated payment status
          const { getRunByReference } = await import('@blink402/database')
          const updatedRun = await getRunByReference(reference.toBase58())

          if (updatedRun) {
            // Create lottery entry (this will start round if needed)
            const entryResult = await createLotteryEntryInternal(blink, updatedRun, account, fastify.log)

            fastify.log.info({
              entryId: entryResult.entry_id,
              roundId: entryResult.round_id,
              roundNumber: entryResult.round_number,
              totalEntries: entryResult.total_entries,
              slug,
              account
            }, 'Lottery entry created from Actions flow')

            // Update message with entry details
            const drawInfo = entryResult.message?.split('Draw in ')[1] || 'soon'
            message = `🎰 Entry #${entryResult.total_entries} confirmed! Round ${entryResult.round_number} draw in ${drawInfo}`
          }
        } catch (error) {
          // Log error but don't block transaction return - entry can be claimed later
          fastify.log.error({
            error: error instanceof Error ? error.message : String(error),
            slug,
            account,
            reference: reference.toBase58()
          }, 'Failed to create lottery entry from Actions - user can claim manually')

          message = `🎰 Transaction ready! Visit blink402.dev/lottery/${slug} after signing to confirm entry.`
        }
      }

      // Return transaction with callback for Phantom to send signature after submission
      // CRITICAL: Callback URL must be same-origin as the request (Solana Actions spec requirement)
      // Always use blink402.dev since that's the only domain registered with Dialect
      const callbackUrl = `https://blink402.dev/api/actions/submit/${reference.toBase58()}`

      fastify.log.info({
        'callbackUrl': callbackUrl,
        'reference': reference.toBase58()
      }, 'Generated callback URL for Actions transaction')

      return reply.code(200).send({
        transaction: base64Transaction,
        message,
        links: {
          next: {
            type: 'post',
            href: callbackUrl,
          }
        }
      })
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      const errorStack = error instanceof Error ? error.stack : undefined

      fastify.log.error({
        error: errorMessage,
        stack: errorStack,
        slug,
        account,
        wallet,
        text,
        tokenAddress,
        imagePrompt,
      }, 'Error building Actions transaction')

      // Return detailed error in development mode
      return reply.code(500).send({
        error: 'Failed to build transaction',
        details: process.env.NODE_ENV === 'development' ? errorMessage : undefined,
        slug,
      })
    }
  })
}
