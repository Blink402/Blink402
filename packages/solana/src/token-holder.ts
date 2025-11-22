// B402 Token Holder Verification & Benefits System
// Implements tier-based loyalty program for b402 pump.fun token holders

import { Connection, PublicKey } from '@solana/web3.js'
import { getAssociatedTokenAddress, getAccount } from '@solana/spl-token'
import { getConnection } from './index'
import { createLogger } from '@blink402/config'

const logger = createLogger('@blink402/token-holder')

// B402 token mint address (from pump.fun)
// TODO: Replace with actual b402 mint address once provided
// Using a valid Solana address as placeholder (system program)
const B402_MINT_ADDRESS =
  process.env.NEXT_PUBLIC_B402_MINT ||
  process.env.B402_MINT ||
  '11111111111111111111111111111111' // Valid placeholder (system program)

export const B402_MINT = new PublicKey(B402_MINT_ADDRESS)

// B402 token decimals (standard pump.fun tokens use 6 or 9 decimals)
// TODO: Verify actual decimals for b402 token
export const B402_DECIMALS = 9 // Most pump.fun tokens use 9 decimals

export type TokenHolderTier = 'NONE' | 'BRONZE' | 'SILVER' | 'GOLD' | 'DIAMOND'

export interface TokenHolderInfo {
  tier: TokenHolderTier
  balance: number
  rawBalance: bigint
  benefits: TokenBenefits
}

export interface TokenBenefits {
  slotMachine: {
    discountPercent: number        // Entry price discount
    bonusMultiplier: number         // Payout multiplier
    freeSpinsDaily: number          // Free daily spins
  }
  lottery: {
    discountPercent: number        // Entry price discount
    bonusEntries: number            // Extra entries per purchase
    winBoostPercent: number         // Payout boost
  }
  blinks: {
    creatorFeeDiscount: number      // Platform fee reduction
    priorityExecution: boolean      // Jump queue
    customBranding: boolean         // Custom icons/themes
  }
}

// Tier thresholds (in B402 tokens)
// Adjust these based on b402 tokenomics and total supply
const TIER_THRESHOLDS: Record<Exclude<TokenHolderTier, 'NONE'>, number> = {
  BRONZE: 1_000,      // 1,000 B402
  SILVER: 10_000,     // 10,000 B402
  GOLD: 50_000,       // 50,000 B402
  DIAMOND: 100_000    // 100,000 B402
}

// Benefits by tier
const TIER_BENEFITS: Record<TokenHolderTier, TokenBenefits> = {
  NONE: {
    slotMachine: { discountPercent: 0, bonusMultiplier: 1.0, freeSpinsDaily: 0 },
    lottery: { discountPercent: 0, bonusEntries: 0, winBoostPercent: 0 },
    blinks: { creatorFeeDiscount: 0, priorityExecution: false, customBranding: false }
  },
  BRONZE: {
    slotMachine: { discountPercent: 5, bonusMultiplier: 1.05, freeSpinsDaily: 1 },
    lottery: { discountPercent: 5, bonusEntries: 0, winBoostPercent: 5 },
    blinks: { creatorFeeDiscount: 10, priorityExecution: false, customBranding: false }
  },
  SILVER: {
    slotMachine: { discountPercent: 10, bonusMultiplier: 1.10, freeSpinsDaily: 3 },
    lottery: { discountPercent: 10, bonusEntries: 1, winBoostPercent: 10 },
    blinks: { creatorFeeDiscount: 20, priorityExecution: false, customBranding: true }
  },
  GOLD: {
    slotMachine: { discountPercent: 15, bonusMultiplier: 1.15, freeSpinsDaily: 5 },
    lottery: { discountPercent: 15, bonusEntries: 2, winBoostPercent: 15 },
    blinks: { creatorFeeDiscount: 30, priorityExecution: true, customBranding: true }
  },
  DIAMOND: {
    slotMachine: { discountPercent: 20, bonusMultiplier: 1.25, freeSpinsDaily: 10 },
    lottery: { discountPercent: 20, bonusEntries: 5, winBoostPercent: 25 },
    blinks: { creatorFeeDiscount: 50, priorityExecution: true, customBranding: true }
  }
}

/**
 * Get B402 token holder tier and benefits for a wallet
 *
 * @param walletAddress - User's Solana wallet address
 * @param connection - Optional Solana connection (uses default if not provided)
 * @returns Token holder information including tier and benefits
 */
