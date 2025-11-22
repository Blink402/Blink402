import { Suspense } from "react"
import Link from "next/link"
import { BlinkData } from "@blink402/types"
import HomeClient from "./HomeClient"
import FeaturedCarousel from "@/components/FeaturedCarousel"
import TrendingBlinks from "@/components/TrendingBlinks"
import NeonDivider from "@/components/NeonDivider"
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip"
import { HomeSlotMachine } from "@/components/HomeSlotMachine"

// Fetch featured and trending blinks on the server
async function getFeaturedBlinks(): Promise<BlinkData[]> {
  try {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'
    const res = await fetch(`${apiUrl}/catalog/featured`, {
      next: { revalidate: 3600 } // Cache for 1 hour
    })

    if (!res.ok) return []

    const data = await res.json()
    return data.data || []
  } catch (error) {
    console.error('Error fetching featured blinks:', error)
    return []
  }
}

async function getTrendingBlinks(): Promise<BlinkData[]> {
  try {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'
    const res = await fetch(`${apiUrl}/catalog/trending?days=1`, {
      next: { revalidate: 900 } // Cache for 15 minutes
    })

    if (!res.ok) return []

    const data = await res.json()
    return data.data || []
  } catch (error) {
    console.error('Error fetching trending blinks:', error)
    return []
  }
}

