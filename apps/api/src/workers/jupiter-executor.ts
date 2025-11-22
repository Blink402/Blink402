import { getPool, updateRunPaymentAtomic } from '@blink402/database'
import { getConnection, verifyPaymentWithSolanaPay, usdcToLamports, parsePublicKey, getUsdcMint } from '@blink402/solana'
import { PublicKey } from '@solana/web3.js'

/**
 * Background worker that polls for paid runs and executes them
 * Runs every 10 seconds to check for:
 * - buy-b402 and burn-b402 runs (Jupiter swaps)
 * - lottery entry runs (Actions lottery entries)
 *
 * For Actions flow (reference is Solana public key), verifies payment on-chain first
 */
export function startJupiterExecutor(log: any) {
  const POLL_INTERVAL = 10000 // 10 seconds
  const API_BASE_URL = process.env.API_URL || `http://localhost:${process.env.PORT || 3001}`

  setInterval(async () => {
    try {
      const pool = getPool()

      // Find pending runs for buy-b402, burn-b402, and lottery entries
      // We check pending runs because we need to verify payment first
      const result = await pool.query(`
        SELECT r.id, r.reference, r.payer, r.signature, r.metadata, b.id as blink_id, b.slug, b.lottery_enabled, b.price_usdc, b.payout_wallet
        FROM runs r
        JOIN blinks b ON r.blink_id = b.id
        WHERE r.status = 'pending'
        AND (b.slug IN ('buy-b402', 'burn-b402') OR b.lottery_enabled = true)
        AND r.created_at > NOW() - INTERVAL '1 hour'
        AND r.created_at < NOW() - INTERVAL '30 seconds'
        LIMIT 10
      `)

      if (result.rows.length === 0) {
        return // No pending runs
      }

      log.info({ count: result.rows.length }, 'Found pending runs to verify and execute')

      for (const run of result.rows) {
        try {
          const isLottery = run.lottery_enabled === true

          // Check if reference is a Solana public key (Actions flow) vs UUID (x402 flow)
          const isSolanaPublicKey = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(run.reference)

          // For Actions flow with Solana public key reference, verify payment on-chain first
          if (isSolanaPublicKey) {
            log.info({
              reference: run.reference,
              slug: run.slug,
              type: 'actions'
            }, 'Detected Actions flow - verifying payment on-chain')

            try {
              // Parse reference as Solana public key
              const referenceKey = new PublicKey(run.reference)
              const recipientKey = parsePublicKey(run.payout_wallet)

              if (!recipientKey) {
                throw new Error(`Invalid payout wallet: ${run.payout_wallet}`)
              }

              // Get payer from metadata (saved during transaction building)
              const payer = run.metadata?.payer
              if (!payer) {
                throw new Error('Payer not found in metadata')
              }

              // Verify payment on-chain using Solana Pay
              const connection = getConnection()
              const expectedAmount = usdcToLamports(run.price_usdc)
              const usdcMint = getUsdcMint()

              const paymentResult = await verifyPaymentWithSolanaPay({
                connection,
                reference: referenceKey,
                recipient: recipientKey,
                amount: expectedAmount,
                splToken: usdcMint,
                timeout: 5000, // 5 second timeout for polling
                commitment: 'confirmed',
              })

              log.info({
                reference: run.reference,
                signature: paymentResult.signature,
                slot: paymentResult.slot,
                payer
              }, 'Payment verified on-chain')

              // Update run status to paid
              await updateRunPaymentAtomic({
                reference: run.reference,
                signature: paymentResult.signature,
                payer,
              })

              log.info({
                reference: run.reference,
                signature: paymentResult.signature
              }, 'Updated run status to paid')

            } catch (verifyError: any) {
              log.error({
                error: verifyError.message,
                reference: run.reference,
                slug: run.slug
              }, 'Payment verification failed - will retry on next poll')
              continue // Skip this run, will retry on next poll
            }
          }

          // Route to correct endpoint based on blink type
          const endpoint = isLottery
            ? `${API_BASE_URL}/lottery/${run.slug}/enter`
            : `${API_BASE_URL}/bazaar/${run.slug}`

          log.info({
            reference: run.reference,
            slug: run.slug,
            payer: run.payer || run.metadata?.payer,
            type: isLottery ? 'lottery' : 'jupiter'
          }, `Executing ${isLottery ? 'lottery entry' : 'Jupiter swap'}`)

          const response = await fetch(endpoint, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              reference: run.reference,
            }),
          })

          if (!response.ok) {
            const errorText = await response.text()
            log.error({
              reference: run.reference,
              status: response.status,
              error: errorText.substring(0, 500),
              endpoint
            }, 'Execution failed')
          } else {
            const result = await response.json() as { success?: boolean; data?: any; signature?: string; entry_id?: string }
            log.info({
              reference: run.reference,
              success: result.success,
              signature: result.signature || result.data?.signature,
              entry_id: result.entry_id,
              type: isLottery ? 'lottery' : 'jupiter'
            }, `${isLottery ? 'Lottery entry' : 'Jupiter swap'} completed successfully`)
          }
        } catch (error) {
          log.error({
            error,
            reference: run.reference,
            slug: run.slug
          }, 'Error executing run')
        }
      }
    } catch (error) {
      log.error({ error }, 'Error in Jupiter executor polling')
    }
  }, POLL_INTERVAL)

  log.info({ interval: POLL_INTERVAL }, 'Actions executor started (Jupiter swaps + Lottery entries)')
}
