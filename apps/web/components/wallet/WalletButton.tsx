"use client"

import { useWallet } from "@solana/wallet-adapter-react"
import { useState, useEffect } from "react"
import { WalletSelector } from "./WalletSelector"
import { cn } from "@/lib/utils"

interface WalletButtonProps {
  className?: string
  variant?: "default" | "mobile"
}

export function WalletButton({ className, variant = "default" }: WalletButtonProps) {
  const { publicKey, disconnect, connected, connecting } = useWallet()
  const [showSelector, setShowSelector] = useState(false)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  // Prevent hydration mismatch
  if (!mounted) {
    return (
      <button
        className={cn(
          "btn-primary h-11 px-6 font-mono text-sm",
          variant === "mobile" && "w-full",
          className
        )}
        disabled
      >
        <span className="opacity-50">...</span>
      </button>
    )
  }

  const handleClick = () => {
    if (connected) {
      // Show disconnect/copy address menu
      setShowSelector(true)
    } else {
      // Show wallet selection
      setShowSelector(true)
    }
  }

  const formatAddress = (address: string) => {
    return `${address.slice(0, 4)}...${address.slice(-4)}`
  }

  return (
    <>
      <button
        onClick={handleClick}
        disabled={connecting}
        className={cn(
          "relative h-11 px-6 font-mono text-sm font-medium",
          "bg-neon-dark border border-dashed border-neon-blue-dark/60",
          "text-neon-blue-light hover:text-white",
          "transition-all duration-300",
          "hover:border-neon-blue-light hover:shadow-[0_0_20px_rgba(90,180,255,0.5)]",
          "disabled:opacity-50 disabled:cursor-not-allowed",
          "group relative overflow-hidden",
          variant === "mobile" && "w-full",
          className
        )}
      >
        {/* Hover glow effect */}
        <div className="absolute inset-0 bg-neon-blue-dark/0 group-hover:bg-neon-blue-dark/5 transition-colors duration-300" />

        <span className="relative z-10 flex items-center justify-center gap-2">
          {connecting ? (
            <>
              <span className="inline-block w-4 h-4 border-2 border-neon-blue-light border-t-transparent rounded-full animate-spin" />
              Connecting...
            </>
          ) : connected && publicKey ? (
            <>
              <svg
                className="w-4 h-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              {formatAddress(publicKey.toBase58())}
            </>
          ) : (
            <>
              <svg
                className="w-4 h-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z"
                />
              </svg>
              Connect Wallet
            </>
          )}
        </span>

        {/* Dashed border animation on hover */}
        <div className="absolute inset-0 border border-dashed border-neon-blue-light opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
      </button>

      <WalletSelector
        open={showSelector}
        onClose={() => setShowSelector(false)}
      />
    </>
  )
}
