"use client"

import { useEffect, useState } from "react"
import { useParams } from "next/navigation"
import { usePrivy, useWallets } from "@privy-io/react-auth"
import {
  Connection,
  PublicKey,
  TransactionMessage,
  VersionedTransaction,
  ComputeBudgetProgram,
} from "@solana/web3.js"
import {
  getAssociatedTokenAddress,
  createTransferCheckedInstruction,
  getAccount,
} from "@solana/spl-token"
import { cn } from "@/lib/utils"
import { applyB402Discount, getB402HolderTier, getTierDisplayInfo, type TokenHolderTier } from "@blink402/solana"

// Solana configuration
const USDC_MINT = new PublicKey("EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v") // Mainnet USDC
const USDC_DECIMALS = 6
const PAYAI_FEE_PAYER = new PublicKey("2wKupLR9q6wXYppw8Gr2NvWxKBUqm4PPJKkQfoxHDBg4") // PayAI fee payer - prevents Phantom Lighthouse injection

interface LotteryRound {
  round_id: string
  round_number: number
  started_at: string
  total_entries: number
  prize_pool_usdc: string
  bonus_pool_usdc?: string
  next_draw_at: string
  time_remaining_seconds: number
  user_entries?: number
  prize_breakdown: {
    first_place: string
    second_place: string
    third_place: string
    platform_fee: string
  }
}

interface LotteryWinner {
  wallet: string
  rank: 1 | 2 | 3
  payout_amount_usdc: string
  tx_signature?: string
  completed_at?: string
}

interface LotteryHistory {
  round_number: number
  started_at: string
  ended_at: string
  total_entries: number
  prize_pool_usdc: string
  winners: LotteryWinner[]
  platform_fee_usdc: string
}

