"use client"

import { useState } from "react"
import { usePrivy, useWallets } from "@privy-io/react-auth"
import { useWalletClient } from "wagmi"
import { sendUsdcPayment, getUsdcBalance, type ChainNetwork } from "@blink402/evm"
import { retryFetch } from "@/lib/retry"

function TestBasePaymentContent() {
  const { ready, authenticated, login, logout, user } = usePrivy()
  const { wallets } = useWallets()
  const { data: walletClient } = useWalletClient()

  // Get the first Ethereum wallet
  const ethWallet = wallets.find((w: any) => w.chainType === 'ethereum')
  const wallet = ethWallet || wallets[0]

  // Get wallet address from wallets or linkedAccounts
  const ethAccount: any = user?.linkedAccounts?.find(
    (account: any) => account.type === 'wallet' && account.chainType === 'ethereum'
  )
  const connectedWallet = wallet?.address || (ethAccount as any)?.address

  const [result, setResult] = useState<any>(null)
  const [error, setError] = useState<string | null>(null)
  const [logs, setLogs] = useState<string[]>([])
  const [isPaying, setIsPaying] = useState(false)
  const [balance, setBalance] = useState<number | null>(null)

  const addLog = (message: string) => {
    setLogs((prev) => [...prev, `[${new Date().toLocaleTimeString()}] ${message}`])
  }

  const checkBalance = async () => {
    if (!connectedWallet) {
      setError("Please connect your wallet first")
      return
    }

    try {
      addLog("Checking USDC balance on Base...")
      const usdcBalance = await getUsdcBalance(
        connectedWallet as `0x${string}`,
        'mainnet' // Use 'testnet' for Base Sepolia
      )
      setBalance(usdcBalance)
      addLog(`✅ Balance: ${usdcBalance} USDC`)
    } catch (err: any) {
      setError(err.message)
      addLog(`❌ Error: ${err.message}`)
    }
  }

  const testPayment = async () => {
    setError(null)
    setResult(null)
    setLogs([])

    if (!authenticated || !connectedWallet) {
      setError("Please connect your wallet first")
      return
    }

    if (!walletClient) {
      setError("Wallet client not ready. Please ensure you're connected to Base network.")
      return
    }

    // Validate wallet address
    if (!connectedWallet.trim() || !connectedWallet.startsWith('0x')) {
      setError("Invalid Ethereum address - please reconnect your wallet")
      return
    }

    setIsPaying(true)

    try {
      addLog(`Connected wallet: ${connectedWallet}`)
      addLog("Step 1: Building Base USDC payment transaction...")

      // Setup
      const payer = connectedWallet as `0x${string}`
      const merchant = "0xC61e6F5a62e0bCd2Be2DaE2D629e775a23Dda4Bd" as `0x${string}` // Test merchant address
      const amountUsdc = 0.01 // 0.01 USDC
      const network: ChainNetwork = 'mainnet' // Use 'testnet' for Base Sepolia

      addLog("Step 2: Checking USDC balance...")
      const usdcBalance = await getUsdcBalance(payer, network)
      addLog(`Current balance: ${usdcBalance} USDC`)

      if (usdcBalance < amountUsdc) {
        throw new Error(
          `Insufficient USDC balance. You have ${usdcBalance} USDC but need ${amountUsdc} USDC.`
        )
      }

      addLog("Step 3: Building and sending USDC transfer transaction...")
      addLog("🔑 Using ERC-20 transfer on Base chain")

      // Build, sign, and send USDC payment transaction
      // This creates an ERC-20 transfer transaction that:
      // 1. Calls USDC contract transfer() function
      // 2. Transfers from payer to merchant
      // 3. Uses wagmi wallet client for signing
      const txHash = await sendUsdcPayment({
        walletClient,
        payer,
        merchant,
        amountUsdc,
        network
      })

      addLog(`✅ Transaction sent! Hash: ${txHash}`)
      addLog("Step 4: Verifying payment with ONCHAIN x402...")

      // Build x402 payment payload for ONCHAIN
      const paymentPayload = {
        x402Version: 1,
        scheme: 'exact-evm',
        network: 'base',
        payload: {
          transactionHash: txHash
        }
      }

      const xPaymentHeader = btoa(JSON.stringify(paymentPayload))
      addLog("Step 5: Calling backend with X-Payment header...")

      // Call backend with x402 payment header
      const apiResponse = await retryFetch('/api/onchain/pay', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Payment': xPaymentHeader,
        },
        body: JSON.stringify({
          slug: 'test-base-payment',
          merchantAddress: merchant,
          amount: amountUsdc,
          network: 'base'
        })
      })

      if (!apiResponse.ok) {
        const errorData = await apiResponse.json()
        throw new Error(errorData.error || 'Payment verification failed')
      }

      const responseData = await apiResponse.json()
      setResult(responseData)

      addLog("✅ Payment verified and settled!")
      addLog("🎉 Test completed successfully!")

      // Update balance after payment
      setTimeout(() => checkBalance(), 3000)
    } catch (err: any) {
      console.error("Payment error:", err)
      setError(err.message || "Payment failed")
      addLog(`❌ Error: ${err.message}`)
    } finally {
      setIsPaying(false)
    }
  }

  return (
    <div className="min-h-screen bg-neon-dark py-12 px-4">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-neon-white mb-2">
            Base Chain Payment Test
          </h1>
          <p className="text-neon-grey">
            Test USDC payments on Base using EVM wallets (MetaMask, Coinbase Wallet, etc.)
          </p>
        </div>

        {/* Wallet Connection */}
        <div className="bg-neon-black border border-dashed border-neon-blue-dark rounded-lg p-6 mb-6">
          <h2 className="text-xl font-bold text-neon-white mb-4">Wallet Connection</h2>

          {!ready ? (
            <p className="text-neon-grey">Loading...</p>
          ) : !authenticated ? (
            <div>
              <p className="text-neon-grey mb-4">
                Connect your Ethereum wallet to test Base payments
              </p>
              <button
                onClick={login}
                className="btn-primary"
              >
                Connect Wallet
              </button>
            </div>
          ) : (
            <div>
              <p className="text-neon-grey mb-2">
                <span className="text-neon-white font-mono">
                  {connectedWallet ? `${connectedWallet.slice(0, 6)}...${connectedWallet.slice(-4)}` : 'No address'}
                </span>
              </p>
              {balance !== null && (
                <p className="text-neon-grey mb-2">
                  Balance: <span className="text-neon-white">{balance} USDC</span>
                </p>
              )}
              <div className="flex gap-2">
                <button
                  onClick={checkBalance}
                  className="btn-ghost"
                >
                  Check Balance
                </button>
                <button
                  onClick={logout}
                  className="btn-ghost"
                >
                  Disconnect
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Test Payment */}
        <div className="bg-neon-black border border-dashed border-neon-blue-dark rounded-lg p-6 mb-6">
          <h2 className="text-xl font-bold text-neon-white mb-4">Test Payment</h2>
          <p className="text-neon-grey mb-4">
            This will send 0.01 USDC on Base mainnet to a test merchant address.
          </p>

          <button
            onClick={testPayment}
            disabled={!authenticated || isPaying}
            className="btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isPaying ? 'Processing Payment...' : 'Send Test Payment (0.01 USDC)'}
          </button>
        </div>

        {/* Logs */}
        {logs.length > 0 && (
          <div className="bg-neon-black border border-dashed border-neon-blue-dark rounded-lg p-6 mb-6">
            <h2 className="text-xl font-bold text-neon-white mb-4">Logs</h2>
            <div className="font-mono text-sm space-y-1">
              {logs.map((log, i) => (
                <div key={i} className="text-neon-grey">
                  {log}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="bg-red-900/20 border border-red-500 rounded-lg p-6 mb-6">
            <h2 className="text-xl font-bold text-red-400 mb-2">Error</h2>
            <p className="text-red-300 font-mono text-sm">{error}</p>
          </div>
        )}

        {/* Result */}
        {result && (
          <div className="bg-green-900/20 border border-green-500 rounded-lg p-6">
            <h2 className="text-xl font-bold text-green-400 mb-2">Success!</h2>
            <pre className="text-green-300 font-mono text-sm overflow-auto">
              {JSON.stringify(result, null, 2)}
            </pre>
          </div>
        )}

        {/* Info */}
        <div className="bg-neon-black border border-dashed border-neon-blue-dark rounded-lg p-6 mt-6">
          <h2 className="text-xl font-bold text-neon-white mb-4">Test Details</h2>
          <ul className="text-neon-grey space-y-2 text-sm">
            <li>• Network: Base Mainnet (Chain ID: 8453)</li>
            <li>• Token: USDC (0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913)</li>
            <li>• Amount: 0.01 USDC</li>
            <li>• Test Merchant: 0xC61e6F5a62e0bCd2Be2DaE2D629e775a23Dda4Bd</li>
            <li>• Payment Protocol: ONCHAIN x402 (exact-evm scheme)</li>
          </ul>
        </div>
      </div>
    </div>
  )
}

export default function TestBasePage() {
  return <TestBasePaymentContent />
}
