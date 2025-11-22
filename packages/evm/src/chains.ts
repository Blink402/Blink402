/**
 * Chain Configuration for EVM Networks
 *
 * Provides chain objects and utilities for Base and other EVM L2s.
 */

import { base, baseSepolia } from 'viem/chains'
import type { Chain } from 'viem'

/**
 * Supported EVM chains
 */
export const CHAINS = {
  mainnet: base,
  testnet: baseSepolia
} as const

export type ChainNetwork = keyof typeof CHAINS

/**
 * Get chain configuration by network name
 *
 * @param network - 'mainnet' for Base or 'testnet' for Base Sepolia
 * @returns Viem chain object
 */
export function getChain(network: ChainNetwork): Chain {
  return CHAINS[network]
}

/**
 * Get chain name for display purposes
 */
export function getChainName(network: ChainNetwork): string {
  return network === 'mainnet' ? 'Base' : 'Base Sepolia'
}

/**
 * Get block explorer URL for a transaction
 */
export function getExplorerUrl(txHash: string, network: ChainNetwork): string {
  const baseUrl = network === 'mainnet'
    ? 'https://basescan.org'
    : 'https://sepolia.basescan.org'
  return `${baseUrl}/tx/${txHash}`
}
