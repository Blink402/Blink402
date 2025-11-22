// Lottery database operations
import { getPool } from './index.js'
import type {
  LotteryRound,
  LotteryEntry,
  LotteryWinner,
  LotteryRoundStatus,
  LotteryPayoutStatus,
  LotteryRank
} from '@blink402/types'

// ========== ROUND MANAGEMENT ==========

export async function createLotteryRound(
  blinkId: string,
  roundNumber: number
): Promise<LotteryRound> {
  const pool = getPool()
  const result = await pool.query(
    `INSERT INTO lottery_rounds (blink_id, round_number, status)
     VALUES ($1, $2, 'active')
     RETURNING *`,
    [blinkId, roundNumber]
  )
  return mapToLotteryRound(result.rows[0])
}

export async function getActiveRound(blinkId: string): Promise<LotteryRound | null> {
  const pool = getPool()
  const result = await pool.query(
    `SELECT * FROM lottery_rounds
     WHERE blink_id = $1 AND status = 'active'
     ORDER BY round_number DESC
     LIMIT 1`,
    [blinkId]
  )
  return result.rows[0] ? mapToLotteryRound(result.rows[0]) : null
}

export async function getRoundById(roundId: string): Promise<LotteryRound | null> {
  const pool = getPool()
  const result = await pool.query(
    `SELECT * FROM lottery_rounds WHERE id = $1`,
    [roundId]
  )
  return result.rows[0] ? mapToLotteryRound(result.rows[0]) : null
}

export async function getMaxRoundNumber(blinkId: string): Promise<number> {
  const pool = getPool()
  const result = await pool.query(
    `SELECT COALESCE(MAX(round_number), 0) as max_round
     FROM lottery_rounds
     WHERE blink_id = $1`,
    [blinkId]
  )
  return parseInt(result.rows[0].max_round, 10)
}

export async function getRoundsEndingBefore(timestamp: Date): Promise<LotteryRound[]> {
  const pool = getPool()
  const result = await pool.query(
    `SELECT lr.* FROM lottery_rounds lr
     JOIN blinks b ON b.id = lr.blink_id
     WHERE lr.status = 'active'
     AND (
       -- Special case: duration = 1 means 15 seconds for testing
       (b.lottery_round_duration_minutes = 1 AND lr.started_at + INTERVAL '15 seconds' <= $1)
       OR
       -- Normal case: use minutes duration
       (b.lottery_round_duration_minutes != 1 AND lr.started_at + (b.lottery_round_duration_minutes || ' minutes')::INTERVAL <= $1)
     )
     ORDER BY lr.started_at ASC`,
    [timestamp]
  )
  return result.rows.map(mapToLotteryRound)
}

export async function updateRoundStatus(
  roundId: string,
  status: LotteryRoundStatus,
  winnersSelectedAt?: Date
): Promise<void> {
  const pool = getPool()
  await pool.query(
    `UPDATE lottery_rounds
     SET status = $1::varchar,
         winners_selected_at = $2,
         ended_at = CASE WHEN $1::varchar IN ('closed', 'distributed') THEN NOW() ELSE ended_at END
     WHERE id = $3`,
    [status, winnersSelectedAt || null, roundId]
  )
}

export async function updateRoundStats(
  roundId: string,
  totalEntries: number,
  totalFees: string
): Promise<void> {
  const pool = getPool()
  await pool.query(
    `UPDATE lottery_rounds
     SET total_entries = $1, total_entry_fee_usdc = $2
     WHERE id = $3`,
    [totalEntries, totalFees, roundId]
  )
}

// ========== ENTRY MANAGEMENT ==========

export async function createLotteryEntry(
  roundId: string,
  runId: string,
  payerWallet: string,
  entryFeeUsdc: string
): Promise<LotteryEntry> {
  const pool = getPool()
  const result = await pool.query(
    `INSERT INTO lottery_entries (round_id, run_id, payer_wallet, entry_fee_usdc)
     VALUES ($1, $2, $3, $4)
     RETURNING *`,
    [roundId, runId, payerWallet, entryFeeUsdc]
  )
  return mapToLotteryEntry(result.rows[0])
}

export async function getRoundEntries(roundId: string): Promise<LotteryEntry[]> {
  const pool = getPool()
  const result = await pool.query(
    `SELECT * FROM lottery_entries
     WHERE round_id = $1
     ORDER BY entry_timestamp ASC`,
    [roundId]
  )
  return result.rows.map(mapToLotteryEntry)
}

