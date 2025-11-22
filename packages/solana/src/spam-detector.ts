// Spam Token Detection using Heuristics
// Identifies potential scam/spam tokens without external API calls

import { createLogger } from '@blink402/config'

const logger = createLogger('@blink402/spam-detector')

export type SpamRiskLevel = 'low' | 'medium' | 'high' | 'critical'

export interface SpamDetectionResult {
  isSpam: boolean
  riskLevel: SpamRiskLevel
  flags: string[]
  confidence: number // 0-100
  recommendations: string[]
}

export interface TokenForSpamCheck {
  mint: string
  name?: string
  symbol?: string
  decimals?: number
  amount?: number
  uiAmount?: number
  usdValue?: number | null
  metadata?: {
    freezeAuthority?: string | null
    mintAuthority?: string | null
  }
}

// Common scam keywords in token names
const SCAM_KEYWORDS = [
  'airdrop',
  'claim',
  'free',
  'reward',
  'giveaway',
  'bonus',
  'prize',
  'winner',
  'congratulations',
  'lucky',
  'lottery',
  'official',
  'verify',
  'validation',
  'security',
  'support',
  'help',
  'wallet',
  'metamask', // Solana doesn't use MetaMask
  'trust', // TrustWallet scam
  'coinbase', // Impersonation
]

// Legitimate token patterns (whitelist common known tokens)
const KNOWN_LEGITIMATE_PATTERNS = [
  /^SOL$/i,
  /^USDC$/i,
  /^USDT$/i,
  /^BONK$/i,
  /^JUP$/i,
  /^RAY$/i,
  /^ORCA$/i,
  /^MNGO$/i,
  /^SRM$/i,
  /^STEP$/i,
  /^B402$/i, // Blink402 platform token
  /^WIF$/i,  // dogwifhat
  /^POPCAT$/i,
  /^MEW$/i,
]

/**
 * Detect if a token is likely spam using heuristics
 *
 * @param token - Token information to analyze
 * @returns Spam detection result with risk level and flags
 */