export default async function Home() {
  // Fetch data in parallel
  const [featuredBlinks, trendingBlinks] = await Promise.all([
    getFeaturedBlinks(),
    getTrendingBlinks()
  ])

  return (
    <main className="min-h-screen">
      {/* Hero Section - Client Component for animations */}
      <HomeClient />

      {/* Featured Demos Section */}
      {featuredBlinks.length > 0 && (
      <section className="px-4 sm:px-6 section-padding">
          <div className="max-w-6xl mx-auto">
            <div className="text-center mb-12">
              <h2 className="text-3xl md:text-4xl font-sans font-light text-neon-white mb-4">
                Featured Demos
              </h2>
              <p className="text-neon-grey font-mono text-sm">
                Try these polished examples to see what Blink402 can do
              </p>
            </div>
            <FeaturedCarousel blinks={featuredBlinks} />
          </div>
        </section>
      )}

      <NeonDivider className="max-w-6xl mx-auto" />

      {/* Trending Today Section */}
      {trendingBlinks.length > 0 && (
      <section className="px-4 sm:px-6 section-padding">
          <TrendingBlinks blinks={trendingBlinks} />
        </section>
      )}

      <NeonDivider className="max-w-6xl mx-auto" />

      {/* How It Works Section */}
      <section className="relative px-6 section-padding overflow-hidden">
        <div className="absolute inset-0 opacity-[0.05] pointer-events-none -z-10">
          <div className="absolute inset-0 bg-gradient-to-b from-neon-dark/20 via-transparent to-neon-dark/20" />
        </div>

        <div className="max-w-6xl mx-auto relative z-10">
          <h2
            data-reveal
            data-scramble
            className="text-4xl md:text-5xl font-sans text-neon-white text-center mb-16 heading-sm"
          >
            How it works
          </h2>

          <div className="grid md:grid-cols-3 gap-8">
            {/* Step 1 */}
            <div data-reveal className="card-3d hover-lift text-center p-8 border border-dashed border-neon-blue-dark/30 rounded bg-neon-dark/20">
              <div className="w-12 h-12 rounded-full bg-neon-dark/10 border border-neon-blue-dark/30 flex items-center justify-center mx-auto mb-6">
                <span className="text-neon font-mono text-xl font-bold">1</span>
              </div>
              <h3 className="text-xl font-mono text-neon-white mb-3">Paste your endpoint & set a price</h3>
              <p className="text-neon-grey font-mono text-sm leading-relaxed">
                Configure your API URL, method, and pricing in seconds.
              </p>
            </div>

            {/* Step 2 */}
            <div data-reveal className="card-3d hover-lift text-center p-8 border border-dashed border-neon-blue-dark/30 rounded bg-neon-dark/20">
              <div className="w-12 h-12 rounded-full bg-neon-dark/10 border border-neon-blue-dark/30 flex items-center justify-center mx-auto mb-6">
                <span className="text-neon font-mono text-xl font-bold">2</span>
              </div>
              <h3 className="text-xl font-mono text-neon-white mb-3">
                Share your{" "}
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span className="text-neon-blue-light border-b border-dashed border-neon-blue-light/50 cursor-help">
                      Blink
                    </span>
                  </TooltipTrigger>
                  <TooltipContent className="bg-neon-dark border border-neon-blue-dark/50 text-neon-white max-w-xs">
                    <p className="font-mono text-xs">A shareable link that charges a tiny fee and runs your API on-chain</p>
                  </TooltipContent>
                </Tooltip>
                {" "}anywhere
              </h3>
              <p className="text-neon-grey font-mono text-sm leading-relaxed">
                Get a shareable link that unfurls beautifully on social. Built on Solana&apos;s x402 protocol.
              </p>
            </div>

            {/* Step 3 */}
            <div data-reveal className="card-3d hover-lift text-center p-8 border border-dashed border-neon-blue-dark/30 rounded bg-neon-dark/20">
              <div className="w-12 h-12 rounded-full bg-neon-dark/10 border border-neon-blue-dark/30 flex items-center justify-center mx-auto mb-6">
                <span className="text-neon font-mono text-xl font-bold">3</span>
              </div>
              <h3 className="text-xl font-mono text-neon-white mb-3">People pay pennies, you get paid instantly</h3>
              <p className="text-neon-grey font-mono text-sm leading-relaxed">
                Buyers approve payment on-chain, API executes automatically.
              </p>
            </div>
          </div>

          {/* Safety Note */}
          <div data-reveal className="mt-16 text-center">
            <p className="text-neon-grey font-mono text-sm mb-3">
              <span className="text-neon-blue-light">✓</span> Blink402 verifies payment on-chain before executing your API.
            </p>
            <p className="text-neon-grey/70 font-mono text-xs">
              Built on Solana&apos;s x402 protocol with PayAI for instant settlement
            </p>
          </div>
        </div>
      </section>

      <NeonDivider className="max-w-6xl mx-auto" />

      {/* Why it's fast (onchain.fi) Section */}
      <section className="px-4 sm:px-6 py-16 sm:py-20">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-sans font-light text-neon-white mb-6">
              Why Blink402 is faster than traditional paywalls
            </h2>
            <p className="text-neon-grey font-mono text-base mb-8">
              Powered by PayAI x402 protocol for instant settlement
            </p>
          </div>

          {/* Comparison Table */}
          <div className="grid md:grid-cols-2 gap-6 mb-12">
            <div className="bg-neon-dark/20 border border-neon-grey/20 rounded-lg p-8">
              <div className="text-center mb-6">
                <h3 className="text-2xl font-mono text-neon-blue-light mb-2">Blink402</h3>
                <p className="text-neon-grey text-xs">On-chain micro-payments</p>
              </div>
              <ul className="space-y-4 text-sm font-mono">
                <li className="flex items-start gap-3">
                  <span className="text-green-400 mt-0.5">✓</span>
                  <span className="text-neon-white"><strong>2.1s</strong> average settlement time</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="text-green-400 mt-0.5">✓</span>
                  <span className="text-neon-white"><strong>Zero chargebacks</strong> (on-chain finality)</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="text-green-400 mt-0.5">✓</span>
                  <span className="text-neon-white"><strong>Pennies per transaction</strong> (USDC/SOL)</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="text-green-400 mt-0.5">✓</span>
                  <span className="text-neon-white"><strong>No user accounts</strong> required</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="text-green-400 mt-0.5">✓</span>
                  <span className="text-neon-white"><strong>99.9% uptime</strong> with auto-failover</span>
                </li>
              </ul>
            </div>

            <div className="bg-neon-dark/20 border border-red-500/20 rounded-lg p-8">
              <div className="text-center mb-6">
                <h3 className="text-2xl font-mono text-neon-white mb-2">Traditional Paywall</h3>
                <p className="text-neon-grey text-xs">Card processors</p>
              </div>
              <ul className="space-y-4 text-sm font-mono">
                <li className="flex items-start gap-3">
                  <span className="text-red-400 mt-0.5">✗</span>
                  <span className="text-neon-white/80"><strong className="text-red-400">2-7 days</strong> settlement delay</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="text-red-400 mt-0.5">✗</span>
                  <span className="text-neon-white/80"><strong className="text-red-400">Chargeback risk</strong> (fraud, disputes)</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="text-red-400 mt-0.5">✗</span>
                  <span className="text-neon-white/80"><strong className="text-red-400">2.9% + $0.30</strong> per transaction</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="text-red-400 mt-0.5">✗</span>
                  <span className="text-neon-white/80"><strong className="text-red-400">Account creation</strong> friction</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="text-red-400 mt-0.5">✗</span>
                  <span className="text-neon-white/80"><strong className="text-red-400">Single point of failure</strong></span>
                </li>
              </ul>
            </div>
          </div>

          {/* Speed Benefits Grid */}
          <div className="grid md:grid-cols-3 gap-6 text-left mb-8">
            <div className="bg-neon-dark/30 border border-neon-blue-dark/30 rounded-lg p-6">
              <h3 className="text-neon-blue-light font-mono text-sm mb-2">Multi-facilitator routing</h3>
              <p className="text-neon-grey text-xs">Automatic failover between OctonetAI, PayAI, Coinbase CDP, and more</p>
            </div>
            <div className="bg-neon-dark/30 border border-neon-blue-dark/30 rounded-lg p-6">
              <h3 className="text-neon-blue-light font-mono text-sm mb-2">Solana speed</h3>
              <p className="text-neon-grey text-xs">Built on Solana&apos;s 400ms block times for near-instant finality</p>
            </div>
            <div className="bg-neon-dark/30 border border-neon-blue-dark/30 rounded-lg p-6">
              <h3 className="text-neon-blue-light font-mono text-sm mb-2">No PCI compliance</h3>
              <p className="text-neon-grey text-xs">Crypto-native payments bypass card network complexity</p>
            </div>
          </div>

          <div className="text-center">
            <a
              href="https://payai.network"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 text-sm font-mono text-neon-blue-light hover:text-neon-white transition-colors"
            >
              Powered by PayAI
              <span aria-hidden="true">↗</span>
            </a>
          </div>
        </div>
      </section>

      <NeonDivider className="max-w-6xl mx-auto" />

      {/* Pricing FAQ Section */}
      <section className="px-4 sm:px-6 py-16 sm:py-20">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-sans font-light text-neon-white mb-4">
              Transparent Pricing
            </h2>
            <p className="text-neon-grey font-mono text-sm">
              No subscriptions. No hidden fees. Pay only when your API gets called.
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-6">
            {/* Pricing FAQ Card 1 */}
            <div className="bg-neon-dark/20 border border-neon-blue-dark/30 rounded-lg p-6">
              <div className="flex items-start gap-3 mb-3">
                <span className="text-neon-blue-light text-xl">💰</span>
                <h3 className="text-lg font-mono text-neon-white">What does it cost?</h3>
              </div>
              <p className="text-neon-grey font-mono text-sm leading-relaxed">
                <strong className="text-neon-white">You set the price.</strong> Typical Blinks charge $0.01–$0.10 per API call.
                Solana gas fees are ~$0.0001 (fractions of a penny). No monthly subscription or platform fees.
              </p>
            </div>

            {/* Pricing FAQ Card 2 */}
            <div className="bg-neon-dark/20 border border-neon-blue-dark/30 rounded-lg p-6">
              <div className="flex items-start gap-3 mb-3">
                <span className="text-neon-blue-light text-xl">🔓</span>
                <h3 className="text-lg font-mono text-neon-white">Do buyers need an account?</h3>
              </div>
              <p className="text-neon-grey font-mono text-sm leading-relaxed">
                <strong className="text-neon-white">Nope.</strong> Buyers just need a Solana wallet (Phantom, Solflare, etc.).
                No signups, no API keys, no credit cards. One click, one signature, done.
              </p>
            </div>

            {/* Pricing FAQ Card 3 */}
            <div className="bg-neon-dark/20 border border-neon-blue-dark/30 rounded-lg p-6">
              <div className="flex items-start gap-3 mb-3">
                <span className="text-neon-blue-light text-xl">⚡</span>
                <h3 className="text-lg font-mono text-neon-white">How fast do I get paid?</h3>
              </div>
              <p className="text-neon-grey font-mono text-sm leading-relaxed">
                <strong className="text-neon-white">Instantly.</strong> Powered by PayAI for sub-second settlement in USDC.
                Payments hit your wallet on-chain within 2.1 seconds on average. No waiting, no chargebacks.
              </p>
            </div>

            {/* Pricing FAQ Card 4 */}
            <div className="bg-neon-dark/20 border border-neon-blue-dark/30 rounded-lg p-6">
              <div className="flex items-start gap-3 mb-3">
                <span className="text-neon-blue-light text-xl">🛡️</span>
                <h3 className="text-lg font-mono text-neon-white">Are there hidden fees?</h3>
              </div>
              <p className="text-neon-grey font-mono text-sm leading-relaxed">
                <strong className="text-neon-white">Zero.</strong> What you charge is what you earn.
                Blink402 doesn&apos;t take a cut. Only Solana network fees apply (~$0.0001 per transaction).
              </p>
            </div>
          </div>

          {/* Trust Signals */}
          <div className="mt-12 grid md:grid-cols-3 gap-4 text-center">
            <div className="flex flex-col items-center gap-2">
              <span className="text-green-400 text-2xl">✓</span>
              <p className="text-neon-grey font-mono text-xs">
                <strong className="text-neon-white">No platform fees</strong><br/>
                You keep 100% of earnings
              </p>
            </div>
            <div className="flex flex-col items-center gap-2">
              <span className="text-green-400 text-2xl">✓</span>
              <p className="text-neon-grey font-mono text-xs">
                <strong className="text-neon-white">No contracts</strong><br/>
                Cancel or modify anytime
              </p>
            </div>
            <div className="flex flex-col items-center gap-2">
              <span className="text-green-400 text-2xl">✓</span>
              <p className="text-neon-grey font-mono text-xs">
                <strong className="text-neon-white">No minimums</strong><br/>
                Withdraw earnings anytime
              </p>
            </div>
          </div>
        </div>
      </section>

      <NeonDivider className="max-w-6xl mx-auto" />

      {/* Try Our Advanced Tech Section */}
      <section className="px-4 sm:px-6 py-16 sm:py-20">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-sans font-light text-neon-white mb-4">
              Try Our Advanced Tech
            </h2>
            <p className="text-neon-grey font-mono text-sm mb-2">
              Experience the power of x402 payment-gated interactions right here
            </p>
            <p className="text-neon-grey font-mono text-xs">
              Play our Lucky Slot Machine - pay 0.10 USDC for a chance to win up to 50x!
            </p>
          </div>

          <div className="relative">
            <HomeSlotMachine />
          </div>

          <div className="mt-8 text-center">
            <p className="text-neon-grey font-mono text-xs mb-4">
              This slot machine is powered by Blink402&apos;s x402 payment protocol
            </p>
            <Link href="/slot-machine">
              <button className="btn-ghost text-neon-blue-light border-neon-blue-dark/50 hover:border-neon-blue-light text-sm">
                View Full Slot Machine Page →
              </button>
            </Link>
          </div>
        </div>
      </section>

      <NeonDivider className="max-w-6xl mx-auto" />

      {/* Reverse Blinks Section */}
      <section className="px-4 sm:px-6 py-16 sm:py-20">
        <div className="max-w-4xl mx-auto">
          <div className="bg-gradient-to-br from-green-500/5 to-transparent border border-green-500/20 rounded-lg p-8">
            <div className="flex items-start gap-4">
              <div className="flex-shrink-0 w-12 h-12 bg-green-500/10 rounded-full flex items-center justify-center">
                <span className="text-green-400 text-xl">💰</span>
              </div>
              <div>
                <h2 className="text-2xl font-sans font-light text-neon-white mb-4">
                  Introducing Reverse Blinks
                </h2>
                <p className="text-neon-grey font-mono text-sm mb-6">
                  Get paid to perform actions! Reverse Blinks pay YOU for completing tasks like surveys,
                  data labeling, or user testing. Creators fund rewards upfront, users earn instantly.
                </p>
                <div className="flex flex-wrap gap-4">
                  <Link href="/catalog?mode=reverse">
                    <button className="btn-ghost text-green-400 border-green-500/30 hover:border-green-400">
                      Browse Reverse Blinks
                    </button>
                  </Link>
                  <Link href="/create?mode=reverse">
                    <button className="btn-ghost">
                      Create a Reverse Blink
                    </button>
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
    </main>
  )
}