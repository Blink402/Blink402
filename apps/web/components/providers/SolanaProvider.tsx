'use client'

import { useMemo } from 'react'
import { ConnectionProvider, WalletProvider } from '@solana/wallet-adapter-react'
import {
  PhantomWalletAdapter,
  SolflareWalletAdapter,
  CoinbaseWalletAdapter,
  TrustWalletAdapter,
} from '@solana/wallet-adapter-wallets'
import { clusterApiUrl } from '@solana/web3.js'

export function SolanaProvider({ children }: { children: React.ReactNode }) {
  // Use mainnet-beta for production, devnet for testing
  const network = (process.env.NEXT_PUBLIC_SOLANA_NETWORK || 'mainnet-beta') as 'devnet' | 'mainnet-beta'
  const endpoint = useMemo(() => {
    // Use custom RPC endpoint (Helius) if provided, otherwise fallback to public endpoint
    if (process.env.NEXT_PUBLIC_SOLANA_RPC_URL) {
      return process.env.NEXT_PUBLIC_SOLANA_RPC_URL
    }
    return clusterApiUrl(network)
  }, [network])

  // Initialize wallet adapters - using only widely available adapters
  const wallets = useMemo(() => [
    new PhantomWalletAdapter(),
    new SolflareWalletAdapter(),
    new CoinbaseWalletAdapter(),
    new TrustWalletAdapter(),
  ], [])

  return (
    <ConnectionProvider endpoint={endpoint}>
      <WalletProvider wallets={wallets} autoConnect>
        {children}
      </WalletProvider>
    </ConnectionProvider>
  )
}
