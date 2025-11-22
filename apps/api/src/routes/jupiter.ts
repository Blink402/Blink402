import { FastifyPluginAsync } from 'fastify'
import { getRunByReference, markRunExecuted, markRunFailed } from '@blink402/database'
import { getConnection, solToLamports } from '@blink402/solana'
import { Keypair, VersionedTransaction, PublicKey } from '@solana/web3.js'
import { getAssociatedTokenAddress } from '@solana/spl-token'

// Jupiter API endpoints
const JUPITER_QUOTE_API = 'https://quote-api.jup.ag/v6/quote'
const JUPITER_SWAP_API = 'https://api.jup.ag/swap/v1/swap'  // Fixed: was using wrong domain

// Token mints
const SOL_MINT = 'So11111111111111111111111111111111111111112'
const B402_TOKEN_MINT = '2mESiwuVdfft9PxG7x36rvDvex6ccyY8m8BKCWJqpump'

// Jupiter API types
interface JupiterQuoteResponse {
  inputMint: string
  inAmount: string
  outputMint: string
  outAmount: string
  otherAmountThreshold: string
  swapMode: string
  slippageBps: number
  priceImpactPct: string
  routePlan: Array<{
    swapInfo: {
      ammKey: string
      label?: string
      inputMint: string
      outputMint: string
      inAmount: string
      outAmount: string
      feeAmount: string
      feeMint: string
    }
    percent: number
  }>
}

interface JupiterSwapResponse {
  swapTransaction: string
  lastValidBlockHeight: number
  prioritizationFeeLamports?: number
}

