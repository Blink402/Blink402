// Environment variable validation for Blink402

interface EnvConfig {
  // Database
  DATABASE_URL: string

  // Solana
  NEXT_PUBLIC_SOLANA_NETWORK?: string
  NEXT_PUBLIC_SOLANA_RPC_URL?: string
  NEXT_PUBLIC_USDC_MINT?: string

  // App URLs
  NEXT_PUBLIC_APP_URL?: string
  NEXT_PUBLIC_APP_DOMAIN?: string

  // Optional
  NODE_ENV?: string
}

const REQUIRED_ENV_VARS = [
  'DATABASE_URL',
] as const

const OPTIONAL_ENV_VARS = [
  'NEXT_PUBLIC_SOLANA_NETWORK',
  'NEXT_PUBLIC_SOLANA_RPC_URL',
  'NEXT_PUBLIC_USDC_MINT',
  'NEXT_PUBLIC_APP_URL',
  'NEXT_PUBLIC_APP_DOMAIN',
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
    console.warn('\n⚠️  Environment warnings:')
    warnings.forEach(w => console.warn(`  - ${w}`))
    console.warn('')
  }

  return {
    DATABASE_URL: process.env.DATABASE_URL!,
    NEXT_PUBLIC_SOLANA_NETWORK: process.env.NEXT_PUBLIC_SOLANA_NETWORK || 'devnet',
    NEXT_PUBLIC_SOLANA_RPC_URL: process.env.NEXT_PUBLIC_SOLANA_RPC_URL,
    NEXT_PUBLIC_USDC_MINT: process.env.NEXT_PUBLIC_USDC_MINT,
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
    NEXT_PUBLIC_APP_DOMAIN: process.env.NEXT_PUBLIC_APP_DOMAIN || 'localhost',
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

// Note: Module-level validation removed to prevent build-time issues
// Call validateEnv() manually in API routes that need it, or use getEnv()