export async function getUserEntriesInRound(
  roundId: string,
  wallet: string
): Promise<number> {
  const pool = getPool()
  const result = await pool.query(
    `SELECT COUNT(*) as count FROM lottery_entries
     WHERE round_id = $1 AND payer_wallet = $2`,
    [roundId, wallet]
  )
  return parseInt(result.rows[0].count, 10)
}

export async function getEntryByRunId(runId: string): Promise<LotteryEntry | null> {
  const pool = getPool()
  const result = await pool.query(
    `SELECT * FROM lottery_entries WHERE run_id = $1`,
    [runId]
  )
  return result.rows[0] ? mapToLotteryEntry(result.rows[0]) : null
}

// ========== WINNER MANAGEMENT ==========

export async function createWinner(
  roundId: string,
  winnerWallet: string,
  payoutAmount: string,
  rank: LotteryRank
): Promise<LotteryWinner> {
  const pool = getPool()
  const result = await pool.query(
    `INSERT INTO lottery_winners (round_id, winner_wallet, payout_amount_usdc, payout_rank)
     VALUES ($1, $2, $3, $4)
     RETURNING *`,
    [roundId, winnerWallet, payoutAmount, rank]
  )
  return mapToLotteryWinner(result.rows[0])
}

export async function getRoundWinners(roundId: string): Promise<LotteryWinner[]> {
  const pool = getPool()
  const result = await pool.query(
    `SELECT * FROM lottery_winners
     WHERE round_id = $1
     ORDER BY payout_rank ASC`,
    [roundId]
  )
  return result.rows.map(mapToLotteryWinner)
}

export async function getPendingPayouts(): Promise<LotteryWinner[]> {
  const pool = getPool()
  const result = await pool.query(
    `SELECT * FROM lottery_winners
     WHERE payout_status = 'pending'
     ORDER BY created_at ASC
     LIMIT 50`
  )
  return result.rows.map(mapToLotteryWinner)
}

export async function updatePayoutStatus(
  winnerId: string,
  status: LotteryPayoutStatus,
  txSignature?: string
): Promise<void> {
  const pool = getPool()
  await pool.query(
    `UPDATE lottery_winners
     SET payout_status = $1::varchar,
         payout_tx_signature = $2,
         completed_at = CASE WHEN $1::varchar = 'completed' THEN NOW() ELSE completed_at END
     WHERE id = $3`,
    [status, txSignature || null, winnerId]
  )
}

// ========== STATISTICS & ANALYTICS ==========

export async function getLotteryStatsByBlink(blinkId: string) {
  const pool = getPool()

  // Get current active round
  const currentRoundResult = await pool.query(
    `SELECT
       id, round_number, started_at, total_entries, total_entry_fee_usdc,
       (started_at + INTERVAL '15 minutes') as next_draw_at,
       EXTRACT(EPOCH FROM ((started_at + INTERVAL '15 minutes') - NOW())) as time_remaining_seconds
     FROM lottery_rounds
     WHERE blink_id = $1 AND status = 'active'
     ORDER BY round_number DESC
     LIMIT 1`,
    [blinkId]
  )

  // Get recent winners (last 10)
  const recentWinnersResult = await pool.query(
    `SELECT
       lr.round_number, lw.winner_wallet, lw.payout_amount_usdc,
       lw.payout_rank, lw.completed_at
     FROM lottery_winners lw
     JOIN lottery_rounds lr ON lw.round_id = lr.id
     WHERE lr.blink_id = $1 AND lw.payout_status = 'completed'
     ORDER BY lw.completed_at DESC
     LIMIT 10`,
    [blinkId]
  )

  // Get aggregate stats
  const aggregateResult = await pool.query(
    `SELECT
       COUNT(DISTINCT lr.id) as total_rounds,
       COALESCE(SUM(le.entry_fee_usdc), 0) as total_entry_fees,
       COUNT(le.id) as total_entries,
       COALESCE(SUM(lw.payout_amount_usdc), 0) as total_distributed,
       COALESCE(SUM(lr.buyback_b402_amount), 0) as total_b402_bought
     FROM lottery_rounds lr
     LEFT JOIN lottery_entries le ON le.round_id = lr.id
     LEFT JOIN lottery_winners lw ON lw.round_id = lr.id AND lw.payout_status = 'completed'
     WHERE lr.blink_id = $1`,
    [blinkId]
  )

  const current = currentRoundResult.rows[0]
  const aggregate = aggregateResult.rows[0]
  const totalEntryFees = parseFloat(aggregate.total_entry_fees || '0')
  const totalDistributed = parseFloat(aggregate.total_distributed || '0')
  const platformFees = totalEntryFees - totalDistributed
  const totalB402Bought = parseFloat(aggregate.total_b402_bought || '0')

  return {
    current_round: current ? {
      round_id: current.id,
      round_number: current.round_number,
      total_entries: current.total_entries,
      prize_pool_usdc: current.total_entry_fee_usdc,
      next_draw_at: current.next_draw_at,
      time_remaining_seconds: Math.max(0, Math.floor(current.time_remaining_seconds))
    } : null,
    recent_winners: recentWinnersResult.rows.map(w => ({
      round_number: w.round_number,
      winner_wallet: w.winner_wallet,
      payout_amount_usdc: w.payout_amount_usdc,
      rank: w.payout_rank,
      completed_at: w.completed_at
    })),
    total_rounds: parseInt(aggregate.total_rounds, 10),
    total_entries: parseInt(aggregate.total_entries, 10),
    total_distributed_usdc: totalDistributed.toFixed(6),
    total_platform_fees_usdc: platformFees.toFixed(6),
    total_b402_bought: totalB402Bought.toFixed(2)
  }
}

