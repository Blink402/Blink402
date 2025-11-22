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
  payment_mode: 'charge' | 'reward' // charge: user pays | reward: creator pays user
  payout_wallet: string // Wallet that receives payments (can differ from creator)
  creator_id: string // Creator ID from database
  creator: {
    wallet: string
  }
  lottery_enabled?: boolean // Whether this is a lottery blink
  lottery_round_duration_minutes?: number // Duration of each lottery round
  parameters?: Array<{
    name: string
    type?: 'text' | 'number' | 'email' | 'url' | 'date' | 'datetime-local' | 'textarea' | 'checkbox' | 'radio' | 'select'
    label?: string
    required?: boolean
    pattern?: string
    patternDescription?: string
    placeholder?: string
    min?: number
    max?: number
    options?: Array<{ label: string; value: string }>
  }> // Dynamic parameters for input fields
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

// Slot Machine Types
export type SlotSymbol = '🎰' | '💎' | '⚡' | '🍊' | '🍋' | '🍒'

export interface SpinResult {
  success: boolean
  reels: [SlotSymbol, SlotSymbol, SlotSymbol]
  payout: string
  win: boolean
  multiplier: number
  betAmount: string
  serverSeed: string
  serverSeedHash: string
  clientSeed: string
  nonce: string
  reference: string
  payoutSignature?: string
  message?: string
}
