"use client"

import type React from "react"
import { PrivyProvider } from "@privy-io/react-auth"
import { toSolanaWalletConnectors } from "@privy-io/react-auth/solana"
import { WagmiProvider, createConfig, http } from "wagmi"
import { base, baseSepolia } from "wagmi/chains"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { ToastProvider, ToastContainer } from "@/components/toast"
import { TooltipProvider } from "@/components/ui/tooltip"
import { ScrollProgressBar } from "@/components/ScrollProgressBar"
import { ErrorBoundary } from "@/components/ErrorBoundary"

// Configure Wagmi for Base chain support
const wagmiConfig = createConfig({
  chains: [base, baseSepolia],
  transports: {
    [base.id]: http(),
    [baseSepolia.id]: http(),
  },
})

// Create QueryClient for TanStack Query (required by wagmi)
const queryClient = new QueryClient()

export function ClientProviders({ children }: { children: React.ReactNode }) {
  // Use fallback values during build if env vars are missing
  const privyAppId = process.env.NEXT_PUBLIC_PRIVY_APP_ID || 'placeholder-app-id'

  return (
    <QueryClientProvider client={queryClient}>
      <WagmiProvider config={wagmiConfig}>
        <ToastProvider>
          <TooltipProvider delayDuration={200}>
            <PrivyProvider
              appId={privyAppId}
              config={{
                appearance: {
                  theme: "dark",
                  accentColor: "#5AB4FF",
                  logo: "/onchain_icon.svg",
                  walletChainType: "ethereum-and-solana",
              // Show only the most common Solana wallets
              walletList: [
                "phantom",         // #1 Solana wallet (3M+ users)
                "solflare",        // #2 Solana wallet
                "backpack",        // #3 Solana wallet (xNFT support)
                "coinbase_wallet", // Multi-chain (Solana + EVM)
                "detected_wallets", // Auto-detect any other installed wallets
              ],
              // Privy modal appearance config
              showWalletLoginFirst: true,
              landingHeader: "Connect Wallet",
              loginMessage: "Connect your wallet to continue",
            },
            loginMethods: ["wallet"], // Wallet-only for payments
            externalWallets: {
              // Solana wallets configuration (Phantom, Solflare, etc.)
              solana: {
                connectors: toSolanaWalletConnectors({
                  // Fix Pack 8: Disable auto-connect to prevent mobile redirect issues
                  // On mobile, shouldAutoConnect: true causes unwanted redirects to Phantom's in-app browser
                  // Setting this to false gives users manual control over wallet connections
                  shouldAutoConnect: false,
                }),
              },
            },
            // Disable embedded wallet creation - use external wallets only
            embeddedWallets: {
              solana: {
                createOnLogin: "off",
              },
              ethereum: {
                createOnLogin: "off",
              },
            },
            // Default chain for EVM wallets
            defaultChain: base,
            supportedChains: [base, baseSepolia],
          }}
        >
          <ScrollProgressBar />
          <a
            href="#main-content"
            className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-[9999] focus:px-4 focus:py-2 focus:bg-neon-blue-dark focus:text-neon-white focus:font-mono focus:text-sm focus:rounded focus:outline-none focus:ring-2 focus:ring-neon-blue-light"
          >
            Skip to main content
          </a>
          <ErrorBoundary>
            <div className="noise-overlay" aria-hidden="true" />
            {children}
          </ErrorBoundary>
          <ToastContainer />
        </PrivyProvider>
      </TooltipProvider>
        </ToastProvider>
      </WagmiProvider>
    </QueryClientProvider>
  )
}
