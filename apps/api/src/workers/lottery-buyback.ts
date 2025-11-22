import { getPool } from '@blink402/database'
import { Keypair, VersionedTransaction, PublicKey } from '@solana/web3.js'
import { getConnection } from '@blink402/solana'
import { getAssociatedTokenAddress } from '@solana/spl-token'
import axios from 'axios'
import https from 'https'
import dns from 'dns'

// Set DNS resolution order to prefer IPv4 (Railway DNS issue)
dns.setDefaultResultOrder('ipv4first')

// Custom DNS lookup function that tries both IPv4 and IPv6
const customLookup = (hostname: string, options: any, callback: any) => {
  // Try IPv4 first
  dns.lookup(hostname, { family: 4 }, (err4, address4) => {
    if (!err4 && address4) {
      return callback(null, address4, 4)
    }
    // Fallback to IPv6 if IPv4 fails
    dns.lookup(hostname, { family: 6 }, (err6, address6) => {
      if (!err6 && address6) {
        return callback(null, address6, 6)
      }
      // If both fail, return the IPv4 error
      callback(err4 || err6 || new Error('DNS resolution failed'))
    })
  })
}

/**
 * Background worker that processes automated B402 buyback & burn
 * - Checks every 5 minutes for closed rounds with pending buyback
 * - Calculates 15% platform fee from prize pool
 * - Uses Jupiter to swap USDC → SOL → B402
 * - Holds B402 in platform wallet (removes from circulation)
 * - Updates buyback status and transaction signatures
 *
 * Flow:
 * 1. Find closed lottery rounds with buyback_status = 'pending'
 * 2. Calculate 15% platform fee in USDC
 * 3. Swap USDC → SOL via Jupiter
 * 4. Swap SOL → B402 via Jupiter
 * 5. Hold B402 in platform wallet (burn by holding)
 * 6. Mark buyback as completed with transaction signature
 */

// Jupiter API endpoints - always use hostnames (IP addresses fail SSL handshake)
const JUPITER_QUOTE_API = 'https://quote-api.jup.ag/v6/quote'
const JUPITER_SWAP_API = 'https://quote-api.jup.ag/v6/swap'

// Custom HTTPS agent with custom DNS lookup (fixes Railway ENOTFOUND)
const httpsAgent = new https.Agent({
  lookup: customLookup as any, // Use custom DNS lookup function
  keepAlive: true,
  timeout: 15000
})

// Token mints
const USDC_MINT = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v' // Mainnet USDC
const SOL_MINT = 'So11111111111111111111111111111111111111112' // Wrapped SOL
const B402_TOKEN_MINT = '2mESiwuVdfft9PxG7x36rvDvex6ccyY8m8BKCWJqpump'
const PLATFORM_FEE_PERCENTAGE = 0.15 // 15% for buyback & burn

interface ClosedRound {
  id: string
  round_number: number
  blink_id: string
  total_entry_fee_usdc: string
  ended_at: Date
  status: string
}

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

interface SwapResult {
  signature: string
  outAmount: string
}

/**
 * Jupiter swap helper - executes a token swap via Jupiter aggregator
 * @param inputMint - Input token mint address
 * @param outputMint - Output token mint address
 * @param amountAtomic - Amount in smallest unit (e.g., lamports for SOL, micro-USDC for USDC)
 * @param platformKeypair - Platform wallet keypair for signing
 * @param slippageBps - Slippage in basis points (100 bps = 1%)
 * @param log - Logger instance
 * @returns Swap result with signature and output amount, or null on failure
 */
