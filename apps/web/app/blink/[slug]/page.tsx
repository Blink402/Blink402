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

    // Redirect to checkout page with the blink slug
    router.push(`/checkout?slug=${slug}`)
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
              <Link href="/catalog" className="hover:text-neon-green-light transition-colors">
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

                <Button
                  onClick={handleExecuteBlink}
                  className="w-full bg-neon-blue-light hover:bg-neon-blue-dark text-neon-black font-mono font-bold"
                >
                  Pay ${blink.price_usdc || '0.00'} {blink.payment_token || 'SOL'} & Execute
                </Button>

                <p className="text-xs text-neon-grey font-mono text-center">
                  You'll be redirected to complete payment via Solana wallet
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

          <NeonDivider />
        </div>
      </section>
    </main>
  )
}