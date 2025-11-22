"use client"
import { useEffect, useState } from "react"
import { getDashboardData, updateBlink } from "@/lib/api"
import { usePrivy, useWallets } from "@privy-io/react-auth"
import type { DashboardData } from "@/lib/types"
import { useRouter } from "next/navigation"
import { logger } from "@/lib/logger"
import NeonDivider from "@/components/NeonDivider"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import Link from "next/link"
import { AnimatedNumber } from "@/components/AnimatedNumber"

export default function DashboardPage() {
  const router = useRouter()
  const { ready, authenticated, login, user } = usePrivy()
  const { wallets } = useWallets()

  // Get wallet address from wallets or linkedAccounts (same pattern as create page)
  const walletFromArray = wallets[0]
  const solanaAccount: any = user?.linkedAccounts?.find(
    (account: any) => account.type === 'wallet' && account.chainType === 'solana'
  )
  const wallet = walletFromArray?.address || (solanaAccount as any)?.address
  const isAuthenticated = authenticated && !!wallet
  const [searchQuery, setSearchQuery] = useState("")
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "paused">("all")
  const [data, setData] = useState<DashboardData | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [authError, setAuthError] = useState<string | null>(null)
  const [updatingBlinkId, setUpdatingBlinkId] = useState<string | null>(null)

  useEffect(() => {
    // Load dashboard data when authenticated
    if (isAuthenticated && wallet) {
      setIsLoading(true)

      // Generate auth token for dashboard access
      const loadDashboard = async () => {
        try {
          // Import auth utilities
          const { generateAuthMessage, createAuthToken, encodeAuthToken } = await import('@/lib/auth')

          // Generate auth message
          const { message } = generateAuthMessage(wallet)

          // Use window.solana for signing
          // @ts-ignore
          const solana = window.solana || window.phantom?.solana

          if (!solana) {
            throw new Error('No Solana wallet found. Please install Phantom or Solflare and connect it.')
          }

          if (!solana.isConnected) {
            throw new Error('Wallet not connected. Please connect your wallet in the navigation bar.')
          }

          // Convert message to Uint8Array for Solana signing
          const messageBytes = new TextEncoder().encode(message)

          // Request signature from Solana wallet
          let signature: Uint8Array
          try {
            const signResult = await solana.signMessage(messageBytes, 'utf8')
            signature = signResult.signature
          } catch (signError: any) {
            if (signError.message?.includes('rejected') || signError.message?.includes('denied')) {
              throw new Error('Signature rejected by user')
            }
            throw new Error(`Failed to sign message: ${signError.message}`)
          }

          // Convert signature bytes to base58 string
          const bs58 = await import('bs58')
          const signatureBase58 = bs58.default.encode(signature)

          // Create and encode auth token
          const authToken = createAuthToken(wallet, signatureBase58, message)
          const encodedToken = encodeAuthToken(authToken)

          // Fetch dashboard data with auth token
          const dashboardData = await getDashboardData(wallet, encodedToken)
          setData(dashboardData)
          setIsLoading(false)
          setAuthError(null)
        } catch (error) {
          logger.error('Error loading dashboard:', error)
          setAuthError(error instanceof Error ? error.message : 'Failed to load dashboard')
          setIsLoading(false)
        }
      }

      loadDashboard()
    }
  }, [isAuthenticated, wallet])

  const handleEditBlink = (slug: string) => {
    router.push(`/blink/${slug}?edit=true`)
  }

  const handleToggleStatus = async (slug: string, currentStatus: string) => {
    if (!wallet) {
      setAuthError("Wallet not connected")
      return
    }

    setUpdatingBlinkId(slug)
    setAuthError(null)

    try {
      // Import auth utilities
      const { generateAuthMessage, createAuthToken, encodeAuthToken } = await import('@/lib/auth')

      // Generate auth message
      const { message } = generateAuthMessage(wallet)

      // Use window.solana for signing (same pattern as create page)
      // @ts-ignore
      const solana = window.solana || window.phantom?.solana

      if (!solana) {
        throw new Error('No Solana wallet found. Please install Phantom or Solflare and connect it.')
      }

      if (!solana.isConnected) {
        throw new Error('Wallet not connected. Please connect your wallet in the navigation bar.')
      }

      // Convert message to Uint8Array for Solana signing
      const messageBytes = new TextEncoder().encode(message)

      // Request signature from Solana wallet
      let signature: Uint8Array
      try {
        const signResult = await solana.signMessage(messageBytes, 'utf8')
        signature = signResult.signature
      } catch (signError: any) {
        if (signError.message?.includes('rejected') || signError.message?.includes('denied')) {
          throw new Error('Signature rejected by user')
        }
        throw new Error(`Failed to sign message: ${signError.message}`)
      }

      // Convert signature bytes to base58 string
      const bs58 = await import('bs58')
      const signatureBase58 = bs58.default.encode(signature)

      // Create and encode auth token
      const authToken = createAuthToken(wallet, signatureBase58, message)
      const encodedToken = encodeAuthToken(authToken)

      const newStatus = currentStatus === "active" ? "paused" : "active"
      await updateBlink(slug, { status: newStatus }, encodedToken)

      // Refresh dashboard data (reuse the same auth token)
      if (wallet) {
        const dashboardData = await getDashboardData(wallet, encodedToken)
        setData(dashboardData)
      }
    } catch (error) {
      logger.error('Error updating blink:', error)
      setAuthError(error instanceof Error ? error.message : "Failed to update blink")
    } finally {
      setUpdatingBlinkId(null)
    }
  }

  // Filter blinks
  const filteredBlinks = data?.blinks.filter((blink) => {
    const matchesSearch =
      searchQuery === "" ||
      blink.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      blink.description.toLowerCase().includes(searchQuery.toLowerCase())

    const matchesStatus = statusFilter === "all" || blink.status === statusFilter

    return matchesSearch && matchesStatus
  }) || []

  // Show sign-in prompt if not authenticated
  if (!isAuthenticated && ready) {
    return (
      <div className="min-h-screen bg-neon-black flex items-center justify-center">
        <div className="text-center max-w-md px-6">
          <div className="w-40 h-40 mx-auto mb-6 bg-neon-dark border border-neon-blue-dark/30 rounded-lg flex items-center justify-center">
            <div className="text-6xl">🔒</div>
          </div>
          <h1 className="text-neon-white font-sans text-3xl mb-4">
            Creator Dashboard
          </h1>
          <p className="text-neon-grey font-mono text-sm mb-8">
            Sign in with your Solana wallet to access your dashboard
          </p>
          {wallet ? (
            <Button onClick={login} className="btn-primary btn-ripple">
              Sign Message to Authenticate
            </Button>
          ) : (
            <p className="text-neon-grey font-mono text-sm">
              Please connect your wallet using the button above
            </p>
          )}
          {authError && (
            <p className="text-red-500 font-mono text-xs mt-4">{authError}</p>
          )}
        </div>
      </div>
    )
  }

  // Show loading state
  if (isLoading || !data || !ready) {
    return (
      <div className="min-h-screen bg-neon-black flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 mx-auto mb-4 bg-neon-dark border border-neon-blue-dark/30 rounded-lg flex items-center justify-center">
            <div className="text-2xl">⏳</div>
          </div>
          <p className="text-neon-grey font-mono text-sm">
            {!ready ? 'Initializing...' : 'Loading dashboard...'}
          </p>
        </div>
      </div>
    )
  }

  return (
    <main className="min-h-screen bg-neon-black">
      {/* Header */}
      <section className="px-6 py-8">
        <div className="max-w-7xl mx-auto">
          <div className="mb-8">
            <Link href="/" className="link-gradient text-neon-blue-light hover:text-neon-blue-dark font-mono text-sm">
              ← Back to home
            </Link>
          </div>

          <header className="flex items-center justify-between mb-12">
            <div>
              <h1
                className="font-sans text-neon-white mb-2 heading-md"
              >
                Creator Dashboard
              </h1>
              <p className="text-neon-grey font-mono text-sm">
                Connected: <span className="text-neon-blue-light">{data.wallet}</span>
              </p>
            </div>
            <Link href="/create">
              <Button className="btn-primary btn-ripple">+ Create New Blink</Button>
            </Link>
          </header>

          {/* Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
            <Card className="bg-neon-dark border-neon-blue-dark/20 p-6">
              <div className="text-neon-grey font-mono text-sm mb-2">Total Earnings</div>
              <div className="text-neon-white font-mono text-3xl mb-1">
                <AnimatedNumber
                  value={parseFloat(data.totalEarnings)}
                  decimals={2}
                  prefix="$"
                  duration={2500}
                />
              </div>
              <div className="text-neon-blue-light font-mono text-xs">USDC</div>
            </Card>

            <Card className="bg-neon-dark border-neon-blue-dark/20 p-6">
              <div className="text-neon-grey font-mono text-sm mb-2">Total Runs</div>
              <div className="text-neon-white font-mono text-3xl mb-1">
                <AnimatedNumber
                  value={data.totalRuns}
                  decimals={0}
                  duration={2000}
                />
              </div>
              <div className="text-neon-blue-light font-mono text-xs">+12% this week</div>
            </Card>

            <Card className="bg-neon-dark border-neon-blue-dark/20 p-6">
              <div className="text-neon-grey font-mono text-sm mb-2">Active Blinks</div>
              <div className="text-neon-white font-mono text-3xl mb-1">
                <AnimatedNumber
                  value={data.activeBlinks}
                  decimals={0}
                  duration={1800}
                />
              </div>
              <div className="text-neon-grey font-mono text-xs">out of {data.blinks.length} total</div>
            </Card>

            <Card className="bg-neon-dark border-neon-blue-dark/20 p-6">
              <div className="text-neon-grey font-mono text-sm mb-2">Avg Price</div>
              <div className="text-neon-white font-mono text-3xl mb-1">
                <AnimatedNumber
                  value={parseFloat(data.avgPrice)}
                  decimals={2}
                  prefix="$"
                  duration={2200}
                />
              </div>
              <div className="text-neon-grey font-mono text-xs">per call</div>
            </Card>
          </div>

          {/* Blinks Management */}
          <div className="mb-12">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-neon-white font-mono text-2xl">Your Blinks</h2>
              <div className="flex gap-4">
                <Input
                  type="text"
                  placeholder="Search blinks..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-64 bg-neon-dark border-neon-blue-dark/30 text-neon-white font-mono"
                />
                <Select value={statusFilter} onValueChange={(value: any) => setStatusFilter(value)}>
                  <SelectTrigger className="w-32 bg-neon-dark border-neon-blue-dark/30 text-neon-white font-mono">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-neon-dark border-neon-blue-dark/30">
                    <SelectItem value="all">All</SelectItem>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="paused">Paused</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Blinks Table */}
            <Card className="bg-neon-dark border-neon-blue-dark/20 overflow-hidden">
              {/* Mobile: Sticky scroll indicator */}
              <div className="md:hidden sticky left-0 z-10 text-center py-2 text-neon-blue-light text-xs font-mono border-b border-neon-blue-dark/10 bg-neon-dark/95">
                ← Swipe to see all columns →
              </div>

              <div className="relative overflow-x-auto">
                {/* Gradient fade on right edge (scroll hint) */}
                <div className="md:hidden absolute right-0 top-0 bottom-0 w-12 bg-gradient-to-l from-neon-dark via-neon-dark/80 to-transparent pointer-events-none z-10" />

                <table className="w-full min-w-[800px]">
                  <thead>
                    <tr className="border-b border-neon-blue-dark/20">
                      <th className="text-left p-4 text-neon-grey font-mono text-xs uppercase">Blink</th>
                      <th className="text-left p-4 text-neon-grey font-mono text-xs uppercase">Status</th>
                      <th className="text-right p-4 text-neon-grey font-mono text-xs uppercase">Price</th>
                      <th className="text-right p-4 text-neon-grey font-mono text-xs uppercase">Runs</th>
                      <th className="text-right p-4 text-neon-grey font-mono text-xs uppercase">Revenue</th>
                      <th className="text-right p-4 text-neon-grey font-mono text-xs uppercase">Success</th>
                      <th className="text-left p-4 text-neon-grey font-mono text-xs uppercase">Last Run</th>
                      <th className="text-right p-4 text-neon-grey font-mono text-xs uppercase">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredBlinks.map((blink) => (
                      <tr
                        key={blink.id}
                        className="border-b border-neon-blue-dark/10 hover:bg-neon-black/50 active:bg-neon-black/70 transition-colors"
                      >
                        <td className="p-4">
                          <div>
                            <Link
                              href={`/blink/${blink.slug}`}
                              className="text-neon-white font-mono text-sm hover:text-neon-blue-light active:text-neon-blue-light active:underline transition-all"
                            >
                              {blink.title}
                            </Link>
                            <div className="text-neon-grey font-mono text-xs mt-1">
                              {blink.description.substring(0, 40)}...
                            </div>
                          </div>
                        </td>
                        <td className="p-4">
                          <Badge
                            className={
                              blink.status === "active"
                                ? "bg-neon-blue-dark/20 text-neon-blue-light border-neon-blue-dark/30"
                                : "bg-neon-grey/20 text-neon-grey border-neon-grey/30"
                            }
                          >
                            {blink.status}
                          </Badge>
                        </td>
                        <td className="p-4 text-right">
                          <span className="text-neon-white font-mono text-sm">${blink.price_usdc}</span>
                        </td>
                        <td className="p-4 text-right">
                          <span className="text-neon-white font-mono text-sm">{blink.runs.toLocaleString()}</span>
                        </td>
                        <td className="p-4 text-right">
                          <span className="text-neon-blue-light font-mono text-sm">${blink.revenue}</span>
                        </td>
                        <td className="p-4 text-right">
                          <span className="text-neon-white font-mono text-sm">{blink.successRate}%</span>
                        </td>
                        <td className="p-4">
                          <span className="text-neon-grey font-mono text-xs">{blink.lastRun}</span>
                        </td>
                        <td className="p-4 text-right">
                          <button
                            onClick={() => handleEditBlink(blink.slug)}
                            className="text-neon-blue-light hover:text-neon-blue-dark active:text-neon-blue-dark active:underline font-mono text-xs mr-3 transition-all"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => handleToggleStatus(blink.slug, blink.status)}
                            disabled={updatingBlinkId === blink.slug}
                            className="text-neon-grey hover:text-neon-white active:text-neon-white active:underline font-mono text-xs disabled:opacity-50 transition-all"
                          >
                            {updatingBlinkId === blink.slug
                              ? "Updating..."
                              : blink.status === "active"
                              ? "Pause"
                              : "Resume"}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {filteredBlinks.length === 0 && (
                <div className="p-12 text-center">
                  <div className="w-40 h-40 mx-auto mb-6 bg-neon-dark border border-neon-blue-dark/30 rounded-lg flex items-center justify-center">
                    <div className="text-6xl">📊</div>
                  </div>
                  <p className="text-neon-grey font-mono text-sm mb-4">
                    {data.blinks.length === 0
                      ? "You haven't created any Blinks yet"
                      : "No blinks found matching your filters"}
                  </p>
                  {data.blinks.length === 0 ? (
                    <Link href="/create">
                      <Button className="btn-primary btn-ripple">Create Your First Blink</Button>
                    </Link>
                  ) : (
                    <Button
                      onClick={() => {
                        setSearchQuery("")
                        setStatusFilter("all")
                      }}
                      className="btn-ghost btn-ripple"
                    >
                      Clear Filters
                    </Button>
                  )}
                </div>
              )}
            </Card>
          </div>

          {/* Recent Activity */}
          <div>
            <h2 className="text-neon-white font-mono text-2xl mb-6">Recent Activity</h2>
            <Card className="bg-neon-dark border-neon-blue-dark/20 p-6">
              {data.recentActivity && data.recentActivity.length > 0 ? (
                <div className="space-y-4">
                  {data.recentActivity.map((activity) => (
                    <div
                      key={activity.id}
                      className="flex items-center justify-between pb-4 border-b border-neon-blue-dark/10 last:border-0 last:pb-0"
                    >
                      <div className="flex items-center gap-4">
                        <div
                          className={`
                            w-2 h-2 rounded-full
                            ${activity.status === "success" ? "bg-neon-blue-light" : "bg-red-500"}
                          `}
                        />
                        <div>
                          <div className="text-neon-white font-mono text-sm">{activity.blink}</div>
                          <div className="text-neon-grey font-mono text-xs mt-1">{activity.time}</div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-neon-blue-light font-mono text-sm">${activity.amount} USDC</div>
                        <div
                          className={`
                            font-mono text-xs mt-1
                            ${activity.status === "success" ? "text-neon-blue-light" : "text-red-500"}
                          `}
                        >
                          {activity.status}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8">
                  <p className="text-neon-grey font-mono text-sm">
                    No recent activity yet. Create your first Blink to get started!
                  </p>
                </div>
              )}
            </Card>
          </div>
        </div>
      </section>
    </main>
  )
}
