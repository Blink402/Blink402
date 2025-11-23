"use client"

import { useEffect, useState } from "react"
import { usePrivy, useWallets } from "@privy-io/react-auth"
import { mountScramble } from "@/lib/scramble"
import { mountReveals } from "@/lib/reveal"
import { cn } from "@/lib/utils"
import NeonDivider from "@/components/NeonDivider"
import Link from "next/link"
import { SlotMachine } from "@/components/SlotMachine"
import type { SpinResult } from "@/lib/types"
import {
  PublicKey,
  Connection,
  TransactionMessage,
  VersionedTransaction,
  ComputeBudgetProgram,
} from '@solana/web3.js'
import {
  getAssociatedTokenAddress,
  createTransferCheckedInstruction,
  getAccount,
} from '@solana/spl-token'
import { Alert, AlertDescription } from "@/components/ui/alert"
import { applyB402Discount, getB402HolderTier, getTierDisplayInfo, type TokenHolderTier } from "@blink402/solana"

// Use relative path to leverage Next.js rewrites (proxied to API backend)
const API_BASE_URL = ''
const SOLANA_RPC_URL = process.env.NEXT_PUBLIC_SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com'
const USDC_MINT = new PublicKey('EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v')
const USDC_DECIMALS = 6
const PAYAI_FEE_PAYER = new PublicKey('2wKupLR9q6wXYppw8Gr2NvWxKBUqm4PPJKkQfoxHDBg4')

type GameState = 'idle' | 'paying' | 'ready-to-spin' | 'error'

interface BlinkData {
  id: string
  slug: string
  title: string
  description: string
  price_usdc: string
  payout_wallet: string
  payment_token: 'SOL' | 'USDC'
  payment_mode: 'charge' | 'reward'
}

