// Database module for PostgreSQL operations
// Replaces in-memory storage with persistent database

import { Pool, QueryResult } from 'pg'
import type { BlinkData, DashboardData, DashboardBlink, Activity } from './types'
import { logger } from './logger'

// Lazy connection pool - only created when first query is run
// This prevents database connection attempts during Next.js build time
let pool: Pool | null = null

function getPool(): Pool {
  // Skip pool creation entirely if no DATABASE_URL (happens during build)
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL not configured - cannot connect to database')
  }

  if (!pool) {
    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      max: 20, // Maximum number of clients in the pool
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000, // 5 second timeout for connections
    })
  }
  return pool
}

// Helper function to get or create a creator
async function getOrCreateCreator(wallet: string): Promise<string> {
  const result = await getPool().query(
    'INSERT INTO creators (wallet) VALUES ($1) ON CONFLICT (wallet) DO UPDATE SET wallet = $1 RETURNING id',
    [wallet]
  )
  return result.rows[0].id
}

// ========== BLINKS CRUD OPERATIONS ==========

export async function getAllBlinks(): Promise<BlinkData[]> {
  const result = await getPool().query(
    `SELECT
      b.id, b.slug, b.title, b.description, b.price_usdc::text,
      b.icon_url, b.endpoint_url, b.method, b.category,
      b.runs, b.status, b.payment_token, b.payment_mode, b.payout_wallet, b.creator_id, c.wallet as creator_wallet
    FROM blinks b
    JOIN creators c ON b.creator_id = c.id
    ORDER BY b.created_at DESC`
  )

  return result.rows.map(row => ({
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
    payment_token: row.payment_token || 'USDC',
    payment_mode: row.payment_mode || 'charge',
    payout_wallet: row.payout_wallet,
    creator_id: row.creator_id,
    creator: { wallet: row.creator_wallet }
  }))
}

export async function getBlinkBySlug(slug: string): Promise<BlinkData | null> {
  const result = await getPool().query(
    `SELECT
      b.id, b.slug, b.title, b.description, b.price_usdc::text,
      b.icon_url, b.endpoint_url, b.method, b.category,
      b.runs, b.status, b.payment_token, b.payment_mode, b.payout_wallet, b.creator_id, c.wallet as creator_wallet
    FROM blinks b
    JOIN creators c ON b.creator_id = c.id
    WHERE b.slug = $1`,
    [slug]
  )

  if (result.rows.length === 0) return null

  const row = result.rows[0]
  return {
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
    payment_token: row.payment_token || 'USDC',
    payment_mode: row.payment_mode || 'charge',
    payout_wallet: row.payout_wallet,
    creator_id: row.creator_id,
    creator: { wallet: row.creator_wallet }
  }
}

export async function createBlink(data: Omit<BlinkData, 'id' | 'runs' | 'creator_id'>): Promise<BlinkData> {
  const creatorId = await getOrCreateCreator(data.creator.wallet)

  const result = await getPool().query(
    `INSERT INTO blinks
      (slug, title, description, endpoint_url, method, price_usdc, payout_wallet, icon_url, category, status, payment_token, payment_mode, creator_id)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
    RETURNING id, slug, title, description, price_usdc::text, icon_url, endpoint_url, method, category, runs, status, payout_wallet, payment_token, payment_mode`,
    [
      data.slug,
      data.title,
      data.description,
      data.endpoint_url,
      data.method,
      data.price_usdc,
      data.payout_wallet, // Use payout_wallet from data
      data.icon_url,
      data.category,
      data.status,
      data.payment_token,
      data.payment_mode,
      creatorId
    ]
  )

  const row = result.rows[0]
  return {
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
    payment_token: row.payment_token,
    payment_mode: row.payment_mode,
    payout_wallet: row.payout_wallet,
    creator_id: creatorId,
    creator: data.creator
  }
}

