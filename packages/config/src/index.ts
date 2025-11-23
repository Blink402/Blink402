// Environment variable validation for Blink402

import { createLogger } from './logger'

const configLogger = createLogger('@blink402/config')

interface EnvConfig {
  // Database
  DATABASE_URL: string

  // Redis (Optional - graceful degradation if not available)
  REDIS_URL?: string
  REDIS_PUBLIC_URL?: string

  // ONCHAIN x402 Integration
  ONCHAIN_API_KEY: string
  ONCHAIN_API_URL?: string

  // Solana
  SOLANA_RPC_URL?: string // Backend RPC URL
  NEXT_PUBLIC_SOLANA_NETWORK?: string
  NEXT_PUBLIC_SOLANA_RPC_URL?: string
  NEXT_PUBLIC_USDC_MINT?: string

  // App URLs
  APP_URL?: string // Backend APP_URL
  NEXT_PUBLIC_APP_URL?: string // Frontend API URL
  NEXT_PUBLIC_APP_DOMAIN?: string

  // Treasury & Payments
  TREASURY_WALLET?: string
  PAYOUT_WALLET?: string

  // API Security
  INTERNAL_API_KEY?: string

  // AI Services (Optional - demos work with mock data if not provided)
  OPENAI_API_KEY?: string
  DEEPAI_API_KEY?: string
  SCREENSHOT_API_KEY?: string

  // Slot Machine (Optional - only needed if hosting slot machine blink)
  SLOT_MACHINE_PAYOUT_PRIVATE_KEY?: string

  // Admin (Optional - required for admin endpoints)
  ADMIN_API_KEY?: string

  // Testing
  MOCK_PAYMENTS?: boolean

  // Optional
  NODE_ENV?: string
}

const REQUIRED_ENV_VARS = [
  'DATABASE_URL',
  'ONCHAIN_API_KEY',
] as const

const OPTIONAL_ENV_VARS = [
  'REDIS_URL',
  'REDIS_PUBLIC_URL',
  'ONCHAIN_API_URL',
  'SOLANA_RPC_URL',
  'NEXT_PUBLIC_SOLANA_NETWORK',
  'NEXT_PUBLIC_SOLANA_RPC_URL',
  'NEXT_PUBLIC_USDC_MINT',
  'APP_URL',
  'NEXT_PUBLIC_APP_URL',
  'NEXT_PUBLIC_APP_DOMAIN',
  'TREASURY_WALLET',
  'PAYOUT_WALLET',
  'INTERNAL_API_KEY',
  'OPENAI_API_KEY',
  'DEEPAI_API_KEY',
  'SCREENSHOT_API_KEY',
  'SLOT_MACHINE_PAYOUT_PRIVATE_KEY',
  'ADMIN_API_KEY',
  'MOCK_PAYMENTS',
  'NODE_ENV',
] as const

/**
 * Validate that all required environment variables are set
 * Throws an error if any required variables are missing
 */
