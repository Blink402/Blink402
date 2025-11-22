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
  // Catalog fields
  is_verified?: boolean
  verified_at?: Date
  verified_by?: string
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

export interface BlinkParameter {
  name: string // Parameter name (e.g., "wallet", "amount")
  type?: 'text' | 'number' | 'email' | 'url' | 'date' | 'datetime-local' | 'textarea' | 'checkbox' | 'radio' | 'select' // Input type
  label?: string // Display label for the input field
  required?: boolean // Whether this parameter is required
  pattern?: string // Regex pattern for validation
  patternDescription?: string // User-friendly description of the pattern
  placeholder?: string // Placeholder text
  min?: number // Minimum value (for number/date types)
  max?: number // Maximum value (for number/date types)
  options?: Array<{ label: string; value: string }> // Options for select/radio types
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
  payment_mode: 'charge' | 'reward' // charge: user pays | reward: creator pays user
  reward_amount?: string // Amount paid TO user in reward mode
  funded_wallet?: string // Creator wallet that pays rewards
  max_claims_per_user?: number // Max reward claims per wallet
  creator_id: string
  runs: number
  status: "active" | "paused" | "archived" // Must match database constraint
  payment_token: 'SOL' | 'USDC' // Payment currency
  access_duration_days?: number // For gallery-type blinks: days of access after payment
  parameters?: BlinkParameter[] // Solana Actions spec parameter definitions for dynamic inputs
  created_at?: Date
  updated_at?: Date
  // Catalog fields
  is_public?: boolean
  is_featured?: boolean
  publish_to_catalog?: boolean
  media_type?: 'text' | 'json' | 'image' | 'video' | 'audio' | 'data' | 'ai' | 'utility'
  avg_latency_ms?: number
  success_rate_percent?: number
  badges?: string[]
  catalog_published_at?: Date
  reported_count?: number
  fork_of_blink_id?: string
  is_forkable?: boolean
  health_status?: 'healthy' | 'degraded' | 'unhealthy'
  // Lottery fields
  lottery_enabled?: boolean
  lottery_round_duration_minutes?: number
}

export interface Run {
  id: string
  blink_id: string
  reference: string // UUID for idempotency
  signature: string | null // Solana transaction signature
  payer: string | null // Wallet address
  status: "pending" | "paid" | "executed" | "failed"
  duration_ms: number | null
  metadata?: Record<string, any> // User input parameters like target_wallet
  created_at: Date
  expires_at: Date // Payment reference expires after 15 minutes
  // x402 Integration fields
  payment_method?: 'solana_actions' | 'x402' // Payment protocol used
  facilitator?: string // x402 facilitator name (e.g., "OctonetAI", "PayAI")
  facilitator_tx_hash?: string // Transaction hash from facilitator
}

export interface Receipt {
  id: string
  run_id: string
  tree: string // cNFT Merkle tree address
  leaf: string // cNFT leaf index
  created_at: Date
}