export async function getB402HolderTier(
  walletAddress: string,
  connection?: Connection
): Promise<TokenHolderInfo> {
  try {
    const conn = connection || getConnection()
    const wallet = new PublicKey(walletAddress)

    // Get user's B402 token account
    const tokenAccount = await getAssociatedTokenAddress(B402_MINT, wallet)

    // Check if token account exists and get balance
    try {
      const account = await getAccount(conn, tokenAccount)
      const rawBalance = account.amount
      const balance = Number(rawBalance) / Math.pow(10, B402_DECIMALS)

      // Determine tier based on balance
      let tier: TokenHolderTier = 'NONE'
      if (balance >= TIER_THRESHOLDS.DIAMOND) {
        tier = 'DIAMOND'
      } else if (balance >= TIER_THRESHOLDS.GOLD) {
        tier = 'GOLD'
      } else if (balance >= TIER_THRESHOLDS.SILVER) {
        tier = 'SILVER'
      } else if (balance >= TIER_THRESHOLDS.BRONZE) {
        tier = 'BRONZE'
      }

      logger.info('B402 holder tier calculated', {
        wallet: walletAddress,
        balance,
        tier
      })

      return {
        tier,
        balance,
        rawBalance,
        benefits: TIER_BENEFITS[tier]
      }
    } catch (error: any) {
      // Token account doesn't exist or other error
      // This is normal for wallets that don't hold B402
      if (
        error.name === 'TokenAccountNotFoundError' ||
        error.message?.includes('could not find') ||
        error.message?.includes('Invalid')
      ) {
        logger.debug('No B402 token account found', { wallet: walletAddress })
        return {
          tier: 'NONE',
          balance: 0,
          rawBalance: BigInt(0),
          benefits: TIER_BENEFITS.NONE
        }
      }

      // Unexpected error - log and return NONE tier
      logger.error('Error checking B402 balance', {
        wallet: walletAddress,
        error: error.message
      })

      return {
        tier: 'NONE',
        balance: 0,
        rawBalance: BigInt(0),
        benefits: TIER_BENEFITS.NONE
      }
    }
  } catch (error) {
    logger.error('Failed to get B402 holder tier', {
      wallet: walletAddress,
      error
    })

    // Return NONE tier on error (fail-safe)
    return {
      tier: 'NONE',
      balance: 0,
      rawBalance: BigInt(0),
      benefits: TIER_BENEFITS.NONE
    }
  }
}

/**
 * Apply B402 holder discount to a base price
 *
 * @param basePrice - Original price in USDC
 * @param walletAddress - User's Solana wallet address
 * @param gameType - Type of game/blink ('slotMachine' | 'lottery' | 'blinks')
 * @returns Discounted price, tier, and savings amount
 */
export async function applyB402Discount(
  basePrice: number,
  walletAddress: string,
  gameType: keyof TokenBenefits
): Promise<{
  discountedPrice: number
  originalPrice: number
  tier: TokenHolderTier
  savings: number
  discountPercent: number
}> {
  const holderInfo = await getB402HolderTier(walletAddress)
  const benefits = holderInfo.benefits[gameType]

  // Calculate discount based on game type
  let discountPercent = 0
  if (gameType === 'slotMachine' || gameType === 'lottery') {
    discountPercent = 'discountPercent' in benefits ? benefits.discountPercent : 0
  } else if (gameType === 'blinks') {
    discountPercent = 'creatorFeeDiscount' in benefits ? benefits.creatorFeeDiscount : 0
  }

  const discountAmount = basePrice * (discountPercent / 100)
  const discountedPrice = Math.max(0, basePrice - discountAmount) // Never negative

  logger.info('B402 discount applied', {
    wallet: walletAddress,
    tier: holderInfo.tier,
    gameType,
    basePrice,
    discountedPrice,
    savings: discountAmount
  })

  return {
    discountedPrice,
    originalPrice: basePrice,
    tier: holderInfo.tier,
    savings: discountAmount,
    discountPercent
  }
}

/**
 * Get tier display information for UI rendering
 *
 * @param tier - Token holder tier
 * @returns Display info including icon, color, label
 */
export function getTierDisplayInfo(tier: TokenHolderTier): {
  icon: string
  color: string
  label: string
  gradient: string
} {
  const displayInfo = {
    NONE: {
      icon: '⚫',
      color: 'gray-500',
      label: 'No Tier',
      gradient: 'from-gray-600/40 to-gray-400/40'
    },
    BRONZE: {
      icon: '🥉',
      color: 'amber-700',
      label: 'Bronze Tier',
      gradient: 'from-amber-900/40 to-amber-700/40'
    },
    SILVER: {
      icon: '🥈',
      color: 'gray-400',
      label: 'Silver Tier',
      gradient: 'from-gray-600/40 to-gray-400/40'
    },
    GOLD: {
      icon: '🥇',
      color: 'yellow-400',
      label: 'Gold Tier',
      gradient: 'from-yellow-600/40 to-yellow-400/40'
    },
    DIAMOND: {
      icon: '💎',
      color: 'cyan-400',
      label: 'Diamond Tier',
      gradient: 'from-cyan-600/40 to-blue-500/40'
    }
  }

  return displayInfo[tier]
}

/**
 * Get all tier thresholds for display purposes
 * Useful for showing tier comparison UI
 */
export function getTierThresholds(): typeof TIER_THRESHOLDS {
  return TIER_THRESHOLDS
}

/**
 * Get all tier benefits for display purposes
 * Useful for showing tier comparison UI
 */
export function getAllTierBenefits(): typeof TIER_BENEFITS {
  return TIER_BENEFITS
}

/**
 * Check if wallet is eligible for free spins today
 * Requires tracking in database to prevent abuse
 *
 * @param walletAddress - User's wallet address
 * @param usedSpinsToday - Number of free spins already used today
 * @returns Number of remaining free spins
 */
export async function getRemainingFreeSpins(
  walletAddress: string,
  usedSpinsToday: number = 0
): Promise<number> {
  const holderInfo = await getB402HolderTier(walletAddress)
  const dailyLimit = holderInfo.benefits.slotMachine.freeSpinsDaily

  return Math.max(0, dailyLimit - usedSpinsToday)
}

/**
 * Validate B402 mint address
 * Ensures the mint is properly configured
 */
export function validateB402Mint(): boolean {
  const mintStr = B402_MINT.toBase58()

  // Check if it's the placeholder
  if (mintStr.includes('B402MINT111')) {
    logger.warn('B402 mint address is placeholder - update B402_MINT or NEXT_PUBLIC_B402_MINT env var')
    return false
  }

  return true
}
