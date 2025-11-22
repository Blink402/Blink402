'use client'

import { useEffect, useState } from 'react'
import { usePrivy, useWallets } from '@privy-io/react-auth'
import { Copy, Check, Twitter, Share2, TrendingUp, Users, DollarSign, Award } from 'lucide-react'
import { Card } from '@/components/ui/card'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'

interface ReferralStats {
  code: string | null
  tier: string
  total_referrals: number
  total_earnings_usdc: string
  share_url: string | null
  referrals: Array<{
    referee_wallet: string
    referred_at: string
    first_call_at: string | null
    total_spent_usdc: string
    commission_paid_usdc: string
    status: 'active' | 'pending'
  }>
}

interface LeaderboardEntry {
  rank: number
  wallet: string
  code: string
  tier: string
  total_referrals: number
  total_earnings_usdc: string
  creator_name: string | null
  creator_avatar: string | null
}

export default function ReferralsPage() {
  const { authenticated, login } = usePrivy()
  const { wallets } = useWallets()
  const [stats, setStats] = useState<ReferralStats | null>(null)
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [copied, setCopied] = useState(false)
  const [generatingCode, setGeneratingCode] = useState(false)

  // Get wallet address with Solana priority (Fix Pack 8)
  const wallet = wallets[0]
  const user = (wallet as any)?._user
  const solanaAccount: any = user?.linkedAccounts?.find(
    (account: any) => account.type === 'wallet' && account.chainType === 'solana'
  )
  const connectedWallet = (solanaAccount as any)?.address || wallet?.address

  useEffect(() => {
    if (authenticated && connectedWallet) {
      fetchReferralStats()
      fetchLeaderboard()
    } else {
      setLoading(false)
    }
  }, [authenticated, connectedWallet])

  const fetchReferralStats = async () => {
    if (!connectedWallet) return

    try {
      const response = await fetch(`${API_URL}/referrals/stats?wallet=${connectedWallet}`)
      const data = await response.json()

      if (data.success) {
        setStats(data.data)
      }
    } catch (error) {
      console.error('Failed to fetch referral stats:', error)
    } finally {
      setLoading(false)
    }
  }

  const fetchLeaderboard = async () => {
    try {
      const response = await fetch(`${API_URL}/referrals/leaderboard?period=all&limit=10`)
      const data = await response.json()

      if (data.success) {
        setLeaderboard(data.data.leaderboard)
      }
    } catch (error) {
      console.error('Failed to fetch leaderboard:', error)
    }
  }

  const generateReferralCode = async () => {
    if (!connectedWallet || generatingCode) return

    setGeneratingCode(true)

    try {
      const response = await fetch(`${API_URL}/referrals/generate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ wallet: connectedWallet }),
      })

      const data = await response.json()

      if (data.success) {
        setStats({
          code: data.data.code,
          tier: data.data.tier,
          total_referrals: data.data.total_referrals,
          total_earnings_usdc: data.data.total_earnings_usdc,
          share_url: data.data.share_url,
          referrals: []
        })
      }
    } catch (error) {
      console.error('Failed to generate referral code:', error)
    } finally {
      setGeneratingCode(false)
    }
  }

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (error) {
      console.error('Failed to copy:', error)
    }
  }

  const shareOnTwitter = () => {
    const text = `I'm earning passive income by sharing Blink402! Use my code ${stats?.code} to get started.\n\n${stats?.share_url}`
    const url = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`
    window.open(url, '_blank')
  }

  const getTierColor = (tier: string) => {
    switch (tier) {
      case 'gold':
        return 'text-yellow-400'
      case 'silver':
        return 'text-gray-300'
      default:
        return 'text-amber-600'
    }
  }

  const getTierBadge = (tier: string) => {
    switch (tier) {
      case 'gold':
        return '🏆 Gold'
      case 'silver':
        return '🥈 Silver'
      default:
        return '🥉 Bronze'
    }
  }

  if (!authenticated) {
    return (
      <div className="min-h-screen bg-[--neon-black] text-white flex items-center justify-center p-4">
        <Card className="p-8 text-center max-w-md w-full">
          <h1 className="text-3xl font-light mb-4">Referral Program</h1>
          <p className="text-gray-400 mb-6">
            Earn commission by referring friends to Blink402. Connect your wallet to get started.
          </p>
          <button
            onClick={login}
            className="w-full py-3 bg-gradient-to-r from-[--neon-blue-light] to-[--neon-blue-dark] text-white rounded font-medium hover:opacity-90 transition"
          >
            Connect Wallet
          </button>
        </Card>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[--neon-black] text-white flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block w-8 h-8 border-4 border-[--neon-blue-light] border-t-transparent rounded-full animate-spin mb-4"></div>
          <p className="text-gray-400">Loading referral stats...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[--neon-black] text-white p-4 md:p-8">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-light mb-2">Referral Program</h1>
          <p className="text-gray-400">
            Earn 5-15% commission by referring friends to Blink402
          </p>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <Card className="p-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-gray-400 text-sm">Total Earnings</span>
              <DollarSign className="w-5 h-5 text-green-400" />
            </div>
            <p className="text-2xl font-bold">${stats?.total_earnings_usdc || '0.00'}</p>
          </Card>

          <Card className="p-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-gray-400 text-sm">Referrals</span>
              <Users className="w-5 h-5 text-blue-400" />
            </div>
            <p className="text-2xl font-bold">{stats?.total_referrals || 0}</p>
          </Card>

          <Card className="p-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-gray-400 text-sm">Tier</span>
              <Award className="w-5 h-5 text-yellow-400" />
            </div>
            <p className={`text-2xl font-bold ${getTierColor(stats?.tier || 'bronze')}`}>
              {getTierBadge(stats?.tier || 'bronze')}
            </p>
          </Card>

          <Card className="p-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-gray-400 text-sm">Commission Rate</span>
              <TrendingUp className="w-5 h-5 text-purple-400" />
            </div>
            <p className="text-2xl font-bold">
              {stats?.tier === 'gold' ? '15%' : stats?.tier === 'silver' ? '10%' : '5%'}
            </p>
          </Card>
        </div>

        {/* Referral Code Card */}
        {stats?.code ? (
          <Card className="p-6 mb-8">
            <h2 className="text-xl font-light mb-4">Your Referral Link</h2>
            <div className="flex flex-col md:flex-row gap-3">
              <input
                type="text"
                value={stats.share_url || ''}
                readOnly
                className="flex-1 px-4 py-3 bg-[--neon-dark] border border-gray-700 rounded text-white"
              />
              <button
                onClick={() => copyToClipboard(stats.share_url || '')}
                className="px-6 py-3 bg-gradient-to-r from-[--neon-blue-light] to-[--neon-blue-dark] text-white rounded font-medium hover:opacity-90 transition flex items-center gap-2 justify-center"
              >
                {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                {copied ? 'Copied!' : 'Copy'}
              </button>
              <button
                onClick={shareOnTwitter}
                className="px-6 py-3 bg-blue-500 text-white rounded font-medium hover:bg-blue-600 transition flex items-center gap-2 justify-center"
              >
                <Twitter className="w-4 h-4" />
                Share
              </button>
            </div>
            <p className="text-sm text-gray-400 mt-3">
              Your code: <span className="font-mono text-[--neon-blue-light]">{stats.code}</span>
            </p>
          </Card>
        ) : (
          <Card className="p-6 mb-8 text-center">
            <h2 className="text-xl font-light mb-2">Get Your Referral Code</h2>
            <p className="text-gray-400 mb-4">
              Generate your unique referral code and start earning commission
            </p>
            <button
              onClick={generateReferralCode}
              disabled={generatingCode}
              className="px-6 py-3 bg-gradient-to-r from-[--neon-blue-light] to-[--neon-blue-dark] text-white rounded font-medium hover:opacity-90 transition disabled:opacity-50"
            >
              {generatingCode ? 'Generating...' : 'Generate Code'}
            </button>
          </Card>
        )}

        {/* Tier Progress */}
        {stats?.code && (
          <Card className="p-6 mb-8">
            <h2 className="text-xl font-light mb-4">Tier Progress</h2>
            <div className="space-y-4">
              {stats.tier !== 'silver' && stats.tier !== 'gold' && (
                <div>
                  <div className="flex justify-between text-sm mb-2">
                    <span>Progress to Silver (10+ referrals)</span>
                    <span>{stats.total_referrals}/11</span>
                  </div>
                  <div className="w-full bg-gray-700 rounded-full h-2">
                    <div
                      className="bg-gradient-to-r from-[--neon-blue-light] to-[--neon-blue-dark] h-2 rounded-full transition-all"
                      style={{ width: `${Math.min((stats.total_referrals / 11) * 100, 100)}%` }}
                    />
                  </div>
                </div>
              )}
              {stats.tier === 'silver' && (
                <div>
                  <div className="flex justify-between text-sm mb-2">
                    <span>Progress to Gold (50+ referrals)</span>
                    <span>{stats.total_referrals}/51</span>
                  </div>
                  <div className="w-full bg-gray-700 rounded-full h-2">
                    <div
                      className="bg-gradient-to-r from-yellow-400 to-yellow-600 h-2 rounded-full transition-all"
                      style={{ width: `${Math.min((stats.total_referrals / 51) * 100, 100)}%` }}
                    />
                  </div>
                </div>
              )}
              {stats.tier === 'gold' && (
                <div className="text-center py-4">
                  <p className="text-xl text-yellow-400">🎉 You've reached the highest tier!</p>
                  <p className="text-gray-400 mt-2">Keep referring to earn 15% + 2% lifetime commission</p>
                </div>
              )}
            </div>
          </Card>
        )}

        {/* Referrals List */}
        {stats?.referrals && stats.referrals.length > 0 && (
          <Card className="p-6 mb-8">
            <h2 className="text-xl font-light mb-4">Your Referrals</h2>
            <div className="space-y-3">
              {stats.referrals.map((ref, idx) => (
                <div
                  key={idx}
                  className="flex items-center justify-between p-4 bg-[--neon-dark] rounded border border-gray-700"
                >
                  <div>
                    <p className="font-mono text-sm">{ref.referee_wallet.slice(0, 8)}...{ref.referee_wallet.slice(-6)}</p>
                    <p className="text-xs text-gray-400">
                      Referred {new Date(ref.referred_at).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-medium">${ref.commission_paid_usdc} earned</p>
                    <p className="text-xs text-gray-400">
                      {ref.status === 'active' ? '✅ Active' : '⏳ Pending first call'}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        )}

        {/* Leaderboard */}
        {leaderboard.length > 0 && (
          <Card className="p-6">
            <h2 className="text-xl font-light mb-4">Top Referrers</h2>
            <div className="space-y-2">
              {leaderboard.map((entry) => (
                <div
                  key={entry.rank}
                  className={`flex items-center justify-between p-4 rounded ${
                    entry.wallet === connectedWallet
                      ? 'bg-[--neon-blue-dark] bg-opacity-20 border border-[--neon-blue-light]'
                      : 'bg-[--neon-dark]'
                  }`}
                >
                  <div className="flex items-center gap-4">
                    <span className="text-2xl font-bold text-gray-400 w-8">#{entry.rank}</span>
                    <div>
                      <p className="font-medium">{entry.creator_name || `${entry.wallet.slice(0, 8)}...`}</p>
                      <p className="text-xs text-gray-400">{entry.total_referrals} referrals</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-green-400">${entry.total_earnings_usdc}</p>
                    <p className={`text-xs ${getTierColor(entry.tier)}`}>{getTierBadge(entry.tier)}</p>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        )}
      </div>
    </div>
  )
}
