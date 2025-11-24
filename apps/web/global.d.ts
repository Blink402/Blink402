/**
 * Type declarations for browser window extensions
 * Fixes TypeScript errors for Solana wallet adapters
 */

import { PublicKey, Transaction, VersionedTransaction } from '@solana/web3.js'

/**
 * Solana Wallet Adapter Interface
 * Standard interface implemented by Phantom, Solflare, Backpack, etc.
 */
interface SolanaWalletAdapter {
  publicKey: PublicKey | null
  isConnected: boolean

  connect(): Promise<{ publicKey: PublicKey }>
  disconnect(): Promise<void>

  signTransaction<T extends Transaction | VersionedTransaction>(
    transaction: T
  ): Promise<T>

  signAllTransactions<T extends Transaction | VersionedTransaction>(
    transactions: T[]
  ): Promise<T[]>

  signMessage(message: Uint8Array): Promise<{ signature: Uint8Array }>
}

/**
 * Phantom Wallet Extensions
 */
interface PhantomProvider extends SolanaWalletAdapter {
  isPhantom?: boolean
}

interface PhantomWindow {
  phantom?: {
    solana?: PhantomProvider
  }
}

/**
 * Test Mock Extensions
 * Used in Playwright E2E tests
 */
interface TestMockWindow {
  mockWalletConnected?: boolean
  mockPublicKey?: PublicKey
  mockSignTransaction?: (tx: Transaction | VersionedTransaction) => Promise<Transaction | VersionedTransaction>
}

/**
 * Solflare Wallet Extension
 */
interface SolflareProvider extends SolanaWalletAdapter {
  isSolflare?: boolean
}

/**
 * Backpack Wallet Extension
 */
interface BackpackProvider extends SolanaWalletAdapter {
  isBackpack?: boolean
}

/**
 * Coinbase Solana Wallet Extension
 */
interface CoinbaseSolanaProvider extends SolanaWalletAdapter {
  isCoinbaseWallet?: boolean
}

/**
 * Global Window Extensions
 */
declare global {
  interface Window extends PhantomWindow, TestMockWindow {
    solana?: SolanaWalletAdapter
    solflare?: SolflareProvider
    backpack?: BackpackProvider
    coinbaseSolana?: CoinbaseSolanaProvider
  }
}

export {}
