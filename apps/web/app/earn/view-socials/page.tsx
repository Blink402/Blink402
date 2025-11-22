"use client"

import { useEffect, useState } from "react"
import { useSearchParams } from "next/navigation"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import Link from "next/link"
import NeonDivider from "@/components/NeonDivider"
import { WalletButton } from "@/components/wallet"
import { usePrivy, useWallets } from "@privy-io/react-auth"

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'

export default function ViewSocialsPage() {
  const searchParams = useSearchParams()
  // Generate reference only once on mount (not on every render!)
  const [reference] = useState(() => searchParams.get("ref") || crypto.randomUUID())
  const { ready, authenticated, user } = usePrivy()
  const { wallets } = useWallets()

  // Get wallet address (same pattern as checkout page)
  const wallet = wallets[0]
  const solanaAccount: any = user?.linkedAccounts?.find(
    (account: any) => account.type === 'wallet' && account.chainType === 'solana'
  )
  const connectedWallet = (solanaAccount as any)?.address || wallet?.address

  const [viewTracked, setViewTracked] = useState(false)
  const [timeSpent, setTimeSpent] = useState(0)
  const [canClaim, setCanClaim] = useState(false)
  const [claiming, setClaiming] = useState(false)
  const [claimed, setClaimed] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const [transactionSignature, setTransactionSignature] = useState<string | null>(null)
  const [rewardInfo, setRewardInfo] = useState<{
    current_amount: string
    tier: string
    remaining_in_tier: number
    total_claims: number
    expired: boolean
  } | null>(null)

  const handleClaimReward = async () => {
    if (!authenticated || !connectedWallet) {
      setError('Please connect your Solana wallet first')
      return
    }

    setClaiming(true)
    setError(null)

    try {
      // Reward mode: Server handles transaction building and signing
      // User just needs to be authenticated via Privy
      const response = await fetch(`${API_BASE_URL}/bazaar/view-socials-earn`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reference,
          data: {
            user_wallet: connectedWallet, // Send wallet address from Privy auth
          },
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.message || errorData.error || 'Failed to claim reward')
      }

      const data = await response.json()
      setClaimed(true)
      setTransactionSignature(data.signature)
      setSuccessMessage(
        `Success! You received ${data.reward_amount} ${data.reward_token}.`
      )
    } catch (err: any) {
      console.error('Claim error:', err)
      setError(err.message || 'Failed to claim reward. Please try again.')
    } finally {
      setClaiming(false)
    }
  }

  useEffect(() => {
    // Fetch reward tier info
    const fetchRewardInfo = async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/a/reward-info/view-socials-earn`)
        if (response.ok) {
          const data = await response.json()
          setRewardInfo(data)
        }
      } catch (err) {
        console.error('Failed to fetch reward info:', err)
      }
    }

    // Track the view when page loads
    const trackView = async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/a/track-view`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ reference })
        })

        if (response.ok) {
          setViewTracked(true)
        } else {
          const errorData = await response.json()
          throw new Error(errorData.message || 'Failed to track view')
        }
      } catch (err: any) {
        console.error('View tracking error:', err)
        setError(err.message || 'Failed to track your view. Please refresh the page.')
      }
    }

    fetchRewardInfo()
    trackView()

    // Timer: enable claim button after 15 seconds
    const timer = setInterval(() => {
      setTimeSpent(prev => {
        const newTime = prev + 1
        if (newTime >= 15) {
          setCanClaim(true)
        }
        return newTime
      })
    }, 1000)

    return () => clearInterval(timer)
  }, [reference])

  return (
    <main className="min-h-screen bg-neon-black">
      <section className="px-4 sm:px-6 py-8 sm:py-12">
        <div className="max-w-5xl mx-auto">
          {/* Header */}
          <div className="text-center mb-8">
            {rewardInfo?.expired ? (
              <Badge className="bg-yellow-500/20 text-yellow-400 border-yellow-500/30 mb-4 text-sm">
                ⏰ CAMPAIGN ENDED
              </Badge>
            ) : (
              <Badge className="bg-green-500/20 text-green-400 border-green-500/30 mb-4 text-sm">
                💰 EARN ${rewardInfo?.current_amount || '...'} USDC
              </Badge>
            )}
            <h1 className="font-sans text-neon-white mb-4 text-3xl sm:text-4xl md:text-5xl font-light">
              Discover Blink<span className="text-neon-blue-light">x402</span>
            </h1>
            <p className="text-neon-grey font-mono text-sm sm:text-base max-w-2xl mx-auto">
              {rewardInfo?.expired ? (
                <>
                  Explore our socials and learn about the protocol.
                  Follow us for updates on future campaigns!
                </>
              ) : (
                <>
                  Explore our socials, learn about the protocol, and earn{" "}
                  <span className="text-neon-blue-light font-bold">${rewardInfo?.current_amount || '...'} USDC</span> for your time.
                  Spend at least 15 seconds exploring below.
                </>
              )}
            </p>
            {rewardInfo && !rewardInfo.expired && rewardInfo.remaining_in_tier > 0 && rewardInfo.remaining_in_tier < 20 && (
              <p className="text-yellow-400 font-mono text-xs mt-2">
                ⚡ Only {rewardInfo.remaining_in_tier} claims left at ${rewardInfo.current_amount}!
              </p>
            )}
          </div>

          {/* Demo Video */}
          <Card className="bg-neon-dark border-neon-blue-dark/30 p-4 mb-6 overflow-hidden">
            <video
              autoPlay
              loop
              muted
              playsInline
              className="w-full h-auto rounded-lg"
            >
              <source src="/blink-demo.mp4" type="video/mp4" />
              Your browser does not support the video tag.
            </video>
            <p className="text-neon-grey font-mono text-xs text-center mt-3">
              See Blinkx402 in action 🎬
            </p>
          </Card>

          {/* Progress Bar */}
          {viewTracked && !canClaim && !rewardInfo?.expired && (
            <Card className="bg-neon-blue-dark/10 border-neon-blue-dark/30 p-4 mb-6">
              <div className="flex items-center justify-between mb-2">
                <span className="text-neon-white font-mono text-sm">
                  ⏱ Time viewing: <span className="text-neon-blue-light font-bold">{timeSpent}s</span> / 15s
                </span>
                <span className="text-neon-grey font-mono text-xs">
                  {Math.round((timeSpent / 15) * 100)}%
                </span>
              </div>
              <div className="w-full h-2 bg-neon-black rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-neon-blue-dark to-neon-blue-light transition-all duration-1000 ease-out"
                  style={{ width: `${Math.min((timeSpent / 15) * 100, 100)}%` }}
                />
              </div>
            </Card>
          )}

          {/* Error Alert */}
          {error && (
            <Card className="bg-red-500/10 border-red-500/30 p-4 mb-6">
              <p className="text-red-400 font-mono text-sm">⚠ {error}</p>
            </Card>
          )}

          {/* Success Alert */}
          {successMessage && (
            <Card className="bg-green-500/10 border-green-500/30 p-4 mb-6">
              <p className="text-green-400 font-mono text-sm">✓ {successMessage}</p>
            </Card>
          )}

          {/* Social Links Hero */}
          <Card className="bg-neon-dark border-neon-blue-dark/30 p-6 sm:p-8 mb-6">
            <h2 className="text-neon-white font-mono text-2xl mb-6 text-center">
              🌐 Connect With Us
            </h2>
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* X/Twitter */}
              <a
                href="https://x.com/Blinkx402"
                target="_blank"
                rel="noopener noreferrer"
                className="group block p-4 bg-neon-black rounded-lg border-2 border-dashed border-neon-blue-dark/40 hover:border-neon-blue-light transition-all duration-300"
              >
                <div className="text-center">
                  <div className="text-4xl mb-2">𝕏</div>
                  <div className="text-neon-white font-mono text-sm mb-1">@Blinkx402</div>
                  <div className="text-neon-grey font-mono text-xs">Follow on X →</div>
                </div>
              </a>

              {/* Telegram */}
              <a
                href="https://t.me/blinkx402"
                target="_blank"
                rel="noopener noreferrer"
                className="group block p-4 bg-neon-black rounded-lg border-2 border-dashed border-neon-blue-dark/40 hover:border-neon-blue-light transition-all duration-300"
              >
                <div className="text-center">
                  <div className="text-4xl mb-2">✈️</div>
                  <div className="text-neon-white font-mono text-sm mb-1">Telegram</div>
                  <div className="text-neon-grey font-mono text-xs">Join chat →</div>
                </div>
              </a>

              {/* Website */}
              <a
                href="https://blink402.dev/"
                target="_blank"
                rel="noopener noreferrer"
                className="group block p-4 bg-neon-black rounded-lg border-2 border-dashed border-neon-blue-dark/40 hover:border-neon-blue-light transition-all duration-300"
              >
                <div className="text-center">
                  <div className="text-4xl mb-2">🌐</div>
                  <div className="text-neon-white font-mono text-sm mb-1">blink402.dev</div>
                  <div className="text-neon-grey font-mono text-xs">Visit site →</div>
                </div>
              </a>

              {/* Pump.fun Token */}
              <a
                href="https://pump.fun/coin/2mESiwuVdfft9PxG7x36rvDvex6ccyY8m8BKCWJqpump"
                target="_blank"
                rel="noopener noreferrer"
                className="group block p-4 bg-neon-black rounded-lg border-2 border-dashed border-neon-blue-dark/40 hover:border-neon-blue-light transition-all duration-300"
              >
                <div className="text-center">
                  <div className="text-4xl mb-2">🚀</div>
                  <div className="text-neon-white font-mono text-sm mb-1">$BLINK402</div>
                  <div className="text-neon-grey font-mono text-xs">Trade token →</div>
                </div>
              </a>
            </div>
          </Card>

          {/* Content Grid */}
          <div className="grid lg:grid-cols-2 gap-6 mb-6">
            {/* What is Blink402 */}
            <Card className="bg-neon-dark border-neon-blue-dark/20 p-6">
              <h2 className="text-neon-white font-mono text-xl mb-4 flex items-center gap-2">
                <span className="text-2xl">⚡</span> What is Blinkx402?
              </h2>
              <div className="space-y-4 text-neon-grey font-mono text-sm">
                <p className="text-neon-white leading-relaxed">
                  <strong className="text-neon-blue-light">Pay-per-call APIs</strong> on Solana.
                  Turn any HTTP endpoint into a monetized Blink with instant USDC/SOL payments.
                </p>
                <NeonDivider className="my-3" />
                <ul className="space-y-2">
                  <li className="flex items-start gap-2">
                    <span className="text-neon-blue-light mt-1">•</span>
                    <span><strong className="text-neon-white">No accounts</strong> - Just connect wallet & pay</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-neon-blue-light mt-1">•</span>
                    <span><strong className="text-neon-white">2.1s settlement</strong> - ONCHAIN x402 protocol</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-neon-blue-light mt-1">•</span>
                    <span><strong className="text-neon-white">Multi-platform</strong> - Works on X, Telegram, Discord</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-neon-blue-light mt-1">•</span>
                    <span><strong className="text-neon-white">0% fees</strong> - Keep 100% of your revenue</span>
                  </li>
                </ul>
              </div>
            </Card>

            {/* Stats */}
            <Card className="bg-neon-dark border-neon-blue-dark/20 p-6">
              <h2 className="text-neon-white font-mono text-xl mb-4 flex items-center gap-2">
                <span className="text-2xl">📊</span> By the Numbers
              </h2>
              <div className="grid grid-cols-2 gap-4">
                <div className="text-center p-4 bg-neon-black rounded-lg border border-neon-blue-dark/20">
                  <div className="text-3xl font-bold text-neon-blue-light font-mono">2.1s</div>
                  <div className="text-xs text-neon-grey font-mono mt-2">Avg Settlement</div>
                </div>
                <div className="text-center p-4 bg-neon-black rounded-lg border border-neon-blue-dark/20">
                  <div className="text-3xl font-bold text-neon-blue-light font-mono">$0.01+</div>
                  <div className="text-xs text-neon-grey font-mono mt-2">Min Price</div>
                </div>
                <div className="text-center p-4 bg-neon-black rounded-lg border border-neon-blue-dark/20">
                  <div className="text-3xl font-bold text-neon-blue-light font-mono">0%</div>
                  <div className="text-xs text-neon-grey font-mono mt-2">Platform Fee</div>
                </div>
                <div className="text-center p-4 bg-neon-black rounded-lg border border-neon-blue-dark/20">
                  <div className="text-3xl font-bold text-neon-blue-light font-mono">100%</div>
                  <div className="text-xs text-neon-grey font-mono mt-2">Your Revenue</div>
                </div>
              </div>
              <NeonDivider className="my-4" />
              <div className="text-center">
                <p className="text-neon-grey font-mono text-xs mb-3">
                  Powered by ONCHAIN facilitators
                </p>
                <div className="flex flex-wrap justify-center gap-2">
                  <Badge variant="outline" className="border-neon-blue-dark/30 text-neon-grey text-xs">
                    PayAI
                  </Badge>
                  <Badge variant="outline" className="border-neon-blue-dark/30 text-neon-grey text-xs">
                    OctonetAI
                  </Badge>
                  <Badge variant="outline" className="border-neon-blue-dark/30 text-neon-grey text-xs">
                    Coinbase CDP
                  </Badge>
                </div>
              </div>
            </Card>

            {/* Use Cases */}
            <Card className="bg-neon-dark border-neon-blue-dark/20 p-6">
              <h2 className="text-neon-white font-mono text-xl mb-4 flex items-center gap-2">
                <span className="text-2xl">🎯</span> Use Cases
              </h2>
              <div className="space-y-3">
                <div className="p-3 bg-neon-black/50 rounded border-l-2 border-neon-blue-dark">
                  <div className="text-neon-white font-mono text-sm font-bold mb-1">AI/ML APIs</div>
                  <div className="text-neon-grey font-mono text-xs">
                    Image gen, text analysis, predictions
                  </div>
                </div>
                <div className="p-3 bg-neon-black/50 rounded border-l-2 border-neon-blue-dark">
                  <div className="text-neon-white font-mono text-sm font-bold mb-1">Data Services</div>
                  <div className="text-neon-grey font-mono text-xs">
                    Weather, crypto prices, analytics
                  </div>
                </div>
                <div className="p-3 bg-neon-black/50 rounded border-l-2 border-neon-blue-dark">
                  <div className="text-neon-white font-mono text-sm font-bold mb-1">Utilities</div>
                  <div className="text-neon-grey font-mono text-xs">
                    QR codes, screenshots, conversions
                  </div>
                </div>
                <div className="p-3 bg-neon-black/50 rounded border-l-2 border-neon-blue-dark">
                  <div className="text-neon-white font-mono text-sm font-bold mb-1">Reverse Blinks</div>
                  <div className="text-neon-grey font-mono text-xs">
                    Pay users for actions (like this one!)
                  </div>
                </div>
              </div>
            </Card>

            {/* Quick Links */}
            <Card className="bg-neon-dark border-neon-blue-dark/20 p-6">
              <h2 className="text-neon-white font-mono text-xl mb-4 flex items-center gap-2">
                <span className="text-2xl">🔗</span> Explore Platform
              </h2>
              <div className="space-y-3">
                <Link
                  href="/catalog"
                  className="block p-3 bg-neon-black rounded-lg border-2 border-dashed border-neon-blue-dark/40 hover:border-neon-blue-light transition-all"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-neon-white font-mono text-sm font-bold">Browse Catalog</div>
                      <div className="text-neon-grey font-mono text-xs mt-1">
                        Explore available Blinks
                      </div>
                    </div>
                    <span className="text-neon-blue-light text-xl">→</span>
                  </div>
                </Link>
                <Link
                  href="/create"
                  className="block p-3 bg-neon-black rounded-lg border-2 border-dashed border-neon-blue-dark/40 hover:border-neon-blue-light transition-all"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-neon-white font-mono text-sm font-bold">Create Blink</div>
                      <div className="text-neon-grey font-mono text-xs mt-1">
                        Monetize your API in minutes
                      </div>
                    </div>
                    <span className="text-neon-blue-light text-xl">→</span>
                  </div>
                </Link>
                <a
                  href="https://github.com/yourusername/blink402"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block p-3 bg-neon-black rounded-lg border-2 border-dashed border-neon-blue-dark/40 hover:border-neon-blue-light transition-all"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-neon-white font-mono text-sm font-bold">GitHub Repo</div>
                      <div className="text-neon-grey font-mono text-xs mt-1">
                        Open source & contributions welcome
                      </div>
                    </div>
                    <span className="text-neon-blue-light text-xl">→</span>
                  </div>
                </a>
              </div>
            </Card>
          </div>

          {/* Claim Reward Section */}
          <Card className="bg-gradient-to-br from-neon-dark to-neon-black border-neon-blue-light/40 p-6 sm:p-8 text-center">
            <div className="max-w-2xl mx-auto">
              {rewardInfo?.expired ? (
                <div className="space-y-4">
                  <div className="inline-flex items-center gap-2 bg-yellow-500/20 border border-yellow-500/40 rounded-full px-6 py-3 mb-4">
                    <span className="text-yellow-400 text-2xl">⏰</span>
                    <span className="text-yellow-400 font-mono text-base font-bold">
                      Campaign Ended
                    </span>
                  </div>
                  <h3 className="text-neon-white font-mono text-2xl mb-2">
                    Thank You for Your Interest!
                  </h3>
                  <p className="text-neon-grey font-mono text-sm mb-6">
                    This reward campaign has concluded. Follow us on social media to stay updated on future opportunities!
                  </p>
                  <div className="flex flex-col sm:flex-row gap-3 justify-center">
                    <a
                      href="https://x.com/Blinkx402"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 px-6 py-3 bg-neon-blue-dark hover:bg-neon-blue-light text-neon-white font-mono border-2 border-dashed border-neon-blue-light/40 rounded transition-all"
                    >
                      <span>Follow on 𝕏</span>
                      <span className="text-xs">→</span>
                    </a>
                    <Link href="/catalog">
                      <Button className="px-6 py-3 bg-neon-black hover:bg-neon-dark text-neon-white font-mono border-2 border-neon-blue-light transition-all">
                        Explore Blinks →
                      </Button>
                    </Link>
                  </div>
                  <p className="text-neon-grey font-mono text-xs mt-6">
                    Total Claims: {rewardInfo?.total_claims || 0} • Campaign Status: Ended
                  </p>
                </div>
              ) : !canClaim && (
                <div className="space-y-4">
                  <div className="text-neon-white font-mono text-lg mb-2">
                    ⏳ Keep exploring...
                  </div>
                  <div className="text-neon-grey font-mono text-sm mb-4">
                    {15 - timeSpent} seconds remaining until you can claim your reward
                  </div>
                  <Button
                    disabled
                    className="w-full sm:w-auto px-8 py-6 text-lg bg-neon-grey/20 text-neon-grey cursor-not-allowed"
                  >
                    <span className="inline-block w-4 h-4 border-2 border-neon-grey border-t-transparent rounded-full animate-spin mr-2" />
                    Claim ${rewardInfo?.current_amount || '...'} USDC (Locked)
                  </Button>
                </div>
              )}

              {canClaim && !claimed && (
                <div className="space-y-4">
                  <div className="inline-flex items-center gap-2 bg-green-500/20 border border-green-500/40 rounded-full px-4 py-2 mb-2">
                    <span className="text-green-400 text-xl">✓</span>
                    <span className="text-green-400 font-mono text-sm font-bold">
                      Ready to Claim!
                    </span>
                  </div>
                  <h3 className="text-neon-white font-mono text-2xl mb-2">
                    You've earned <span className="text-neon-blue-light">${rewardInfo?.current_amount || '...'} USDC</span>
                  </h3>
                  <p className="text-neon-grey font-mono text-sm mb-6">
                    Connect your Solana wallet to receive your reward instantly
                  </p>
                  {rewardInfo?.tier === 'Early Bird' && (
                    <p className="text-yellow-400 font-mono text-xs mb-4">
                      🎉 Early Bird Bonus! You're in the first {rewardInfo.total_claims + 1}/50
                    </p>
                  )}
                  {!authenticated || !connectedWallet ? (
                    <div className="flex justify-center">
                      <WalletButton />
                    </div>
                  ) : (
                    <Button
                      onClick={handleClaimReward}
                      disabled={claiming}
                      className="w-full sm:w-auto px-8 py-6 text-lg bg-neon-blue-dark hover:bg-neon-blue-light font-mono border-2 border-dashed border-neon-blue-light/40"
                    >
                      {claiming ? (
                        <>
                          <span className="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                          Processing...
                        </>
                      ) : (
                        <>💰 Claim ${rewardInfo?.current_amount || '...'} USDC Reward →</>
                      )}
                    </Button>
                  )}
                  <div className="mt-4">
                    <p className="text-neon-grey font-mono text-xs">
                      Reference: <code className="text-neon-blue-light bg-neon-black px-2 py-1 rounded">
                        {reference.slice(0, 8)}...{reference.slice(-8)}
                      </code>
                    </p>
                    <p className="text-neon-grey font-mono text-xs mt-2">
                      Limited to 1 claim per wallet • Instant settlement via ONCHAIN x402
                    </p>
                  </div>
                </div>
              )}

              {claimed && successMessage && (
                <div className="space-y-4">
                  <div className="inline-flex items-center gap-2 bg-green-500/20 border border-green-500/40 rounded-full px-6 py-3 mb-4">
                    <span className="text-green-400 text-2xl">🎉</span>
                    <span className="text-green-400 font-mono text-base font-bold">
                      Reward Claimed!
                    </span>
                  </div>
                  <p className="text-neon-white font-mono text-lg text-center mb-4">
                    {successMessage}
                  </p>
                  {transactionSignature && (
                    <div className="text-center">
                      <a
                        href={`https://solscan.io/tx/${transactionSignature}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-2 text-neon-blue-light hover:text-neon-blue-dark font-mono text-sm underline transition-colors"
                      >
                        <span>View Transaction on Solscan</span>
                        <span className="text-xs">↗</span>
                      </a>
                      <p className="text-neon-grey font-mono text-xs mt-2">
                        {transactionSignature.substring(0, 8)}...{transactionSignature.substring(transactionSignature.length - 8)}
                      </p>
                    </div>
                  )}
                  <div className="mt-6 flex justify-center">
                    <Link href="/catalog">
                      <Button className="px-6 py-3 bg-neon-blue-dark hover:bg-neon-blue-light text-neon-white font-mono border-2 border-neon-blue-light transition-all">
                        Explore More Blinks →
                      </Button>
                    </Link>
                  </div>
                </div>
              )}
            </div>
          </Card>

          {/* Footer */}
          <div className="mt-8 text-center">
            <NeonDivider className="mb-6" />
            <p className="text-neon-grey font-mono text-xs mb-2">
              Built with ❤️ on Solana • Powered by ONCHAIN Connect
            </p>
            <p className="text-neon-grey font-mono text-xs">
              Protocol Fee: 0% • You keep 100% of your revenue
            </p>
          </div>
        </div>
      </section>
    </main>
  )
}