export default function SlotMachinePage() {
  const { ready, authenticated, login, user } = usePrivy()
  const { wallets } = useWallets()
  const [gameState, setGameState] = useState<GameState>('idle')
  const [error, setError] = useState<string | null>(null)
  const [lastReference, setLastReference] = useState<string | null>(null)
  const [xPaymentHeader, setXPaymentHeader] = useState<string | null>(null)
  const [isSpinning, setIsSpinning] = useState(false)
  const [blink, setBlink] = useState<BlinkData | null>(null)

  // B402 token holder state
  const [b402Tier, setB402Tier] = useState<TokenHolderTier>('NONE')
  const [basePrice] = useState(0.10) // Original price: 0.10 USDC
  const [finalPrice, setFinalPrice] = useState(0.10)
  const [savings, setSavings] = useState(0)
  const [discountPercent, setDiscountPercent] = useState(0)

  // Get wallet address (same pattern as checkout page)
  const wallet = wallets[0]
  const solanaAccount: any = user?.linkedAccounts?.find(
    (account: any) => account.type === 'wallet' && account.chainType === 'solana'
  )
  const connectedWallet = (solanaAccount as any)?.address || wallet?.address
  const connected = authenticated && !!connectedWallet

  // Fetch blink data on mount
  useEffect(() => {
    console.log('Fetching blink data from:', `${API_BASE_URL}/blinks/slot-machine`)
    fetch(`${API_BASE_URL}/blinks/slot-machine`)
      .then(res => {
        console.log('Blink fetch response:', res.status, res.statusText)
        return res.json()
      })
      .then(data => {
        console.log('Blink data received:', data)
        // API returns {success: true, data: {...}} or {blink: {...}}
        const blinkData = data.data || data.blink
        if (blinkData) {
          setBlink(blinkData)
          console.log('Blink set successfully:', blinkData.payout_wallet)
        } else {
          console.error('No blink in response:', data)
          setError('Failed to load slot machine configuration')
        }
      })
      .catch(err => {
        console.error('Failed to load blink data:', err)
        setError('Failed to load slot machine. Please refresh the page.')
      })
  }, [])

  // Debug wallet state
  useEffect(() => {
    console.log('Wallet debug:', {
      ready,
      authenticated,
      walletsCount: wallets.length,
      wallet: wallet?.address,
      solanaAccount: solanaAccount?.address,
      connectedWallet,
      connected,
      linkedAccounts: user?.linkedAccounts,
    })
  }, [ready, authenticated, wallets, connectedWallet, connected, user])

  // Fetch B402 holder tier and apply discount when wallet connects
  useEffect(() => {
    const fetchB402Discount = async () => {
      if (!connected || !connectedWallet) {
        // Reset to no tier if wallet disconnects
        setB402Tier('NONE')
        setFinalPrice(basePrice)
        setSavings(0)
        setDiscountPercent(0)
        return
      }

      try {
        console.log('Fetching B402 holder tier for wallet:', connectedWallet)

        // Get tier and apply discount
        const discount = await applyB402Discount(basePrice, connectedWallet, 'slotMachine')

        console.log('B402 discount applied:', {
          tier: discount.tier,
          originalPrice: discount.originalPrice,
          discountedPrice: discount.discountedPrice,
          savings: discount.savings,
          discountPercent: discount.discountPercent
        })

        setB402Tier(discount.tier)
        setFinalPrice(discount.discountedPrice)
        setSavings(discount.savings)
        setDiscountPercent(discount.discountPercent)
      } catch (err) {
        console.error('Failed to fetch B402 tier:', err)
        // Fail gracefully - use base price
        setB402Tier('NONE')
        setFinalPrice(basePrice)
        setSavings(0)
        setDiscountPercent(0)
      }
    }

    fetchB402Discount()
  }, [connected, connectedWallet, basePrice])

  useEffect(() => {
    mountScramble()
    mountReveals()
  }, [])

  const handlePlayNow = async () => {
    if (!ready) return

    // If not authenticated, trigger login
    if (!authenticated) {
      login()
      return
    }

    // If authenticated but no wallet, show error
    if (!connected) {
      setError('No Solana wallet found. Please reconnect.')
      return
    }

    // Start payment flow
    await handlePayment()
  }

  const handlePayment = async () => {
    setGameState('paying')
    setError(null)

    console.log('handlePayment called - wallet state:', {
      wallet: wallet?.address,
      connectedWallet,
      wallets: wallets.length,
      authenticated,
      blinkLoaded: !!blink,
    })

    try {
      // FIX: Early validation with clearer error messages
      if (!authenticated) {
        throw new Error('Wallet not authenticated. Please connect your wallet.')
      }

      if (!connectedWallet) {
        console.error('No connected wallet address')
        throw new Error('Wallet not connected. Please reconnect.')
      }

      if (!blink) {
        throw new Error('Slot machine data not loaded. Please refresh the page.')
      }

      // Get the ACTUAL connected wallet from window.solana (same as checkout page)
      // @ts-ignore
      const solana = window.solana || window.phantom?.solana

      if (!solana || !solana.publicKey) {
        throw new Error(
          "No Solana wallet found. Please ensure Phantom, Solflare, or another Solana wallet is installed and connected."
        )
      }

      // FIX: Verify wallet hasn't changed mid-session
      const actualWalletAddress = solana.publicKey.toBase58()
      console.log('Using actual wallet address from window.solana:', {
        actualWalletAddress,
        privyAddress: connectedWallet,
        matches: actualWalletAddress === connectedWallet
      })

      // Warn if mismatch but continue (use actual wallet)
      if (actualWalletAddress !== connectedWallet) {
        console.warn('Wallet address mismatch! Using window.solana address instead of Privy address', {
          windowSolana: actualWalletAddress,
          privyAddress: connectedWallet
        })
      }

      const connection = new Connection(SOLANA_RPC_URL, 'confirmed')

      // Use the wallet's actual public key (this is guaranteed to be on-curve)
      const payer = solana.publicKey  // Use the actual PublicKey object from wallet
      const merchant = new PublicKey(blink.payout_wallet) // Use merchant address from database

      console.log('Building transaction for merchant:', {
        merchant: merchant.toBase58(),
        amount: `${finalPrice} USDC`,
        originalAmount: `${basePrice} USDC`,
        tier: b402Tier,
        savings: savings
      })
      const amountUsdc = finalPrice // Use discounted price if B402 holder
      const amountAtomic = BigInt(Math.round(amountUsdc * 1_000_000))

      // Get token accounts
      const payerATA = await getAssociatedTokenAddress(USDC_MINT, payer)
      const merchantATA = await getAssociatedTokenAddress(USDC_MINT, merchant)

      // Verify payer has enough USDC
      try {
        const payerAccount = await getAccount(connection, payerATA)
        const balance = Number(payerAccount.amount) / 1_000_000

        if (balance < amountUsdc) {
          throw new Error(`Insufficient USDC. You have ${balance.toFixed(2)} USDC but need ${amountUsdc} USDC.`)
        }
      } catch (err: any) {
        if (err.message.includes('could not find')) {
          throw new Error('No USDC account found. Please add USDC to your wallet first.')
        }
        throw err
      }

      // Get latest blockhash
      const { blockhash } = await connection.getLatestBlockhash('confirmed')

      // Build exactly 3 instructions (ONCHAIN EXACT-SVM requirement)
      const instructions = [
        ComputeBudgetProgram.setComputeUnitLimit({ units: 40_000 }),
        ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 1 }),
        createTransferCheckedInstruction(
          payerATA,
          USDC_MINT,
          merchantATA,
          payer,
          BigInt(amountAtomic.toString()),
          USDC_DECIMALS
        )
      ]

      // Build VersionedTransaction with PayAI fee payer
      const messageV0 = new TransactionMessage({
        payerKey: PAYAI_FEE_PAYER,
        recentBlockhash: blockhash,
        instructions,
      }).compileToV0Message()

      const transaction = new VersionedTransaction(messageV0)

      // Sign transaction
      // @ts-ignore - Privy wallet provider has signTransaction method
      const signedTx = await solana.signTransaction(transaction)
      const base64Tx = Buffer.from(signedTx.serialize()).toString('base64')

      // Build x402 payment payload
      const paymentPayload = {
        x402Version: 1,
        scheme: 'exact',
        network: 'solana',
        payload: {
          transaction: base64Tx
        }
      }

      const xPaymentHeader = btoa(JSON.stringify(paymentPayload))
      const reference = crypto.randomUUID()

      // Store payment data for spin request
      setLastReference(reference)
      setXPaymentHeader(xPaymentHeader)

      console.log('Payment signed, ready to spin with reference:', reference)

      // Payment successful, ready to spin
      // The X-Payment header will be sent with the spin request
      setGameState('ready-to-spin')

    } catch (err: any) {
      console.error('Payment error:', err)
      setError(err.message || 'Payment failed. Please try again.')
      setGameState('error')
    }
  }

  const handleSpin = async (): Promise<SpinResult> => {
    // Prevent duplicate calls
    if (isSpinning) {
      console.warn('Spin already in progress, ignoring duplicate call')
      throw new Error('Spin already in progress')
    }

    setIsSpinning(true)
    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      }

      // Include X-Payment header if available
      if (xPaymentHeader) {
        headers['X-Payment'] = xPaymentHeader
        console.log('Including X-Payment header in spin request:', {
          reference: lastReference,
          headerLength: xPaymentHeader.length,
          headerPreview: xPaymentHeader.substring(0, 50) + '...'
        })
      } else {
        console.warn('No X-Payment header available for spin request!')
      }

      console.log('Sending spin request with headers:', Object.keys(headers))

      const response = await fetch(`${API_BASE_URL}/api/slots/spin`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          reference: lastReference || '',
          payer: connectedWallet || '',
        }),
      })

      // FIX: Better error handling for non-200 responses
      if (!response.ok) {
        let errorMessage = 'Spin failed'
        try {
          const errorData = await response.json()
          errorMessage = errorData.error || errorData.details || errorMessage
        } catch {
          // If response is not JSON, use status text
          errorMessage = `Spin failed: ${response.statusText}`
        }
        console.error('Spin request failed:', {
          status: response.status,
          statusText: response.statusText,
          errorMessage
        })
        throw new Error(errorMessage)
      }

      // FIX: Validate JSON response structure
      let spinResult: SpinResult
      try {
        spinResult = await response.json()

        // Validate required fields
        if (!spinResult.success || !spinResult.reels) {
          throw new Error('Invalid spin result format')
        }
      } catch (parseError) {
        console.error('Failed to parse spin result:', parseError)
        throw new Error('Invalid response from server. Please try again.')
      }

      return spinResult
    } catch (err) {
      console.error('Spin error:', err)
      // Re-throw to let SlotMachine component handle it
      throw err
    } finally {
      setIsSpinning(false)
    }
  }

  const handlePlayAgain = async () => {
    console.log('Play Again clicked - current state:', {
      authenticated,
      connectedWallet,
      gameState
    })

    // FIX: Reset game state properly but keep wallet connected
    setLastReference(null)
    setXPaymentHeader(null)
    setError(null)
    // Don't reset gameState to 'idle' - stay in 'paying' to prevent re-render issues

    // FIX: Verify wallet is still connected before triggering payment
    // @ts-ignore
    const solana = window.solana || window.phantom?.solana

    if (!solana || !solana.publicKey) {
      // Wallet disconnected - need to reconnect
      console.error('Wallet disconnected, triggering login')
      setError('Wallet disconnected. Please reconnect.')
      setGameState('idle')
      login() // Trigger Privy login
      return
    }

    // Wallet still connected - proceed with new payment
    console.log('Wallet still connected, triggering new payment')
    await handlePayment()
  }

  const payoutTable = [
    { combo: '🎰🎰🎰', multiplier: '50x', payout: '5.0 USDC', chance: '0.2%' },
    { combo: '💎💎💎', multiplier: '20x', payout: '2.0 USDC', chance: '1%' },
    { combo: '⚡⚡⚡', multiplier: '10x', payout: '1.0 USDC', chance: '3%' },
    { combo: '🍊🍊🍊', multiplier: '5x', payout: '0.50 USDC', chance: '8%' },
    { combo: '🍋🍋🍋', multiplier: '2x', payout: '0.20 USDC', chance: '15%' },
    { combo: '🍒🍒🍒', multiplier: '1.5x', payout: '0.15 USDC', chance: '20%' },
    { combo: 'Any 2 Match', multiplier: '0.5x', payout: '0.05 USDC', chance: '30%' },
  ]

  return (
    <main className="min-h-screen">
      <div className="container mx-auto px-4 py-12">
        <div className="max-w-5xl mx-auto">
          {/* Back button */}
          <div className="mb-8" data-reveal>
            <Link
              href="/catalog"
              className="text-[--neon-grey] hover:text-[--neon-white] text-sm transition-colors inline-flex items-center gap-2"
            >
              ← Back to Catalog
            </Link>
          </div>

          {/* Hero Section */}
          <div className="text-center mb-12" data-reveal>
            <h1
              className="text-5xl md:text-6xl font-light text-[--neon-white] mb-4"
              data-scramble
              style={{
                textShadow: "0 0 20px rgba(90, 180, 255, 0.8)"
              }}
            >
              Lucky Slot Machine
            </h1>
            <p className="text-xl text-[--neon-grey] mb-2">
              Spin the reels for a chance to win up to 50x your bet
            </p>
            <div className="flex items-center justify-center gap-4 flex-wrap text-sm">
              <div className="flex items-center gap-2">
                <span className="font-sans text-[--neon-grey]">Cost:</span>
                {savings > 0 ? (
                  <div className="flex items-center gap-2">
                    <span className="text-[--neon-grey] font-mono line-through">{basePrice.toFixed(2)} USDC</span>
                    <span className="text-[--neon-blue-light] font-mono font-bold">{finalPrice.toFixed(2)} USDC</span>
                    <span className="text-green-400 font-mono text-xs">(-{discountPercent}%)</span>
                  </div>
                ) : (
                  <span className="text-[--neon-blue-light] font-mono font-bold">{finalPrice.toFixed(2)} USDC</span>
                )}
              </div>
              <span className="text-[--neon-grey]">•</span>
              <div className="flex items-center gap-2">
                <span className="font-sans text-[--neon-grey]">Max Win:</span>
                <span className="text-[--neon-blue-light] font-mono font-bold">5.0 USDC</span>
              </div>
            </div>

            {/* B402 Tier Badge */}
            {connected && b402Tier !== 'NONE' && (
              <div className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-lg border-2 border-dashed border-green-500/60 bg-green-900/20">
                <span className="text-2xl">{getTierDisplayInfo(b402Tier).icon}</span>
                <div className="text-left">
                  <div className="text-green-400 font-mono text-sm font-bold">{getTierDisplayInfo(b402Tier).label}</div>
                  <div className="text-green-300 font-mono text-xs">
                    {savings > 0 && `Save ${savings.toFixed(4)} USDC per spin!`}
                  </div>
                </div>
              </div>
            )}
          </div>

          <NeonDivider />

          {/* Game Area */}
          <div className="my-12" data-reveal>
            {gameState === 'ready-to-spin' ? (
              // Show slot machine after payment
              <div className="space-y-6">
                <div
                  className={cn(
                    "p-4 rounded-lg text-center",
                    "border-2 border-dashed border-green-500/60",
                    "bg-[--neon-black]"
                  )}
                  style={{
                    boxShadow: "0 0 16px rgba(34, 197, 94, 0.3), 0 0 32px rgba(34, 197, 94, 0.15)"
                  }}
                >
                  <div className="text-green-400 font-mono text-sm font-bold flex items-center justify-center gap-2">
                    <span className="inline-block w-3 h-3 bg-green-400 rounded-full animate-pulse" />
                    ✓ Payment successful! Ready to spin...
                  </div>
                </div>

                <SlotMachine
                  key={lastReference || 'default'}
                  onSpin={handleSpin}
                  onPlayAgain={handlePlayAgain}
                  disabled={isSpinning}
                />
              </div>
            ) : (
              // Show preview reels and play button
              <>
                <div className="grid grid-cols-3 gap-6 max-w-lg mx-auto mb-10">
                  {['🎰', '💎', '⚡'].map((symbol, i) => (
                    <div
                      key={i}
                      className={cn(
                        "relative h-32 w-full overflow-hidden rounded-lg",
                        "border-2 border-dashed border-[--neon-blue-light]",
                        "bg-gradient-to-br from-[--neon-black] to-[--neon-dark]",
                        "flex items-center justify-center",
                        "transition-all duration-300 hover:scale-110 hover:rotate-3",
                        "group cursor-pointer"
                      )}
                      style={{
                        boxShadow: "0 0 16px rgba(90, 180, 255, 0.5), 0 0 32px rgba(90, 180, 255, 0.25)",
                        animation: `float ${3 + i * 0.5}s ease-in-out infinite`
                      }}
                    >
                      <div
                        className="text-6xl font-bold transition-transform group-hover:scale-125"
                        style={{
                          textShadow: "0 0 20px rgba(90, 180, 255, 0.8), 0 0 40px rgba(90, 180, 255, 0.4)"
                        }}
                      >
                        {symbol}
                      </div>
                    </div>
                  ))}
                </div>

                <style jsx>{`
                  @keyframes float {
                    0%, 100% { transform: translateY(0px); }
                    50% { transform: translateY(-10px); }
                  }
                `}</style>

                {error && (
                  <div
                    className={cn(
                      "mb-6 p-4 rounded-lg",
                      "border-2 border-dashed border-red-500/60",
                      "bg-[--neon-black]"
                    )}
                    style={{
                      boxShadow: "0 0 12px rgba(239, 68, 68, 0.3), 0 0 24px rgba(239, 68, 68, 0.15)"
                    }}
                  >
                    <div className="text-red-400 font-mono text-sm text-center">
                      ✕ {error}
                    </div>
                  </div>
                )}

                {connected && connectedWallet && (
                  <div
                    className={cn(
                      "mb-6 p-3 rounded-lg",
                      "border-2 border-dashed border-[--neon-blue-light]/60",
                      "bg-[--neon-black]"
                    )}
                    style={{
                      boxShadow: "0 0 12px rgba(90, 180, 255, 0.3), 0 0 24px rgba(90, 180, 255, 0.15)"
                    }}
                  >
                    <div className="text-[--neon-blue-light] font-mono text-sm text-center flex items-center justify-center gap-2">
                      <span className="inline-block w-2 h-2 bg-[--neon-blue-light] rounded-full animate-pulse" />
                      Connected: {connectedWallet.slice(0, 4)}...{connectedWallet.slice(-4)}
                    </div>
                  </div>
                )}

                <div className="text-center">
                  <button
                    onClick={handlePlayNow}
                    disabled={!ready || gameState === 'paying' || !blink}
                    className={cn(
                      "relative inline-block py-5 px-16 rounded-lg font-mono text-2xl font-bold",
                      "border-2 border-dashed overflow-hidden group",
                      "transition-all duration-300",
                      (!ready || gameState === 'paying' || !blink)
                        ? "border-[--neon-grey] bg-[--neon-dark] text-[--neon-grey] cursor-not-allowed"
                        : "border-[--neon-blue-light] bg-[--neon-black] text-[--neon-white] hover:bg-[--neon-blue-light] hover:text-[--neon-black] hover:scale-[1.05] active:scale-[0.98]"
                    )}
                    style={
                      ready && gameState !== 'paying' && blink
                        ? {
                            boxShadow: "0 0 24px rgba(90, 180, 255, 0.7), 0 0 48px rgba(90, 180, 255, 0.4), inset 0 0 12px rgba(90, 180, 255, 0.15)",
                            animation: "pulse-glow 2s ease-in-out infinite"
                          }
                        : undefined
                    }
                  >
                    {!blink ? (
                      <span className="flex items-center justify-center gap-3">
                        <span className="inline-block w-5 h-5 border-2 border-[--neon-grey] border-t-transparent rounded-full animate-spin" />
                        Loading...
                      </span>
                    ) : gameState === 'paying' ? (
                      <span className="flex items-center justify-center gap-3">
                        <span className="inline-block w-5 h-5 border-2 border-[--neon-grey] border-t-transparent rounded-full animate-spin" />
                        Processing...
                      </span>
                    ) : authenticated ? (
                      `💰 PAY ${finalPrice.toFixed(2)} USDC & PLAY${savings > 0 ? ` (${discountPercent}% OFF!)` : ''}`
                    ) : (
                      '🎰 CONNECT WALLET'
                    )}
                  </button>
                </div>

                <style jsx>{`
                  @keyframes pulse-glow {
                    0%, 100% {
                      box-shadow: 0 0 24px rgba(90, 180, 255, 0.7), 0 0 48px rgba(90, 180, 255, 0.4), inset 0 0 12px rgba(90, 180, 255, 0.15);
                    }
                    50% {
                      box-shadow: 0 0 32px rgba(90, 180, 255, 0.9), 0 0 64px rgba(90, 180, 255, 0.6), inset 0 0 16px rgba(90, 180, 255, 0.2);
                    }
                  }
                `}</style>
              </>
            )}
          </div>

          <NeonDivider />

          {/* Payout Table */}
          <div className="my-12" data-reveal>
            <h2
              className="text-3xl font-light text-[--neon-white] mb-6 text-center"
              style={{
                textShadow: "0 0 12px rgba(90, 180, 255, 0.6)"
              }}
            >
              Payout Table
            </h2>

            <div
              className={cn(
                "relative rounded-lg p-6",
                "border-2 border-dashed border-[--neon-blue-light]",
                "bg-[--neon-dark]"
              )}
              style={{
                boxShadow: "0 0 16px rgba(90, 180, 255, 0.3), 0 0 32px rgba(90, 180, 255, 0.15)"
              }}
            >
              <div className="relative space-y-3">
                {payoutTable.map((row, i) => (
                  <div
                    key={i}
                    className={cn(
                      "grid grid-cols-4 gap-4 p-4 rounded-lg",
                      "border-2 border-dashed border-[--neon-grey]/50",
                      "bg-[--neon-black]",
                      "hover:border-[--neon-blue-light] hover:bg-[--neon-dark]",
                      "transition-all duration-200 hover:scale-[1.02]",
                      "cursor-default"
                    )}
                  >
                    <div className="text-2xl font-bold flex items-center">{row.combo}</div>
                    <div className="text-[--neon-blue-light] font-mono font-bold flex items-center">
                      {row.multiplier}
                    </div>
                    <div className="text-[--neon-white] font-mono flex items-center">{row.payout}</div>
                    <div className="text-[--neon-grey] text-sm flex items-center justify-end">{row.chance}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <NeonDivider />

          {/* Features */}
          <div className="my-12 grid md:grid-cols-3 gap-6" data-reveal>
            <div
              className={cn(
                "relative p-6 rounded-lg text-center group",
                "border-2 border-dashed border-[--neon-blue-light]",
                "bg-gradient-to-br from-[--neon-dark] to-[--neon-black]",
                "hover:scale-105 transition-all duration-300 cursor-pointer"
              )}
              style={{
                boxShadow: "0 0 16px rgba(90, 180, 255, 0.3), 0 0 32px rgba(90, 180, 255, 0.15)"
              }}
            >
              <div className="relative">
                <div className="text-5xl mb-4 transition-transform group-hover:scale-110">🔒</div>
                <h3 className="text-xl font-bold text-[--neon-white] mb-3" style={{
                  textShadow: "0 0 10px rgba(90, 180, 255, 0.5)"
                }}>
                  Provably Fair
                </h3>
                <p className="text-sm text-[--neon-grey] leading-relaxed">
                  Every spin uses SHA-256 cryptographic hashing. Verify results independently.
                </p>
              </div>
            </div>

            <div
              className={cn(
                "relative p-6 rounded-lg text-center group",
                "border-2 border-dashed border-[--neon-blue-light]",
                "bg-gradient-to-br from-[--neon-dark] to-[--neon-black]",
                "hover:scale-105 transition-all duration-300 cursor-pointer"
              )}
              style={{
                boxShadow: "0 0 16px rgba(90, 180, 255, 0.3), 0 0 32px rgba(90, 180, 255, 0.15)"
              }}
            >
              <div className="relative">
                <div className="text-5xl mb-4 transition-transform group-hover:scale-110">⚡</div>
                <h3 className="text-xl font-bold text-[--neon-white] mb-3" style={{
                  textShadow: "0 0 10px rgba(90, 180, 255, 0.5)"
                }}>
                  Instant Payouts
                </h3>
                <p className="text-sm text-[--neon-grey] leading-relaxed">
                  Win instantly! Payouts are sent directly to your wallet in seconds.
                </p>
              </div>
            </div>

            <div
              className={cn(
                "relative p-6 rounded-lg text-center group",
                "border-2 border-dashed border-[--neon-blue-light]",
                "bg-gradient-to-br from-[--neon-dark] to-[--neon-black]",
                "hover:scale-105 transition-all duration-300 cursor-pointer"
              )}
              style={{
                boxShadow: "0 0 16px rgba(90, 180, 255, 0.3), 0 0 32px rgba(90, 180, 255, 0.15)"
              }}
            >
              <div className="relative">
                <div className="text-5xl mb-4 transition-transform group-hover:scale-110">📊</div>
                <h3 className="text-xl font-bold text-[--neon-white] mb-3" style={{
                  textShadow: "0 0 10px rgba(90, 180, 255, 0.5)"
                }}>
                  98% RTP
                </h3>
                <p className="text-sm text-[--neon-grey] leading-relaxed">
                  Industry-leading return to player. Fair odds, player-friendly house edge.
                </p>
              </div>
            </div>
          </div>

          <NeonDivider />

          {/* How to Play */}
          <div className="my-12" data-reveal>
            <h2
              className="text-3xl font-light text-[--neon-white] mb-6 text-center"
              style={{
                textShadow: "0 0 12px rgba(90, 180, 255, 0.6)"
              }}
            >
              How to Play
            </h2>

            <div
              className={cn(
                "relative rounded-lg p-8",
                "border-2 border-dashed border-[--neon-blue-light]",
                "bg-gradient-to-br from-[--neon-dark] to-[--neon-black]"
              )}
              style={{
                boxShadow: "0 0 16px rgba(90, 180, 255, 0.3), 0 0 32px rgba(90, 180, 255, 0.15)"
              }}
            >
              <div className="relative space-y-6">
                <div className="flex gap-5 group hover:translate-x-2 transition-transform">
                  <div
                    className="flex-shrink-0 w-10 h-10 rounded-full bg-[--neon-blue-light] text-[--neon-black] flex items-center justify-center font-bold text-lg group-hover:scale-110 transition-transform"
                    style={{
                      boxShadow: "0 0 12px rgba(90, 180, 255, 0.6)"
                    }}
                  >
                    1
                  </div>
                  <div>
                    <h4 className="text-[--neon-white] font-bold text-lg mb-2">Connect Your Wallet</h4>
                    <p className="text-[--neon-grey] text-sm leading-relaxed">
                      Click "Connect Wallet" and approve with your Solana wallet (Phantom, Solflare, etc.)
                    </p>
                  </div>
                </div>

                <div className="h-px bg-gradient-to-r from-transparent via-[--neon-blue-light]/50 to-transparent" />

                <div className="flex gap-5 group hover:translate-x-2 transition-transform">
                  <div
                    className="flex-shrink-0 w-10 h-10 rounded-full bg-[--neon-blue-light] text-[--neon-black] flex items-center justify-center font-bold text-lg group-hover:scale-110 transition-transform"
                    style={{
                      boxShadow: "0 0 12px rgba(90, 180, 255, 0.6)"
                    }}
                  >
                    2
                  </div>
                  <div>
                    <h4 className="text-[--neon-white] font-bold text-lg mb-2">Pay & Play</h4>
                    <p className="text-[--neon-grey] text-sm leading-relaxed">
                      Pay 0.10 USDC - your wallet stays connected for multiple rounds!
                    </p>
                  </div>
                </div>

                <div className="h-px bg-gradient-to-r from-transparent via-[--neon-blue-light]/50 to-transparent" />

                <div className="flex gap-5 group hover:translate-x-2 transition-transform">
                  <div
                    className="flex-shrink-0 w-10 h-10 rounded-full bg-[--neon-blue-light] text-[--neon-black] flex items-center justify-center font-bold text-lg group-hover:scale-110 transition-transform"
                    style={{
                      boxShadow: "0 0 12px rgba(90, 180, 255, 0.6)"
                    }}
                  >
                    3
                  </div>
                  <div>
                    <h4 className="text-[--neon-white] font-bold text-lg mb-2">Spin & Win!</h4>
                    <p className="text-[--neon-grey] text-sm leading-relaxed">
                      Watch the reels spin on this page. If you win, your payout is sent instantly!
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Footer Note */}
          <div className="text-center my-12" data-reveal>
            <p className="text-[--neon-grey] text-sm">
              Must be 18+ to play. Gamble responsibly.
            </p>
          </div>

          {/* Promotional Note */}
          <div className="my-12" data-reveal>
            <div
              className={cn(
                "relative p-10 rounded-lg text-center overflow-hidden group",
                "border-2 border-dashed border-[--neon-blue-light]",
                "bg-gradient-to-br from-[--neon-dark] via-[--neon-black] to-[--neon-dark]",
                "hover:border-[--neon-blue-light] transition-all duration-300"
              )}
              style={{
                boxShadow: "0 0 20px rgba(90, 180, 255, 0.4), 0 0 40px rgba(90, 180, 255, 0.2)"
              }}
            >
              <div className="relative z-10">
                <div className="text-5xl mb-5 animate-bounce">✨</div>
                <h3 className="text-3xl font-bold text-[--neon-white] mb-4" style={{
                  textShadow: "0 0 16px rgba(90, 180, 255, 0.7)"
                }}>
                  Want Your Own Custom Blink?
                </h3>
                <p className="text-base text-[--neon-grey] mb-6 max-w-2xl mx-auto leading-relaxed">
                  Get a custom slot machine, game, or interactive experience built just for you!
                </p>
                <a
                  href="https://x.com/Blinkx402"
                  target="_blank"
                  rel="noopener noreferrer"
                  className={cn(
                    "inline-block py-4 px-10 rounded-lg font-mono text-base font-bold",
                    "border-2 border-dashed border-[--neon-blue-light]",
                    "bg-[--neon-black] text-[--neon-white]",
                    "transition-all duration-200",
                    "hover:bg-[--neon-blue-light] hover:text-[--neon-black] hover:scale-105 active:scale-95"
                  )}
                  style={{
                    boxShadow: "0 0 16px rgba(90, 180, 255, 0.6), 0 0 32px rgba(90, 180, 255, 0.3)"
                  }}
                >
                  🐦 Reach out to @Blinkx402 on X
                </a>
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
  )
}