async function executeJupiterSwap(
  inputMint: string,
  outputMint: string,
  amountAtomic: bigint,
  platformKeypair: Keypair,
  slippageBps: number,
  log: any
): Promise<SwapResult | null> {
  const maxRetries = 3

  try {
    // Step 1: Get quote from Jupiter
    const quoteUrl = new URL(JUPITER_QUOTE_API)
    quoteUrl.searchParams.set('inputMint', inputMint)
    quoteUrl.searchParams.set('outputMint', outputMint)
    quoteUrl.searchParams.set('amount', amountAtomic.toString())
    quoteUrl.searchParams.set('slippageBps', slippageBps.toString())
    quoteUrl.searchParams.set('onlyDirectRoutes', 'false') // Allow multi-hop routes for better prices

    log.info({
      inputMint,
      outputMint,
      amount: amountAtomic.toString(),
      slippageBps,
      url: quoteUrl.toString()
    }, 'Requesting Jupiter quote')

    let quoteData: JupiterQuoteResponse | undefined
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        // Use axios with custom HTTPS agent for dual-stack DNS (fixes Railway ENOTFOUND)
        const response = await axios.get(quoteUrl.toString(), {
          timeout: 15000,
          httpsAgent, // Custom agent with family: 0 for dual-stack DNS
          headers: {
            'Accept': 'application/json'
          }
        })

        quoteData = response.data as JupiterQuoteResponse
        break // Success - exit retry loop

      } catch (error: any) {
        const isLastAttempt = attempt === maxRetries

        if (error.response) {
          // HTTP error (4xx, 5xx)
          log.warn({
            attempt,
            status: error.response.status,
            error: error.response.data
          }, 'Jupiter quote request failed, retrying...')
        } else {
          // Network error (DNS, timeout, etc)
          log.error({
            attempt,
            error: error.message,
            code: error.code,
            url: quoteUrl.toString()
          }, 'Jupiter quote fetch error')
        }

        if (isLastAttempt) throw error
        await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 1000))
      }
    }

    if (!quoteData) {
      log.error('Failed to get Jupiter quote after retries')
      return null
    }

    log.info({
      inputAmount: quoteData.inAmount,
      outputAmount: quoteData.outAmount,
      priceImpact: quoteData.priceImpactPct
    }, 'Jupiter quote received')

    // Step 2: Get swap transaction
    let swapData: JupiterSwapResponse | undefined
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const response = await axios.post(JUPITER_SWAP_API, {
          quoteResponse: quoteData,
          userPublicKey: platformKeypair.publicKey.toBase58(),
          wrapAndUnwrapSol: true,
          dynamicComputeUnitLimit: true,
          prioritizationFeeLamports: {
            priorityLevelWithMaxLamports: {
              maxLamports: 10_000_000, // 0.01 SOL max priority fee
              priorityLevel: 'high'
            }
          }
        }, {
          timeout: 15000,
          httpsAgent, // Custom agent with family: 0 for dual-stack DNS
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json'
          }
        })

        swapData = response.data as JupiterSwapResponse
        break // Success - exit retry loop

      } catch (error: any) {
        const isLastAttempt = attempt === maxRetries

        if (error.response) {
          // HTTP error (4xx, 5xx)
          log.warn({
            attempt,
            status: error.response.status,
            error: error.response.data
          }, 'Jupiter swap request failed, retrying...')
        } else {
          // Network error (DNS, timeout, etc)
          log.error({
            attempt,
            error: error.message
          }, 'Jupiter swap fetch error')
        }

        if (isLastAttempt) throw error
        await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 1000))
      }
    }

    if (!swapData) {
      log.error('Failed to get Jupiter swap transaction after retries')
      return null
    }

    // Step 3: Deserialize, sign, and send transaction
    const connection = getConnection()
    const transaction = VersionedTransaction.deserialize(
      Buffer.from(swapData.swapTransaction, 'base64')
    )

    transaction.sign([platformKeypair])

    log.info('Sending Jupiter swap transaction to Solana...')

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
      log.error({
        txSignature,
        error: confirmation.value.err
      }, 'Jupiter swap transaction failed on-chain')
      return null
    }

    log.info({
      txSignature,
      inputAmount: quoteData.inAmount,
      outputAmount: quoteData.outAmount,
      explorer: `https://solscan.io/tx/${txSignature}`
    }, 'Jupiter swap completed successfully')

    return {
      signature: txSignature,
      outAmount: quoteData.outAmount
    }

  } catch (error: any) {
    log.error({
      error: error.message,
      stack: error.stack,
      inputMint,
      outputMint,
      amount: amountAtomic.toString()
    }, 'Exception during Jupiter swap execution')
    return null
  }
}

interface BuybackResult {
  signature: string
  b402Amount: string
}

/**
 * Execute B402 buyback and burn using Jupiter aggregator
 * Flow: USDC → SOL → B402 (all via Jupiter)
 * B402 tokens are held in platform wallet (removes from circulation)
 *
 * @param amountUsdc - Amount of USDC to spend (platform fee)
 * @param log - Logger instance
 * @returns Buyback result with final signature and B402 amount, or null on failure
 */