export const jupiterRoutes: FastifyPluginAsync = async (fastify) => {
  /**
   * POST /api/jupiter/buy-b402
   * Jupiter flow: User pays SOL → Platform buys B402 via Jupiter → Send tokens to user
   *
   * This endpoint is called via /bazaar/buy-b402 after payment verification
   */
  fastify.post('/buy-b402', async (request, reply) => {
    const { reference, payer, signature } = request.body as {
      reference: string
      payer: string
      signature?: string
    }

    try {

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
      }, 'Processing B402 purchase via Jupiter')

      // Verify the run exists and is paid
      fastify.log.info({ reference }, '[BUY] Step 1: Fetching run')
      const run = await getRunByReference(reference)
      if (!run) {
        fastify.log.error({ reference }, '[BUY] Run not found')
        return reply.code(404).send({ error: 'Payment not found' })
      }

      fastify.log.info({ reference, status: run.status }, '[BUY] Step 2: Run status check')
      if (run.status !== 'paid') {
        fastify.log.error({ reference, status: run.status }, '[BUY] Run not paid')
        return reply.code(400).send({ error: 'Payment not verified yet' })
      }

      // Extract SOL amount from run metadata
      fastify.log.info({ reference, metadata: run.metadata }, '[BUY] Step 3: Extract amount')
      const amountInSol = run.metadata?.amountSol
      if (!amountInSol || typeof amountInSol !== 'number') {
        fastify.log.error({ run, amountInSol, type: typeof amountInSol }, '[BUY] Invalid amountSol')
        return reply.code(400).send({ error: 'Invalid amount data' })
      }

      if (amountInSol <= 0) {
        fastify.log.error({ amountInSol }, '[BUY] Amount <= 0')
        return reply.code(400).send({ error: 'Invalid amount' })
      }

      // Get platform wallet keypair
      fastify.log.info('[BUY] Step 4: Loading platform keypair')
      const platformKeypairJson = process.env.PLATFORM_REFUND_KEYPAIR
      if (!platformKeypairJson) {
        fastify.log.error('[BUY] PLATFORM_REFUND_KEYPAIR not configured')
        await markRunFailed(reference)
        return reply.code(500).send({ error: 'Service configuration error' })
      }

      fastify.log.info('[BUY] Step 5: Parsing keypair')
      const platformKeypair = Keypair.fromSecretKey(
        Buffer.from(JSON.parse(platformKeypairJson))
      )

      fastify.log.info({ amountInSol }, '[BUY] Step 6: Converting to lamports')
      const amountInLamports = solToLamports(amountInSol)

      // Step 1: Get quote from Jupiter (SOL → B402)
      const quoteUrl = new URL(JUPITER_QUOTE_API)
      quoteUrl.searchParams.set('inputMint', SOL_MINT)
      quoteUrl.searchParams.set('outputMint', B402_TOKEN_MINT)
      quoteUrl.searchParams.set('amount', amountInLamports.toString())
      quoteUrl.searchParams.set('slippageBps', '500') // 5% slippage

      fastify.log.info({ url: quoteUrl.toString() }, '[BUY] Step 7: Fetching Jupiter quote')

      let quoteResponse
      let retries = 0
      const maxRetries = 3

      while (retries < maxRetries) {
        try {
          quoteResponse = await fetch(quoteUrl.toString(), {
            method: 'GET',
            headers: { 'Accept': 'application/json' },
            signal: AbortSignal.timeout(15000) // 15 second timeout
          })
          break // Success, exit retry loop
        } catch (fetchError) {
          retries++
          fastify.log.error({
            attempt: retries,
            maxRetries,
            error: fetchError instanceof Error ? fetchError.message : String(fetchError),
            url: quoteUrl.toString()
          }, '[BUY] Jupiter quote API fetch failed')

          if (retries >= maxRetries) {
            await markRunFailed(reference)
            return reply.code(502).send({
              error: 'Jupiter API unreachable',
              details: 'Unable to connect to swap service. Please try again later.'
            })
          }

          // Wait before retry (exponential backoff)
          await new Promise(resolve => setTimeout(resolve, Math.pow(2, retries) * 1000))
        }
      }

      if (!quoteResponse || !quoteResponse.ok) {
        const errorText = quoteResponse ? await quoteResponse.text() : 'No response'
        fastify.log.error({
          status: quoteResponse?.status,
          error: errorText,
          url: quoteUrl.toString()
        }, 'Jupiter quote API error')

        await markRunFailed(reference)
        return reply.code(502).send({ error: 'Failed to get swap quote' })
      }

      const quoteData = await quoteResponse.json() as JupiterQuoteResponse

      // Get user's B402 token account (where tokens will be sent)
      const userPubkey = new PublicKey(payer)
      const b402Mint = new PublicKey(B402_TOKEN_MINT)
      const userTokenAccount = await getAssociatedTokenAddress(
        b402Mint,
        userPubkey
      )

      // Step 2: Get swap transaction from Jupiter
      fastify.log.info('[BUY] Step 8: Requesting swap transaction from Jupiter')

      let swapResponse
      retries = 0

      while (retries < maxRetries) {
        try {
          swapResponse = await fetch(JUPITER_SWAP_API, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Accept': 'application/json'
            },
            body: JSON.stringify({
              quoteResponse: quoteData,
              userPublicKey: platformKeypair.publicKey.toBase58(),
              destinationTokenAccount: userTokenAccount.toBase58(), // Send tokens directly to user
              wrapAndUnwrapSol: true,
              dynamicComputeUnitLimit: true,
              prioritizationFeeLamports: {
                priorityLevelWithMaxLamports: {
                  maxLamports: 10000000,
                  priorityLevel: 'high'
                }
              }
            }),
            signal: AbortSignal.timeout(15000) // 15 second timeout
          })
          break // Success, exit retry loop
        } catch (fetchError) {
          retries++
          fastify.log.error({
            attempt: retries,
            maxRetries,
            error: fetchError instanceof Error ? fetchError.message : String(fetchError),
            url: JUPITER_SWAP_API
          }, '[BUY] Jupiter swap API fetch failed')

          if (retries >= maxRetries) {
            await markRunFailed(reference)
            return reply.code(502).send({
              error: 'Jupiter API unreachable',
              details: 'Unable to connect to swap service. Please try again later.'
            })
          }

          // Wait before retry (exponential backoff)
          await new Promise(resolve => setTimeout(resolve, Math.pow(2, retries) * 1000))
        }
      }

      if (!swapResponse || !swapResponse.ok) {
        const errorText = swapResponse ? await swapResponse.text() : 'No response'
        fastify.log.error({
          status: swapResponse?.status,
          error: errorText
        }, 'Jupiter swap API error')

        await markRunFailed(reference)
        return reply.code(502).send({ error: 'Failed to create swap transaction' })
      }

      const swapData = await swapResponse.json() as JupiterSwapResponse
      const { swapTransaction } = swapData

      // Step 3: Deserialize, sign, and send transaction
      const connection = getConnection()
      const transaction = VersionedTransaction.deserialize(
        Buffer.from(swapTransaction, 'base64')
      )

      transaction.sign([platformKeypair])

      const txSignature = await connection.sendRawTransaction(
        transaction.serialize(),
        {
          skipPreflight: false,
          maxRetries: 3,
        }
      )

      // Wait for confirmation
      const confirmation = await connection.confirmTransaction(txSignature, 'confirmed')

      if (confirmation.value.err) {
        fastify.log.error({ txSignature, error: confirmation.value.err }, 'Transaction failed')
        await markRunFailed(reference)
        return reply.code(502).send({ error: 'Swap transaction failed' })
      }

      // Calculate tokens received from quote
      const tokensReceived = quoteData.outAmount || 'unknown'

      // Mark run as executed
      const startTime = Date.now()
      await markRunExecuted({
        reference,
        durationMs: Date.now() - startTime,
      })

      fastify.log.info({
        runId: run.id,
        buyer: payer,
        solSpent: amountInSol,
        swapSignature: txSignature,
        tokensReceived,
      }, 'B402 purchase completed successfully via Jupiter')

      // Return success
      return reply.code(200).send({
        success: true,
        message: `🎉 Successfully bought B402! Tokens sent to ${payer}`,
        signature: txSignature,
        tokensReceived,
        explorer: `https://solscan.io/tx/${txSignature}`,
      })
    } catch (error) {
      fastify.log.error({
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        reference,
        payer
      }, 'Error in Jupiter buy endpoint')
      return reply.code(500).send({
        error: 'Internal server error',
        details: error instanceof Error ? error.message : String(error)
      })
    }
  })

  /**
   * POST /api/jupiter/burn-b402
   * Burn flow: User pays SOL → Platform buys B402 via Jupiter → Hold tokens (removed from circulation)
   *
   * This endpoint is called via /bazaar/burn-b402 after payment verification
   * Tokens stay in platform wallet, effectively reducing circulating supply
   */
  fastify.post('/burn-b402', async (request, reply) => {
    const { reference, payer, signature } = request.body as {
      reference: string
      payer: string
      signature?: string
    }

    try {

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
      }, 'Processing B402 burn via Jupiter')

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

      // Get platform wallet keypair
      const platformKeypairJson = process.env.PLATFORM_REFUND_KEYPAIR
      if (!platformKeypairJson) {
        fastify.log.error('PLATFORM_REFUND_KEYPAIR not configured')
        await markRunFailed(reference)
        return reply.code(500).send({ error: 'Service configuration error' })
      }

      const platformKeypair = Keypair.fromSecretKey(
        Buffer.from(JSON.parse(platformKeypairJson))
      )

      const amountInLamports = solToLamports(amountInSol)

      // Step 1: Get quote from Jupiter (SOL → B402)
      const quoteUrl = new URL(JUPITER_QUOTE_API)
      quoteUrl.searchParams.set('inputMint', SOL_MINT)
      quoteUrl.searchParams.set('outputMint', B402_TOKEN_MINT)
      quoteUrl.searchParams.set('amount', amountInLamports.toString())
      quoteUrl.searchParams.set('slippageBps', '500') // 5% slippage

      fastify.log.info({ url: quoteUrl.toString() }, '[BURN] Fetching Jupiter quote')

      let quoteResponse
      let retries = 0
      const maxRetries = 3

      while (retries < maxRetries) {
        try {
          quoteResponse = await fetch(quoteUrl.toString(), {
            method: 'GET',
            headers: { 'Accept': 'application/json' },
            signal: AbortSignal.timeout(15000) // 15 second timeout
          })
          break // Success, exit retry loop
        } catch (fetchError) {
          retries++
          fastify.log.error({
            attempt: retries,
            maxRetries,
            error: fetchError instanceof Error ? fetchError.message : String(fetchError),
            url: quoteUrl.toString()
          }, '[BURN] Jupiter quote API fetch failed')

          if (retries >= maxRetries) {
            await markRunFailed(reference)
            return reply.code(502).send({
              error: 'Jupiter API unreachable',
              details: 'Unable to connect to swap service. Please try again later.'
            })
          }

          // Wait before retry (exponential backoff)
          await new Promise(resolve => setTimeout(resolve, Math.pow(2, retries) * 1000))
        }
      }

      if (!quoteResponse || !quoteResponse.ok) {
        const errorText = quoteResponse ? await quoteResponse.text() : 'No response'
        fastify.log.error({
          status: quoteResponse?.status,
          error: errorText,
          url: quoteUrl.toString()
        }, 'Jupiter quote API error during burn')

        await markRunFailed(reference)
        return reply.code(502).send({ error: 'Failed to get swap quote for burn' })
      }

      const quoteData = await quoteResponse.json() as JupiterQuoteResponse

      // Step 2: Get swap transaction from Jupiter
      // NOTE: No destinationTokenAccount - tokens stay in platform wallet (burn)
      fastify.log.info('[BURN] Requesting swap transaction from Jupiter')

      let swapResponse
      retries = 0

      while (retries < maxRetries) {
        try {
          swapResponse = await fetch(JUPITER_SWAP_API, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Accept': 'application/json'
            },
            body: JSON.stringify({
              quoteResponse: quoteData,
              userPublicKey: platformKeypair.publicKey.toBase58(),
              wrapAndUnwrapSol: true,
              dynamicComputeUnitLimit: true,
              prioritizationFeeLamports: {
                priorityLevelWithMaxLamports: {
                  maxLamports: 10000000,
                  priorityLevel: 'high'
                }
              }
            }),
            signal: AbortSignal.timeout(15000) // 15 second timeout
          })
          break // Success, exit retry loop
        } catch (fetchError) {
          retries++
          fastify.log.error({
            attempt: retries,
            maxRetries,
            error: fetchError instanceof Error ? fetchError.message : String(fetchError),
            url: JUPITER_SWAP_API
          }, '[BURN] Jupiter swap API fetch failed')

          if (retries >= maxRetries) {
            await markRunFailed(reference)
            return reply.code(502).send({
              error: 'Jupiter API unreachable',
              details: 'Unable to connect to swap service. Please try again later.'
            })
          }

          // Wait before retry (exponential backoff)
          await new Promise(resolve => setTimeout(resolve, Math.pow(2, retries) * 1000))
        }
      }

      if (!swapResponse || !swapResponse.ok) {
        const errorText = swapResponse ? await swapResponse.text() : 'No response'
        fastify.log.error({
          status: swapResponse?.status,
          error: errorText
        }, 'Jupiter swap API error during burn')

        await markRunFailed(reference)
        return reply.code(502).send({ error: 'Failed to create swap transaction for burn' })
      }

      const swapData = await swapResponse.json() as JupiterSwapResponse
      const { swapTransaction } = swapData

      // Step 3: Deserialize, sign, and send transaction
      const connection = getConnection()
      const transaction = VersionedTransaction.deserialize(
        Buffer.from(swapTransaction, 'base64')
      )

      transaction.sign([platformKeypair])

      const txSignature = await connection.sendRawTransaction(
        transaction.serialize(),
        {
          skipPreflight: false,
          maxRetries: 3,
        }
      )

      // Wait for confirmation
      const confirmation = await connection.confirmTransaction(txSignature, 'confirmed')

      if (confirmation.value.err) {
        fastify.log.error({ txSignature, error: confirmation.value.err }, 'Burn transaction failed')
        await markRunFailed(reference)
        return reply.code(502).send({ error: 'Burn transaction failed' })
      }

      // Calculate tokens burned from quote
      const tokensBurned = quoteData.outAmount || 'unknown'

      // Tokens are now in platform wallet (removed from circulation)
      // Mark run as executed
      const startTime = Date.now()
      await markRunExecuted({
        reference,
        durationMs: Date.now() - startTime,
      })

      fastify.log.info({
        runId: run.id,
        burner: payer,
        solSpent: amountInSol,
        burnSignature: txSignature,
        tokensBurned,
        burnMethod: 'hold-in-platform-wallet'
      }, '🔥 B402 tokens burned successfully (removed from circulation)')

      // Return success
      return reply.code(200).send({
        success: true,
        message: `🔥 Successfully burned ${tokensBurned} B402 tokens! Supply reduced.`,
        signature: txSignature,
        tokensBurned,
        solSpent: amountInSol,
        burnMethod: 'Held in platform wallet (removed from circulation)',
        explorer: `https://solscan.io/tx/${txSignature}`,
      })
    } catch (error) {
      fastify.log.error({
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        reference,
        payer
      }, 'Error in Jupiter burn endpoint')
      return reply.code(500).send({
        error: 'Internal server error',
        details: error instanceof Error ? error.message : String(error)
      })
    }
  })
}
