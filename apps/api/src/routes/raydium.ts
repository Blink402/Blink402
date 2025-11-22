import { FastifyPluginAsync } from 'fastify'
import { getRunByReference, markRunExecuted, markRunFailed } from '@blink402/database'
import { getConnection, solToLamports } from '@blink402/solana'
import { Keypair, PublicKey, Transaction, ComputeBudgetProgram } from '@solana/web3.js'
import { getAssociatedTokenAddress, createAssociatedTokenAccountIdempotentInstruction } from '@solana/spl-token'
import { Liquidity, LiquidityPoolKeys, Token, TokenAmount, Percent, SPL_ACCOUNT_LAYOUT } from '@raydium-io/raydium-sdk'
import BN from 'bn.js'

// Token mints
const SOL_MINT = new PublicKey('So11111111111111111111111111111111111111112')
const B402_TOKEN_MINT = new PublicKey('2mESiwuVdfft9PxG7x36rvDvex6ccyY8m8BKCWJqpump')
const WSOL_MINT = SOL_MINT // Wrapped SOL

export const raydiumRoutes: FastifyPluginAsync = async (fastify) => {
  /**
   * POST /api/raydium/buy-b402
   * Raydium flow: User pays SOL → Platform swaps via Raydium → Send B402 to user
   * Works entirely on-chain, no external API calls
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
        token: B402_TOKEN_MINT.toBase58(),
      }, '[RAYDIUM] Processing B402 purchase')

      // Step 1: Verify the run exists and is paid
      fastify.log.info({ reference }, '[RAYDIUM] Step 1: Fetching run')
      const run = await getRunByReference(reference)
      if (!run) {
        fastify.log.error({ reference }, '[RAYDIUM] Run not found')
        return reply.code(404).send({ error: 'Payment not found' })
      }

      fastify.log.info({ reference, status: run.status }, '[RAYDIUM] Step 2: Run status check')
      if (run.status !== 'paid') {
        fastify.log.error({ reference, status: run.status }, '[RAYDIUM] Run not paid')
        return reply.code(400).send({ error: 'Payment not verified yet' })
      }

      // Step 2: Extract SOL amount from run metadata
      fastify.log.info({ reference, metadata: run.metadata }, '[RAYDIUM] Step 3: Extract amount')
      const amountInSol = run.metadata?.amountSol
      if (!amountInSol || typeof amountInSol !== 'number') {
        fastify.log.error({ run, amountInSol, type: typeof amountInSol }, '[RAYDIUM] Invalid amountSol')
        return reply.code(400).send({ error: 'Invalid amount data' })
      }

      if (amountInSol <= 0) {
        fastify.log.error({ amountInSol }, '[RAYDIUM] Amount <= 0')
        return reply.code(400).send({ error: 'Invalid amount' })
      }

      // Step 3: Get platform wallet keypair
      fastify.log.info('[RAYDIUM] Step 4: Loading platform keypair')
      const platformKeypairJson = process.env.PLATFORM_REFUND_KEYPAIR
      if (!platformKeypairJson) {
        fastify.log.error('[RAYDIUM] PLATFORM_REFUND_KEYPAIR not configured')
        await markRunFailed(reference)
        return reply.code(500).send({ error: 'Service configuration error' })
      }

      fastify.log.info('[RAYDIUM] Step 5: Parsing keypair')
      const platformKeypair = Keypair.fromSecretKey(
        Buffer.from(JSON.parse(platformKeypairJson))
      )

      // Step 4: Fetch Raydium pool info from on-chain
      fastify.log.info('[RAYDIUM] Step 6: Fetching Raydium pool info from chain')
      const connection = getConnection()

      // NOTE: We need to find the actual Raydium pool ID for SOL-B402
      // This is a placeholder - in production, we'd fetch this from Raydium's pool list
      // or use Jupiter aggregator which routes through multiple DEXs
      const poolId = new PublicKey('PLACEHOLDER_POOL_ID') // TODO: Get actual pool ID

      fastify.log.info({
        message: 'Raydium pool lookup required',
        tokenPair: 'SOL-B402',
        note: 'B402 is a pump.fun token - may not have Raydium liquidity yet'
      }, '[RAYDIUM] Pool resolution needed')

      // For now, return an error explaining the situation
      await markRunFailed(reference)
      return reply.code(503).send({
        error: 'Raydium swap not available',
        details: 'B402 token does not have a Raydium liquidity pool yet. This token uses pump.fun bonding curve.',
        suggestion: 'Please use pump.fun directly or wait for Raydium migration'
      })

      // TODO: Implement actual Raydium swap once pool exists
      // The code below is commented out as a template for when pools are available:
      /*
      const poolInfo = await connection.getAccountInfo(poolId)
      if (!poolInfo) {
        throw new Error('Raydium pool not found')
      }

      // Parse pool data and build swap instruction
      const poolKeys: LiquidityPoolKeys = {
        // Parse from on-chain data
        id: poolId,
        baseMint: WSOL_MINT,
        quoteMint: B402_TOKEN_MINT,
        // ... other required fields
      }

      const userPubkey = new PublicKey(payer)
      const userTokenAccount = await getAssociatedTokenAddress(
        B402_TOKEN_MINT,
        userPubkey
      )

      // Build swap transaction
      const amountIn = new TokenAmount(new Token(WSOL_MINT, 9), solToLamports(amountInSol), false)
      const slippage = new Percent(5, 100) // 5% slippage

      const { amountOut, minAmountOut, ...swapResult } = await Liquidity.computeAmountOut({
        poolKeys,
        poolInfo: await Liquidity.fetchInfo({ connection, poolKeys }),
        amountIn,
        currencyOut: new Token(B402_TOKEN_MINT, 6), // Assuming 6 decimals
        slippage,
      })

      const transaction = new Transaction()

      // Add compute budget
      transaction.add(
        ComputeBudgetProgram.setComputeUnitLimit({ units: 400_000 }),
        ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 50_000 })
      )

      // Create ATA if needed
      transaction.add(
        createAssociatedTokenAccountIdempotentInstruction(
          platformKeypair.publicKey,
          userTokenAccount,
          userPubkey,
          B402_TOKEN_MINT
        )
      )

      // Add Raydium swap instruction
      const swapInstruction = await Liquidity.makeSwapInstruction({
        poolKeys,
        userKeys: {
          tokenAccountIn: platformKeypair.publicKey, // Platform's WSOL account
          tokenAccountOut: userTokenAccount, // User's B402 account
          owner: platformKeypair.publicKey,
        },
        amountIn: amountIn.raw,
        amountOut: minAmountOut.raw,
        fixedSide: 'in',
      })

      transaction.add(swapInstruction)

      // Send transaction
      const { blockhash } = await connection.getLatestBlockhash()
      transaction.recentBlockhash = blockhash
      transaction.feePayer = platformKeypair.publicKey

      transaction.sign(platformKeypair)

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
        fastify.log.error({ txSignature, error: confirmation.value.err }, '[RAYDIUM] Transaction failed')
        await markRunFailed(reference)
        return reply.code(502).send({ error: 'Swap transaction failed' })
      }

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
        tokensReceived: amountOut.toFixed(),
      }, '[RAYDIUM] B402 purchase completed successfully')

      return reply.code(200).send({
        success: true,
        message: `🎉 Successfully bought B402! Tokens sent to ${payer}`,
        signature: txSignature,
        tokensReceived: amountOut.toFixed(),
        explorer: `https://solscan.io/tx/${txSignature}`,
      })
      */
    } catch (error) {
      fastify.log.error({
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        reference,
        payer
      }, '[RAYDIUM] Error in buy endpoint')
      return reply.code(500).send({
        error: 'Internal server error',
        details: error instanceof Error ? error.message : String(error)
      })
    }
  })

  /**
   * POST /api/raydium/burn-b402
   * Burn flow: Similar to buy, but tokens stay in platform wallet
   */
  fastify.post('/burn-b402', async (request, reply) => {
    return reply.code(503).send({
      error: 'Raydium burn not implemented',
      details: 'Use pump.fun for B402 token operations'
    })
  })
}