async function buyAndBurnB402(amountUsdc: number, log: any): Promise<BuybackResult | null> {
  try {
    // Validate lottery platform keypair
    const platformKeypairJson = process.env.LOTTERY_PLATFORM_KEYPAIR
    if (!platformKeypairJson) {
      log.error('LOTTERY_PLATFORM_KEYPAIR not configured')
      return null
    }

    const platformKeypair = Keypair.fromSecretKey(
      Buffer.from(JSON.parse(platformKeypairJson))
    )

    log.info({
      amountUsdc,
      platformWallet: platformKeypair.publicKey.toBase58(),
      token: B402_TOKEN_MINT,
      action: 'AUTOMATED_BUYBACK_BURN'
    }, 'Starting B402 buyback via Jupiter (USDC → SOL → B402)')

    // Convert USDC to atomic units (6 decimals)
    const usdcAtomic = BigInt(Math.round(amountUsdc * 1_000_000))

    if (usdcAtomic < 500_000n) { // Less than 0.50 USDC - Jupiter routing fails for tiny amounts
      log.warn({
        amountUsdc,
        usdcAtomic: usdcAtomic.toString(),
        minimumRequired: '0.50 USDC'
      }, 'USDC amount too small for Jupiter routing, skipping buyback')
      return null
    }

    // Step 1: Swap USDC → SOL (with 2% slippage)
    log.info({ amountUsdc, usdcAtomic: usdcAtomic.toString() }, 'Step 1: Swapping USDC → SOL')
    const usdcToSolResult = await executeJupiterSwap(
      USDC_MINT,
      SOL_MINT,
      usdcAtomic,
      platformKeypair,
      200, // 2% slippage for USDC → SOL (liquid pair)
      log
    )

    if (!usdcToSolResult) {
      log.error('Failed to swap USDC → SOL')
      return null
    }

    log.info({
      signature: usdcToSolResult.signature,
      explorer: `https://solscan.io/tx/${usdcToSolResult.signature}`
    }, 'USDC → SOL swap completed')

    // Step 2: Get SOL balance after swap
    // Wait a bit for state to settle
    await new Promise(resolve => setTimeout(resolve, 2000))

    const connection = getConnection()
    const solBalance = await connection.getBalance(platformKeypair.publicKey)
    const availableSol = BigInt(solBalance) - BigInt(5_000_000) // Reserve 0.005 SOL (~$1) for future transaction fees

    if (availableSol <= 0n) {
      log.error({
        solBalance,
        availableSol: availableSol.toString()
      }, 'Insufficient SOL balance after USDC swap')
      return null
    }

    log.info({
      solBalance,
      availableSol: availableSol.toString()
    }, 'SOL balance after USDC swap')

    // Step 3: Swap SOL → B402 (with 10% slippage due to B402 volatility)
    log.info({ solAmount: availableSol.toString() }, 'Step 2: Swapping SOL → B402')
    const solToB402Result = await executeJupiterSwap(
      SOL_MINT,
      B402_TOKEN_MINT,
      availableSol,
      platformKeypair,
      1000, // 10% slippage for SOL → B402 (less liquid, more volatile)
      log
    )

    if (!solToB402Result) {
      log.error('Failed to swap SOL → B402')
      return null
    }

    // Convert B402 amount from atomic units (6 decimals) to readable format
    const b402AmountRaw = parseFloat(solToB402Result.outAmount) / 1_000_000

    log.info({
      signature: solToB402Result.signature,
      usdcSpent: amountUsdc,
      b402Amount: b402AmountRaw.toFixed(2),
      usdcToSolTx: usdcToSolResult.signature,
      solToB402Tx: solToB402Result.signature,
      explorer: `https://solscan.io/tx/${solToB402Result.signature}`
    }, '🔥 B402 buyback completed - tokens held in platform wallet (burned)')

    // Return the final transaction signature and B402 amount
    return {
      signature: solToB402Result.signature,
      b402Amount: b402AmountRaw.toFixed(6)
    }

  } catch (error: any) {
    log.error({
      error: error.message,
      stack: error.stack,
      amountUsdc
    }, 'Exception during B402 buyback')
    return null
  }
}

/**
 * Main worker function - polls for pending buybacks and executes them
 */
