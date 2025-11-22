// Type definitions for MCP server

export interface Blink {
  id: number
  slug: string
  title: string
  description: string
  price_usdc: number
  category: string
  icon_url: string | null
  success_rate_percent: number | null
  avg_latency_ms: number | null
}

export interface B402TierInfo {
  tier: 'NONE' | 'BRONZE' | 'SILVER' | 'GOLD' | 'DIAMOND'
  balance: number
  benefits: {
    blinks: {
      creatorFeeDiscount: number
      priorityExecution: boolean
      customBranding: boolean
    }
  }
}

export interface DiscountInfo {
  discountedPrice: number
  originalPrice: number
  tier: string
  savings: number
  discountPercent: number
}

export interface ExecutionResult {
  success: boolean
  data: any
  payment: {
    amount_paid: number
    original_price: number
    tier: string
    savings: number
    signature: string
  }
  message: string
}

export interface APIConfig {
  baseUrl: string
  timeout: number
}
