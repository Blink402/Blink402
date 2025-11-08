// In-memory storage for rapid MVP prototyping
// WARNING: Data will be lost on server restart
// Replace with database in Phase 2

import type { BlinkData, DashboardData } from './types'
import { MOCK_BLINKS, MOCK_DASHBOARD_DATA } from './mock-data'
import { generateUUID } from './uuid'

// Initialize with mock data for demo purposes
let blinks: Map<string, BlinkData> = new Map()
let activityLog: Array<{ id: number; blink: string; amount: string; time: string; status: 'success' | 'failed' }> = []

// Seed initial data
function seedData() {
  blinks.clear()
  MOCK_BLINKS.forEach(blink => {
    blinks.set(blink.slug, blink)
  })
  activityLog = [...MOCK_DASHBOARD_DATA.recentActivity]
}

// Initialize on module load
seedData()

// Blink CRUD operations
export function getAllBlinks(): BlinkData[] {
  return Array.from(blinks.values())
}

export function getBlinkBySlug(slug: string): BlinkData | undefined {
  return blinks.get(slug)
}

export function createBlink(data: Omit<BlinkData, 'id' | 'runs'>): BlinkData {
  const id = data.slug || generateUUID()
  const newBlink: BlinkData = {
    ...data,
    id,
    runs: 0,
  }
  blinks.set(newBlink.slug, newBlink)
  return newBlink
}

export function updateBlink(slug: string, updates: Partial<BlinkData>): BlinkData | null {
  const existing = blinks.get(slug)
  if (!existing) return null

  const updated = { ...existing, ...updates }
  blinks.set(slug, updated)
  return updated
}

export function deleteBlink(slug: string): boolean {
  return blinks.delete(slug)
}

// Dashboard operations
export function getDashboardData(wallet: string): DashboardData {
  const userBlinks = Array.from(blinks.values()).filter(b => b.creator.wallet === wallet)

  const totalRuns = userBlinks.reduce((sum, b) => sum + b.runs, 0)
  const totalEarnings = userBlinks.reduce((sum, b) => sum + (parseFloat(b.price_usdc) * b.runs), 0)
  const activeBlinks = userBlinks.filter(b => b.status === 'active').length
  const avgPrice = userBlinks.length > 0
    ? (userBlinks.reduce((sum, b) => sum + parseFloat(b.price_usdc), 0) / userBlinks.length).toFixed(3)
    : '0.000'

  // Transform to dashboard blinks with additional fields
  const dashboardBlinks = userBlinks.map(b => ({
    ...b,
    revenue: (parseFloat(b.price_usdc) * b.runs).toFixed(2),
    successRate: 98 + Math.random() * 2, // Mock success rate for now
    lastRun: b.runs > 0 ? `${Math.floor(Math.random() * 24)} hours ago` : 'Never',
  }))

  return {
    wallet,
    totalEarnings: totalEarnings.toFixed(2),
    totalRuns,
    activeBlinks,
    avgPrice,
    blinks: dashboardBlinks,
    recentActivity: activityLog.slice(0, 10),
  }
}

// Activity tracking (for future use with payments)
export function addActivity(blink: string, amount: string, status: 'success' | 'failed') {
  const newActivity = {
    id: activityLog.length + 1,
    blink,
    amount,
    time: 'Just now',
    status,
  }
  activityLog.unshift(newActivity)

  // Keep only last 100 activities
  if (activityLog.length > 100) {
    activityLog = activityLog.slice(0, 100)
  }
}

// Utility to reset data (for testing)
export function resetStorage() {
  seedData()
}
