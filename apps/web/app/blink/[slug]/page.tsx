"use client"
import { useEffect, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import { getBlinkBySlug } from "@/lib/api"
import type { BlinkData } from "@/lib/types"
import { logger } from "@/lib/logger"
import NeonDivider from "@/components/NeonDivider"
import Lottie from "@/components/Lottie"
import { Button } from "@/components/ui/button"
import ShareModal from "@/components/ShareModal"
import Link from "next/link"

export default function BlinkDetailPage() {
  const params = useParams()
  const router = useRouter()
  const slug = params.slug as string
  
  const [blink, setBlink] = useState<BlinkData | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  // Dynamic parameter values (key = parameter name, value = user input)
  const [parameterValues, setParameterValues] = useState<Record<string, string>>({})

  useEffect(() => {
    // Load blink data from API
    if (slug) {
      getBlinkBySlug(slug)
        .then((data) => {
          if (data) {
            setBlink(data)
          } else {
            setError('Blink not found')
          }
        })
        .catch((err) => {
          logger.error('Failed to load blink:', err)
          setError(err.message || 'Failed to load blink')
        })
        .finally(() => {
          setIsLoading(false)
        })
    }
  }, [slug])

  const handleExecuteBlink = () => {
    if (!blink) return

    // Check if this is a lottery blink - redirect to dedicated lottery page
    if (blink.lottery_enabled || slug.includes('lottery')) {
      router.push(`/lottery/${slug}`)
      return
    }

    // Dynamic parameter validation based on blink.parameters
    if (blink.parameters && blink.parameters.length > 0) {
      for (const param of blink.parameters) {
        const value = parameterValues[param.name] || ''

        // Check required parameters
        if (param.required && !value.trim()) {
          alert(`Please enter ${param.label || param.name}`)
          return
        }

        // Validate pattern if provided
        if (param.pattern && value.trim()) {
          const regex = new RegExp(param.pattern)
          if (!regex.test(value.trim())) {
            alert(param.patternDescription || `Invalid format for ${param.label || param.name}`)
            return
          }
        }

        // Validate min/max for number inputs
        if (param.type === 'number' && value.trim()) {
          const numValue = parseFloat(value)
          if (param.min !== undefined && numValue < param.min) {
            alert(`${param.label || param.name} must be at least ${param.min}`)
            return
          }
          if (param.max !== undefined && numValue > param.max) {
            alert(`${param.label || param.name} must be at most ${param.max}`)
            return
          }
        }

        // Store parameter in localStorage for checkout page
        if (value.trim()) {
          localStorage.setItem(`blink_param_${param.name}`, value.trim())
        }
      }
    }

    // Redirect to checkout page with the blink slug
    router.push(`/checkout/${slug}`)
  }

  if (isLoading) {
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
          <p className="text-neon-grey font-mono">Loading Blink...</p>
        </div>
      </main>
    )
  }

  if (error || !blink) {
    return (
      <main className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-mono text-neon-white mb-4">
            {error || 'Blink not found'}
          </h1>
          <Link href="/catalog">
            <Button variant="outline" className="font-mono">
              ← Back to Catalog
            </Button>
          </Link>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen">
      {/* Hero Section */}
      <section className="relative overflow-hidden px-6 py-16 md:py-24">
        <div className="max-w-4xl mx-auto">
          {/* Breadcrumbs */}
          <nav className="mb-8">
            <div className="flex items-center gap-2 text-sm font-mono text-neon-grey">
              <Link href="/catalog" className="hover:text-neon-blue-light transition-colors">
                Catalog
              </Link>
              <span>/</span>
              <span className="text-neon-white">{blink.title || 'Untitled Blink'}</span>
            </div>
          </nav>

          {/* Blink Header */}
          <div className="flex flex-col lg:flex-row gap-8 mb-12">
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-4">
                <div className="inline-block px-3 py-1 text-xs border border-neon-blue-dark/40 text-neon-blue-light bg-neon-blue-dark/10 font-mono rounded">
                  {blink.category || 'Uncategorized'}
                </div>
                {(blink.status === "active" || !blink.status) && (
                  <div className="inline-block px-3 py-1 text-xs border border-green-500/40 text-green-500 bg-green-500/10 font-mono rounded">
                    Active
                  </div>
                )}
              </div>

              <h1
                className="font-sans text-neon-white mb-4 text-3xl md:text-4xl font-light"
              >
                {blink.title || 'Untitled Blink'}
              </h1>

              <p className="text-neon-grey font-mono text-lg mb-6 leading-relaxed">
                {blink.description || 'No description available'}
              </p>

              <div className="flex items-center gap-6 text-sm font-mono">
                <div>
                  <span className="text-neon-grey">Price: </span>
                  <span className="text-neon-blue-light font-bold">${blink.price_usdc || '0.00'} {blink.payment_token || 'SOL'}</span>
                </div>
                <div>
                  <span className="text-neon-grey">Runs: </span>
                  <span className="text-neon-white">{(blink.runs || 0).toLocaleString()}</span>
                </div>
                <div>
                  <span className="text-neon-grey">Method: </span>
                  <span className="text-neon-white">{blink.method || 'GET'}</span>
                </div>
              </div>
            </div>

            {/* Action Card */}
            <div className="lg:w-96">
              <div className="p-6 bg-neon-dark border border-neon-grey/20 rounded-lg space-y-4">
                <h3 className="text-xl font-mono text-neon-white mb-4">Execute Blink</h3>

                {/* Dynamic Parameter Input Section - Renders based on blink.parameters from database */}
                {blink.parameters && blink.parameters.length > 0 && (
                  <div className="space-y-4">
                    <div className="flex items-center gap-2 p-3 bg-neon-black/40 border-2 border-dashed border-neon-blue-dark/60 rounded-lg">
                      <span className="text-xs font-mono text-neon-blue-light font-bold">📥 INPUT REQUIRED</span>
                    </div>

                    {blink.parameters.map((param) => {
                      const value = parameterValues[param.name] || ''
                      const isTextarea = param.type === 'textarea'
                      const isNumber = param.type === 'number'

                      return (
                        <div key={param.name} className="space-y-2">
                          <label
                            htmlFor={param.name}
                            className="block text-sm font-mono text-neon-white font-bold"
                          >
                            {param.label || param.name}
                            {param.required && <span className="text-red-400 ml-1">*</span>}
                          </label>

                          {isTextarea ? (
                            <textarea
                              id={param.name}
                              value={value}
                              onChange={(e) => setParameterValues(prev => ({ ...prev, [param.name]: e.target.value }))}
                              placeholder={param.placeholder || `Enter ${param.label || param.name}...`}
                              rows={3}
                              maxLength={param.max}
                              required={param.required}
                              className="w-full px-4 py-3 bg-neon-black border-2 border-neon-blue-dark/40 rounded text-neon-white font-mono text-sm focus:outline-none focus:border-neon-blue-light focus:ring-2 focus:ring-neon-blue-light/20 transition-all resize-none"
                            />
                          ) : (
                            <input
                              id={param.name}
                              type={param.type || 'text'}
                              value={value}
                              onChange={(e) => setParameterValues(prev => ({ ...prev, [param.name]: e.target.value }))}
                              placeholder={param.placeholder || `Enter ${param.label || param.name}...`}
                              required={param.required}
                              min={param.min}
                              max={param.max}
                              pattern={param.pattern}
                              className="w-full px-4 py-3 bg-neon-black border-2 border-neon-blue-dark/40 rounded text-neon-white font-mono text-sm focus:outline-none focus:border-neon-blue-light focus:ring-2 focus:ring-neon-blue-light/20 transition-all"
                            />
                          )}

                          {param.patternDescription && (
                            <p className="text-xs text-neon-grey font-mono">
                              💡 {param.patternDescription}
                            </p>
                          )}

                          {isTextarea && param.max && (
                            <p className="text-xs text-neon-grey font-mono">
                              {value.length}/{param.max} characters
                            </p>
                          )}
                        </div>
                      )
                    })}
                  </div>
                )}

                <Button
                  onClick={handleExecuteBlink}
                  className="w-full bg-neon-blue-light hover:bg-neon-blue-dark text-neon-black font-mono font-bold text-base py-6"
                >
                  Pay ${blink.price_usdc || '0.00'} USDC & Execute
                </Button>

                <p className="text-xs text-neon-grey font-mono text-center">
                  Powered by ONCHAIN x402 • Average settlement: 2.1s
                </p>

                <div className="pt-4 border-t border-neon-grey/20">
                  <ShareModal
                    slug={slug}
                    title={blink.title || 'Untitled Blink'}
                    description={blink.description || 'No description available'}
                    iconUrl={blink.icon_url}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* API Details */}
          <div className="mb-12">
            <h3 className="text-xl font-mono text-neon-white mb-6">API Details</h3>
            
            <div className="grid md:grid-cols-3 gap-6">
              <div className="p-6 bg-neon-dark border border-neon-grey/20 rounded-lg">
                <h4 className="text-lg font-mono text-neon-white mb-4">Overview</h4>
                <p className="text-neon-grey font-mono text-sm leading-relaxed mb-4">
                  {blink.description}
                </p>
                <div className="space-y-2 text-sm font-mono">
                  <div>
                    <span className="text-neon-grey">Category:</span>
                    <span className="text-neon-white ml-2">{blink.category}</span>
                  </div>
                  <div>
                    <span className="text-neon-grey">Status:</span>
                    <span className="text-neon-white ml-2 capitalize">{blink.status}</span>
                  </div>
                </div>
              </div>

              <div className="p-6 bg-neon-dark border border-neon-grey/20 rounded-lg">
                <h4 className="text-lg font-mono text-neon-white mb-4">Endpoint</h4>
                <div className="space-y-2 text-sm font-mono">
                  <div>
                    <span className="text-neon-grey block">URL</span>
                    <span className="text-neon-white break-all">{blink.endpoint_url}</span>
                  </div>
                  <div>
                    <span className="text-neon-grey block">Method</span>
                    <span className="text-neon-white">{blink.method}</span>
                  </div>
                  <div>
                    <span className="text-neon-grey block">Price</span>
                    <span className="text-neon-blue-light">${blink.price_usdc} {blink.payment_token || 'SOL'}</span>
                  </div>
                </div>
              </div>

              <div className="p-6 bg-neon-dark border border-neon-grey/20 rounded-lg">
                <h4 className="text-lg font-mono text-neon-white mb-4">Creator</h4>
                <div className="space-y-2 text-sm font-mono">
                  <div>
                    <span className="text-neon-grey block">Wallet</span>
                    <span className="text-neon-white break-all">{blink.creator?.wallet}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Payment Flow Info */}
          <div className="mb-12">
            <h3 className="text-xl font-mono text-neon-white mb-6">Payment Flow</h3>

            <div className="p-6 bg-gradient-to-br from-blue-500/5 to-purple-500/5 border border-blue-500/20 rounded-lg">
              <div className="flex items-start gap-4 mb-4">
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-blue-500/20 border border-blue-500/40 flex items-center justify-center text-blue-400 font-mono text-sm">
                  i
                </div>
                <div>
                  <h4 className="text-lg font-mono text-blue-400 mb-2">ONCHAIN x402 Protocol</h4>
                  <p className="text-neon-grey font-mono text-sm leading-relaxed mb-4">
                    This Blink uses ONCHAIN's x402 payment protocol with automatic facilitator routing.
                    Payments are settled on-chain in an average of 2.1 seconds with automatic failover.
                  </p>

                  <div className="grid md:grid-cols-3 gap-4 mt-4">
                    <div className="space-y-1">
                      <div className="text-xs font-mono text-blue-400 font-bold">Step 1: Connect</div>
                      <div className="text-xs font-mono text-neon-grey">Connect your Solana wallet (Phantom, Solflare, etc.)</div>
                    </div>
                    <div className="space-y-1">
                      <div className="text-xs font-mono text-blue-400 font-bold">Step 2: Sign</div>
                      <div className="text-xs font-mono text-neon-grey">Sign USDC payment transaction (no SOL fees needed)</div>
                    </div>
                    <div className="space-y-1">
                      <div className="text-xs font-mono text-blue-400 font-bold">Step 3: Execute</div>
                      <div className="text-xs font-mono text-neon-grey">API executes instantly after payment settles</div>
                    </div>
                  </div>

                  <div className="mt-4 pt-4 border-t border-blue-500/20">
                    <div className="flex flex-wrap gap-4 text-xs font-mono">
                      <div>
                        <span className="text-neon-grey">Network:</span>
                        <span className="text-neon-white ml-2">Solana</span>
                      </div>
                      <div>
                        <span className="text-neon-grey">Token:</span>
                        <span className="text-neon-white ml-2">USDC</span>
                      </div>
                      <div>
                        <span className="text-neon-grey">Facilitator:</span>
                        <span className="text-neon-white ml-2">PayAI</span>
                      </div>
                      <div>
                        <span className="text-neon-grey">Settlement:</span>
                        <span className="text-green-400 ml-2">~2.1s avg</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <NeonDivider />
        </div>
      </section>
    </main>
  )
}