export default function LotteryPage() {
  const params = useParams()
  const slug = params.slug as string
  const { login, authenticated, user, ready } = usePrivy()
  const { wallets } = useWallets()

  // Get wallet address (same pattern as checkout page)
  const wallet = wallets[0]
  const solanaAccount: any = user?.linkedAccounts?.find(
    (account: any) => account.type === 'wallet' && account.chainType === 'solana'
  )
  const connectedWallet = (solanaAccount as any)?.address || wallet?.address
  const connected = authenticated && !!connectedWallet

  const [currentRound, setCurrentRound] = useState<LotteryRound | null>(null)
  const [recentWinners, setRecentWinners] = useState<LotteryHistory[]>([])
  const [loading, setLoading] = useState(true)
  const [entering, setEntering] = useState(false)
  const [timeRemaining, setTimeRemaining] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [entryPrice, setEntryPrice] = useState<number>(1.0) // Default 1 USDC (base price)
  const [waitingForFirstEntry, setWaitingForFirstEntry] = useState(false)
  const [blinkData, setBlinkData] = useState<any>(null) // Store blink metadata including payout_wallet
  const [totalB402Bought, setTotalB402Bought] = useState<string>("0")

  // B402 token holder state
  const [b402Tier, setB402Tier] = useState<TokenHolderTier>('NONE')
  const [finalPrice, setFinalPrice] = useState<number>(1.0)
  const [savings, setSavings] = useState(0)
  const [discountPercent, setDiscountPercent] = useState(0)

  // Fetch current round
  const fetchCurrentRound = async () => {
    try {
      const url = connectedWallet
        ? `/api/lottery/${slug}/current?wallet=${connectedWallet}`
        : `/api/lottery/${slug}/current`

      const res = await fetch(url)
      if (res.ok) {
        const data = await res.json()
        setCurrentRound(data)
        setTimeRemaining(data.time_remaining_seconds)
        setWaitingForFirstEntry(false)

        // Get blink metadata (includes payout_wallet)
        const blinkRes = await fetch(`/api/blinks/${slug}`)
        if (blinkRes.ok) {
          const blink = await blinkRes.json()
          setBlinkData(blink.data) // Store full blink data
          setEntryPrice(parseFloat(blink.data?.price_usdc || "1.0"))
        }
      } else if (res.status === 404) {
        // No active round yet - waiting for first entry
        setWaitingForFirstEntry(true)
        setCurrentRound(null)
        setTimeRemaining(0)

        // Still get blink metadata
        const blinkRes = await fetch(`/api/blinks/${slug}`)
        if (blinkRes.ok) {
          const blink = await blinkRes.json()
          setBlinkData(blink.data) // Store full blink data
          setEntryPrice(parseFloat(blink.data?.price_usdc || "1.0"))
        }
      }
    } catch (error) {
      console.error("Failed to fetch current round:", error)
    }
  }

  // Fetch recent winners
  const fetchRecentWinners = async () => {
    try {
      const res = await fetch(`/api/lottery/${slug}/history?limit=5`)
      if (res.ok) {
        const data = await res.json()
        setRecentWinners(data.rounds || [])
      }
    } catch (error) {
      console.error("Failed to fetch winners:", error)
    } finally {
      setLoading(false)
    }
  }

  // Fetch lottery stats (B402 buyback total, etc.)
  const fetchLotteryStats = async () => {
    try {
      const res = await fetch(`/api/lottery/${slug}/stats`)
      if (res.ok) {
        const data = await res.json()
        setTotalB402Bought(data.total_b402_bought || "0")
      }
    } catch (error) {
      console.error("Failed to fetch lottery stats:", error)
    }
  }

  // Fetch B402 holder tier and apply discount when wallet connects
  useEffect(() => {
    const fetchB402Discount = async () => {
      if (!connected || !connectedWallet) {
        // Reset to no tier if wallet disconnects
        setB402Tier('NONE')
        setFinalPrice(entryPrice)
        setSavings(0)
        setDiscountPercent(0)
        return
      }

      try {
        console.log('Fetching B402 holder tier for wallet:', connectedWallet)

        // Get tier and apply discount
        const discount = await applyB402Discount(entryPrice, connectedWallet, 'lottery')

        console.log('B402 lottery discount applied:', {
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
        setFinalPrice(entryPrice)
        setSavings(0)
        setDiscountPercent(0)
      }
    }

    fetchB402Discount()
  }, [connected, connectedWallet, entryPrice])

  // Initial load
  useEffect(() => {
    fetchCurrentRound()
    fetchRecentWinners()
    fetchLotteryStats()

    // Refresh current round and stats every 10 seconds
    const interval = setInterval(() => {
      fetchCurrentRound()
      fetchLotteryStats()
    }, 10000)
    return () => clearInterval(interval)
  }, [slug, user])

  // Countdown timer
  useEffect(() => {
    if (timeRemaining <= 0) return

    const timer = setInterval(() => {
      setTimeRemaining(prev => Math.max(0, prev - 1))
    }, 1000)

    return () => clearInterval(timer)
  }, [timeRemaining])

  // Format time remaining
  const formatTimeRemaining = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  // Enter lottery - Complete USDC payment flow
  const handleEnter = async () => {
    if (!authenticated || !ready) {
      login()
      return
    }

    if (!connected || !connectedWallet) {
      setError("Please connect your Solana wallet first")
      return
    }

    setEntering(true)
    setError(null)
    setSuccess(null)

    try {
      // Get the actual connected wallet from window.solana
      // @ts-ignore
      const solana = window.solana || window.phantom?.solana

      if (!solana || !solana.publicKey) {
        throw new Error(
          "No Solana wallet connected. Please ensure Phantom, Solflare, or another Solana wallet is installed and connected."
        )
      }

      console.log("Building USDC transfer transaction with B402 discount...", {
        originalPrice: entryPrice,
        finalPrice: finalPrice,
        tier: b402Tier,
        savings: savings
      })

      // Setup Solana connection
      const connection = new Connection(
        process.env.NEXT_PUBLIC_SOLANA_RPC_URL || "https://api.mainnet-beta.solana.com",
        "confirmed"
      )

      const payer = solana.publicKey
      const amountUsdc = finalPrice // Use discounted price if B402 holder
      const amountAtomic = BigInt(Math.round(amountUsdc * 1_000_000))

      // Get payout wallet from blink data
      if (!blinkData?.payout_wallet) {
        throw new Error("Lottery configuration error: payout wallet not found")
      }
      const platformWallet = new PublicKey(blinkData.payout_wallet)

      // Get token accounts
      const payerATA = await getAssociatedTokenAddress(USDC_MINT, payer)
      const platformATA = await getAssociatedTokenAddress(USDC_MINT, platformWallet)

      // Verify payer has enough USDC
      try {
        const payerAccount = await getAccount(connection, payerATA)
        const rawBalance = Number(payerAccount.amount) / 1_000_000
        // Subtract base reserve amounts for fees ($10 USDC)
        const RESERVE_USDC = 10.0
        const availableBalance = Math.max(0, rawBalance - RESERVE_USDC)
        console.log(`USDC balance: ${rawBalance} USDC (Available: ${availableBalance} USDC after ${RESERVE_USDC} USDC reserve)`)

        if (availableBalance < amountUsdc) {
          throw new Error(`Insufficient USDC balance. You have ${availableBalance.toFixed(2)} USDC available (${RESERVE_USDC} USDC reserved for fees) but need ${amountUsdc} USDC.`)
        }
      } catch (err: any) {
        console.error('USDC balance check error:', err)
        // Check for token account not found error
        if (
          err.name === 'TokenAccountNotFoundError' ||
          err.message?.includes('could not find') ||
          err.message?.includes('Invalid') ||
          err.message?.includes('TokenAccountNotFoundError')
        ) {
          throw new Error('⚠️ No USDC found in your wallet. Please get some USDC first!\n\nYou can buy USDC on Jupiter (https://jup.ag) or receive it from another wallet.')
        }
        throw err
      }

      // Get latest blockhash
      const { blockhash } = await connection.getLatestBlockhash('confirmed')

      // Build transaction with exactly 3 instructions (ONCHAIN EXACT-SVM requirement)
      const instructions = [
        ComputeBudgetProgram.setComputeUnitLimit({ units: 40_000 }),
        ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 1 }),
        createTransferCheckedInstruction(
          payerATA,
          USDC_MINT,
          platformATA,
          payer,
          BigInt(amountAtomic.toString()), // Match slot machine - normalizes BigInt serialization
          USDC_DECIMALS
        )
      ]

      // Build VersionedTransaction with PayAI fee payer (prevents Phantom Lighthouse MEV injection)
      // NOTE: Using PayAI fee payer keeps transaction at exactly 3 instructions
      // If we use user's wallet as fee payer, Phantom injects 2 extra Lighthouse instructions (causes "Request blocked" error)
      const messageV0 = new TransactionMessage({
        payerKey: PAYAI_FEE_PAYER, // PayAI pays network fees - prevents Phantom security block!
        recentBlockhash: blockhash,
        instructions,
      }).compileToV0Message()

      const transaction = new VersionedTransaction(messageV0)

      console.log('Requesting wallet signature with PayAI fee payer...')

      // Sign transaction
      let signedTx: VersionedTransaction
      try {
        signedTx = await solana.signTransaction(transaction)
      } catch (signError: any) {
        if (signError.message?.includes('rejected') || signError.message?.includes('denied')) {
          throw new Error('Transaction rejected by user')
        }
        throw new Error(`Failed to sign transaction: ${signError.message}`)
      }

      console.log('[LOTTERY] Transaction signed, building x402 payment header...')

      // Build x402 payment payload (same as slot machine)
      const base64Tx = Buffer.from(signedTx.serialize()).toString('base64')
      const paymentPayload = {
        x402Version: 1,
        scheme: 'exact',
        network: 'solana',
        payload: {
          transaction: base64Tx
        }
      }

      const xPaymentHeader = btoa(JSON.stringify(paymentPayload))

      console.log('X-Payment header created, submitting to lottery entry endpoint...')
      console.log('ONCHAIN will handle blockchain submission after verification')

      // Submit to lottery entry endpoint with X-Payment header
      // ONCHAIN will verify, add PayAI signature, and submit to blockchain
      const entryRes = await fetch(`/api/lottery/${slug}/enter`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Payment': xPaymentHeader // Include x402 payment header
        },
        body: JSON.stringify({
          payer: payer.toBase58()
        })
      })

      if (!entryRes.ok) {
        const errorData = await entryRes.json()
        throw new Error(errorData.error || 'Failed to create lottery entry')
      }

      const entryData = await entryRes.json()

      setSuccess(entryData.message || 'Entry successful! Good luck!')

      // Refresh round data
      await fetchCurrentRound()

      console.log('Lottery entry created successfully!')

    } catch (error: any) {
      console.error("Failed to enter lottery:", error)
      setError(error.message || 'Failed to enter lottery')
    } finally {
      setEntering(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[--neon-black]">
        <div className="text-[--neon-blue-light] animate-pulse">Loading lottery...</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[--neon-black] text-white p-6">
      <div className="max-w-4xl mx-auto space-y-8">
        {/* Header */}
        <div className="text-center space-y-4">
          <h1 className="text-5xl font-sans font-light text-[--neon-blue-light]" data-scramble>
            BLINK402 LOTTERY
          </h1>
          <p className="text-[--neon-grey] text-lg font-mono">
            Win USDC every 15 minutes • On-chain • Provably Fair
          </p>
        </div>

        {/* Current Round Card */}
        <div className="border border-dashed border-[--neon-blue-light] bg-[--neon-dark] p-8 rounded-lg space-y-6">
          <div className="flex justify-between items-start">
            <div>
              <h2 className="text-2xl font-sans font-light text-[--neon-blue-light]">
                {waitingForFirstEntry ? (
                  <>Round #1 <span className="text-[--neon-grey]">- Not Started</span></>
                ) : (
                  `Round #${currentRound?.round_number || '...'}`
                )}
              </h2>
              <p className="text-[--neon-grey] text-sm font-mono">
                {waitingForFirstEntry ? (
                  'Be the first to enter!'
                ) : (
                  `${currentRound?.total_entries || 0} entries`
                )}
              </p>
            </div>

            {/* Countdown */}
            <div className="text-right">
              <div className="text-sm text-[--neon-grey] font-mono">Next Draw In</div>
              <div className="text-4xl font-mono font-bold text-[--neon-blue-light]">
                {waitingForFirstEntry ? (
                  <div className="text-2xl animate-pulse">
                    Waiting for first player...
                  </div>
                ) : (
                  formatTimeRemaining(timeRemaining)
                )}
              </div>
            </div>
          </div>

          {/* Bonus Pool Announcement */}
          {currentRound && parseFloat(currentRound.bonus_pool_usdc || '0') > 0 && (
            <div className="border border-[--neon-blue-light] bg-linear-to-r from-[--neon-blue-dark]/30 to-[--neon-blue-light]/20 p-6 rounded-lg text-center animate-pulse">
              <div className="text-lg font-sans font-light text-[--neon-blue-light] mb-2">
                🎉 SPECIAL BONUS ROUND! 🎉
              </div>
              <div className="text-3xl font-mono font-bold text-[--neon-white]">
                +${parseFloat(currentRound.bonus_pool_usdc || '0').toFixed(0)} USDC ADDED TO PRIZE POOL!
              </div>
              <div className="text-sm text-[--neon-grey] font-mono mt-2">
                Limited time promotional bonus - bigger prizes for everyone!
              </div>
            </div>
          )}

          {/* Prize Pool */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="border border-[--neon-blue-light]/30 bg-[--neon-black] p-4 rounded">
              <div className="text-xs text-[--neon-grey] font-mono">Total Pool</div>
              <div className="text-2xl font-mono font-bold text-[--neon-blue-light]">
                {currentRound?.prize_pool_usdc || '0.00'} USDC
              </div>
              {/* Show bonus if present */}
              {currentRound && parseFloat(currentRound.bonus_pool_usdc || '0') > 0 && (
                <div className="text-xs text-[--neon-blue-light] font-mono mt-1 animate-pulse">
                  +${parseFloat(currentRound.bonus_pool_usdc || '0').toFixed(0)} BONUS! 🎉
                </div>
              )}
            </div>
            <div className="border border-[--neon-blue-light]/30 bg-[--neon-black] p-4 rounded">
              <div className="text-xs text-[--neon-grey] font-mono">🥇 1st (50%)</div>
              <div className="text-xl font-mono font-bold">
                {currentRound?.prize_breakdown.first_place || '0.00'}
              </div>
            </div>
            <div className="border border-[--neon-blue-light]/30 bg-[--neon-black] p-4 rounded">
              <div className="text-xs text-[--neon-grey] font-mono">🥈 2nd (20%)</div>
              <div className="text-xl font-mono font-bold">
                {currentRound?.prize_breakdown.second_place || '0.00'}
              </div>
            </div>
            <div className="border border-[--neon-blue-light]/30 bg-[--neon-black] p-4 rounded">
              <div className="text-xs text-[--neon-grey] font-mono">🥉 3rd (15%)</div>
              <div className="text-xl font-mono font-bold">
                {currentRound?.prize_breakdown.third_place || '0.00'}
              </div>
            </div>
          </div>

          {/* User Entries */}
          {authenticated && currentRound?.user_entries !== undefined && (
            <div className="bg-[--neon-blue-dark]/10 border border-[--neon-blue-light]/20 p-4 rounded">
              <div className="text-sm text-[--neon-grey] font-mono">Your Entries This Round</div>
              <div className="text-3xl font-mono font-bold text-[--neon-blue-light]">
                {currentRound.user_entries}
              </div>
            </div>
          )}

          {/* Error Message */}
          {error && (
            <div className="bg-red-900/20 border border-red-500 text-red-200 p-4 rounded">
              <p className="text-sm font-mono">{error}</p>
            </div>
          )}

          {/* Success Message */}
          {success && (
            <div className="bg-green-900/20 border border-green-500 text-green-200 p-4 rounded">
              <p className="text-sm font-mono">{success}</p>
            </div>
          )}

          {/* B402 Tier Badge */}
          {authenticated && b402Tier !== 'NONE' && (
            <div className="bg-green-900/20 border-2 border-dashed border-green-500/60 p-4 rounded-lg">
              <div className="flex items-center gap-3">
                <span className="text-3xl">{getTierDisplayInfo(b402Tier).icon}</span>
                <div className="flex-1">
                  <div className="text-green-400 font-mono text-base font-bold">{getTierDisplayInfo(b402Tier).label}</div>
                  <div className="text-green-300 font-mono text-sm">
                    {savings > 0 && `${discountPercent}% discount • Save ${savings.toFixed(2)} USDC per entry!`}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Entry Button */}
          <button
            onClick={handleEnter}
            disabled={entering}
            className={cn(
              "w-full py-4 px-6 rounded font-mono font-bold text-lg transition-all",
              "border-2 border-dashed border-[--neon-blue-light]",
              "bg-[--neon-blue-dark] hover:bg-[--neon-blue-light] hover:text-black",
              "disabled:opacity-50 disabled:cursor-not-allowed"
            )}
          >
            {entering ? "Processing..." : authenticated ? (
              savings > 0 ? (
                <>
                  Buy Entry ({finalPrice.toFixed(2)} USDC) <span className="text-green-400 ml-2">-{discountPercent}%!</span>
                </>
              ) : (
                `Buy Entry (${finalPrice.toFixed(2)} USDC)`
              )
            ) : "Connect Wallet to Enter"}
          </button>

          {/* B402 Buyback Stats */}
          <div className="border border-[--neon-blue-light]/30 bg-gradient-to-br from-[--neon-blue-dark]/20 to-[--neon-black] p-4 rounded-lg">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-xs text-[--neon-grey] font-mono uppercase tracking-wide">🔥 Total B402 Bought & Burned</div>
                <div className="text-sm text-[--neon-grey]/70 font-mono mt-1">15% of each pot → automatic buyback</div>
              </div>
              <div className="text-2xl font-mono font-bold text-[--neon-blue-light]">
                {parseFloat(totalB402Bought).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} B402
              </div>
            </div>
          </div>
        </div>

        {/* Recent Winners */}
        <div className="space-y-4">
          <h2 className="text-2xl font-sans font-light text-[--neon-blue-light]">Recent Winners</h2>

          {recentWinners.length === 0 ? (
            <div className="border border-dashed border-[--neon-grey] p-8 rounded text-center text-[--neon-grey] font-mono">
              No winners yet. Be the first!
            </div>
          ) : (
            <div className="space-y-4">
              {recentWinners.map((round) => (
                <div
                  key={round.round_number}
                  className="border border-[--neon-blue-light]/30 bg-[--neon-dark] p-6 rounded-lg"
                >
                  <div className="flex justify-between items-center mb-4">
                    <div>
                      <h3 className="text-xl font-sans font-light">Round #{round.round_number}</h3>
                      <p className="text-sm text-[--neon-grey] font-mono">
                        {round.total_entries} entries • {round.prize_pool_usdc} USDC pool
                      </p>
                    </div>
                    <div className="text-sm text-[--neon-grey] font-mono">
                      {new Date(round.ended_at).toLocaleDateString()}
                    </div>
                  </div>

                  {/* Winners */}
                  <div className="space-y-3">
                    {round.winners.map((winner) => (
                      <div
                        key={`${round.round_number}-${winner.rank}`}
                        className="flex items-center justify-between bg-[--neon-black] p-4 rounded border border-[--neon-blue-light]/20"
                      >
                        <div className="flex items-center gap-4">
                          <div className="text-3xl">
                            {winner.rank === 1 ? '🥇' : winner.rank === 2 ? '🥈' : '🥉'}
                          </div>
                          <div>
                            <div className="font-mono text-sm text-[--neon-blue-light]">
                              {winner.wallet.slice(0, 4)}...{winner.wallet.slice(-4)}
                            </div>
                            {winner.tx_signature && (
                              <a
                                href={`https://orb.helius.dev/tx/${winner.tx_signature}?tab=summary&cluster=mainnet-beta`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-xs text-[--neon-grey] hover:text-[--neon-blue-light] underline"
                              >
                                View on Orb →
                              </a>
                            )}
                          </div>
                        </div>
                        <div className="text-xl font-mono font-bold text-[--neon-blue-light]">
                          {parseFloat(winner.payout_amount_usdc).toFixed(2)} USDC
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* How It Works */}
        <div className="border border-dashed border-[--neon-grey] p-6 rounded-lg space-y-4">
          <h3 className="text-xl font-sans font-light text-[--neon-blue-light]">How It Works</h3>
          <ol className="space-y-2 text-[--neon-grey] font-mono list-decimal list-inside">
            <li>Connect your Solana wallet</li>
            <li>Buy entries for 1 USDC each (unlimited entries)</li>
            <li>New draw every 15 minutes, 3 winners selected</li>
            <li>Winners receive USDC instantly (50% / 20% / 15%)</li>
            <li>15% platform fee supports $B402 buyback & burn</li>
          </ol>
          <div className="text-sm text-[--neon-grey] font-mono italic">
            ✓ Provably fair (SHA-256 seeded randomness)
            <br />
            ✓ Fully on-chain
            <br />
            ✓ No accounts or KYC required
          </div>
        </div>
      </div>
    </div>
  )
}
