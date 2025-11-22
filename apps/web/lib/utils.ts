import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Format SOL or USDC amount for display
 * @param amount - Amount in SOL or USDC
 * @returns Formatted string with appropriate decimal places
 */
export function formatSol(amount: number | string): string {
  const value = typeof amount === 'string' ? parseFloat(amount) : amount

  if (isNaN(value)) return '0.00'

  // For very small amounts, show more decimals
  if (value < 0.01) {
    return value.toFixed(4)
  }

  // For small amounts, show 3 decimals
  if (value < 1) {
    return value.toFixed(3)
  }

  // For larger amounts, show 2 decimals
  return value.toFixed(2)
}

/**
 * Format USDC amount for display (removes trailing zeros)
 * @param amount - Amount in USDC
 * @returns Formatted string with clean decimal places
 */
export function formatUsdc(amount: number | string): string {
  const value = typeof amount === 'string' ? parseFloat(amount) : amount

  if (isNaN(value)) return '0'

  // Format to remove trailing zeros
  return value.toString()
}
