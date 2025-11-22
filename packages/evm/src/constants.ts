/**
 * Constants for EVM Blockchain Operations
 *
 * USDC contract addresses, ABIs, and other constants for Base chain.
 */

import type { Address } from 'viem'

/**
 * USDC Contract Addresses
 *
 * Base Mainnet: Circle-issued native USDC
 * Base Sepolia: Test USDC from Circle faucet
 */
export const USDC_ADDRESSES = {
  mainnet: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913' as Address,
  testnet: '0x036CbD53842c5426634e7929541eC2318f3dCF7e' as Address // Updated Base Sepolia USDC
} as const

/**
 * USDC has 6 decimals (same as Solana)
 */
export const USDC_DECIMALS = 6

/**
 * Minimal ERC-20 ABI for USDC operations
 *
 * Includes only the functions we need:
 * - transfer: Send USDC to another address
 * - balanceOf: Check USDC balance
 */
export const ERC20_ABI = [
  {
    constant: false,
    inputs: [
      { name: '_to', type: 'address' },
      { name: '_value', type: 'uint256' }
    ],
    name: 'transfer',
    outputs: [{ name: '', type: 'bool' }],
    type: 'function'
  },
  {
    constant: true,
    inputs: [{ name: '_owner', type: 'address' }],
    name: 'balanceOf',
    outputs: [{ name: 'balance', type: 'uint256' }],
    type: 'function'
  },
  {
    constant: true,
    inputs: [],
    name: 'decimals',
    outputs: [{ name: '', type: 'uint8' }],
    type: 'function'
  }
] as const
