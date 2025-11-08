// Shared type definitions for Blink402

export interface BlinkData {
  id: string
  slug: string
  title: string
  description: string
  price_usdc: string
  icon_url: string
  endpoint_url: string
  method: string
  category: string
  runs: number
  status: "active" | "paused" | "archived"
  payment_token: 'SOL' | 'USDC' // Required field
  payout_wallet: string // Wallet that receives payments (can differ from creator)
  creator: {
    wallet: string
  }
}

export interface DashboardData {
  wallet: string
  totalEarnings: string
  totalRuns: number
  activeBlinks: number
  avgPrice: string
  blinks: DashboardBlink[]
  recentActivity: Activity[]
}

export interface DashboardBlink extends BlinkData {
  revenue: string
  successRate: number
  lastRun: string
}

export interface Activity {
  id: number
  blink: string
  amount: string
  time: string
  status: "success" | "failed"
}
