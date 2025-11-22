"use client"
import { useEffect, useState } from "react"
import Link from "next/link"
import { useParams } from "next/navigation"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import NeonDivider from "@/components/NeonDivider"
import Lottie from "@/components/Lottie"
import TokenPriceResult from "@/components/TokenPriceResult"

type ResultsData = {
  signature: string
  reference: string
  payer: string
  status: string
  duration_ms: number | null
  created_at: string
  paid_at: string | null
  executed_at: string | null
  blink: {
    id: string
    slug: string
    title: string
    description: string
    price_usdc: string
    payment_token: string
    icon_url: string
    category: string
  }
  creator: {
    wallet: string
    display_name: string | null
  }
  explorer_url: string
  response_data?: any
}

export default function ResultsPage() {
  const params = useParams()
  const id = params.id as string
  const [results, setResults] = useState<ResultsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!id) return

    let pollInterval: NodeJS.Timeout | null = null
    let pollAttempts = 0
    const MAX_POLL_ATTEMPTS = 20 // Poll for up to 20 seconds (20 attempts * 1s)

    const fetchResults = async () => {
      try {
        // Try to fetch by signature first, then by reference
        let res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'https://blink402-production.up.railway.app'}/receipts/tx/${id}`)

        if (!res.ok) {
          // If not found by signature, try by reference
          res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'https://blink402-production.up.railway.app'}/receipts/ref/${id}`)
        }

        if (res.ok) {
          const data = await res.json()
          setResults(data.data)
          setLoading(false)

          // If status is 'executed' but no response_data yet, keep polling
          if (data.data.status === 'executed' && !data.data.response_data) {
            pollAttempts++
            if (pollAttempts < MAX_POLL_ATTEMPTS) {
              // Continue polling every 1 second
              if (!pollInterval) {
                pollInterval = setInterval(fetchResults, 1000)
              }
            } else {
              // Max attempts reached, stop polling
              if (pollInterval) {
                clearInterval(pollInterval)
                pollInterval = null
              }
            }
          } else {
            // Response data available or not executed, stop polling
            if (pollInterval) {
              clearInterval(pollInterval)
              pollInterval = null
            }
          }
        } else {
          setError('Results not found')
          setLoading(false)
          if (pollInterval) {
            clearInterval(pollInterval)
            pollInterval = null
          }
        }
      } catch (err: any) {
        console.error('Error loading results:', err)
        setError(err.message || 'Failed to load results')
        setLoading(false)
        if (pollInterval) {
          clearInterval(pollInterval)
          pollInterval = null
        }
      }
    }

    fetchResults()

    // Cleanup interval on unmount
    return () => {
      if (pollInterval) {
        clearInterval(pollInterval)
      }
    }
  }, [id])

  if (loading) {
    return (
      <main className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <Lottie
            src="/lottie/Loading (Neon spinning).lottie"
            autoplay
            loop
            width={64}
            height={64}
            className="mx-auto mb-4"
          />
          <p className="text-neon-grey font-mono">Loading results...</p>
        </div>
      </main>
    )
  }

  if (error || !results) {
    return (
      <main className="min-h-screen flex items-center justify-center">
        <div className="max-w-2xl mx-auto text-center px-6">
          <div className="mb-6">
            <div className="w-20 h-20 mx-auto rounded-full bg-red-500/10 border-2 border-red-500 flex items-center justify-center">
              <span className="text-4xl">❌</span>
            </div>
          </div>
          <h1 className="text-3xl font-mono text-neon-white mb-4">
            {error || 'Results not found'}
          </h1>
          <p className="text-neon-grey font-mono mb-8">
            This transaction may still be processing or does not exist.
          </p>
          <Link href="/catalog">
            <Button variant="outline" className="font-mono">
              ← Back to Catalog
            </Button>
          </Link>
        </div>
      </main>
    )
  }

  const statusColors = {
    executed: "text-green-400 border-green-400/40 bg-green-400/10",
    paid: "text-blue-400 border-blue-400/40 bg-blue-400/10",
    failed: "text-red-400 border-red-400/40 bg-red-400/10",
    pending: "text-yellow-400 border-yellow-400/40 bg-yellow-400/10",
  }

  return (
    <main className="min-h-screen">
      {/* Header */}
      <section className="px-6 py-12 md:py-16">
        <div className="max-w-4xl mx-auto">
          {/* Breadcrumb */}
          <nav className="mb-8 font-mono text-sm text-neon-grey">
            <Link href="/" className="hover:text-neon-blue-light transition-colors">
              Home
            </Link>
            <span className="mx-2">/</span>
            <Link href="/catalog" className="hover:text-neon-blue-light transition-colors">
              Catalog
            </Link>
            <span className="mx-2">/</span>
            <span className="text-neon-white">Results</span>
          </nav>

          {/* Success Header */}
          {results.status === 'executed' && (
            <div className="mb-8">
              <div className="flex items-center gap-4 mb-4">
                <div className="w-16 h-16 rounded-full bg-green-500/20 border-2 border-green-500 flex items-center justify-center flex-shrink-0">
                  <span className="text-green-500 text-3xl">✓</span>
                </div>
                <div>
                  <h1 className="text-4xl md:text-5xl font-sans text-green-400 mb-2" style={{ fontWeight: 300 }}>
                    Execution Successful
                  </h1>
                  <p className="font-mono text-neon-grey">Your API call was executed successfully</p>
                </div>
              </div>
            </div>
          )}

          {results.status !== 'executed' && (
            <div className="mb-8">
              <h1 className="text-4xl md:text-5xl font-sans text-neon-white mb-2" style={{ fontWeight: 300 }}>
                Transaction Results
              </h1>
              <Badge className={`${statusColors[results.status as keyof typeof statusColors] || statusColors.pending} font-mono text-sm px-4 py-2`}>
                {results.status.toUpperCase()}
              </Badge>
            </div>
          )}

          <NeonDivider className="mb-8" />
        </div>
      </section>

      {/* Results Content */}
      <section className="px-6 pb-20">
        <div className="max-w-4xl mx-auto space-y-6">
          {/* API Output */}
          {results.status === 'executed' && results.response_data && (
            <Card className="p-6 bg-neon-dark/40 border-neon-grey/20">
              <div className="flex items-center gap-2 mb-4">
                <span className="text-base font-mono text-green-400 font-bold">📤 API OUTPUT</span>
              </div>

              {/* Render response based on blink type */}
              {(results.blink.slug === 'wallet-tracker' || results.blink.slug === 'wallet-analyzer' || results.blink.slug === 'wallet-snapshot') && results.response_data.data && (
                <div className="space-y-4">
                  {/* Wallet Analysis Report Header */}
                  <div className="mb-4">
                    <h3 className="text-xl font-mono text-neon-white mb-2">Wallet Analysis Report</h3>
                    <p className="text-neon-grey text-sm font-mono">Wallet: {results.response_data.data.wallet}</p>
                    {results.response_data.data.analyzedAt && (
                      <p className="text-neon-grey text-xs font-mono">Analyzed: {new Date(results.response_data.data.analyzedAt).toLocaleString()}</p>
                    )}
                  </div>

                  {/* B402 Tier Badge (if available) */}
                  {results.response_data.data.b402 && (
                    <div className="p-4 bg-gradient-to-r from-blue-500/10 to-purple-500/10 border border-blue-500/40 rounded-lg mb-4">
                      <div className="flex items-center justify-between flex-wrap gap-4">
                        <div className="flex items-center gap-3">
                          <span className="text-2xl">{results.response_data.data.b402.display.icon}</span>
                          <div>
                            <p className="font-mono text-sm text-neon-white font-bold mb-1">
                              {results.response_data.data.b402.display.label} Tier
                            </p>
                            <p className="text-xs font-mono text-neon-grey">
                              {results.response_data.data.b402.balance.toLocaleString()} B402 tokens
                            </p>
                          </div>
                        </div>

                        {/* Feature Badges */}
                        <div className="flex flex-wrap gap-2">
                          {results.response_data.data.b402.features.spamDetection && (
                            <Badge className="text-xs font-mono bg-green-500/20 border-green-500 text-green-400">
                              ✓ Spam Detection
                            </Badge>
                          )}
                          {results.response_data.data.b402.features.portfolioHealth && (
                            <Badge className="text-xs font-mono bg-blue-500/20 border-blue-500 text-blue-400">
                              ✓ Portfolio Health
                            </Badge>
                          )}
                          {results.response_data.data.b402.features.rugPullDetection && (
                            <Badge className="text-xs font-mono bg-purple-500/20 border-purple-500 text-purple-400">
                              ✓ Rug Detection
                            </Badge>
                          )}
                          {results.response_data.data.b402.features.aiInsights && (
                            <Badge className="text-xs font-mono bg-pink-500/20 border-pink-500 text-pink-400">
                              ✓ AI Insights
                            </Badge>
                          )}
                        </div>
                      </div>

                      {/* Upgrade Prompt */}
                      {results.response_data.data.b402.upgrade && results.response_data.data.b402.upgrade.tokensNeeded > 0 && (
                        <div className="mt-3 pt-3 border-t border-blue-500/20">
                          <p className="text-xs font-mono text-neon-grey">
                            💡 {results.response_data.data.b402.upgrade.message}
                          </p>
                        </div>
                      )}
                    </div>
                  )}

                  {/* SOL Balance & Stats Grid */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="p-4 bg-neon-black/40 rounded-lg border border-neon-grey/20">
                      <span className="text-neon-grey text-sm font-mono block mb-1">SOL Balance</span>
                      <span className="text-neon-blue-light text-2xl font-mono font-bold block">
                        {results.response_data.data.solBalance?.toFixed(3)} SOL
                      </span>
                      {results.response_data.data.solUsdValue && (
                        <span className="text-green-400 text-sm font-mono">
                          ${results.response_data.data.solUsdValue.toFixed(2)}
                        </span>
                      )}
                    </div>

                    {results.response_data.data.transactionSummary && (
                      <div className="p-4 bg-neon-black/40 rounded-lg border border-neon-grey/20">
                        <span className="text-neon-grey text-sm font-mono block mb-1">Total Transactions</span>
                        <span className="text-neon-white text-2xl font-mono font-bold">
                          {results.response_data.data.transactionSummary.totalTransactions || 0}
                        </span>
                        <span className="text-neon-grey text-xs font-mono block mt-1">
                          ~{results.response_data.data.transactionSummary.avgPerDay || 0}/day
                        </span>
                      </div>
                    )}

                    <div className="p-4 bg-neon-black/40 rounded-lg border border-neon-grey/20">
                      <span className="text-neon-grey text-sm font-mono block mb-1">NFTs Owned</span>
                      <span className="text-neon-white text-2xl font-mono font-bold">
                        {results.response_data.data.nftCount || 0}
                      </span>
                      <span className="text-neon-grey text-xs font-mono block mt-1">
                        digital collectibles
                      </span>
                    </div>
                  </div>

                  {/* Token Holdings */}
                  {results.response_data.data.tokens && results.response_data.data.tokens.length > 0 ? (
                    <div className="mt-4">
                      <div className="flex justify-between items-center mb-3">
                        <h3 className="text-neon-white font-mono">Token Holdings</h3>
                        {results.response_data.data.totalTokensUsdValue && (
                          <span className="text-green-400 font-mono font-bold">
                            Total: ${results.response_data.data.totalTokensUsdValue.toFixed(2)}
                          </span>
                        )}
                      </div>
                      <div className="space-y-2">
                        {results.response_data.data.tokens.slice(0, 5).map((token: any, idx: number) => {
                          // Risk level colors and emojis
                          const riskColors = {
                            low: 'border-yellow-500/40 bg-yellow-500/10',
                            medium: 'border-orange-500/40 bg-orange-500/10',
                            high: 'border-red-500/40 bg-red-500/10',
                            critical: 'border-red-700/40 bg-red-700/10',
                          }
                          const riskEmojis = {
                            low: '🟡',
                            medium: '🟠',
                            high: '🔴',
                            critical: '⛔',
                          }

                          return (
                            <div
                              key={idx}
                              className={`p-3 rounded border ${
                                token.spamDetection?.isSpam
                                  ? riskColors[token.spamDetection.riskLevel as keyof typeof riskColors] || riskColors.low
                                  : 'border-neon-grey/20 bg-neon-black/40'
                              }`}
                            >
                              <div className="flex justify-between items-start">
                                <div className="flex-1">
                                  <div className="flex items-center gap-2 mb-1">
                                    <span className="font-mono text-sm text-neon-white font-bold">
                                      {idx + 1}. {token.symbol || 'UNKNOWN'}
                                    </span>
                                    {token.spamDetection?.isSpam && (
                                      <Badge className="text-xs font-mono px-2 py-0 bg-red-500/20 border-red-500 text-red-400">
                                        {riskEmojis[token.spamDetection.riskLevel as keyof typeof riskEmojis]} SPAM
                                      </Badge>
                                    )}
                                  </div>
                                  {token.name && token.symbol !== token.name && (
                                    <span className="text-neon-grey text-xs font-mono block">{token.name}</span>
                                  )}
                                  {token.spamDetection?.flags && token.spamDetection.flags.length > 0 && (
                                    <div className="mt-2 space-y-1">
                                      {token.spamDetection.flags.slice(0, 2).map((flag: string, flagIdx: number) => (
                                        <p key={flagIdx} className="text-xs font-mono text-red-400">
                                          {flag}
                                        </p>
                                      ))}
                                      {token.spamDetection.flags.length > 2 && (
                                        <p className="text-xs font-mono text-red-400/60">
                                          +{token.spamDetection.flags.length - 2} more warnings
                                        </p>
                                      )}
                                    </div>
                                  )}
                                </div>
                                <div className="text-right">
                                  <span className="font-mono text-sm text-neon-blue-light block">
                                    {token.uiAmount?.toLocaleString() || '0'}
                                  </span>
                                  {token.usdValue && (
                                    <span className="text-green-400 text-xs font-mono">
                                      ${token.usdValue.toFixed(2)}
                                    </span>
                                  )}
                                  {token.spamDetection && (
                                    <div className="mt-1">
                                      <span className="text-xs font-mono text-neon-grey">
                                        {token.spamDetection.confidence}% confidence
                                      </span>
                                    </div>
                                  )}
                                </div>
                              </div>
                            </div>
                          )
                        })}
                        {results.response_data.data.tokens.length > 5 && (
                          <p className="text-neon-grey text-xs font-mono text-center">
                            +{results.response_data.data.tokens.length - 5} more tokens
                          </p>
                        )}
                      </div>

                      {/* Spam Summary (B402 BRONZE+ feature) */}
                      {results.response_data.data.b402?.features?.spamDetection && (
                        results.response_data.data.tokens.some((t: any) => t.spamDetection?.isSpam) ? (
                          <div className="mt-4 p-4 bg-red-500/10 border border-red-500/40 rounded-lg">
                            <h4 className="text-red-400 font-mono text-sm mb-2">⚠️ Spam Tokens Detected</h4>
                            <p className="text-neon-grey text-xs font-mono mb-2">
                              {results.response_data.data.tokens.filter((t: any) => t.spamDetection?.isSpam).length} potentially malicious tokens found in this wallet.
                            </p>
                            <p className="text-neon-grey text-xs font-mono">
                              💡 <strong className="text-neon-white">Recommendation:</strong> Review flagged tokens carefully. Consider using wallet spam filters or burning dust tokens.
                            </p>
                          </div>
                        ) : (
                          <div className="mt-4 p-4 bg-green-500/10 border border-green-500/40 rounded-lg">
                            <h4 className="text-green-400 font-mono text-sm mb-2">✅ No Spam Detected</h4>
                            <p className="text-neon-grey text-xs font-mono">
                              All tokens passed spam detection checks. This wallet appears to hold legitimate assets only.
                            </p>
                          </div>
                        )
                      )}
                    </div>
                  ) : (
                    <div className="mt-4 p-6 bg-neon-black/40 rounded-lg border border-neon-grey/20 text-center">
                      <p className="text-neon-grey font-mono text-sm">
                        📭 No tokens found in this wallet
                      </p>
                      <p className="text-neon-grey/60 font-mono text-xs mt-2">
                        This wallet only holds SOL{results.response_data.data.nftCount > 0 ? ' and NFTs' : ''}
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* Token Price Response */}
              {(results.blink.slug === 'token-price' || results.blink.slug === 'dexscreener-token-data' || results.blink.category === 'defi') && results.response_data.data && results.response_data.data.tokenAddress && (
                <TokenPriceResult data={results.response_data.data} />
              )}

              {/* QR Code Response */}
              {(results.blink.slug === 'qr-code' || results.blink.slug === 'qr-code-generator' || results.blink.category === 'utility') && results.response_data.data?.qrCode && (
                <div className="flex flex-col items-center gap-4">
                  <img
                    src={results.response_data.data.qrCode}
                    alt="Generated QR Code"
                    className="max-w-xs border-2 border-neon-blue-light/40 rounded-lg shadow-lg"
                  />
                  {results.response_data.data.text && (
                    <div className="w-full max-w-md">
                      <p className="font-mono text-xs text-neon-grey mb-1">Encoded Text:</p>
                      <p className="font-mono text-sm text-neon-white break-all p-3 bg-neon-black/40 rounded border border-neon-grey/20">
                        {results.response_data.data.text}
                      </p>
                    </div>
                  )}
                  {results.response_data.data.size && (
                    <p className="text-xs font-mono text-neon-grey">
                      Size: {results.response_data.data.size}x{results.response_data.data.size}px • Format: {results.response_data.data.format?.toUpperCase() || 'PNG'}
                    </p>
                  )}
                </div>
              )}

              {/* Generic JSON Response - fallback for any other response types */}
              {!results.blink.slug.match(/wallet-tracker|wallet-analyzer|wallet-snapshot|token-price|dexscreener-token-data|qr-code|qr-code-generator/) && (
                <pre className="p-4 bg-neon-black/60 rounded-lg border border-neon-grey/20 overflow-x-auto">
                  <code className="text-neon-blue-light text-sm font-mono">
                    {JSON.stringify(results.response_data, null, 2)}
                  </code>
                </pre>
              )}
            </Card>
          )}

          {/* Loading API Response */}
          {results.status === 'executed' && !results.response_data && (
            <Card className="p-6 bg-neon-dark/40 border-neon-grey/20">
              <div className="flex items-center gap-4">
                <Lottie
                  src="/lottie/Loading (Neon spinning).lottie"
                  autoplay
                  loop
                  width={48}
                  height={48}
                />
                <div>
                  <span className="text-base font-mono text-green-400 font-bold block mb-1">📤 API OUTPUT</span>
                  <span className="text-sm font-mono text-neon-grey">
                    Fetching wallet analysis... This may take 10-15 seconds.
                  </span>
                  <p className="text-xs font-mono text-neon-grey/60 mt-1">
                    Results will appear automatically when ready
                  </p>
                </div>
              </div>
            </Card>
          )}

          {/* Transaction Details */}
          <Card className="p-6 bg-neon-dark/40 border-neon-grey/20">
            <h2 className="text-xl font-mono text-neon-white mb-4">Transaction Details</h2>

            <div className="space-y-3 font-mono text-sm">
              {results.signature && (
                <div>
                  <span className="text-neon-grey">Signature:</span>
                  <a
                    href={results.explorer_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block text-neon-blue-light hover:text-neon-blue-dark break-all underline mt-1"
                  >
                    {results.signature}
                  </a>
                </div>
              )}

              <div>
                <span className="text-neon-grey">Reference:</span>
                <p className="text-neon-white break-all mt-1">{results.reference}</p>
              </div>

              <div>
                <span className="text-neon-grey">Payer:</span>
                <p className="text-neon-white break-all mt-1">{results.payer}</p>
              </div>

              <div>
                <span className="text-neon-grey">Amount:</span>
                <p className="text-neon-blue-light mt-1">
                  ${results.blink.price_usdc} <span className="text-neon-grey">{results.blink.payment_token}</span>
                </p>
              </div>

              {results.duration_ms && (
                <div>
                  <span className="text-neon-grey">Duration:</span>
                  <p className="text-neon-white mt-1">{results.duration_ms}ms</p>
                </div>
              )}

              {results.executed_at && (
                <div>
                  <span className="text-neon-grey">Executed:</span>
                  <p className="text-neon-white mt-1">{new Date(results.executed_at).toLocaleString()}</p>
                </div>
              )}
            </div>
          </Card>

          {/* Blink Details */}
          <Card className="p-6 bg-neon-dark/40 border-neon-grey/20">
            <h2 className="text-xl font-mono text-neon-white mb-4">Blink Details</h2>

            <div className="space-y-3 font-mono text-sm">
              <div>
                <span className="text-neon-grey">Title:</span>
                <p className="text-neon-white mt-1">{results.blink.title}</p>
              </div>

              <div>
                <span className="text-neon-grey">Description:</span>
                <p className="text-neon-white mt-1">{results.blink.description}</p>
              </div>

              <div>
                <span className="text-neon-grey">Category:</span>
                <p className="text-neon-white mt-1 capitalize">{results.blink.category}</p>
              </div>

              <div>
                <span className="text-neon-grey">Creator:</span>
                <p className="text-neon-white break-all mt-1">
                  {results.creator.display_name || results.creator.wallet}
                </p>
              </div>
            </div>
          </Card>

          {/* Actions */}
          <div className="flex flex-wrap gap-4 justify-center pt-4">
            <Link href={`/blink/${results.blink.slug}`}>
              <Button className="bg-neon-blue-light hover:bg-neon-blue-dark text-neon-black font-mono font-bold">
                Run Again
              </Button>
            </Link>
            <Link href="/catalog">
              <Button variant="outline" className="font-mono">
                Browse Catalog
              </Button>
            </Link>
            {results.signature && (
              <a href={results.explorer_url} target="_blank" rel="noopener noreferrer">
                <Button variant="outline" className="font-mono">
                  View on Explorer →
                </Button>
              </a>
            )}
          </div>
        </div>
      </section>
    </main>
  )
}
