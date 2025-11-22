"use client"

import { useState } from "react"
import { usePrivy, useWallets } from "@privy-io/react-auth"
import { retryFetch } from "@/lib/retry"
import {
  Connection,
  PublicKey,
  TransactionMessage,
  VersionedTransaction,
} from "@solana/web3.js"
import { buildUsdcPaymentTransaction } from "@blink402/solana"

function TestPaymentContent() {
  const { ready, authenticated, login, logout, user, sendTransaction } = usePrivy()
  const { wallets } = useWallets()

  // Get the first Solana wallet
  const solanaWallet = wallets.find((w: any) => w.chainType === 'solana')
  const wallet = solanaWallet || wallets[0]

  // Get wallet address from wallets or linkedAccounts (same as WalletButton)
  const solanaAccount: any = user?.linkedAccounts?.find(
    (account: any) => account.type === 'wallet' && account.chainType === 'solana'
  )
  const connectedWallet = (solanaAccount as any)?.address || wallet?.address

  const [result, setResult] = useState<any>(null)
  const [error, setError] = useState<string | null>(null)
  const [logs, setLogs] = useState<string[]>([])
  const [isPaying, setIsPaying] = useState(false)

  const addLog = (message: string) => {
    setLogs((prev) => [...prev, `[${new Date().toLocaleTimeString()}] ${message}`])
  }

  const testPayment = async () => {
    setError(null)
    setResult(null)
    setLogs([])

    if (!authenticated || !connectedWallet) {
      setError("Please connect your wallet first")
      return
    }

    // Validate wallet address is not empty string
    if (!connectedWallet.trim()) {
      setError("Invalid wallet address - please reconnect your wallet")
      return
    }

    setIsPaying(true)

    try {
      addLog(`Connected wallet: ${connectedWallet}`)
      addLog("Step 1: Building Solana USDC transaction...")

      // Setup
      const connection = new Connection(
        process.env.NEXT_PUBLIC_SOLANA_RPC_URL || "https://api.mainnet-beta.solana.com",
        "confirmed"
      )

      const payer = new PublicKey(connectedWallet)
      const merchant = new PublicKey("Gk5mZUdomuc7JF9wAAioTSh8ajf98WsVLCyrofuvpUbM")
      const amountUsdc = 0.01 // 0.01 USDC

      // Build USDC payment transaction using shared utility
      // This creates a VersionedTransaction with exactly 3 instructions:
      // 1. ComputeBudgetProgram.setComputeUnitLimit (40,000 units)
      // 2. ComputeBudgetProgram.setComputeUnitPrice (1 microlamport)
      // 3. SPL Token Transfer (USDC from payer to merchant)
      // Uses PayAI fee payer to prevent Phantom Lighthouse MEV injection
      addLog("Step 2: Building USDC payment transaction...")
      const transaction = await buildUsdcPaymentTransaction({
        connection,
        payer,
        merchant,
        amountUsdc,
        network: 'mainnet-beta'
      })

      addLog("✅ Built VersionedTransaction with 3 instructions (PayAI fee payer)")
      addLog("🔑 Using PayAI fee payer to prevent Lighthouse MEV injection")

      addLog("Step 3: Signing transaction with wallet...")

      // Use standard Solana wallet adapter (window.solana)
      // @ts-ignore
      const solana = window.solana || window.phantom?.solana

      if (!solana || !solana.signTransaction) {
        throw new Error(
          "Solana wallet not found. " +
          "Please ensure Phantom, Solflare, or another Solana wallet is installed and connected."
        )
      }

      // Sign the VersionedTransaction
      // With designated fee payer, Phantom should NOT inject Lighthouse MEV protection!
      let signedTx: VersionedTransaction
      try {
        signedTx = await solana.signTransaction(transaction)
      } catch (signError: any) {
        addLog(`  ❌ Signing error: ${signError.message}`)
        throw new Error(`Failed to sign transaction: ${signError.message}`)
      }

      addLog(`✅ Transaction signed by wallet`)

      // CRITICAL: Verify wallet didn't inject extra instructions
      // VersionedTransaction doesn't have .instructions array - need to decompile message
      const decodedMessage = TransactionMessage.decompile(signedTx.message)
      const instructionCount = decodedMessage.instructions.length

      addLog(`🔍 POST-SIGN: Transaction has ${instructionCount} instruction(s)`)
      decodedMessage.instructions.forEach((ix, i) => {
        const programId = ix.programId.toBase58()
        addLog(`   Instruction ${i + 1}: ${programId}`)
      })

      // With 3 instructions (ComputeBudget + ComputeBudget + Transfer):
      // Expected: 3 instructions (matches ONCHAIN requirement)
      // With Lighthouse: 5 instructions (+ 2 Lighthouse MEV protection)
      if (instructionCount === 3) {
        addLog(`✅ Perfect! Transaction has 3 instructions (matches ONCHAIN requirement).`)
        addLog(`   Wallet did NOT inject Lighthouse MEV protection!`)
      } else if (instructionCount === 5) {
        addLog(`⚠️  Wallet injected 2 Lighthouse instructions (MEV protection enabled)`)
        addLog(`   ONCHAIN will likely reject this. Proceeding to see exact error...`)
      } else {
        addLog(`⚠️  Unexpected instruction count: ${instructionCount}`)
        addLog(`   Expected 3 (our instructions) or 5 (with Lighthouse). Got ${instructionCount}.`)
      }

      // Serialize the VersionedTransaction
      const serialized = signedTx.serialize()
      const base64Tx = Buffer.from(serialized).toString('base64')

      addLog("Step 4: Building x402 Payment Payload...")

      // ✅ MATCH ONCHAIN'S SDK EXACT FORMAT (simplified):
      // Their SDK uses a minimal x402 header - just transaction + network
      // ONCHAIN backend extracts payment details from the transaction itself
      const paymentPayload = {
        x402Version: 1,
        scheme: 'exact',
        network: 'solana',
        payload: {
          transaction: base64Tx  // ONCHAIN SDK only includes the transaction
        }
      }

      // Base64 encode the entire x402 payload for X-Payment header
      const xPaymentHeader = btoa(JSON.stringify(paymentPayload))

      console.log('[TEST] x402 Payload (ONCHAIN SDK format):', JSON.stringify(paymentPayload, null, 2))
      console.log('[TEST] X-Payment Header (base64):', xPaymentHeader)

      addLog("Step 5: Sending to ONCHAIN for verification & settlement...")

      // Send to backend with X-Payment header (x402 spec compliant)
      // ✨ Using retryFetch with exponential backoff for transient failures
      const response = await retryFetch(
        '/api/onchain/pay',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Payment': xPaymentHeader
          },
          body: JSON.stringify({
            sourceNetwork: 'solana',
            destinationNetwork: 'solana',
            expectedAmount: '0.01',
            expectedToken: 'USDC',
            recipientAddress: merchant.toBase58(),
            priority: 'balanced'
          })
        },
        {
          maxRetries: 3,
          initialDelayMs: 1000,
          onRetry: (attempt, error, delayMs) => {
            addLog(`⚠️  Retry attempt ${attempt}/3 after ${Math.round(delayMs)}ms: ${error.message}`)
          }
        }
      )

      const data = await response.json()

      if (!response.ok) {
        console.error('[ONCHAIN Payment Error]', {
          status: response.status,
          error: data.error,
          details: data.details
        })
        const errorMsg = data.details ? `${data.error}: ${JSON.stringify(data.details)}` : data.error
        throw new Error(errorMsg || 'Payment failed')
      }

      addLog("✅ Payment verified and settled by ONCHAIN!")
      setResult(data)

    } catch (err) {
      console.error('[Test Payment Error]', err)
      const message = err instanceof Error ? err.message : String(err)
      setError(message)
      addLog(`❌ Error: ${message}`)
    } finally {
      setIsPaying(false)
    }
  }

  return (
    <div className="min-h-screen bg-neon-black p-4 md:p-8">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="mb-12 text-center">
          <h1 className="text-4xl md:text-5xl font-bold text-white mb-4">
            ONCHAIN Payment Demo
          </h1>
          <p className="text-neon-blue-light text-lg max-w-2xl mx-auto">
            Test x402 payment protocol with your Solana wallet
          </p>
        </div>

        {/* Main Card */}
        <div className="mb-8 p-8 bg-neon-dark border-2 border-neon-blue-dark/40 rounded-lg shadow-[0_0_30px_rgba(90,180,255,0.15)]">
          {/* Wallet Connection Status */}
          <div className="mb-8 pb-8 border-b border-neon-blue-dark/30">
            <h2 className="text-2xl font-bold text-white mb-6 flex items-center gap-3">
              <span className="text-neon-blue-light">01</span>
              Wallet Connection
            </h2>
            {authenticated && connectedWallet ? (
              <div className="space-y-4">
                <div className="bg-black/40 p-4 rounded border border-neon-blue-dark/30">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                    <span className="text-green-400 text-sm font-medium">Connected</span>
                  </div>
                  <div className="font-mono text-sm text-neon-blue-light break-all">
                    {connectedWallet}
                  </div>
                </div>
                <button
                  onClick={logout}
                  className="btn-ghost text-sm"
                >
                  Disconnect Wallet
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="bg-yellow-500/5 border border-yellow-500/20 rounded-lg p-4">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 bg-yellow-500 rounded-full"></div>
                    <span className="text-yellow-400 text-sm font-medium">Please connect your wallet to continue</span>
                  </div>
                </div>
                <button
                  onClick={login}
                  disabled={!ready}
                  className="btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Connect Wallet
                </button>
              </div>
            )}
          </div>

          {/* Payment Test */}
          <div>
            <h2 className="text-2xl font-bold text-white mb-6 flex items-center gap-3">
              <span className="text-neon-blue-light">02</span>
              Execute Payment
            </h2>

            {authenticated && connectedWallet && (
              <div className="space-y-4 mb-6">
                <div className="grid md:grid-cols-2 gap-4">
                  <div className="bg-black/40 p-4 rounded border border-green-500/20">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-green-400 text-xs">✓</span>
                      <span className="text-green-400 text-xs font-medium">Your Wallet</span>
                    </div>
                    <div className="font-mono text-xs text-neon-blue-light">
                      {connectedWallet.substring(0, 12)}...{connectedWallet.substring(connectedWallet.length - 8)}
                    </div>
                  </div>
                  <div className="bg-black/40 p-4 rounded border border-green-500/20">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-green-400 text-xs">✓</span>
                      <span className="text-green-400 text-xs font-medium">Receiver Ready</span>
                    </div>
                    <div className="font-mono text-xs text-neon-blue-light">
                      5.15 USDC Available
                    </div>
                  </div>
                </div>
              </div>
            )}

            <button
              onClick={testPayment}
              disabled={isPaying || !authenticated}
              className="btn-primary w-full md:w-auto disabled:opacity-50 disabled:cursor-not-allowed text-lg py-4 px-8"
            >
              {isPaying ? (
                <span className="flex items-center gap-3 justify-center">
                  <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                  Processing Payment...
                </span>
              ) : (
                "Send $0.01 USDC Test Payment"
              )}
            </button>
          </div>
        </div>

        {/* Results Section */}
        {result && (
          <div className="mb-8 p-8 bg-neon-dark border-2 border-green-500/40 rounded-lg shadow-[0_0_30px_rgba(34,197,94,0.2)]">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-12 h-12 rounded-full bg-green-500/20 flex items-center justify-center">
                <span className="text-green-400 text-2xl">✓</span>
              </div>
              <h2 className="text-2xl font-bold text-green-400">
                Payment Successful
              </h2>
            </div>
            <div className="bg-black/60 rounded-lg overflow-hidden border border-green-500/20">
              <div className="p-3 bg-green-500/10 border-b border-green-500/20">
                <span className="text-green-400 text-xs font-mono font-medium">Response Data</span>
              </div>
              <pre className="font-mono text-xs text-white overflow-auto max-h-96 p-6">
                {JSON.stringify(result, null, 2)}
              </pre>
            </div>
          </div>
        )}

        {/* Error Section */}
        {error && (
          <div className="mb-8 p-8 bg-neon-dark border-2 border-red-500/40 rounded-lg shadow-[0_0_30px_rgba(239,68,68,0.2)]">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-12 h-12 rounded-full bg-red-500/20 flex items-center justify-center">
                <span className="text-red-400 text-2xl">✕</span>
              </div>
              <h2 className="text-2xl font-bold text-red-400">Payment Failed</h2>
            </div>
            <div className="bg-black/60 rounded-lg p-6 border border-red-500/20">
              <p className="font-mono text-sm text-white">{error}</p>
            </div>
          </div>
        )}

        {/* Execution Logs */}
        {logs.length > 0 && (
          <div className="mb-8 p-8 bg-neon-dark border-2 border-neon-blue-dark/40 rounded-lg">
            <h2 className="text-2xl font-bold text-white mb-6 flex items-center gap-3">
              <span className="text-neon-blue-light">03</span>
              Execution Log
            </h2>
            <div className="bg-black/60 rounded-lg overflow-hidden border border-neon-blue-dark/30">
              <div className="p-3 bg-neon-blue-dark/10 border-b border-neon-blue-dark/30">
                <span className="text-neon-blue-light text-xs font-mono font-medium">Transaction Steps</span>
              </div>
              <div className="font-mono text-xs space-y-1 text-neon-blue-light max-h-96 overflow-auto p-6">
                {logs.map((log, i) => (
                  <div key={i} className="leading-relaxed">{log}</div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default function TestOnchainPage() {
  // No need for OnchainConnect here - it's already provided in layout.tsx
  return <TestPaymentContent />
}