export function detectSpamToken(token: TokenForSpamCheck): SpamDetectionResult {
  const flags: string[] = []
  const recommendations: string[] = []

  // Skip spam detection for known legitimate tokens
  if (token.symbol && KNOWN_LEGITIMATE_PATTERNS.some(pattern => pattern.test(token.symbol!))) {
    return {
      isSpam: false,
      riskLevel: 'low',
      flags: [],
      confidence: 0,
      recommendations: []
    }
  }

  // Flag 1: Freeze authority not removed (CRITICAL RISK)
  // Tokens with freeze authority can freeze user funds at any time
  // NOTE: Metadata may not always be available (Helius DAS API limitation)
  if (token.metadata?.freezeAuthority && token.metadata.freezeAuthority !== null) {
    flags.push('❄️ Freeze authority not removed - funds can be frozen by creator')
    recommendations.push('CRITICAL: This token can freeze your funds. Do not trade or interact with it.')
  }

  // Flag 2: Extremely low USD value (potential dust spam)
  if (token.usdValue !== null && token.usdValue !== undefined && token.usdValue < 0.01) {
    flags.push('💸 Extremely low USD value (<$0.01) - likely spam')
    recommendations.push('This token has negligible value. Consider hiding spam tokens in wallet settings.')
  }

  // Flag 3: Missing metadata (no name or symbol)
  if (!token.name || !token.symbol) {
    flags.push('⚠️ Missing token metadata - unverified token')
    recommendations.push('Tokens without metadata are unverified. High risk of scam.')
  }

  // Flag 4: Scam keywords in name
  if (token.name) {
    const lowerName = token.name.toLowerCase()
    const foundKeywords = SCAM_KEYWORDS.filter(keyword => lowerName.includes(keyword))

    if (foundKeywords.length > 0) {
      flags.push(`🚨 Contains scam keywords: ${foundKeywords.join(', ')}`)
      recommendations.push('Token name contains common scam keywords. High likelihood of phishing attempt.')
    }
  }

  // Flag 5: Suspicious decimals (standard is 9, sometimes 6)
  // Decimals > 9 are extremely rare and often used in scams
  if (token.decimals !== undefined && token.decimals > 9) {
    flags.push(`🔢 Unusual decimal count (${token.decimals}) - standard is 6 or 9`)
    recommendations.push('Non-standard decimals may indicate a scam token.')
  }

  // Flag 6: Zero balance (airdropped dust)
  // Note: uiAmount is the human-readable amount (not atomic units)
  if (token.uiAmount !== undefined && token.uiAmount === 0) {
    flags.push('📭 Zero balance - dust spam')
    recommendations.push('Zero-balance airdrops are spam. Safe to ignore or burn.')
  }

  // Flag 7: Symbol too long (legitimate symbols are typically 3-5 chars)
  if (token.symbol && token.symbol.length > 10) {
    flags.push(`🔤 Abnormally long symbol (${token.symbol.length} chars) - suspicious`)
    recommendations.push('Legitimate tokens have short symbols (3-5 characters).')
  }

  // Flag 8: Symbol contains special characters (not alphanumeric)
  if (token.symbol && !/^[A-Z0-9]+$/i.test(token.symbol)) {
    flags.push('🔣 Symbol contains special characters - unusual for legitimate tokens')
    recommendations.push('Token symbols should be alphanumeric only.')
  }

  // Calculate risk level based on number and severity of flags
  let riskLevel: SpamRiskLevel = 'low'
  let confidence = Math.min(flags.length * 20, 100) // Each flag adds 20% confidence

  // Critical if freeze authority exists (instant rug pull risk)
  if (flags.some(f => f.includes('Freeze authority'))) {
    riskLevel = 'critical'
    confidence = Math.max(confidence, 90)
  }
  // High if 3+ flags or scam keywords detected
  else if (flags.length >= 3 || flags.some(f => f.includes('scam keywords'))) {
    riskLevel = 'high'
    confidence = Math.max(confidence, 70)
  }
  // Medium if 2 flags
  else if (flags.length === 2) {
    riskLevel = 'medium'
    confidence = Math.max(confidence, 50)
  }
  // Low if 1 flag
  else if (flags.length === 1) {
    riskLevel = 'low'
    confidence = Math.max(confidence, 30)
  }

  const isSpam = flags.length >= 2 // Consider spam if 2+ red flags

  if (isSpam) {
    logger.info('Spam token detected', {
      mint: token.mint,
      name: token.name,
      symbol: token.symbol,
      isSpam,
      riskLevel,
      flagCount: flags.length,
      confidence,
      flags: flags.slice(0, 3), // Log first 3 flags
    })
  } else {
    logger.debug('Spam detection completed', {
      mint: token.mint,
      symbol: token.symbol,
      isSpam,
      riskLevel,
      flagCount: flags.length,
    })
  }

  return {
    isSpam,
    riskLevel,
    flags,
    confidence,
    recommendations
  }
}

/**
 * Batch spam detection for multiple tokens
 *
 * @param tokens - Array of tokens to analyze
 * @returns Array of spam detection results
 */
export function detectSpamTokens(tokens: TokenForSpamCheck[]): Map<string, SpamDetectionResult> {
  const results = new Map<string, SpamDetectionResult>()

  for (const token of tokens) {
    const result = detectSpamToken(token)
    results.set(token.mint, result)
  }

  const spamCount = Array.from(results.values()).filter(r => r.isSpam).length
  logger.info('Batch spam detection completed', {
    totalTokens: tokens.length,
    spamDetected: spamCount,
    cleanTokens: tokens.length - spamCount
  })

  return results
}

/**
 * Get human-readable risk level description
 */
export function getRiskLevelDescription(riskLevel: SpamRiskLevel): string {
  switch (riskLevel) {
    case 'low':
      return 'Low risk - minor concerns'
    case 'medium':
      return 'Medium risk - be cautious'
    case 'high':
      return 'High risk - likely scam'
    case 'critical':
      return 'Critical risk - avoid interaction'
  }
}

/**
 * Get emoji for risk level
 */
export function getRiskLevelEmoji(riskLevel: SpamRiskLevel): string {
  switch (riskLevel) {
    case 'low':
      return '🟡'
    case 'medium':
      return '🟠'
    case 'high':
      return '🔴'
    case 'critical':
      return '⛔'
  }
}

/**
 * Get color for risk level (Tailwind classes)
 */
export function getRiskLevelColor(riskLevel: SpamRiskLevel): string {
  switch (riskLevel) {
    case 'low':
      return 'yellow-500'
    case 'medium':
      return 'orange-500'
    case 'high':
      return 'red-500'
    case 'critical':
      return 'red-700'
  }
}
