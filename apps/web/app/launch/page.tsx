"use client"
import { useEffect } from "react"
import { mountReveals } from "@/lib/reveal"
import { mountScramble } from "@/lib/scramble"
import NeonDivider from "@/components/NeonDivider"
import Lottie from "@/components/Lottie"
import { Rocket, Zap, Twitter, ArrowRight, ExternalLink } from "lucide-react"
import Link from "next/link"

export default function LaunchPage() {
  useEffect(() => {
    mountReveals()
    mountScramble()
  }, [])

  return (
    <main className="min-h-screen">
      {/* Hero Section */}
      <section className="relative overflow-hidden px-4 sm:px-6 py-16 md:py-24">
        <div className="absolute inset-0 opacity-[0.08] pointer-events-none -z-10">
          <div className="absolute inset-0 bg-gradient-to-b from-neon-blue-primary/30 via-transparent to-neon-purple/20" />
        </div>

        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-12">
            {/* Logo/Icon */}
            <div data-reveal className="inline-flex items-center justify-center w-20 h-20 mb-8 rounded-full bg-neon-dark/50 border-2 border-dashed border-neon-blue-light/40">
              <Rocket className="w-10 h-10 text-neon-blue-light" />
            </div>

            {/* Main Heading */}
            <h1
              data-reveal
              data-scramble
              className="text-4xl md:text-5xl lg:text-6xl font-sans font-light text-neon-white mb-6 leading-tight"
            >
              X402 × Blink402
              <br />
              <span className="bg-gradient-to-r from-neon-blue-light via-neon-blue-primary to-neon-purple bg-clip-text text-transparent">
                Launch Pad
              </span>
            </h1>

            {/* Subheading */}
            <p
              data-reveal
              className="text-neon-grey font-mono text-base md:text-xl max-w-3xl mx-auto leading-relaxed mb-8"
            >
              Fully native inside{" "}
              <span className="text-neon-blue-light inline-flex items-center gap-1">
                <Twitter className="w-4 h-4 inline" />X
              </span>
              , powered directly through embedded posts.
            </p>

            {/* Key Value Props - Inline */}
            <div data-reveal className="flex flex-wrap justify-center gap-4 md:gap-6 mb-12 font-mono text-sm md:text-base">
              <div className="flex items-center gap-2 text-neon-white">
                <Zap className="w-5 h-5 text-neon-blue-light" />
                <span>No redirects</span>
              </div>
              <div className="flex items-center gap-2 text-neon-white">
                <Zap className="w-5 h-5 text-neon-blue-light" />
                <span>No extra steps</span>
              </div>
              <div className="flex items-center gap-2 text-neon-white">
                <Zap className="w-5 h-5 text-neon-blue-light" />
                <span>100% on-chain</span>
              </div>
            </div>

            {/* CTA Buttons */}
            <div data-reveal className="flex flex-col sm:flex-row gap-4 justify-center items-center">
              <Link href="/create">
                <button className="btn-primary w-full sm:w-auto px-8 py-4 text-base font-mono">
                  Launch Your Token
                  <ArrowRight className="w-5 h-5 ml-2 inline" />
                </button>
              </Link>
              <Link href="#first-token">
                <button className="btn-ghost w-full sm:w-auto px-8 py-4 text-base font-mono">
                  View First Launch
                </button>
              </Link>
            </div>
          </div>
        </div>
      </section>

      <NeonDivider className="max-w-6xl mx-auto" />

      {/* How It Works - Simple Flow */}
      <section className="px-4 sm:px-6 py-16 md:py-20">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-12">
            <h2
              data-reveal
              data-scramble
              className="text-3xl md:text-4xl font-sans font-light text-neon-white mb-4"
            >
              The Simplest Launch Experience
            </h2>
            <p data-reveal className="text-neon-grey font-mono text-sm md:text-base">
              Just tap → mint → launch right where the attention already is.
            </p>
          </div>

          {/* Flow Steps */}
          <div className="grid md:grid-cols-3 gap-6 md:gap-8">
            {/* Step 1 */}
            <div
              data-reveal
              className="relative p-8 bg-neon-dark/30 border border-dashed border-neon-blue-dark/30 rounded-lg text-center hover:border-neon-blue-light/50 transition-all"
            >
              <div className="w-14 h-14 mx-auto mb-6 rounded-full bg-neon-blue-primary/20 border border-neon-blue-light/40 flex items-center justify-center">
                <span className="text-2xl font-bold text-neon-blue-light font-mono">1</span>
              </div>
              <h3 className="text-xl font-mono text-neon-white mb-3">Tap</h3>
              <p className="text-neon-grey font-mono text-sm leading-relaxed">
                See a post on X, tap the embedded Blink. No leaving the feed.
              </p>
            </div>

            {/* Step 2 */}
            <div
              data-reveal
              className="relative p-8 bg-neon-dark/30 border border-dashed border-neon-blue-dark/30 rounded-lg text-center hover:border-neon-blue-light/50 transition-all"
            >
              <div className="w-14 h-14 mx-auto mb-6 rounded-full bg-neon-blue-primary/20 border border-neon-blue-light/40 flex items-center justify-center">
                <span className="text-2xl font-bold text-neon-blue-light font-mono">2</span>
              </div>
              <h3 className="text-xl font-mono text-neon-white mb-3">Mint</h3>
              <p className="text-neon-grey font-mono text-sm leading-relaxed">
                Approve the micro-payment in your wallet. Instant on-chain settlement.
              </p>
            </div>

            {/* Step 3 */}
            <div
              data-reveal
              className="relative p-8 bg-neon-dark/30 border border-dashed border-neon-blue-dark/30 rounded-lg text-center hover:border-neon-blue-light/50 transition-all"
            >
              <div className="w-14 h-14 mx-auto mb-6 rounded-full bg-neon-blue-primary/20 border border-neon-blue-light/40 flex items-center justify-center">
                <span className="text-2xl font-bold text-neon-blue-light font-mono">3</span>
              </div>
              <h3 className="text-xl font-mono text-neon-white mb-3">Launch</h3>
              <p className="text-neon-grey font-mono text-sm leading-relaxed">
                Token created and live. Start trading, sharing, building immediately.
              </p>
            </div>
          </div>
        </div>
      </section>

      <NeonDivider className="max-w-6xl mx-auto" />

      {/* Beyond Launching - Future Features */}
      <section className="px-4 sm:px-6 py-16 md:py-20">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-12">
            <h2
              data-reveal
              data-scramble
              className="text-3xl md:text-4xl font-sans font-light text-neon-white mb-4"
            >
              We&apos;re Just Getting Started
            </h2>
            <p data-reveal className="text-neon-grey font-mono text-sm md:text-base max-w-2xl mx-auto">
              And we&apos;re not stopping there—you&apos;ll be able to stream, swap, and pay DEX-style directly from the same interface.
            </p>
          </div>

          {/* Feature Grid */}
          <div className="grid md:grid-cols-2 gap-6">
            {/* Stream */}
            <div
              data-reveal
              className="p-8 bg-gradient-to-br from-neon-blue-primary/10 to-transparent border border-neon-blue-dark/30 rounded-lg"
            >
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 bg-neon-blue-primary/20 rounded-full flex items-center justify-center flex-shrink-0">
                  <Zap className="w-6 h-6 text-neon-blue-light" />
                </div>
                <div>
                  <h3 className="text-xl font-mono text-neon-white mb-2">Stream</h3>
                  <p className="text-neon-grey font-mono text-sm leading-relaxed">
                    Real-time token vesting, salary payments, and streaming directly in X posts.
                  </p>
                </div>
              </div>
            </div>

            {/* Swap */}
            <div
              data-reveal
              className="p-8 bg-gradient-to-br from-neon-purple/10 to-transparent border border-neon-purple/30 rounded-lg"
            >
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 bg-neon-purple/20 rounded-full flex items-center justify-center flex-shrink-0">
                  <Zap className="w-6 h-6 text-neon-purple" />
                </div>
                <div>
                  <h3 className="text-xl font-mono text-neon-white mb-2">Swap</h3>
                  <p className="text-neon-grey font-mono text-sm leading-relaxed">
                    DEX-style token swaps embedded in posts. No external apps, no context switching.
                  </p>
                </div>
              </div>
            </div>

            {/* Pay */}
            <div
              data-reveal
              className="p-8 bg-gradient-to-br from-neon-cyan/10 to-transparent border border-neon-cyan/30 rounded-lg"
            >
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 bg-neon-cyan/20 rounded-full flex items-center justify-center flex-shrink-0">
                  <Zap className="w-6 h-6 text-neon-cyan" />
                </div>
                <div>
                  <h3 className="text-xl font-mono text-neon-white mb-2">Pay</h3>
                  <p className="text-neon-grey font-mono text-sm leading-relaxed">
                    Micro-payments, tips, and commerce. All on-chain, all inside your timeline.
                  </p>
                </div>
              </div>
            </div>

            {/* On-Chain */}
            <div
              data-reveal
              className="p-8 bg-gradient-to-br from-neon-pink/10 to-transparent border border-neon-pink/30 rounded-lg"
            >
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 bg-neon-pink/20 rounded-full flex items-center justify-center flex-shrink-0">
                  <Zap className="w-6 h-6 text-neon-pink" />
                </div>
                <div>
                  <h3 className="text-xl font-mono text-neon-white mb-2">All On-Chain</h3>
                  <p className="text-neon-grey font-mono text-sm leading-relaxed">
                    Every action verified, settled, and recorded on Solana. No centralized gatekeepers.
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Tagline */}
          <div data-reveal className="text-center mt-12">
            <p className="text-neon-blue-light font-mono text-lg md:text-xl font-semibold">
              One surface. Infinite actions. All on-chain.
            </p>
            <p className="text-neon-grey font-mono text-sm mt-2">
              This is the future of distribution, and we&apos;re building it right into the feed.
            </p>
          </div>
        </div>
      </section>

      <NeonDivider className="max-w-6xl mx-auto" />

      {/* First Token Launch */}
      <section id="first-token" className="px-4 sm:px-6 py-16 md:py-20">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-10">
            <h2
              data-reveal
              data-scramble
              className="text-3xl md:text-4xl font-sans font-light text-neon-white mb-4"
            >
              The First Launch
            </h2>
            <p data-reveal className="text-neon-grey font-mono text-sm md:text-base">
              History starts here. Meet the first token created on the X402 × Blink402 Launch Pad.
            </p>
          </div>

          {/* Token Card */}
          <div
            data-reveal
            className="bg-gradient-to-br from-neon-dark/80 to-neon-surface/50 border-2 border-dashed border-neon-blue-light/40 rounded-lg p-8 md:p-10"
          >
            <div className="flex flex-col md:flex-row gap-8 items-center md:items-start">
              {/* Token Icon/Logo Placeholder */}
              <div className="w-24 h-24 md:w-32 md:h-32 bg-gradient-to-br from-neon-blue-light/20 to-neon-purple/20 rounded-full border-2 border-neon-blue-light/50 flex items-center justify-center flex-shrink-0">
                <Rocket className="w-12 h-12 md:w-16 md:h-16 text-neon-blue-light" />
              </div>

              {/* Token Details */}
              <div className="flex-1 text-center md:text-left">
                <div className="inline-flex items-center gap-2 mb-3 px-3 py-1 bg-neon-blue-primary/20 border border-neon-blue-light/30 rounded-full">
                  <span className="text-neon-blue-light font-mono text-xs uppercase tracking-wider">
                    Genesis Launch
                  </span>
                </div>

                <h3 className="text-2xl md:text-3xl font-sans font-light text-neon-white mb-3">
                  First Token on X402 Launch Pad
                </h3>

                <p className="text-neon-grey font-mono text-sm md:text-base mb-6 leading-relaxed">
                  The inaugural token launched natively through X using Blink402&apos;s payment infrastructure.
                  No redirects. No friction. Pure on-chain distribution.
                </p>

                {/* Token Link */}
                <a
                  href="https://pump.fun/coin/2cMZnVkwRiYaoA1Ht9ptUCegmM4ebZKzFNfYLxLrpump"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 px-6 py-3 bg-neon-dark border border-dashed border-neon-blue-light/50 rounded-lg text-neon-blue-light hover:text-neon-white hover:border-neon-blue-light transition-all font-mono text-sm"
                >
                  <span>View on Pump.fun</span>
                  <ExternalLink className="w-4 h-4" />
                </a>

                {/* Contract Address (truncated) */}
                <div className="mt-4 flex items-center gap-2 justify-center md:justify-start">
                  <span className="text-neon-grey/70 font-mono text-xs">Contract:</span>
                  <code className="text-neon-blue-light font-mono text-xs bg-neon-dark/50 px-2 py-1 rounded border border-neon-blue-dark/30">
                    2cMZ...pump
                  </code>
                </div>
              </div>
            </div>
          </div>

          {/* Stats Grid (Optional) */}
          <div data-reveal className="grid grid-cols-3 gap-4 mt-8">
            <div className="text-center p-4 bg-neon-dark/30 border border-neon-blue-dark/20 rounded-lg">
              <div className="text-neon-blue-light font-mono text-2xl font-bold mb-1">#1</div>
              <div className="text-neon-grey font-mono text-xs">First Launch</div>
            </div>
            <div className="text-center p-4 bg-neon-dark/30 border border-neon-blue-dark/20 rounded-lg">
              <div className="text-neon-blue-light font-mono text-2xl font-bold mb-1">100%</div>
              <div className="text-neon-grey font-mono text-xs">On-Chain</div>
            </div>
            <div className="text-center p-4 bg-neon-dark/30 border border-neon-blue-dark/20 rounded-lg">
              <div className="text-neon-blue-light font-mono text-2xl font-bold mb-1">0s</div>
              <div className="text-neon-grey font-mono text-xs">Redirects</div>
            </div>
          </div>
        </div>
      </section>

      <NeonDivider className="max-w-6xl mx-auto" />

      {/* Final CTA */}
      <section className="px-4 sm:px-6 py-16 md:py-20">
        <div className="max-w-4xl mx-auto text-center">
          <div
            data-reveal
            className="bg-gradient-to-br from-neon-blue-primary/10 via-neon-purple/10 to-transparent border border-neon-blue-light/30 rounded-lg p-10 md:p-12"
          >
            <Lottie
              src="/lottie/technology.lottie"
              autoplay
              loop
              width={120}
              height={120}
              className="mx-auto mb-6"
              applyNeonFilter={true}
            />

            <h2
              data-scramble
              className="text-3xl md:text-4xl font-sans font-light text-neon-white mb-6"
            >
              Ready to Launch?
            </h2>

            <p className="text-neon-grey font-mono text-sm md:text-base mb-8 max-w-2xl mx-auto leading-relaxed">
              Join the future of token distribution. Launch your token natively inside X with zero friction,
              instant settlement, and 100% on-chain verification.
            </p>

            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link href="/create">
                <button className="btn-primary w-full sm:w-auto px-8 py-4 text-base font-mono">
                  Create Your Launch
                  <Rocket className="w-5 h-5 ml-2 inline" />
                </button>
              </Link>
              <Link href="/catalog">
                <button className="btn-ghost w-full sm:w-auto px-8 py-4 text-base font-mono">
                  Explore Launches
                </button>
              </Link>
            </div>
          </div>
        </div>
      </section>
    </main>
  )
}
