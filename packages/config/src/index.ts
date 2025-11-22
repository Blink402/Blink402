// Environment variable validation for Blink402

import { createLogger } from './logger'

const configLogger = createLogger('@blink402/config')

interface EnvConfig {
  // Database
  DATABASE_URL: string

  // ONCHAIN x402 Integration
  ONCHAIN_API_KEY: string
  ONCHAIN_API_URL?: string

  // Solana
  NEXT_PUBLIC_SOLANA_NETWORK?: string
  NEXT_PUBLIC_SOLANA_RPC_URL?: string
  NEXT_PUBLIC_USDC_MINT?: string

  // App URLs
  NEXT_PUBLIC_APP_URL?: string
  NEXT_PUBLIC_APP_DOMAIN?: string

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
  'ONCHAIN_API_URL',
  'NEXT_PUBLIC_SOLANA_NETWORK',
  'NEXT_PUBLIC_SOLANA_RPC_URL',
  'NEXT_PUBLIC_USDC_MINT',
  'NEXT_PUBLIC_APP_URL',
  'NEXT_PUBLIC_APP_DOMAIN',
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
    ONCHAIN_API_KEY: process.env.ONCHAIN_API_KEY!,
    ONCHAIN_API_URL: process.env.ONCHAIN_API_URL || 'https://api.onchain.fi/v1',
    NEXT_PUBLIC_SOLANA_NETWORK: process.env.NEXT_PUBLIC_SOLANA_NETWORK || 'devnet',
    NEXT_PUBLIC_SOLANA_RPC_URL: process.env.NEXT_PUBLIC_SOLANA_RPC_URL,
    NEXT_PUBLIC_USDC_MINT: process.env.NEXT_PUBLIC_USDC_MINT,
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
    NEXT_PUBLIC_APP_DOMAIN: process.env.NEXT_PUBLIC_APP_DOMAIN || 'localhost',
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

// Note: Module-level validation removed to prevent build-time issues
// Call validateEnv() manually in API routes that need it, or use getEnv()

// Export logger utilities
export { createLogger, logger, type Logger, type LogLevel } from './logger'
