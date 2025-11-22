"use client"

import { useEffect, useState } from "react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import Link from "next/link"
import NeonDivider from "@/components/NeonDivider"
import { WalletButton } from "@/components/wallet"
import { usePrivy, useWallets } from "@privy-io/react-auth"

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'

export default function ThankYouPage() {
  // Generate reference once on mount (client-side only to avoid hydration mismatch)
  const [reference, setReference] = useState<string>('')
  const { ready, authenticated, user } = usePrivy()
  const { wallets } = useWallets()

  // Generate reference after mount to avoid SSR hydration mismatch
  useEffect(() => {
    if (!reference) {
      setReference(crypto.randomUUID())
    }
  }, [reference])

  // Get wallet address (same pattern as checkout page)
  const wallet = wallets[0]
  const solanaAccount: any = user?.linkedAccounts?.find(
    (account: any) => account.type === 'wallet' && account.chainType === 'solana'
  )
  const connectedWallet = (solanaAccount as any)?.address || wallet?.address

  const [claiming, setClaiming] = useState(false)
  const [claimed, setClaimed] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const [transactionSignature, setTransactionSignature] = useState<string | null>(null)
  const [campaignInfo, setCampaignInfo] = useState<{
    remaining_claims: number
    total_claimed: number
    max_claims: number
    active: boolean
  } | null>(null)

  const handleClaimReward = async () => {
    if (!authenticated || !connectedWallet) {
      setError('Please connect your Solana wallet first')
      return
    }

    if (!reference) {
      setError('Initializing... Please try again in a moment')
      return
    }

    setClaiming(true)
    setError(null)

    try {
      // Call the thank-you-claim endpoint
      const response = await fetch(`${API_BASE_URL}/a/thank-you-claim`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reference,
          user_wallet: connectedWallet,
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
    // Fetch campaign info
    const fetchCampaignInfo = async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/a/campaign-info/thank-you-claim`)
        if (response.ok) {
          const data = await response.json()
          setCampaignInfo(data)
        }
      } catch (err) {
        console.error('Failed to fetch campaign info:', err)
      }
    }

    fetchCampaignInfo()
  }, [])

  return (
    <main className="min-h-screen bg-neon-black">
      <section className="px-4 sm:px-6 py-8 sm:py-12">
        <div className="max-w-5xl mx-auto">
          {/* Header */}
          <div className="text-center mb-8">
            {campaignInfo?.active === false ? (
              <Badge className="bg-yellow-500/20 text-yellow-400 border-yellow-500/30 mb-4 text-sm">
                ⏰ CAMPAIGN ENDED
              </Badge>
            ) : (
              <Badge className="bg-green-500/20 text-green-400 border-green-500/30 mb-4 text-sm">
                🎁 {campaignInfo?.remaining_claims || '500'} REWARDS AVAILABLE
              </Badge>
            )}
            <h1 className="font-sans text-neon-white mb-4 text-3xl sm:text-4xl md:text-5xl font-light">
              Thank You for Supporting <span className="text-neon-blue-light">Blinkx402</span>!
            </h1>
            <p className="text-neon-grey font-mono text-sm sm:text-base max-w-2xl mx-auto">
              {campaignInfo?.active === false ? (
                <>
                  This reward campaign has ended. Follow us on social media to stay updated on future opportunities!
                </>
              ) : (
                <>
                  Your support means the world to us. Claim your USDC reward below and join our growing community!
                </>
              )}
            </p>
            {campaignInfo && campaignInfo.active && campaignInfo.remaining_claims < 50 && (
              <p className="text-yellow-400 font-mono text-xs mt-2">
                ⚡ Only {campaignInfo.remaining_claims} rewards remaining!
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
            <div className="grid sm:grid-cols-2 gap-4 max-w-2xl mx-auto">
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
              </div>
            </Card>
          </div>

          {/* Claim Reward Section */}
          <Card className="bg-gradient-to-br from-neon-dark to-neon-black border-neon-blue-light/40 p-6 sm:p-8 text-center">
            <div className="max-w-2xl mx-auto">
              {campaignInfo?.active === false ? (
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
                    Total Claims: {campaignInfo?.total_claimed || 0} / {campaignInfo?.max_claims || 500}
                  </p>
                </div>
              ) : !claimed ? (
                <div className="space-y-4">
                  <div className="inline-flex items-center gap-2 bg-green-500/20 border border-green-500/40 rounded-full px-4 py-2 mb-2">
                    <span className="text-green-400 text-xl">🎁</span>
                    <span className="text-green-400 font-mono text-sm font-bold">
                      Claim Your Reward!
                    </span>
                  </div>
                  <h3 className="text-neon-white font-mono text-2xl mb-2">
                    You're eligible for a <span className="text-neon-blue-light">USDC reward</span>
                  </h3>
                  <p className="text-neon-grey font-mono text-sm mb-6">
                    Connect your Solana wallet to receive your reward instantly
                  </p>
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
                        <>💰 Claim USDC Reward →</>
                      )}
                    </Button>
                  )}
                  <div className="mt-4">
                    {reference && (
                      <p className="text-neon-grey font-mono text-xs">
                        Reference: <code className="text-neon-blue-light bg-neon-black px-2 py-1 rounded">
                          {reference.slice(0, 8)}...{reference.slice(-8)}
                        </code>
                      </p>
                    )}
                    <p className="text-neon-grey font-mono text-xs mt-2">
                      One claim per wallet • Instant settlement via reward mode
                    </p>
                  </div>
                </div>
              ) : null}

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