export async function updateBlink(slug: string, updates: Partial<BlinkData>): Promise<BlinkData | null> {
  // Build dynamic UPDATE query
  const fields: string[] = []
  const values: any[] = []
  let paramCount = 1

  if (updates.title !== undefined) {
    fields.push(`title = $${paramCount++}`)
    values.push(updates.title)
  }
  if (updates.description !== undefined) {
    fields.push(`description = $${paramCount++}`)
    values.push(updates.description)
  }
  if (updates.price_usdc !== undefined) {
    fields.push(`price_usdc = $${paramCount++}`)
    values.push(updates.price_usdc)
  }
  if (updates.status !== undefined) {
    fields.push(`status = $${paramCount++}`)
    values.push(updates.status)
  }
  if (updates.endpoint_url !== undefined) {
    fields.push(`endpoint_url = $${paramCount++}`)
    values.push(updates.endpoint_url)
  }
  if (updates.method !== undefined) {
    fields.push(`method = $${paramCount++}`)
    values.push(updates.method)
  }
  if (updates.category !== undefined) {
    fields.push(`category = $${paramCount++}`)
    values.push(updates.category)
  }
  if (updates.icon_url !== undefined) {
    fields.push(`icon_url = $${paramCount++}`)
    values.push(updates.icon_url)
  }

  if (fields.length === 0) {
    return getBlinkBySlug(slug)
  }

  values.push(slug) // Add slug as last parameter

  const result = await getPool().query(
    `UPDATE blinks
    SET ${fields.join(', ')}
    WHERE slug = $${paramCount}
    RETURNING id, slug, title, description, price_usdc::text, icon_url, endpoint_url, method, category, runs, status, payment_token, payment_mode, payout_wallet, creator_id`,
    values
  )

  if (result.rows.length === 0) return null

  const row = result.rows[0]

  // Get creator wallet
  const creatorResult = await getPool().query(
    'SELECT c.wallet FROM blinks b JOIN creators c ON b.creator_id = c.id WHERE b.slug = $1',
    [slug]
  )

  return {
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
    payment_token: row.payment_token || 'USDC',
    payment_mode: row.payment_mode || 'charge',
    payout_wallet: row.payout_wallet,
    creator_id: row.creator_id,
    creator: { wallet: creatorResult.rows[0].wallet }
  }
}

export async function deleteBlink(slug: string): Promise<boolean> {
  const result = await getPool().query('DELETE FROM blinks WHERE slug = $1', [slug])
  return result.rowCount !== null && result.rowCount > 0
}

