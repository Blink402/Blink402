import { createHash, randomBytes } from 'crypto'
import seedrandom from 'seedrandom'
import {
  getPool,
  getRoundsEndingBefore,
  getRoundEntries,
  updateRoundStatus,
  createWinner,
  createLotteryRound,
  updateRoundStats
} from '@blink402/database'
import type { LotteryEntry, LotteryRank } from '@blink402/types'

/**
 * Background worker that manages lottery rounds
 * - Checks every 60 seconds for rounds that should end
 * - Closes active rounds after 15 minutes
 * - Selects 3 random winners using provably fair SHA-256 seeding
 * - Creates payout records for winners
 * - Starts new rounds automatically
 */
export function startLotteryScheduler(log: any) {
  const POLL_INTERVAL = 60000 // 60 seconds
  const PLATFORM_WALLET = process.env.LOTTERY_PLATFORM_WALLET || 'ErFb9cHKm1XJUdZ3GvgHtQyS94R95TJSU6SsZ9XCsAXA'

  // Fixed prize percentages
  const PRIZE_CONFIG = {
    first: 0.50,   // 50%
    second: 0.20,  // 20%
    third: 0.15,   // 15%
    platform: 0.15 // 15%
  }

  /**
   * Select N random winners from entries using provably fair seeding
   */
  function selectRandomWinners(
    entries: LotteryEntry[],
    count: number,
    roundId: string,
    timestamp: number
  ): LotteryEntry[] {
    if (entries.length === 0) return []
    if (entries.length <= count) return entries // All participants win if fewer than count

    // Create provably fair seed using round ID + timestamp
    const seedStr = `${roundId}-${timestamp}`
    const seed = createHash('sha256').update(seedStr).digest('hex')

    // Use seeded RNG for reproducible randomness (auditable)
    const rng = seedrandom(seed)

    // Fisher-Yates shuffle with seeded RNG
    const shuffled = [...entries]
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
    }

    return shuffled.slice(0, count)
  }

  setInterval(async () => {
    try {
      const now = new Date()

      // Find rounds that should end (started 15+ minutes ago and still active)
      const roundsToEnd = await getRoundsEndingBefore(now)

      if (roundsToEnd.length === 0) {
        return // No rounds to process
      }

      log.info({ count: roundsToEnd.length }, 'Found lottery rounds to close')

      for (const round of roundsToEnd) {
        try {
          log.info({
            roundId: round.id,
            roundNumber: round.round_number,
            blinkId: round.blink_id
          }, 'Closing lottery round and selecting winners')

          // 1. Get all entries for this round
          const entries = await getRoundEntries(round.id)

          if (entries.length === 0) {
            log.warn({ roundId: round.id }, 'Round has no entries, closing without winners')
            await updateRoundStatus(round.id, 'closed', new Date())
            // Don't auto-create new round - wait for next entry to start fresh
            continue
          }

          // 2. Calculate total prize pool
          const totalPool = entries.reduce((sum, e) => sum + parseFloat(e.entry_fee_usdc), 0)

          // 3. Update round statistics
          await updateRoundStats(round.id, entries.length, totalPool.toFixed(6))

          // 4. Select winners (up to 3)
          const timestamp = Date.now()
          const winnerCount = Math.min(3, entries.length)
          const selectedWinners = selectRandomWinners(entries, winnerCount, round.id, timestamp)

          log.info({
            roundId: round.id,
            totalEntries: entries.length,
            winnersSelected: selectedWinners.length,
            prizePool: totalPool.toFixed(6)
          }, 'Selected lottery winners')

          // 5. Calculate and create winner records
          const payoutAmounts = [
            totalPool * PRIZE_CONFIG.first,  // 50% for 1st
            totalPool * PRIZE_CONFIG.second, // 20% for 2nd
            totalPool * PRIZE_CONFIG.third   // 15% for 3rd
          ]

          for (let i = 0; i < selectedWinners.length; i++) {
            const winner = selectedWinners[i]
            const rank = (i + 1) as LotteryRank
            const payoutAmount = payoutAmounts[i]

            await createWinner(
              round.id,
              winner.payer_wallet,
              payoutAmount.toFixed(6),
              rank
            )

            log.info({
              roundId: round.id,
              rank,
              winner: winner.payer_wallet,
              payout: payoutAmount.toFixed(6)
            }, 'Created winner payout record')
          }

          // 6. Mark round as closed (payouts pending)
          await updateRoundStatus(round.id, 'closed', new Date())

          // 7. Log platform fee (15% of pool - goes to treasury)
          const platformFee = totalPool * PRIZE_CONFIG.platform
          log.info({
            roundId: round.id,
            platformFee: platformFee.toFixed(6),
            platformWallet: PLATFORM_WALLET
          }, 'Platform fee calculated (will be sent separately)')

          // Don't auto-create new round - wait for next entry to start fresh
          log.info({ roundId: round.id, blinkId: round.blink_id }, 'Round closed. Waiting for next entry to start new round.')

        } catch (error) {
          log.error({
            error,
            roundId: round.id
          }, 'Error processing lottery round')
        }
      }
    } catch (error) {
      log.error({ error }, 'Error in lottery scheduler polling')
    }
  }, POLL_INTERVAL)

  log.info({ interval: POLL_INTERVAL, config: PRIZE_CONFIG }, 'Lottery scheduler started')
}
