// Shared type definitions for Blink402 monorepo

// ========== CORE DATABASE ENTITIES ==========

export interface Creator {
  id: string
  wallet: string
  created_at: Date
  updated_at?: Date
  // Optional profile fields
  display_name?: string
  bio?: string
  avatar_url?: string
  banner_url?: string
  profile_slug?: string
  social_links?: SocialLinks
}

export interface SocialLinks {
  twitter?: string
  github?: string
  website?: string
  discord?: string
}

export interface CreatorProfile extends Creator {
  // Aggregated statistics
  total_blinks: number
  total_earnings: string
  total_runs: number
}

export interface Blink {
  id: string
  slug: string
  title: string
  description: string
  price_usdc: string // Decimal as string (applies to SOL or USDC)
  endpoint_url: string
  method: string
  category: string
  icon_url: string
  payout_wallet: string
  creator_id: string
  runs: number
  status: "active" | "paused" | "archived" // Must match database constraint
  payment_token: 'SOL' | 'USDC' // Payment currency
  access_duration_days?: number // For gallery-type blinks: days of access after payment
  created_at?: Date
  updated_at?: Date
}

export interface Run {
  id: string
  blink_id: string
  reference: string // UUID for idempotency
  signature: string | null // Solana transaction signature
  payer: string | null // Wallet address
  status: "pending" | "paid" | "executed" | "failed"
  duration_ms: number | null
  created_at: Date
  expires_at: Date // Payment reference expires after 15 minutes
}

export interface Receipt {
  id: string
  run_id: string
  tree: string // cNFT Merkle tree address
  leaf: string // cNFT leaf index
  created_at: Date
}

// ========== API REQUEST/RESPONSE TYPES ==========

// Solana Actions metadata (GET /actions/:slug)
export interface ActionsMetadata {
  type: "action"
  title: string
  icon: string
  description: string
  label: string
  links: {
    actions: Array<{
      label: string
      href: string
    }>
  }
}

// Solana Actions response (POST /actions/:slug)
export interface ActionsResponse {
  recipient: string // Payout wallet
  amount: string // Amount in smallest unit (lamports for SOL, base units for USDC)
  reference: string // UUID for tracking
  memo?: string
  expires_at: string // ISO timestamp
}

// x402 Payment Required response
export interface X402Response {
  status: 402
  message: string
  price: string // Amount in payment currency
  currency: "SOL" | "USDC" // Payment token
  recipient: string
  reference: string
  action_url: string
  expires_at: string
}

// Dashboard data
export interface DashboardData {
  wallet: string
  totalEarnings: string
  totalRuns: number
  activeBlinks: number
  avgPrice: string
  blinks: DashboardBlink[]
  recentActivity: Activity[]
}

export interface DashboardBlink extends Blink {
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

// ========== API PAYLOAD TYPES ==========

export interface CreateBlinkPayload {
  title: string
  description: string
  endpoint_url: string
  method: string
  price_usdc: string
  category: string
  icon_url?: string
  payout_wallet: string
  creator_wallet: string
}

export interface UpdateBlinkPayload {
  title?: string
  description?: string
  price_usdc?: string
  status?: "active" | "paused" | "archived"
  icon_url?: string
}

export interface UpdateCreatorProfilePayload {
  display_name?: string
  bio?: string
  avatar_url?: string
  banner_url?: string
  profile_slug?: string
  social_links?: SocialLinks
}

// ========== FRONTEND-SPECIFIC TYPES ==========

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
  access_duration_days?: number // For gallery-type blinks: days of access after payment
  creator: {
    wallet: string
    display_name?: string
    avatar_url?: string
    profile_slug?: string
  }
}

// ========== UTILITY TYPES ==========

export type BlinkStatus = "active" | "paused" | "archived"
export type RunStatus = "pending" | "paid" | "executed" | "failed"
export type HttpMethod = "GET" | "POST" | "PUT" | "DELETE" | "PATCH"

// ========== SOLANA TYPES ==========

export interface PaymentVerificationResult {
  valid: boolean
  signature: string
  payer: string
  amount: string
  recipient: string
  reference: string
  timestamp: number
}

export interface SolanaPayLink {
  recipient: string
  amount: number // USDC amount in base units
  reference: string
  label?: string
  message?: string
  memo?: string
}

// ========== TEMPLATE TYPES ==========

export type TemplateCategory = "utilities" | "data" | "ai-ml" | "web3" | "fun"
export type TemplateDifficulty = "easy" | "medium" | "advanced"

export interface BlinkTemplate {
  id: string // Unique template identifier (e.g., "qr-code-generator")
  name: string // Display name (e.g., "QR Code Generator")
  description: string // Short description for users
  category: TemplateCategory
  difficulty: TemplateDifficulty
  icon_url: string // Icon for template card
  // Pre-filled Blink configuration
  config: {
    title: string // Suggested title (user can edit)
    description: string // Suggested description (user can edit)
    endpoint_url: string // Pre-configured API endpoint
    method: HttpMethod
    category: string // Blink category (matches existing categories)
    price_usdc: string // Suggested pricing
    example_request?: string // Example request body
  }
  // Customizable fields for user
  customizable_fields: Array<{
    field: keyof CreateBlinkPayload
    label: string
    placeholder?: string
    helpText?: string
    required: boolean
  }>
  // Display metadata
  tags?: string[] // For search/filtering
  preview_image?: string // Screenshot or preview
  is_popular?: boolean
  estimated_setup_time?: string // e.g., "30 seconds"
}
