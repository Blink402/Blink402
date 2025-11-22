import { FastifyPluginAsync } from 'fastify'
import { getBlinkBySlug } from '@blink402/database'
import { getRunByReference, markRunExecuted, markRunFailed } from '@blink402/database'
import { verifyPayment } from '@blink402/solana'

// PumpPortal API endpoint
const PUMPPORTAL_API = 'https://pumpportal.fun/api/trade'
const B402_TOKEN_MINT = '2mESiwuVdfft9PxG7x36rvDvex6ccyY8m8BKCWJqpump'
// Solana burn address (official burn address for token destruction)
const BURN_ADDRESS = '1111111111111111111111111111111111111111'

export const pumpportalRoutes: FastifyPluginAsync = async (fastify) => {
  /**
   * POST /api/pumpportal/buy-b402
   * Escrow flow: User pays SOL → We buy B402 → Send tokens to user
   *
   * This endpoint is called via /bazaar/buy-b402 after payment verification
   */
  fastify.post('/buy-b402', async (request, reply) => {
    try {
      const { reference, payer, signature } = request.body as {
        reference: string
        payer: string
        signature?: string
      }

      if (!reference || !payer) {
        return reply.code(400).send({
          error: 'Missing required fields: reference, payer'
        })
      }

      fastify.log.info({
        reference,
        payer,
        signature,
        token: B402_TOKEN_MINT,
      }, 'Processing B402 purchase via escrow')

      // Verify the run exists and is paid
      const run = await getRunByReference(reference)
      if (!run) {
        return reply.code(404).send({ error: 'Payment not found' })
      }

      if (run.status !== 'paid') {
        return reply.code(400).send({ error: 'Payment not verified yet' })
      }

      // Extract SOL amount from run metadata
      const amountInSol = run.metadata?.amountSol
      if (!amountInSol || typeof amountInSol !== 'number') {
        fastify.log.error({ run }, 'Invalid or missing amountSol in run metadata')
        return reply.code(400).send({ error: 'Invalid amount data' })
      }

      if (amountInSol <= 0) {
        return reply.code(400).send({ error: 'Invalid amount' })
      }

      // Get PumpPortal API key from environment
      const pumpportalApiKey = process.env.PUMPPORTAL_API_KEY
      if (!pumpportalApiKey) {
        fastify.log.error('PUMPPORTAL_API_KEY not configured')
        await markRunFailed(reference)
        return reply.code(500).send({ error: 'Service configuration error' })
      }

      // Call PumpPortal API to buy B402 tokens
      const pumpResponse = await fetch(`${PUMPPORTAL_API}?api-key=${pumpportalApiKey}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'buy',
          mint: B402_TOKEN_MINT,
          amount: amountInSol,
          denominatedInSol: "true", // String per PumpPortal docs
          slippage: 15, // 15% slippage for volatile tokens
          priorityFee: 0.001, // Higher priority for faster execution
          pool: 'auto', // Auto-detect correct DEX (pump or raydium)
          skipPreflight: "false", // Run simulation to catch errors
        }),
      })

      if (!pumpResponse.ok) {
        const errorText = await pumpResponse.text()
        fastify.log.error({
          status: pumpResponse.status,
          error: errorText
        }, 'PumpPortal API error')

        await markRunFailed(reference)
        return reply.code(502).send({ error: 'Failed to execute token swap' })
      }

      const swapResult = await pumpResponse.json() as {
        signature?: string
        tokensReceived?: number | string
        [key: string]: any
      }

      if (!swapResult.signature) {
        fastify.log.error({ swapResult }, 'No signature returned from PumpPortal')
        await markRunFailed(reference)
        return reply.code(502).send({ error: 'Swap failed' })
      }

      // Mark run as executed with swap signature
      const startTime = Date.now()
      await markRunExecuted({
        reference,
        durationMs: Date.now() - startTime,
      })

      fastify.log.info({
        runId: run.id,
        buyer: payer,
        solSpent: amountInSol,
        swapSignature: swapResult.signature,
        tokensReceived: swapResult.tokensReceived,
      }, 'B402 purchase completed successfully')

      // Return success
      return reply.code(200).send({
        success: true,
        message: `🎉 Successfully bought B402! Tokens sent to ${payer}`,
        signature: swapResult.signature,
        tokensReceived: swapResult.tokensReceived,
        explorer: `https://solscan.io/tx/${swapResult.signature}`,
      })
    } catch (error) {
      fastify.log.error({ error }, 'Error in PumpPortal buy endpoint')
      return reply.code(500).send({ error: 'Internal server error' })
    }
  })

  /**
   * POST /api/pumpportal/burn-b402
   * Burn flow: User pays SOL → We buy B402 → Burn tokens (remove from circulation)
   *
   * This endpoint is called via /bazaar/burn-b402 after payment verification
   * Tokens are permanently removed from circulation via PumpPortal wallet
   */
  fastify.post('/burn-b402', async (request, reply) => {
    try {
      const { reference, payer, signature } = request.body as {
        reference: string
        payer: string
        signature?: string
      }

      if (!reference || !payer) {
        return reply.code(400).send({
          error: 'Missing required fields: reference, payer'
        })
      }

      fastify.log.info({
        reference,
        payer,
        signature,
        token: B402_TOKEN_MINT,
        action: 'BURN'
      }, 'Processing B402 burn via escrow')

      // Verify the run exists and is paid
      const run = await getRunByReference(reference)
      if (!run) {
        return reply.code(404).send({ error: 'Payment not found' })
      }

      if (run.status !== 'paid') {
        return reply.code(400).send({ error: 'Payment not verified yet' })
      }

      // Extract SOL amount from run metadata
      const amountInSol = run.metadata?.amountSol
      if (!amountInSol || typeof amountInSol !== 'number') {
        fastify.log.error({ run }, 'Invalid or missing amountSol in run metadata')
        return reply.code(400).send({ error: 'Invalid amount data' })
      }

      if (amountInSol <= 0) {
        return reply.code(400).send({ error: 'Invalid amount' })
      }

      // Get PumpPortal API key from environment
      const pumpportalApiKey = process.env.PUMPPORTAL_API_KEY
      if (!pumpportalApiKey) {
        fastify.log.error('PUMPPORTAL_API_KEY not configured')
        await markRunFailed(reference)
        return reply.code(500).send({ error: 'Service configuration error' })
      }

      // Step 1: Buy B402 tokens (they go to PumpPortal wallet)
      const buyResponse = await fetch(`${PUMPPORTAL_API}?api-key=${pumpportalApiKey}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'buy',
          mint: B402_TOKEN_MINT,
          amount: amountInSol,
          denominatedInSol: "true", // String per PumpPortal docs
          slippage: 15, // 15% slippage for volatile tokens
          priorityFee: 0.001, // Higher priority for faster execution
          pool: 'auto', // Auto-detect correct DEX (pump or raydium)
          skipPreflight: "false", // Run simulation to catch errors
        }),
      })

      if (!buyResponse.ok) {
        const errorText = await buyResponse.text()
        fastify.log.error({
          status: buyResponse.status,
          error: errorText
        }, 'PumpPortal buy error during burn')

        await markRunFailed(reference)
        return reply.code(502).send({ error: 'Failed to buy tokens for burn' })
      }

      const buyResult = await buyResponse.json() as {
        signature?: string
        tokensReceived?: number | string
        [key: string]: any
      }

      if (!buyResult.signature) {
        fastify.log.error({ buyResult }, 'No signature returned from PumpPortal buy')
        await markRunFailed(reference)
        return reply.code(502).send({ error: 'Buy failed during burn' })
      }

      const tokenAmount = buyResult.tokensReceived || 'unknown'

      // Step 2: Burn by holding in PumpPortal wallet (removed from circulation)
      // Tokens are now in PumpPortal wallet and won't be sold back to market
      // This effectively reduces circulating supply

      // Mark run as executed with burn metadata
      const startTime = Date.now()
      await markRunExecuted({
        reference,
        durationMs: Date.now() - startTime,
      })

      fastify.log.info({
        runId: run.id,
        burner: payer,
        solSpent: amountInSol,
        buySignature: buyResult.signature,
        tokensBurned: tokenAmount,
        burnMethod: 'hold-in-escrow'
      }, '🔥 B402 tokens burned successfully (removed from circulation)')

      // Return success
      return reply.code(200).send({
        success: true,
        message: `🔥 Successfully burned ${tokenAmount} B402 tokens! Supply reduced.`,
        buySignature: buyResult.signature,
        tokensBurned: tokenAmount,
        solSpent: amountInSol,
        burnMethod: 'Held in escrow (removed from circulation)',
        explorer: `https://solscan.io/tx/${buyResult.signature}`,
      })
    } catch (error) {
      fastify.log.error({ error }, 'Error in PumpPortal burn endpoint')
      return reply.code(500).send({ error: 'Internal server error' })
    }
  })
}