export async function getLotteryHistory(
  blinkId: string,
  limit: number = 20,
  offset: number = 0
) {
  const pool = getPool()
  const result = await pool.query(
    `SELECT
       lr.round_number, lr.started_at, lr.ended_at,
       lr.total_entries, lr.total_entry_fee_usdc,
       json_agg(
         json_build_object(
           'wallet', lw.winner_wallet,
           'rank', lw.payout_rank,
           'payout_amount_usdc', lw.payout_amount_usdc,
           'tx_signature', lw.payout_tx_signature
         ) ORDER BY lw.payout_rank ASC
       ) FILTER (WHERE lw.id IS NOT NULL) as winners
     FROM lottery_rounds lr
     LEFT JOIN lottery_winners lw ON lw.round_id = lr.id
     WHERE lr.blink_id = $1 AND lr.status IN ('closed', 'distributed')
     GROUP BY lr.id, lr.round_number, lr.started_at, lr.ended_at, lr.total_entries, lr.total_entry_fee_usdc
     ORDER BY lr.round_number DESC
     LIMIT $2 OFFSET $3`,
    [blinkId, limit, offset]
  )

  return result.rows.map(row => {
    const totalPool = parseFloat(row.total_entry_fee_usdc || '0')
    const platformFee = totalPool * 0.15
    return {
      round_number: row.round_number,
      started_at: row.started_at,
      ended_at: row.ended_at,
      total_entries: row.total_entries,
      prize_pool_usdc: row.total_entry_fee_usdc,
      winners: row.winners || [],
      platform_fee_usdc: platformFee.toFixed(6)
    }
  })
}

// ========== HELPER FUNCTIONS ==========

function mapToLotteryRound(row: any): LotteryRound {
  return {
    id: row.id,
    blink_id: row.blink_id,
    round_number: row.round_number,
    started_at: row.started_at,
    ended_at: row.ended_at,
    total_entry_fee_usdc: row.total_entry_fee_usdc,
    total_entries: row.total_entries,
    winners_selected_at: row.winners_selected_at,
    status: row.status as LotteryRoundStatus,
    bonus_pool_usdc: row.bonus_pool_usdc,
    created_at: row.created_at
  }
}

function mapToLotteryEntry(row: any): LotteryEntry {
  return {
    id: row.id,
    round_id: row.round_id,
    run_id: row.run_id,
    payer_wallet: row.payer_wallet,
    entry_fee_usdc: row.entry_fee_usdc,
    entry_timestamp: row.entry_timestamp
  }
}

function mapToLotteryWinner(row: any): LotteryWinner {
  return {
    id: row.id,
    round_id: row.round_id,
    winner_wallet: row.winner_wallet,
    payout_amount_usdc: row.payout_amount_usdc,
    payout_rank: row.payout_rank as LotteryRank,
    payout_tx_signature: row.payout_tx_signature,
    payout_status: row.payout_status as LotteryPayoutStatus,
    completed_at: row.completed_at,
    created_at: row.created_at
  }
}