export interface RewardClaim {
  id: string
  blink_id: string
  user_wallet: string
  reference: string
  signature: string | null
  claim_count: number
  claimed_at: Date
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

// x402 Payment Required response (ONCHAIN protocol)
export interface X402Response {
  status: 402
  message: string
  payment: {
    recipientWallet: string // Payout wallet address
    mint: string // USDC mint address (or native SOL)
    amount: string // Amount in smallest units (e.g., USDC with 6 decimals)
    network: 'solana-mainnet' | 'solana-devnet' // Solana network
    scheme: 'exact' // Payment scheme (exact amount required)
  }
}

// x402 Payment Header (client sends to backend)
export interface X402PaymentHeader {
  x402Version: 1
  scheme: 'exact'
  network: 'solana-mainnet' | 'solana-devnet'
  payload: {
    serializedTransaction: string // base64-encoded signed transaction
  }
}

// Reward payment response
export interface RewardResponse {
  success: boolean
  signature: string
  reward_amount: string
  reward_token: 'SOL' | 'USDC'
  message?: string
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
  payment_mode?: 'charge' | 'reward'
  reward_amount?: string
  funded_wallet?: string
  max_claims_per_user?: number
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
  payment_mode: 'charge' | 'reward' // charge: user pays | reward: creator pays user
  reward_amount?: string // Amount paid TO user in reward mode
  funded_wallet?: string // Creator wallet that pays rewards
  max_claims_per_user?: number // Max reward claims per wallet
  access_duration_days?: number // For gallery-type blinks: days of access after payment
  creator_id: string // UUID of the creator (for internal use)
  creator: {
    wallet: string
    display_name?: string
    avatar_url?: string
    profile_slug?: string
    is_verified?: boolean
  }
  // Catalog fields
  is_public?: boolean
  is_featured?: boolean
  publish_to_catalog?: boolean
  media_type?: 'text' | 'json' | 'image' | 'video' | 'audio' | 'data' | 'ai' | 'utility'
  avg_latency_ms?: number
  success_rate_percent?: number
  badges?: string[]
  catalog_published_at?: Date | string
  reported_count?: number
  fork_of_blink_id?: string
  is_forkable?: boolean
  health_status?: 'healthy' | 'degraded' | 'unhealthy'
  // Lottery fields
  lottery_enabled?: boolean
  lottery_round_duration_minutes?: number
  // Dynamic parameters for Actions metadata and frontend rendering
  parameters?: BlinkParameter[]
}

// ========== CATALOG-SPECIFIC TYPES ==========

export interface BlinkReport {
  id: string
  blink_id: string
  reporter_wallet?: string
  reporter_email?: string
  reason: 'spam' | 'scam' | 'broken' | 'inappropriate' | 'copyright' | 'other'
  details?: string
  status: 'pending' | 'reviewing' | 'resolved' | 'dismissed'
  reviewed_by?: string
  reviewed_at?: Date
  resolution_notes?: string
  created_at: Date
}

export interface FeaturedBlink {
  id: string
  blink_id: string
  display_order: number
  title_override?: string
  description_override?: string
  featured_from: Date
  featured_until?: Date
  created_by?: string
  created_at: Date
}

export interface CatalogFilters {
  category?: string
  price_min?: number
  price_max?: number
  badges?: string[]
  media_type?: string
  search?: string
}

export interface BadgeDefinition {
  code: string
  name: string
  description: string
  icon_url?: string
  criteria_type: 'manual' | 'automatic'
  criteria_config?: any
  display_order: number
  is_active: boolean
}

// ========== AI ENDPOINT DISCOVERY TYPES ==========

export interface AISuggestionRequest {
  query: string // User's natural language query
  limit?: number // Max number of suggestions (default: 5)
}

export interface EndpointSuggestion {
  name: string // API name (e.g., "WeatherAPI", "OpenAI GPT-4")
  description: string // What the API does
  endpoint_url: string // Full endpoint URL
  method: HttpMethod // HTTP method
  category: string // Blink category (AI/ML, Utilities, Data, etc.)
  match_score: number // 0-100, AI confidence score
  pricing_tier: 'free' | 'freemium' | 'paid' // API pricing model
  setup_steps: string[] // Step-by-step setup instructions
  example_request?: string // Example JSON request body
  auth_required: boolean // Whether API key/auth is needed
  auth_type?: 'api_key' | 'bearer' | 'oauth' | 'none' // Type of auth
  docs_url?: string // Link to API documentation
  provider?: string // API provider name (e.g., "RapidAPI", "OpenWeather")
}

export interface AISuggestionResponse {
  suggestions: EndpointSuggestion[]
  query: string // Echo back the query
  processing_time_ms?: number // Time taken to generate suggestions
}

// ========== UTILITY TYPES ==========

export type BlinkStatus = "active" | "paused" | "archived"
export type RunStatus = "pending" | "paid" | "executed" | "failed"
export type HttpMethod = "GET" | "POST" | "PUT" | "DELETE" | "PATCH"
export type MediaType = 'text' | 'json' | 'image' | 'video' | 'audio' | 'data' | 'ai' | 'utility'
export type HealthStatus = 'healthy' | 'degraded' | 'unhealthy'
export type BadgeCode = 'verified' | 'fast' | 'reliable' | 'reverse' | 'forkable' | 'trending'

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

// ========== SLOT MACHINE TYPES ==========

export type SlotSymbol = '🎰' | '💎' | '⚡' | '🍊' | '🍋' | '🍒'

export interface SlotConfig {
  symbols: SlotSymbol[]
  weights: number[] // Probability weights for each symbol
  payoutTable: Record<string, number> // Key: symbol combo (e.g., "🎰🎰🎰"), Value: multiplier
  rtp: number // Return to player percentage (e.g., 0.98 for 98%)
  betAmount: string // USDC amount per spin
  maxPayout: string // Maximum payout in USDC
}

export interface SpinRequest {
  reference: string // UUID from payment run
  signature?: string // Transaction signature (optional, for verification)
  payer: string // User's wallet address
}

export interface SpinResult {
  success: boolean
  reels: [SlotSymbol, SlotSymbol, SlotSymbol] // The 3 reel results
  payout: string // USDC payout amount (0 if no win)
  win: boolean // Whether this was a winning spin
  multiplier: number // Payout multiplier (e.g., 50 for 50x)
  betAmount: string // Original bet amount
  // Provably fair verification data
  serverSeed: string // Revealed after spin
  serverSeedHash: string // Pre-committed hash (for verification)
  clientSeed: string // User's wallet address used as seed
  nonce: string // Unique spin identifier (run ID)
  reference: string // Payment reference UUID
  // Optional payout transaction
  payoutSignature?: string // Transaction signature if user won
  message?: string // User-friendly message
}

// ========== LOTTERY TYPES ==========

export type LotteryRoundStatus = 'active' | 'closed' | 'distributed'
export type LotteryPayoutStatus = 'pending' | 'completed' | 'failed'
export type LotteryRank = 1 | 2 | 3

export interface LotteryRound {
  id: string
  blink_id: string
  round_number: number
  started_at: Date
  ended_at?: Date
  total_entry_fee_usdc: string // Decimal as string
  total_entries: number
  winners_selected_at?: Date
  status: LotteryRoundStatus
  bonus_pool_usdc: string // Promotional bonus pool (e.g., $50 promo)
  created_at: Date
}

export interface LotteryEntry {
  id: string
  round_id: string
  run_id: string // Links to runs table
  payer_wallet: string // User's wallet address
  entry_fee_usdc: string // Always "1.00" for now
  entry_timestamp: Date
}

export interface LotteryWinner {
  id: string
  round_id: string
  winner_wallet: string
  payout_amount_usdc: string // Calculated based on prize pool
  payout_rank: LotteryRank // 1=first (50%), 2=second (20%), 3=third (15%)
  payout_tx_signature?: string // Solana transaction signature
  payout_status: LotteryPayoutStatus
  completed_at?: Date
  created_at: Date
}

export interface LotteryConfig {
  // Fixed prize percentages
  first_place_percent: number // 50
  second_place_percent: number // 20
  third_place_percent: number // 15
  platform_fee_percent: number // 15
  // Entry configuration
  entry_fee_usdc: string // "1.00"
  round_duration_minutes: number // 15
  // Platform settings
  platform_wallet: string // Treasury wallet for buyback funds
}

export interface LotteryStats {
  current_round?: {
    round_id: string
    round_number: number
    total_entries: number
    prize_pool_usdc: string
    next_draw_at: Date
    time_remaining_seconds: number
  }
  recent_winners: Array<{
    round_number: number
    winner_wallet: string
    payout_amount_usdc: string
    rank: LotteryRank
    completed_at: Date
  }>
  total_rounds: number
  total_entries: number
  total_distributed_usdc: string
  total_platform_fees_usdc: string
}

export interface LotteryHistoryRound {
  round_number: number
  started_at: Date
  ended_at: Date
  total_entries: number
  prize_pool_usdc: string
  winners: Array<{
    wallet: string
    rank: LotteryRank
    payout_amount_usdc: string
    tx_signature?: string
  }>
  platform_fee_usdc: string
}

// API Request/Response types for lottery endpoints

export interface LotteryEntryRequest {
  slug: string // Lottery blink slug
  reference: string // Payment reference UUID from run
  signature?: string // Transaction signature
  payer: string // User's wallet address
}

export interface LotteryEntryResponse {
  success: boolean
  entry_id: string
  round_id: string
  round_number: number
  total_entries: number
  user_entries_in_round: number // How many times this user has entered
  next_draw_at: Date
  message?: string
}

export interface LotteryCurrentRoundResponse {
  round_id: string
  round_number: number
  started_at: Date
  total_entries: number
  prize_pool_usdc: string
  bonus_pool_usdc?: string // Optional promotional bonus pool
  next_draw_at: Date
  time_remaining_seconds: number
  user_entries?: number // If wallet provided, show user's entry count
  prize_breakdown: {
    first_place: string
    second_place: string
    third_place: string
    platform_fee: string
  }
}

export interface LotteryWinnersResponse {
  round_id: string
  round_number: number
  ended_at: Date
  total_entries: number
  prize_pool_usdc: string
  winners: Array<{
    wallet: string
    rank: LotteryRank
    payout_amount_usdc: string
    tx_signature?: string
    completed_at?: Date
  }>
  platform_fee_usdc: string
}
