"use client"

import { useState, useEffect } from "react"
import { Connection } from "@solana/web3.js"
import { AlertTriangle } from "lucide-react"
import { checkUsdcAtaExists, createUsdcAtaTransaction } from "@/lib/usdc-ata"
import { Button } from "@/components/ui/button"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { logger } from "@/lib/logger"

interface UsdcAtaCheckerProps {
  payoutWallet: string
  connectedWallet?: string
  onAtaVerified?: () => void
}

export function UsdcAtaChecker({
  payoutWallet,
  connectedWallet,
  onAtaVerified
}: UsdcAtaCheckerProps) {
  const [checking, setChecking] = useState(false)
  const [ataExists, setAtaExists] = useState<boolean | null>(null)
  const [ataAddress, setAtaAddress] = useState<string>("")
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Check ATA whenever payout wallet changes
  useEffect(() => {
    if (!payoutWallet || payoutWallet.length < 32) {
      setAtaExists(null)
      return
    }

    checkAta()
  }, [payoutWallet])

  const checkAta = async () => {
    setChecking(true)
    setError(null)

    try {
      const connection = new Connection(
        process.env.NEXT_PUBLIC_SOLANA_RPC_URL || "https://api.mainnet-beta.solana.com",
        "confirmed"
      )

      const result = await checkUsdcAtaExists(connection, payoutWallet)
      setAtaExists(result.exists)
      setAtaAddress(result.ataAddress)

      if (result.exists && onAtaVerified) {
        onAtaVerified()
      }

      logger.info('ATA check complete:', result)
    } catch (err) {
      logger.error('ATA check failed:', err)
      setError(err instanceof Error ? err.message : 'Failed to check USDC account')
      setAtaExists(null)
    } finally {
      setChecking(false)
    }
  }

  const createAta = async () => {
    if (!connectedWallet) {
      setError("Please connect your wallet first")
      return
    }

    setCreating(true)
    setError(null)

    try {
      // Check for wallet first
      const solana = window.solana || window.phantom?.solana

      if (!solana) {
        throw new Error("No Solana wallet found. Please install Phantom or Solflare and connect it.")
      }

      if (!solana.isConnected) {
        throw new Error("Wallet not connected. Please connect your wallet first.")
      }

      const connection = new Connection(
        process.env.NEXT_PUBLIC_SOLANA_RPC_URL || "https://api.mainnet-beta.solana.com",
        "confirmed"
      )

      logger.info('Creating USDC ATA...', { payoutWallet, payer: connectedWallet })

      // Build transaction
      const transaction = await createUsdcAtaTransaction(
        connection,
        payoutWallet,
        connectedWallet
      )

      logger.info('Requesting wallet signature for ATA creation...')
      const signedTx = await solana.signTransaction(transaction)

      logger.info('Sending signed transaction...')
      const signature = await connection.sendRawTransaction(signedTx.serialize())

      logger.info('Waiting for confirmation...')
      const confirmation = await connection.confirmTransaction(signature, 'confirmed')

      if (confirmation.value.err) {
        throw new Error('Transaction failed')
      }

      logger.info('✅ USDC ATA created successfully!', { signature })

      // Recheck ATA
      await checkAta()
    } catch (err: any) {
      logger.error('ATA creation failed:', err)
      if (err.message?.includes('rejected') || err.message?.includes('denied')) {
        setError("Transaction rejected by user")
      } else {
        setError(err.message || 'Failed to create USDC account')
      }
    } finally {
      setCreating(false)
    }
  }

  if (!payoutWallet || payoutWallet.length < 32) {
    return null
  }

  if (checking) {
    return (
      <Alert className="bg-neon-blue-dark/10 border-neon-blue-dark/30">
        <AlertDescription className="text-neon-white font-mono text-sm flex items-center gap-2">
          <span className="inline-block w-4 h-4 border-2 border-neon-blue-light border-t-transparent rounded-full animate-spin" />
          Checking if your wallet can receive USDC payments...
        </AlertDescription>
      </Alert>
    )
  }

  if (ataExists === null) {
    return null
  }

  if (ataExists) {
    return (
      <Alert className="bg-green-500/10 border-green-500/30">
        <AlertDescription className="text-green-400 font-mono text-sm">
          <div className="space-y-1">
            <div>✅ Ready to receive USDC payments!</div>
            <div className="text-xs text-green-300/70">
              Payment account: <span className="break-all">{ataAddress}</span>
            </div>
          </div>
        </AlertDescription>
      </Alert>
    )
  }

  return (
    <Alert className="bg-yellow-500/10 border-2 border-yellow-500/40 shadow-lg">
      <AlertDescription className="text-yellow-300 font-mono">
        <div className="space-y-4">
          {/* Main Warning Box - More Prominent */}
          <div className="bg-yellow-500/20 border-2 border-yellow-500/50 rounded-lg p-5">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-6 h-6 mt-0.5 flex-shrink-0 text-yellow-300" />
              <div>
                <p className="text-yellow-200 font-bold text-base mb-2">
                  ⚠️ USDC Payment Account Required
                </p>
                <p className="text-yellow-200/90 text-sm">
                  Your wallet needs a USDC payment account to receive payments. Without this, users won't be able to pay you!
                </p>
              </div>
            </div>
          </div>

          {/* Explanation */}
          <div className="text-sm text-yellow-200/80 bg-yellow-500/5 border border-yellow-500/20 rounded-lg p-3">
            <p className="mb-2"><strong className="text-yellow-200">What is this?</strong></p>
            <p className="text-xs">
              All Solana wallets need a special "token account" to hold USDC (like creating a folder for USDC). This is a one-time setup required by Solana's blockchain.
            </p>
          </div>

          {/* Error Display */}
          {error && (
            <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3">
              <p className="text-red-400 text-sm font-bold mb-1">❌ Error</p>
              <p className="text-red-300 text-xs">{error}</p>
            </div>
          )}

          {/* Wallet Connection Warning */}
          {!connectedWallet && (
            <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3">
              <p className="text-red-400 text-sm font-bold">
                ❌ Wallet Not Connected
              </p>
              <p className="text-red-300 text-xs mt-1">
                Please connect your wallet in the top navigation bar first.
              </p>
            </div>
          )}

          {/* Action Buttons - Larger and More Prominent */}
          <div className="flex flex-col sm:flex-row gap-3 pt-2">
            {connectedWallet && (
              <Button
                type="button"
                onClick={createAta}
                disabled={creating}
                className="bg-yellow-600 hover:bg-yellow-700 text-white font-mono text-sm h-11 flex-1 shadow-md font-bold"
              >
                {creating ? (
                  <>
                    <span className="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                    Creating Account...
                  </>
                ) : (
                  <>✅ Create Payment Account Now</>
                )}
              </Button>
            )}

            <Button
              type="button"
              variant="outline"
              onClick={checkAta}
              disabled={checking || creating}
              className="font-mono text-sm h-11 border-yellow-500/30 hover:bg-yellow-500/10"
            >
              🔄 Recheck Status
            </Button>
          </div>

          {/* Cost Info - More Prominent */}
          <div className="bg-neon-dark border border-yellow-500/20 rounded-lg p-3">
            <p className="text-xs text-yellow-200/70">
              {connectedWallet ? (
                <>
                  <strong className="text-yellow-200">One-time cost:</strong> ~0.002 SOL (less than $0.10)
                  <br />
                  <span className="text-yellow-200/60">This small fee creates the account permanently on the Solana blockchain.</span>
                </>
              ) : (
                <>
                  <strong className="text-yellow-200">Next step:</strong> Connect your wallet using the button in the top navigation bar.
                </>
              )}
            </p>
          </div>
        </div>
      </AlertDescription>
    </Alert>
  )
}