export function validateEnv(): EnvConfig {
  const missing: string[] = []
  const warnings: string[] = []

  // Check required variables
  for (const key of REQUIRED_ENV_VARS) {
    if (!process.env[key]) {
      missing.push(key)
    }
  }

  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variables:\n${missing.map(k => `  - ${k}`).join('\n')}\n\nPlease check your .env file.`
    )
  }

  // Check optional but recommended variables
  if (!process.env.NEXT_PUBLIC_SOLANA_RPC_URL) {
    warnings.push('NEXT_PUBLIC_SOLANA_RPC_URL not set - using public RPC (may be slow or rate limited)')
  }

  if (!process.env.NEXT_PUBLIC_APP_URL) {
    warnings.push('NEXT_PUBLIC_APP_URL not set - using http://localhost:3000 as default')
  }

  // Log warnings in development
  if (warnings.length > 0 && process.env.NODE_ENV !== 'production') {
    configLogger.warn('Environment warnings detected')
    warnings.forEach(w => configLogger.warn(w))
  }

  return {
    DATABASE_URL: process.env.DATABASE_URL!,
    REDIS_URL: process.env.REDIS_URL,
    REDIS_PUBLIC_URL: process.env.REDIS_PUBLIC_URL,
    ONCHAIN_API_KEY: process.env.ONCHAIN_API_KEY!,
    ONCHAIN_API_URL: process.env.ONCHAIN_API_URL || 'https://api.onchain.fi/v1',
    SOLANA_RPC_URL: process.env.SOLANA_RPC_URL,
    NEXT_PUBLIC_SOLANA_NETWORK: process.env.NEXT_PUBLIC_SOLANA_NETWORK || 'devnet',
    NEXT_PUBLIC_SOLANA_RPC_URL: process.env.NEXT_PUBLIC_SOLANA_RPC_URL,
    NEXT_PUBLIC_USDC_MINT: process.env.NEXT_PUBLIC_USDC_MINT,
    APP_URL: process.env.APP_URL || 'http://localhost:3001',
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001',
    NEXT_PUBLIC_APP_DOMAIN: process.env.NEXT_PUBLIC_APP_DOMAIN || 'localhost',
    TREASURY_WALLET: process.env.TREASURY_WALLET,
    PAYOUT_WALLET: process.env.PAYOUT_WALLET,
    INTERNAL_API_KEY: process.env.INTERNAL_API_KEY,
    OPENAI_API_KEY: process.env.OPENAI_API_KEY,
    DEEPAI_API_KEY: process.env.DEEPAI_API_KEY,
    SCREENSHOT_API_KEY: process.env.SCREENSHOT_API_KEY,
    SLOT_MACHINE_PAYOUT_PRIVATE_KEY: process.env.SLOT_MACHINE_PAYOUT_PRIVATE_KEY,
    ADMIN_API_KEY: process.env.ADMIN_API_KEY,
    MOCK_PAYMENTS: process.env.MOCK_PAYMENTS === 'true',
    NODE_ENV: process.env.NODE_ENV || 'development',
  }
}

/**
 * Get validated environment config
 * Safe to call multiple times (memoized)
 */
let cachedEnv: EnvConfig | null = null

export function getEnv(): EnvConfig {
  if (!cachedEnv) {
    cachedEnv = validateEnv()
  }
  return cachedEnv
}

/**
 * Check if running in production
 */
export function isProduction(): boolean {
  return process.env.NODE_ENV === 'production'
}

/**
 * Check if running in development
 */
export function isDevelopment(): boolean {
  return process.env.NODE_ENV === 'development'
}

/**
 * Get Solana network (devnet or mainnet-beta)
 */
export function getSolanaNetwork(): 'devnet' | 'mainnet-beta' {
  const network = process.env.NEXT_PUBLIC_SOLANA_NETWORK || 'devnet'
  return network as 'devnet' | 'mainnet-beta'
}

/**
 * Check if payment verification should be mocked (for testing)
 * NEVER enable this in production!
 */
export function isMockPaymentsEnabled(): boolean {
  if (isProduction()) {
    return false // Force disabled in production for security
  }
  return process.env.MOCK_PAYMENTS === 'true'
}

/**
 * Get ONCHAIN API configuration
 * @returns Object with ONCHAIN API key and base URL
 */
export function getOnchainConfig() {
  const env = getEnv()
  return {
    apiKey: env.ONCHAIN_API_KEY,
    apiUrl: env.ONCHAIN_API_URL || 'https://api.onchain.fi/v1'
  }
}

/**
 * Get OpenAI API configuration
 * @returns Object with OpenAI API key
 */
export function getOpenAIConfig() {
  const env = getEnv()
  return {
    apiKey: env.OPENAI_API_KEY,
    model: 'gpt-4o', // Upgraded to GPT-4o for accurate API suggestions (Jan 2025)
    maxTokens: 2000,
    temperature: 0.1 // Very low temperature for maximum accuracy and relevance
  }
}

/**
 * Get Slot Machine configuration
 * @returns Object with payout private key (if set)
 */
export function getSlotMachineConfig() {
  const env = getEnv()
  return {
    payoutPrivateKey: env.SLOT_MACHINE_PAYOUT_PRIVATE_KEY,
    isEnabled: !!env.SLOT_MACHINE_PAYOUT_PRIVATE_KEY
  }
}

/**
 * Get Admin API configuration
 * @returns Object with admin API key (if set)
 */
export function getAdminConfig() {
  const env = getEnv()
  return {
    apiKey: env.ADMIN_API_KEY,
    isEnabled: !!env.ADMIN_API_KEY
  }
}

/**
 * Get Redis configuration
 * @returns Object with Redis URL (preferring REDIS_PUBLIC_URL for Railway)
 */
export function getRedisConfig() {
  const env = getEnv()
  return {
    url: env.REDIS_PUBLIC_URL || env.REDIS_URL,
    isEnabled: !!(env.REDIS_PUBLIC_URL || env.REDIS_URL)
  }
}

/**
 * Get Internal API Key configuration
 * @returns Object with internal API key for background jobs
 */
export function getInternalApiConfig() {
  const env = getEnv()
  return {
    apiKey: env.INTERNAL_API_KEY,
    isEnabled: !!env.INTERNAL_API_KEY
  }
}

/**
 * Get Treasury/Payout Wallet configuration
 * @returns Object with treasury and payout wallet addresses
 */
export function getWalletConfig() {
  const env = getEnv()
  return {
    treasuryWallet: env.TREASURY_WALLET || env.PAYOUT_WALLET,
    payoutWallet: env.PAYOUT_WALLET || env.TREASURY_WALLET,
    isConfigured: !!(env.TREASURY_WALLET || env.PAYOUT_WALLET)
  }
}

/**
 * Get App URL configuration (for both backend and frontend)
 * @returns Object with app URLs
 */
export function getAppUrls() {
  const env = getEnv()
  return {
    appUrl: env.APP_URL || 'http://localhost:3001',
    apiUrl: env.NEXT_PUBLIC_APP_URL || 'http://localhost:3001',
    domain: env.NEXT_PUBLIC_APP_DOMAIN || 'localhost'
  }
}

/**
 * Get Solana RPC configuration
 * @returns Object with RPC URLs for backend and frontend
 */
export function getSolanaRpcConfig() {
  const env = getEnv()
  return {
    backendRpcUrl: env.SOLANA_RPC_URL || env.NEXT_PUBLIC_SOLANA_RPC_URL,
    frontendRpcUrl: env.NEXT_PUBLIC_SOLANA_RPC_URL,
    network: env.NEXT_PUBLIC_SOLANA_NETWORK || 'devnet',
    usdcMint: env.NEXT_PUBLIC_USDC_MINT
  }
}

// Note: Module-level validation removed to prevent build-time issues
// Call validateEnv() manually in API routes that need it, or use getEnv()

// Export logger utilities
export { createLogger, logger, type Logger, type LogLevel } from './logger'
