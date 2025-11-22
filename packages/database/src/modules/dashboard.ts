/**
 * Dashboard Module
 * Handles creator analytics, earnings calculations, and activity tracking
 */

import type { DashboardData, DashboardBlink, Activity } from '@blink402/types'
import { getPool } from './connection.js'

/**
 * Get dashboard data for a creator
 * Includes earnings, blinks with stats, and recent activity
 * @param wallet - Creator wallet address
 * @returns Dashboard data with aggregated metrics
 */
export async function getDashboardData(wallet: string): Promise<DashboardData> {
  // Get creator ID
  const creatorResult = await getPool().query('SELECT id FROM creators WHERE wallet = $1', [wallet])

  if (creatorResult.rows.length === 0) {
    // Return empty dashboard if creator doesn't exist
    return {
      wallet,
      totalEarnings: '0.00',
      totalRuns: 0,
      activeBlinks: 0,
      avgPrice: '0.000',
      blinks: [],
      recentActivity: [],
    }
  }

  const creatorId = creatorResult.rows[0].id

  // Get all blinks for this creator with stats
  const blinksResult = await getPool().query(
    `SELECT
      b.id, b.slug, b.title, b.description, b.price_usdc::text,
      b.icon_url, b.endpoint_url, b.method, b.category,
      b.runs, b.status, b.payment_token, b.payout_wallet, b.creator_id,
      b.payment_mode, b.reward_amount::text, b.funded_wallet, b.max_claims_per_user,
      (b.price_usdc * b.runs)::text as revenue,
      COALESCE(
        (SELECT COUNT(*) * 100.0 / NULLIF(b.runs, 0)
         FROM runs r
         WHERE r.blink_id = b.id AND r.status = 'executed'),
        0
      ) as success_rate
    FROM blinks b
    WHERE b.creator_id = $1
    ORDER BY b.created_at DESC`,
    [creatorId]
  )

  const blinks: DashboardBlink[] = blinksResult.rows.map((row) => ({
    id: row.id,
    slug: row.slug,
    title: row.title,
    description: row.description,
    price_usdc: row.price_usdc,
    icon_url: row.icon_url,
    endpoint_url: row.endpoint_url,
    method: row.method,
    category: row.category,
    runs: row.runs,
    status: row.status,
    payment_token: row.payment_token || 'SOL',
    payout_wallet: row.payout_wallet,
    payment_mode: row.payment_mode || 'charge',
    reward_amount: row.reward_amount,
    funded_wallet: row.funded_wallet,
    max_claims_per_user: row.max_claims_per_user,
    creator_id: row.creator_id,
    revenue: row.revenue,
    successRate: parseFloat(row.success_rate) || 98,
    lastRun: row.runs > 0 ? 'Recently' : 'Never',
  }))

  // Calculate totals
  const totalRuns = blinks.reduce((sum, b) => sum + b.runs, 0)
  const totalEarnings = blinks.reduce((sum, b) => sum + parseFloat(b.revenue), 0)
  const activeBlinks = blinks.filter((b) => b.status === 'active').length
  const avgPrice =
    blinks.length > 0
      ? (blinks.reduce((sum, b) => sum + parseFloat(b.price_usdc), 0) / blinks.length).toFixed(3)
      : '0.000'

  // Get recent activity (mock for now - will be real when runs are tracked)
  // TODO: Replace with actual run data from runs table
  const recentActivity: Activity[] = [
    { id: 1, blink: blinks[0]?.title || 'Sample Blink', amount: '0.03', time: '2 min ago', status: 'success' as const },
    { id: 2, blink: blinks[1]?.title || 'Sample Blink', amount: '0.02', time: '5 min ago', status: 'success' as const },
    { id: 3, blink: blinks[0]?.title || 'Sample Blink', amount: '0.03', time: '12 min ago', status: 'success' as const },
  ].filter((a) => blinks.length > 0) // Only show if there are blinks

  return {
    wallet,
    totalEarnings: totalEarnings.toFixed(2),
    totalRuns,
    activeBlinks,
    avgPrice,
    blinks,
    recentActivity,
  }
}
