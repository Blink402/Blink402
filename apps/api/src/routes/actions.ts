import { FastifyPluginAsync } from 'fastify'
import { getBlinkBySlug, createRun } from '@blink402/database'
import {
  getConnection,
  buildUsdcTransferTransaction,
  buildSolTransferTransaction,
  usdcToLamports,
  solToLamports,
  parsePublicKey,
  generateReference,
} from '@blink402/solana'
import { getCacheOrFetch, isRedisConnected } from '@blink402/redis'

export const actionsRoutes: FastifyPluginAsync = async (fastify) => {
  // GET /actions.json - Solana Actions discovery endpoint
  fastify.get('/actions.json', async (request, reply) => {
    const baseUrl = process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3001'

    return reply
      .code(200)
      .headers({
        'Content-Type': 'application/json',
        'X-Action-Version': '2.0',
        'X-Blockchain-Ids': 'solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp',
      })
      .send({
        rules: [
          {
            pathPattern: '/actions/**',
            apiPath: `${baseUrl}/actions/**`,
          },
        ],
      })
  })

  // GET /actions/:slug - Returns Solana Actions metadata (with caching)
  fastify.get<{ Params: { slug: string } }>('/:slug', async (request, reply) => {
    const { slug } = request.params

    try {
      // CRITICAL: NO CACHE - Must match POST endpoint data source
      // Wallets use this metadata to build transactions
      const blink = await getBlinkBySlug(slug)

      if (!blink) {
        return reply.code(404).send({ error: 'Blink not found' })
      }

      // Validate payment_token
      if (!blink.payment_token || (blink.payment_token !== 'SOL' && blink.payment_token !== 'USDC')) {
        fastify.log.error({ blink, paymentToken: blink.payment_token }, 'Invalid payment_token in GET metadata')
        return reply.code(500).send({ error: 'Invalid blink configuration' })
      }

      // Return Actions metadata (Dialect standard)
      const baseUrl = process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3001'
      // Web URL for static assets (icons are served by Next.js frontend, not API)
      const webUrl = process.env.WEB_URL || process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL || 'https://blink402.dev'
      const paymentToken = blink.payment_token
      const defaultIcon = '/blink-402-webpreview.png'
      const iconUrl = blink.icon_url || defaultIcon

      // Smart URL handling: Check if iconUrl is already absolute (starts with http:// or https://)
      const finalIconUrl = iconUrl.startsWith('http://') || iconUrl.startsWith('https://')
        ? iconUrl  // Use as-is if already an absolute URL
        : `${webUrl}${iconUrl}`  // Prepend webUrl if relative path

      // Build parameters array based on Blink type
      const parameters: Array<{ name: string; label: string; required: boolean; pattern?: string; patternDescription?: string }> = [
        {
          name: 'account',
          label: 'Your wallet address',
          required: true,
        },
      ]

      // Add wallet parameter for wallet analyzer Blink
      if (slug === 'wallet-analyzer') {
        parameters.push({
          name: 'target_wallet',
          label: 'Wallet to analyze',
          required: true,
          pattern: '^[1-9A-HJ-NP-Za-km-z]{32,44}$',
          patternDescription: 'Must be a valid Solana wallet address',
        })
      }

      const metadata = {
        type: 'action',
        title: blink.title,
        icon: finalIconUrl,
        description: blink.description,
        label: `Run for ${blink.price_usdc} ${paymentToken}`,
        links: {
          actions: [
            {
              label: `Pay ${blink.price_usdc} ${paymentToken}`,
              href: `${baseUrl}/actions/${slug}`,
              parameters,
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
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0',
        })
        .send(metadata)
    } catch (error) {
      fastify.log.error({ error, slug }, 'Error generating Actions metadata')
      return reply.code(500).send({ error: 'Failed to generate Actions metadata' })
    }
  })

  // POST /actions/:slug - Returns signable USDC transfer transaction
  fastify.post<{
    Params: { slug: string }
    Body: { account?: string; data?: { account?: string } }
  }>('/:slug', async (request, reply) => {
    const { slug } = request.params
    const { account: directAccount, data } = request.body

    try {
      // Get the account (payer) from request
      const account = directAccount || data?.account
      if (!account) {
        return reply.code(400).send({ error: 'Missing required field: account' })
      }

      // Validate account is a valid Solana address
      const payerPubkey = parsePublicKey(account)
      if (!payerPubkey) {
        return reply.code(400).send({ error: 'Invalid Solana address' })
      }

      // Get blink data (NO CACHE - must match verification in proxy.ts)
      // CRITICAL: Both transaction building and verification must use same data source
      const blink = await getBlinkBySlug(slug)

      if (!blink) {
        return reply.code(404).send({ error: 'Blink not found' })
      }

      // Validate payment_token is explicitly set
      if (!blink.payment_token || (blink.payment_token !== 'SOL' && blink.payment_token !== 'USDC')) {
        fastify.log.error({ blink, paymentToken: blink.payment_token }, 'Invalid or missing payment_token')
        return reply.code(500).send({
          error: 'Invalid blink configuration',
          details: 'Payment token must be either SOL or USDC'
        })
      }

      // Validate recipient wallet (use payout_wallet for payments)
      const recipientPubkey = parsePublicKey(blink.payout_wallet)
      if (!recipientPubkey) {
        return reply.code(500).send({ error: 'Invalid payout wallet address' })
      }

      // Generate reference for tracking this payment
      const reference = generateReference()
      const referenceBase58 = reference.publicKey.toBase58()

      // Save run to database for tracking
      await createRun({
        blinkId: blink.id,
        reference: referenceBase58,
      })

      // Use validated payment_token (already checked above)
      const paymentToken = blink.payment_token // Guaranteed to be 'SOL' or 'USDC' by validation above
      const price = blink.price_usdc // Will be renamed to 'price' after migration

      fastify.log.info({ slug, paymentToken, price }, 'Building transaction')

      // Validate price
      if (!price || price === '0' || isNaN(parseFloat(price))) {
        fastify.log.error({ blink, price }, 'Invalid price for blink')
        return reply.code(500).send({
          error: 'Invalid blink configuration',
          details: 'Price is not set or invalid'
        })
      }

      // Convert price to lamports based on payment token
      const amount = paymentToken === 'SOL' ? solToLamports(price) : usdcToLamports(price)

      // Build the transaction based on payment token (no platform fee)
      const connection = getConnection()
      const transaction = paymentToken === 'SOL'
        ? await buildSolTransferTransaction({
            connection,
            sender: payerPubkey,
            recipient: recipientPubkey,
            amount,
            reference: reference.publicKey,
            memo: `Blink402: ${slug}`,
          })
        : await buildUsdcTransferTransaction({
            connection,
            sender: payerPubkey,
            recipient: recipientPubkey,
            amount,
            reference: reference.publicKey,
            memo: `Blink402: ${slug}`,
          })

      // Log transaction details for debugging
      const instructionProgramIds = transaction.instructions.map(ix => ix.programId.toBase58())
      fastify.log.info({
        slug,
        paymentToken,
        instructionCount: transaction.instructions.length,
        programIds: instructionProgramIds
      }, 'Transaction built with instructions')

      // Serialize transaction
      const serializedTransaction = transaction.serialize({
        requireAllSignatures: false,
        verifySignatures: false,
      })

      const base64Transaction = serializedTransaction.toString('base64')

      // Return transaction in Actions format
      return reply
        .code(200)
        .headers({
          'Content-Type': 'application/json',
          'X-Action-Version': '2.0',
        })
        .send({
          transaction: base64Transaction,
          message: `Pay ${price} ${paymentToken} to execute ${blink.title}`,
          reference: referenceBase58,
        })
    } catch (error) {
      fastify.log.error({ error, slug }, 'Error building transaction')
      return reply.code(500).send({
        error: 'Failed to build transaction',
        details: error instanceof Error ? error.message : 'Unknown error',
      })
    }
  })
}
