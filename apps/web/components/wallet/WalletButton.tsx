"use client"

import { usePrivy, useWallets } from "@privy-io/react-auth"
import { useState, useEffect } from "react"
import { Wallet, Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"

interface WalletButtonProps {
  className?: string
  variant?: "default" | "mobile"
}

export function WalletButton({ className, variant = "default" }: WalletButtonProps) {
  const { ready, authenticated, login, logout, user } = usePrivy()
  const { wallets } = useWallets()
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  // Get wallet address - prioritize Solana wallet for Solana payments
  const wallet = wallets[0]
  const solanaAccount: any = user?.linkedAccounts?.find(
    (account: any) => account.type === 'wallet' && account.chainType === 'solana'
  )
  // IMPORTANT: Prioritize Solana account for Solana payments
  const walletAddress = (solanaAccount as any)?.address || wallet?.address

  // Debug logging
  useEffect(() => {
    if (mounted && ready) {
      console.log("🔍 Privy State:", {
        ready,
        authenticated,
        walletsCount: wallets.length,
        walletAddress,
        walletType: wallet?.walletClientType,
        linkedAccountsCount: user?.linkedAccounts?.length || 0,
        hasSolanaAccount: !!solanaAccount
      })

      // Deep debug: Log all linked accounts
      if (user?.linkedAccounts && user.linkedAccounts.length > 0) {
        console.log("📋 Linked Accounts Details:",
          user.linkedAccounts.map((acc: any) => ({
            type: acc.type,
            walletClientType: acc.walletClientType,
            chainType: acc.chainType,
            address: acc.address,
            connectorType: acc.connectorType
          }))
        )
      }

      // Deep debug: Log all wallets from useWallets
      if (wallets.length > 0) {
        console.log("👛 Wallets from useWallets:",
          wallets.map(w => ({
            address: w.address,
            walletClientType: w.walletClientType,
            chainType: (w as any).chainType
          }))
        )
      }
    }
  }, [ready, authenticated, wallets, walletAddress, wallet, mounted, user, solanaAccount])

  // Prevent hydration mismatch
  if (!mounted || !ready) {
    return (
      <button
        className={cn(
          "btn-primary h-10 px-4 font-mono text-sm",
          variant === "mobile" && "w-full h-11 px-6",
          className
        )}
        disabled
      >
        <span className="opacity-50">...</span>
      </button>
    )
  }

  const handleClick = () => {
    if (authenticated) {
      // User is authenticated - logout (whether wallet is detected or not)
      logout()
    } else {
      // User not authenticated - show wallet login modal
      login()
    }
  }

  const formatAddress = (address: string) => {
    return `${address.slice(0, 4)}...${address.slice(-4)}`
  }

  return (
    <button
      onClick={handleClick}
      disabled={!ready}
      className={cn(
        "relative h-10 px-4 font-mono text-sm font-medium rounded",
        "bg-neon-dark border border-dashed border-neon-blue-dark/60",
        "text-neon-blue-light hover:text-white",
        "transition-all duration-300",
        "hover:border-neon-blue-light hover:shadow-[0_0_10px_rgba(90,180,255,0.3)]",
        "disabled:opacity-50 disabled:cursor-not-allowed",
        "group relative overflow-hidden",
        variant === "mobile" && "w-full h-11 px-6",
        className
      )}
    >
      {/* Hover glow effect */}
      <div className="absolute inset-0 bg-neon-blue-dark/0 group-hover:bg-neon-blue-dark/5 transition-colors duration-300" />

      <span className="relative z-10 flex items-center justify-center gap-2">
        {!ready ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin text-neon-blue-light" />
            Loading...
          </>
        ) : authenticated && walletAddress ? (
          <>
            <Wallet className="w-4 h-4" />
            {formatAddress(walletAddress)}
          </>
        ) : (
          <>
            <Wallet className="w-4 h-4" />
            Connect Wallet
          </>
        )}
      </span>

      {/* Dashed border animation on hover */}
      <div className="absolute inset-0 border border-dashed border-neon-blue-light opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
    </button>
  )
}