// ========== DASHBOARD OPERATIONS ==========

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
      recentActivity: []
    }
  }

  const creatorId = creatorResult.rows[0].id

  // Get all blinks for this creator with stats
  const blinksResult = await getPool().query(
    `SELECT
      b.id, b.slug, b.title, b.description, b.price_usdc::text,
      b.icon_url, b.endpoint_url, b.method, b.category,
      b.runs, b.status, b.payment_token, b.payment_mode, b.payout_wallet, b.creator_id,
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

  const blinks: DashboardBlink[] = blinksResult.rows.map(row => ({
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
    payment_token: row.payment_token || 'USDC',
    payment_mode: row.payment_mode || 'charge',
    payout_wallet: row.payout_wallet,
    creator_id: row.creator_id,
    creator: { wallet },
    revenue: row.revenue,
    successRate: parseFloat(row.success_rate) || 98,
    lastRun: row.runs > 0 ? 'Recently' : 'Never'
  }))

  // Calculate totals
  const totalRuns = blinks.reduce((sum, b) => sum + b.runs, 0)
  const totalEarnings = blinks.reduce((sum, b) => sum + parseFloat(b.revenue), 0)
  const activeBlinks = blinks.filter(b => b.status === 'active').length
  const avgPrice = blinks.length > 0
    ? (blinks.reduce((sum, b) => sum + parseFloat(b.price_usdc), 0) / blinks.length).toFixed(3)
    : '0.000'

  // Get recent activity (mock for now - will be real when runs are tracked)
  const recentActivity: Activity[] = [
    { id: 1, blink: blinks[0]?.title || 'Sample Blink', amount: '0.03', time: '2 min ago', status: 'success' as const },
    { id: 2, blink: blinks[1]?.title || 'Sample Blink', amount: '0.02', time: '5 min ago', status: 'success' as const },
    { id: 3, blink: blinks[0]?.title || 'Sample Blink', amount: '0.03', time: '12 min ago', status: 'success' as const },
  ].filter(a => blinks.length > 0) // Only show if there are blinks

  return {
    wallet,
    totalEarnings: totalEarnings.toFixed(2),
    totalRuns,
    activeBlinks,
    avgPrice,
    blinks,
    recentActivity
  }
}

// ========== RUNS (PAYMENT TRACKING) OPERATIONS ==========

export interface RunData {
  id: string
  blink_id: string
  reference: string
  signature: string | null
  payer: string | null
  status: 'pending' | 'paid' | 'executed' | 'failed'
  duration_ms: number | null
  created_at: Date
}

// Create a new run (payment tracking record)
export async function createRun(params: {
  blinkId: string
  reference: string
}): Promise<RunData> {
  const { blinkId, reference } = params

  const result = await getPool().query(
    `INSERT INTO runs (blink_id, reference, status)
    VALUES ($1, $2, 'pending')
    RETURNING id, blink_id, reference, signature, payer, status, duration_ms, created_at`,
    [blinkId, reference]
  )

  return result.rows[0]
}

// Get run by reference
export async function getRunByReference(reference: string): Promise<RunData | null> {
  const result = await getPool().query(
    'SELECT id, blink_id, reference, signature, payer, status, duration_ms, created_at FROM runs WHERE reference = $1',
    [reference]
  )

  if (result.rows.length === 0) return null
  return result.rows[0]
}

// Update run with payment details
export async function updateRunPayment(params: {
  reference: string
  signature: string
  payer: string
}): Promise<RunData | null> {
  const { reference, signature, payer } = params

  const result = await getPool().query(
    `UPDATE runs
    SET signature = $1, payer = $2, status = 'paid'
    WHERE reference = $3
    RETURNING id, blink_id, reference, signature, payer, status, duration_ms, created_at`,
    [signature, payer, reference]
  )

  if (result.rows.length === 0) return null
  return result.rows[0]
}

// Mark run as executed
export async function markRunExecuted(params: {
  reference: string
  durationMs: number
}): Promise<RunData | null> {
  const { reference, durationMs } = params

  const result = await getPool().query(
    `UPDATE runs
    SET status = 'executed', duration_ms = $1
    WHERE reference = $2
    RETURNING id, blink_id, reference, signature, payer, status, duration_ms, created_at`,
    [durationMs, reference]
  )

  if (result.rows.length === 0) return null

  // Increment run count for the blink
  const run = result.rows[0]
  await getPool().query('UPDATE blinks SET runs = runs + 1 WHERE id = $1', [run.blink_id])

  return run
}

// Mark run as failed
export async function markRunFailed(reference: string): Promise<RunData | null> {
  const result = await getPool().query(
    `UPDATE runs
    SET status = 'failed'
    WHERE reference = $1
    RETURNING id, blink_id, reference, signature, payer, status, duration_ms, created_at`,
    [reference]
  )

  if (result.rows.length === 0) return null
  return result.rows[0]
}

// ========== UTILITY FUNCTIONS ==========

// Test database connection
export async function testConnection(): Promise<boolean> {
  try {
    const result = await getPool().query('SELECT NOW()')
    return true
  } catch (error) {
    logger.error('Database connection test failed:', error)
    return false
  }
}

// Close all connections (for graceful shutdown)
export async function closePool(): Promise<void> {
  if (pool) {
    await pool.end()
  }
}

// Export pool getter for health checks and external use
export { getPool as pool }
