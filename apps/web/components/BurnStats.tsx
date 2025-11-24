"use client"

import { useEffect, useState } from "react"
import { AnimatedNumber } from "./AnimatedNumber"
import { Card } from "./ui/card"
import { ExternalLink } from "lucide-react"

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'

interface BurnStats {
  totalBurned: string
  burned24h: string
  burned7d: string
  burned30d: string
  burnCount: number
  burnCount24h: number
  lastBurnAt: string | null
  burnRate: string
}

interface BurnerWallet {
  address: string
  solscanUrl: string
  explorerUrl: string
}

export function BurnStats() {
  const [stats, setStats] = useState<BurnStats | null>(null)
  const [wallet, setWallet] = useState<BurnerWallet | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchData = async () => {
      try {
        // Fetch burn stats
        const statsRes = await fetch(`${API_URL}/burns/stats`)
        if (statsRes.ok) {
          const statsData = await statsRes.json()
          if (statsData.success) {
            setStats(statsData.data)
          }
        }

        // Fetch burner wallet address
        const walletRes = await fetch(`${API_URL}/burns/wallet`)
        if (walletRes.ok) {
          const walletData = await walletRes.json()
          if (walletData.success) {
            setWallet(walletData.data)
          }
        }

        setLoading(false)
      } catch (err) {
        console.error('Failed to fetch burn stats:', err)
        setError('Failed to load burn statistics')
        setLoading(false)
      }
    }

    fetchData()

    // Auto-refresh every 30 seconds
    const interval = setInterval(fetchData, 30000)

    return () => clearInterval(interval)
  }, [])

  if (loading) {
    return (
      <section className="px-4 sm:px-6 py-12">
        <div className="max-w-6xl mx-auto">
          <Card className="bg-gradient-to-br from-orange-500/5 to-red-500/5 border-orange-500/20 p-8">
            <div className="flex items-center justify-center">
              <div className="animate-pulse text-orange-400">
                Loading burn statistics...
              </div>
            </div>
          </Card>
        </div>
      </section>
    )
  }

  if (error || !stats) {
    // Gracefully hide if burns aren't configured yet
    return null
  }

  const totalBurned = parseFloat(stats.totalBurned)
  const burned24h = parseFloat(stats.burned24h)
  const burnRate = parseFloat(stats.burnRate)

  // If no burns yet, show coming soon message
  if (totalBurned === 0) {
    return (
      <section className="px-4 sm:px-6 py-12">
        <div className="max-w-6xl mx-auto">
          <Card className="bg-gradient-to-br from-orange-500/5 to-red-500/5 border-orange-500/20 p-8">
            <div className="text-center">
              <div className="text-4xl mb-4">🔥</div>
              <h3 className="text-2xl font-sans font-light text-neon-white mb-2">
                Deflationary Tokenomics Coming Soon
              </h3>
              <p className="text-neon-grey font-mono text-sm">
                B402 auto-burn will activate with the first blink execution
              </p>
            </div>
          </Card>
        </div>
      </section>
    )
  }

  return (
    <section className="px-4 sm:px-6 py-16">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 mb-4">
            <span className="text-4xl">🔥</span>
            <h2 className="text-3xl md:text-4xl font-sans font-light text-neon-white">
              Deflationary Tokenomics
            </h2>
          </div>
          <p className="text-neon-grey font-mono text-sm max-w-2xl mx-auto">
            Every Blink execution permanently removes B402 tokens from circulation.
            Watch the supply decrease in real-time.
          </p>
        </div>

        {/* Main Stats Card */}
        <Card className="bg-gradient-to-br from-orange-500/5 to-red-500/5 border-orange-500/20 p-8 mb-6">
          <div className="grid md:grid-cols-2 gap-8">
            {/* Total Burned - Large Counter */}
            <div className="text-center md:text-left">
              <div className="text-orange-400/70 font-mono text-sm uppercase tracking-wider mb-2">
                Total B402 Burned Forever
              </div>
              <div className="text-5xl md:text-6xl font-mono text-neon-white mb-2 font-bold">
                <AnimatedNumber
                  value={totalBurned}
                  decimals={2}
                  duration={2500}
                />
              </div>
              <div className="text-orange-400 font-mono text-xs">
                {stats.burnCount.toLocaleString()} burn transactions
              </div>
            </div>

            {/* 24h Stats */}
            <div className="space-y-4">
              <div className="flex items-center justify-between p-4 bg-neon-dark/40 rounded border border-orange-500/10">
                <div>
                  <div className="text-neon-grey font-mono text-xs mb-1">
                    Burned (24h)
                  </div>
                  <div className="text-2xl font-mono text-neon-white font-semibold">
                    <AnimatedNumber
                      value={burned24h}
                      decimals={2}
                      duration={2000}
                    />
                  </div>
                </div>
                <div className="text-orange-400 text-3xl">🔥</div>
              </div>

              <div className="flex items-center justify-between p-4 bg-neon-dark/40 rounded border border-orange-500/10">
                <div>
                  <div className="text-neon-grey font-mono text-xs mb-1">
                    Burn Rate
                  </div>
                  <div className="text-2xl font-mono text-neon-white font-semibold">
                    {burnRate.toFixed(2)}/day
                  </div>
                </div>
                <div className="text-orange-400 text-3xl">⚡</div>
              </div>
            </div>
          </div>
        </Card>

        {/* Additional Stats Row */}
        <div className="grid md:grid-cols-3 gap-4 mb-6">
          <Card className="bg-neon-dark/20 border-orange-500/10 p-6 text-center">
            <div className="text-neon-grey font-mono text-xs mb-2">
              7 Days
            </div>
            <div className="text-2xl font-mono text-neon-white font-semibold">
              {parseFloat(stats.burned7d).toFixed(2)}
            </div>
            <div className="text-orange-400/70 font-mono text-xs mt-1">
              B402 burned
            </div>
          </Card>

          <Card className="bg-neon-dark/20 border-orange-500/10 p-6 text-center">
            <div className="text-neon-grey font-mono text-xs mb-2">
              30 Days
            </div>
            <div className="text-2xl font-mono text-neon-white font-semibold">
              {parseFloat(stats.burned30d).toFixed(2)}
            </div>
            <div className="text-orange-400/70 font-mono text-xs mt-1">
              B402 burned
            </div>
          </Card>

          <Card className="bg-neon-dark/20 border-orange-500/10 p-6 text-center">
            <div className="text-neon-grey font-mono text-xs mb-2">
              Burns Today
            </div>
            <div className="text-2xl font-mono text-neon-white font-semibold">
              {stats.burnCount24h}
            </div>
            <div className="text-orange-400/70 font-mono text-xs mt-1">
              transactions
            </div>
          </Card>
        </div>

        {/* Transparency Section */}
        {wallet && (
          <div className="text-center">
            <p className="text-neon-grey font-mono text-xs mb-3">
              100% Transparent - All burns are on-chain and verifiable
            </p>
            <div className="flex items-center justify-center gap-4">
              <a
                href={wallet.solscanUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-4 py-2 bg-neon-dark border border-orange-500/30 rounded font-mono text-xs text-orange-400 hover:border-orange-400 hover:text-orange-300 transition-all"
              >
                <span>View Burner Wallet</span>
                <ExternalLink className="w-3 h-3" />
              </a>
              <span className="text-neon-grey font-mono text-xs">
                {wallet.address.substring(0, 4)}...{wallet.address.substring(wallet.address.length - 4)}
              </span>
            </div>
          </div>
        )}
      </div>
    </section>
  )
}
