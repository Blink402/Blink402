"use client"

import { useWallet } from "@solana/wallet-adapter-react"
import { WalletName } from "@solana/wallet-adapter-base"
import { useEffect, useState } from "react"
import { cn } from "@/lib/utils"
import { animate } from "motion"

interface WalletSelectorProps {
  open: boolean
  onClose: () => void
}

export function WalletSelector({ open, onClose }: WalletSelectorProps) {
  const { wallets, select, publicKey, disconnect, connected } = useWallet()
  const [copiedAddress, setCopiedAddress] = useState(false)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    // Animate modal entrance
    if (open && mounted) {
      const overlay = document.getElementById("wallet-selector-overlay")
      const modal = document.getElementById("wallet-selector-modal")

      if (overlay) {
        animate(overlay, { opacity: [0, 1] } as any, { duration: 0.2 } as any)
      }
      if (modal) {
        animate(
          modal,
          { opacity: [0, 1], transform: ["scale(0.95)", "scale(1)"] } as any,
          { duration: 0.3, easing: [0.16, 1, 0.3, 1] } as any
        )
      }
    }
  }, [open, mounted])

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape" && open) {
        onClose()
      }
    }

    if (open) {
      document.addEventListener("keydown", handleEscape)
      document.body.style.overflow = "hidden"
    }

    return () => {
      document.removeEventListener("keydown", handleEscape)
      document.body.style.overflow = ""
    }
  }, [open, onClose])

  const handleSelectWallet = async (walletName: WalletName) => {
    select(walletName)
    onClose()
  }

  const handleCopyAddress = async () => {
    if (publicKey) {
      await navigator.clipboard.writeText(publicKey.toBase58())
      setCopiedAddress(true)
      setTimeout(() => setCopiedAddress(false), 2000)
    }
  }

  const handleDisconnect = async () => {
    await disconnect()
    onClose()
  }

  const handleViewExplorer = () => {
    if (publicKey) {
      const network = process.env.NEXT_PUBLIC_SOLANA_NETWORK === "mainnet-beta" ? "" : "?cluster=devnet"
      window.open(`https://solscan.io/account/${publicKey.toBase58()}${network}`, "_blank")
    }
  }

  const formatAddress = (address: string) => {
    return `${address.slice(0, 8)}...${address.slice(-8)}`
  }

  if (!open || !mounted) return null

  return (
    <div
      id="wallet-selector-overlay"
      className="fixed inset-0 z-[10002] flex items-center justify-center bg-neon-blue-dark/20 backdrop-blur-sm p-4 sm:p-6"
      onClick={onClose}
      style={{ opacity: 0 }}
    >
      <div
        id="wallet-selector-modal"
        className="relative w-full max-w-md bg-neon-dark border-2 border-dashed border-neon-blue-light/60 shadow-[0_0_20px_rgba(90,180,255,0.25)] my-auto"
        onClick={(e) => e.stopPropagation()}
        style={{ opacity: 0 }}
      >
        {/* Noise overlay */}
        <div className="absolute inset-0 noise-overlay opacity-30 pointer-events-none" />

        {/* Header */}
        <div className="relative border-b border-dashed border-neon-blue-dark/40 p-6">
          <div className="flex items-center justify-between">
            <h2 className="font-mono text-xl font-light text-neon-blue-light">
              {connected ? "Connected Wallet" : "Select Wallet"}
            </h2>
            <button
              onClick={onClose}
              className="text-neon-grey hover:text-neon-blue-light transition-colors duration-200 min-w-11 min-h-11 flex items-center justify-center"
              aria-label="Close"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {connected && publicKey && (
            <div className="mt-4 p-3 bg-neon-black/50 border border-dashed border-neon-blue-dark/30">
              <p className="font-mono text-xs text-neon-grey mb-1">ADDRESS</p>
              <p className="font-mono text-sm text-white break-all">
                {formatAddress(publicKey.toBase58())}
              </p>
            </div>
          )}
        </div>

        {/* Content */}
        <div className="relative p-6 max-h-[60vh] overflow-y-auto">
          {connected ? (
            /* Connected Menu */
            <div className="space-y-3">
              <button
                onClick={handleCopyAddress}
                className={cn(
                  "w-full p-4 font-mono text-sm text-left min-h-11",
                  "bg-neon-black/30 border border-dashed border-neon-blue-dark/40",
                  "hover:border-neon-blue-light hover:bg-neon-blue-dark/10",
                  "transition-all duration-200",
                  "flex items-center gap-3 group"
                )}
              >
                <svg className="w-5 h-5 text-neon-blue-dark group-hover:text-neon-blue-light transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
                <div className="flex-1">
                  <div className="text-white group-hover:text-neon-blue-light transition-colors">
                    {copiedAddress ? "Copied!" : "Copy Address"}
                  </div>
                </div>
              </button>

              <button
                onClick={() => {
                  if (publicKey) {
                    window.location.href = `/profile/${publicKey.toBase58()}`
                  }
                }}
                className={cn(
                  "w-full p-4 font-mono text-sm text-left min-h-11",
                  "bg-neon-black/30 border border-dashed border-neon-blue-dark/40",
                  "hover:border-neon-blue-light hover:bg-neon-blue-dark/10",
                  "transition-all duration-200",
                  "flex items-center gap-3 group"
                )}
              >
                <svg className="w-5 h-5 text-neon-blue-dark group-hover:text-neon-blue-light transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
                <div className="flex-1">
                  <div className="text-white group-hover:text-neon-blue-light transition-colors">
                    View Profile
                  </div>
                </div>
              </button>

              <button
                onClick={handleViewExplorer}
                className={cn(
                  "w-full p-4 font-mono text-sm text-left min-h-11",
                  "bg-neon-black/30 border border-dashed border-neon-blue-dark/40",
                  "hover:border-neon-blue-light hover:bg-neon-blue-dark/10",
                  "transition-all duration-200",
                  "flex items-center gap-3 group"
                )}
              >
                <svg className="w-5 h-5 text-neon-blue-dark group-hover:text-neon-blue-light transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                </svg>
                <div className="flex-1">
                  <div className="text-white group-hover:text-neon-blue-light transition-colors">
                    View on Explorer
                  </div>
                </div>
              </button>

              <button
                onClick={handleDisconnect}
                className={cn(
                  "w-full p-4 font-mono text-sm text-left min-h-11",
                  "bg-neon-black/30 border border-dashed border-red-500/40",
                  "hover:border-red-500 hover:bg-red-500/10",
                  "transition-all duration-200",
                  "flex items-center gap-3 group"
                )}
              >
                <svg className="w-5 h-5 text-red-500/60 group-hover:text-red-500 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                </svg>
                <div className="flex-1">
                  <div className="text-white group-hover:text-red-400 transition-colors">
                    Disconnect
                  </div>
                </div>
              </button>
            </div>
          ) : (
            /* Wallet Selection */
            <div className="space-y-3">
              {wallets.filter(w => w.readyState === "Installed" || w.readyState === "Loadable").length === 0 ? (
                <div className="p-6 text-center">
                  <p className="font-mono text-sm text-neon-grey mb-4">
                    No wallet detected
                  </p>
                  <p className="font-mono text-xs text-neon-grey/60">
                    Install a Solana wallet extension to continue
                  </p>
                </div>
              ) : (
                <>
                  {/* Installed Wallets */}
                  {wallets
                    .filter((wallet) => wallet.readyState === "Installed")
                    .map((wallet) => (
                      <button
                        key={wallet.adapter.name}
                        onClick={() => handleSelectWallet(wallet.adapter.name)}
                        className={cn(
                          "w-full p-4 font-mono text-sm text-left min-h-11",
                          "bg-neon-black/30 border border-dashed border-neon-blue-dark/40",
                          "hover:border-neon-blue-light hover:bg-neon-blue-dark/10",
                          "transition-all duration-200",
                          "flex items-center gap-4 group"
                        )}
                      >
                        {wallet.adapter.icon && (
                          <img
                            src={wallet.adapter.icon}
                            alt={wallet.adapter.name}
                            className="w-8 h-8"
                          />
                        )}
                        <div className="flex-1">
                          <div className="text-white group-hover:text-neon-blue-light transition-colors">
                            {wallet.adapter.name}
                          </div>
                          <div className="text-xs text-neon-blue-dark mt-0.5">
                            Detected
                          </div>
                        </div>
                        <svg className="w-5 h-5 text-neon-blue-dark opacity-0 group-hover:opacity-100 transition-opacity" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                      </button>
                    ))}

                  {/* Available but not installed */}
                  {wallets
                    .filter((wallet) => wallet.readyState !== "Installed" && wallet.readyState !== "NotDetected")
                    .map((wallet) => (
                      <button
                        key={wallet.adapter.name}
                        onClick={() => handleSelectWallet(wallet.adapter.name)}
                        className={cn(
                          "w-full p-4 font-mono text-sm text-left",
                          "bg-neon-black/30 border border-dashed border-neon-grey/20",
                          "hover:border-neon-grey/40 hover:bg-neon-grey/5",
                          "transition-all duration-200",
                          "flex items-center gap-4 group opacity-60"
                        )}
                      >
                        {wallet.adapter.icon && (
                          <img
                            src={wallet.adapter.icon}
                            alt={wallet.adapter.name}
                            className="w-8 h-8 grayscale"
                          />
                        )}
                        <div className="flex-1">
                          <div className="text-neon-grey group-hover:text-white transition-colors">
                            {wallet.adapter.name}
                          </div>
                          <div className="text-xs text-neon-grey/60 mt-0.5">
                            Available
                          </div>
                        </div>
                      </button>
                    ))}
                </>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        {!connected && (
          <div className="relative border-t border-dashed border-neon-blue-dark/40 p-4">
            <p className="font-mono text-xs text-center text-neon-grey/60">
              New to Solana?{" "}
              <a
                href="https://phantom.app/"
                target="_blank"
                rel="noopener noreferrer"
                className="text-neon-blue-dark hover:text-neon-blue-light underline transition-colors"
              >
                Get Phantom
              </a>
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