export function startLotteryBuyback(log: any) {
  const POLL_INTERVAL = 30000 // 30 seconds (30,000ms) - faster for testing
  const BATCH_SIZE = 5 // Process up to 5 rounds per cycle

  setInterval(async () => {
    try {
      const pool = getPool()

      // Find closed rounds with pending buyback
      const result = await pool.query<ClosedRound>(
        `SELECT id, round_number, blink_id, total_entry_fee_usdc, ended_at, status
         FROM lottery_rounds
         WHERE buyback_status = 'pending'
           AND ended_at IS NOT NULL
           AND status IN ('closed', 'distributed')
         ORDER BY ended_at ASC
         LIMIT $1`,
        [BATCH_SIZE]
      )

      if (result.rows.length === 0) {
        return // No pending buybacks
      }

      log.info({
        count: result.rows.length,
        rounds: result.rows.map(r => ({
          id: r.id,
          round: r.round_number,
          totalFees: r.total_entry_fee_usdc
        }))
      }, 'Found closed lottery rounds with pending buyback')

      // Process each round
      for (const round of result.rows) {
        try {
          const totalEntryFees = parseFloat(round.total_entry_fee_usdc)
          const platformFeeAmount = totalEntryFees * PLATFORM_FEE_PERCENTAGE

          if (platformFeeAmount <= 0) {
            log.warn({
              roundId: round.id,
              roundNumber: round.round_number,
              totalEntryFees
            }, 'No platform fee to process, marking as completed')

            await pool.query(
              `UPDATE lottery_rounds
               SET buyback_status = 'completed',
                   buyback_executed_at = NOW()
               WHERE id = $1`,
              [round.id]
            )
            continue
          }

          log.info({
            roundId: round.id,
            roundNumber: round.round_number,
            totalEntryFees,
            platformFeeAmount,
            percentage: `${PLATFORM_FEE_PERCENTAGE * 100}%`
          }, 'Processing B402 buyback for lottery round')

          // Execute buyback via Jupiter
          const buybackResult = await buyAndBurnB402(platformFeeAmount, log)

          if (buybackResult) {
            // Success - update with signature and B402 amount
            await pool.query(
              `UPDATE lottery_rounds
               SET buyback_status = 'completed',
                   buyback_tx_signature = $1,
                   buyback_b402_amount = $2,
                   buyback_executed_at = NOW()
               WHERE id = $3`,
              [buybackResult.signature, buybackResult.b402Amount, round.id]
            )

            log.info({
              roundId: round.id,
              roundNumber: round.round_number,
              platformFeeAmount,
              b402Amount: buybackResult.b402Amount,
              signature: buybackResult.signature,
              solscan: `https://solscan.io/tx/${buybackResult.signature}`
            }, 'B402 buyback completed successfully')
          } else if (platformFeeAmount < 0.50) {
            // Amount too small - mark as completed with note
            await pool.query(
              `UPDATE lottery_rounds
               SET buyback_status = 'completed',
                   buyback_tx_signature = 'SKIPPED_TOO_SMALL',
                   buyback_executed_at = NOW()
               WHERE id = $1`,
              [round.id]
            )

            log.warn({
              roundId: round.id,
              roundNumber: round.round_number,
              platformFeeAmount,
              reason: 'Amount < 0.50 USDC minimum for Jupiter routing'
            }, 'Buyback skipped - amount too small, marked as completed')
          } else {
            // Failed - mark for retry
            await pool.query(
              `UPDATE lottery_rounds
               SET buyback_status = 'failed'
               WHERE id = $1`,
              [round.id]
            )

            log.error({
              roundId: round.id,
              roundNumber: round.round_number,
              platformFeeAmount
            }, 'B402 buyback failed, marked for manual intervention')
          }
        } catch (error) {
          log.error({
            error,
            roundId: round.id,
            roundNumber: round.round_number
          }, 'Error processing lottery buyback')

          // Mark as failed for manual review
          await pool.query(
            `UPDATE lottery_rounds
             SET buyback_status = 'failed'
             WHERE id = $1`,
            [round.id]
          )
        }
      }
    } catch (error) {
      log.error({ error }, 'Error in lottery buyback polling')
    }
  }, POLL_INTERVAL)

  log.info({
    interval: `${POLL_INTERVAL / 1000}s`,
    batchSize: BATCH_SIZE,
    platformFee: `${PLATFORM_FEE_PERCENTAGE * 100}%`,
    token: B402_TOKEN_MINT
  }, 'Lottery buyback worker started - automated B402 burn enabled')
}
