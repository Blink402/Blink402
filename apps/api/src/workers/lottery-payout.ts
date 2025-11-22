import { Keypair, PublicKey } from '@solana/web3.js'
import {
  getConnection,
  getUsdcMint,
  usdcToLamports,
  buildRewardTransaction,
  signAndBroadcastReward
} from '@blink402/solana'
import {
  getPool,
  getPendingPayouts,
  updatePayoutStatus,
  getRoundById,
  updateRoundStatus,
  getRoundWinners,
  getCreatorPayoutKey,
  decrypt
} from '@blink402/database'

/**
 * Background worker that processes pending lottery payouts
 * - Checks every 15 seconds for winners awaiting payout
 * - Sends USDC to winner wallets using creator's payout key
 * - Updates payout status and transaction signatures
 * - Marks rounds as 'distributed' when all payouts complete
 */
export function startLotteryPayout(log: any) {
  const POLL_INTERVAL = 15000 // 15 seconds
  const BATCH_SIZE = 10 // Process up to 10 payouts per cycle

  setInterval(async () => {
    try {
      // Find pending winner payouts
      const pendingPayouts = await getPendingPayouts()

      if (pendingPayouts.length === 0) {
        return // No pending payouts
      }

      log.info({ count: pendingPayouts.length }, 'Found pending lottery payouts')

      // Process in batches to avoid overwhelming the RPC
      const batch = pendingPayouts.slice(0, BATCH_SIZE)

      for (const payout of batch) {
        try {
          log.info({
            payoutId: payout.id,
            roundId: payout.round_id,
            winner: payout.winner_wallet,
            amount: payout.payout_amount_usdc,
            rank: payout.payout_rank
          }, 'Processing lottery payout')

          // 1. Get round and blink info
          const round = await getRoundById(payout.round_id)
          if (!round) {
            log.error({ payoutId: payout.id }, 'Round not found')
            await updatePayoutStatus(payout.id, 'failed')
            continue
          }

          // 2. Get creator info (lottery blink owner)
          const pool = getPool()
          const blinkResult = await pool.query(
            `SELECT b.creator_id, c.wallet as creator_wallet
             FROM blinks b
             JOIN creators c ON b.creator_id = c.id
             WHERE b.id = $1`,
            [round.blink_id]
          )

          if (blinkResult.rows.length === 0) {
            log.error({ payoutId: payout.id, blinkId: round.blink_id }, 'Blink or creator not found')
            await updatePayoutStatus(payout.id, 'failed')
            continue
          }

          const { creator_id, creator_wallet } = blinkResult.rows[0]

          // 3. Get payout keypair (creator key or platform fallback)
          let privateKeyArray: number[] | undefined
          let payoutWallet: string | undefined

          // Try to get creator's encrypted payout key
          let encryptedKey = await getCreatorPayoutKey(creator_id).catch(() => null)

          if (encryptedKey) {
            // Use creator's payout key
            try {
              const decrypted = decrypt(encryptedKey)
              privateKeyArray = JSON.parse(decrypted)
              payoutWallet = creator_wallet
              log.info({ payoutId: payout.id }, 'Using creator payout key')
            } catch (error) {
              log.error({ error, payoutId: payout.id }, 'Failed to decrypt creator payout key, falling back to platform key')
              encryptedKey = null
            }
          }

          // Fallback to platform lottery keypair
          if (!encryptedKey) {
            const platformKey = process.env.LOTTERY_PLATFORM_KEYPAIR
            if (!platformKey) {
              log.error({ payoutId: payout.id }, 'No creator payout key and LOTTERY_PLATFORM_KEYPAIR not configured')
              await updatePayoutStatus(payout.id, 'failed')
              continue
            }

            try {
              privateKeyArray = JSON.parse(platformKey)
              // Derive public key from the keypair
              const platformKeypair = Keypair.fromSecretKey(new Uint8Array(privateKeyArray!))
              payoutWallet = platformKeypair.publicKey.toBase58()
              log.info({ payoutId: payout.id, platformWallet: payoutWallet }, 'Using platform lottery keypair for payout')
            } catch (error) {
              log.error({ error, payoutId: payout.id }, 'Failed to parse LOTTERY_PLATFORM_KEYPAIR')
              await updatePayoutStatus(payout.id, 'failed')
              continue
            }
          }

          // 5. Build and send USDC reward transaction
          try {
            // Safety check (should never happen due to continue statements above)
            if (!privateKeyArray || !payoutWallet) {
              log.error({ payoutId: payout.id }, 'Missing privateKeyArray or payoutWallet')
              await updatePayoutStatus(payout.id, 'failed')
              continue
            }

            const connection = getConnection()
            const payoutKeypair = Keypair.fromSecretKey(new Uint8Array(privateKeyArray!))
            const payoutPubkey = new PublicKey(payoutWallet!)
            const winnerPubkey = new PublicKey(payout.winner_wallet)
            const usdcMint = getUsdcMint()
            const amountLamports = usdcToLamports(payout.payout_amount_usdc)

            // Build transaction
            const transaction = await buildRewardTransaction({
              connection,
              creator: payoutPubkey,
              user: winnerPubkey,
              amount: amountLamports,
              tokenMint: usdcMint,
              memo: `Lottery R${round.round_number} P${payout.payout_rank}`
            })

            // Sign and broadcast (skip confirmation to avoid timeout)
            const signature = await signAndBroadcastReward({
              connection,
              transaction,
              creatorKeypair: payoutKeypair,
              skipConfirmation: true
            })

            log.info({
              payoutId: payout.id,
              winner: payout.winner_wallet,
              amount: payout.payout_amount_usdc,
              signature
            }, 'Lottery payout sent successfully')

            // 6. Update payout status
            await updatePayoutStatus(payout.id, 'completed', signature)

            // 7. Check if all payouts for this round are complete
            const allWinners = await getRoundWinners(payout.round_id)
            const allCompleted = allWinners.every(w => w.payout_status === 'completed')

            if (allCompleted) {
              await updateRoundStatus(payout.round_id, 'distributed')
              log.info({ roundId: payout.round_id }, 'All lottery payouts completed, round marked as distributed')
            }

          } catch (error) {
            log.error({
              error,
              payoutId: payout.id,
              winner: payout.winner_wallet
            }, 'Failed to send lottery payout')

            // Mark as failed (will need manual intervention)
            await updatePayoutStatus(payout.id, 'failed')
          }

        } catch (error) {
          log.error({
            error,
            payoutId: payout.id
          }, 'Error processing lottery payout')
        }
      }
    } catch (error) {
      log.error({ error }, 'Error in lottery payout polling')
    }
  }, POLL_INTERVAL)

  log.info({ interval: POLL_INTERVAL, batchSize: BATCH_SIZE }, 'Lottery payout worker started')
}
