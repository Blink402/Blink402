"use client"
import { useEffect } from "react"
import Link from "next/link"
import { mountReveals } from "@/lib/reveal"
import { mountScramble } from "@/lib/scramble"
import Lottie from "@/components/Lottie"
import NeonDivider from "@/components/NeonDivider"

export default function Home() {
  useEffect(() => {
    // Defer animations until after initial render
    // Use requestIdleCallback for non-critical animations
    const startAnimations = () => {
      mountReveals()
      mountScramble()
    }

    if ('requestIdleCallback' in window) {
      requestIdleCallback(startAnimations, { timeout: 500 })
    } else {
      setTimeout(startAnimations, 100)
    }
  }, [])

  return (
    <main className="min-h-screen">
      {/* Hero Section */}
      <section className="relative overflow-hidden px-4 sm:px-6 py-16 sm:py-24 md:py-32">
        <div className="relative z-10 max-w-6xl mx-auto grid md:grid-cols-[1.3fr_.7fr] gap-8 sm:gap-12 items-center">
          {/* Hero Content */}
          <header data-reveal>
            <h1
              data-scramble
              className="font-sans text-neon-white heading-hero"
            >
              Paste a URL. Get a paid link.
            </h1>

            <p className="mt-4 sm:mt-6 text-neon-grey font-mono text-base sm:text-lg leading-relaxed">
              Turn any API into a pay-per-call Blink—shareable anywhere on the web.
            </p>

            <div className="mt-6 sm:mt-8 flex flex-col sm:flex-row flex-wrap gap-3 sm:gap-4">
              <Link href="/create">
                <button className="btn-primary" data-reveal>
                  Create a paid link
                </button>
              </Link>
              <Link href="/catalog">
                <button className="btn-ghost font-mono" data-reveal>
                  Browse the catalog
                </button>
              </Link>
              <Link href="/try">
                <button className="btn-ghost text-neon-green-light" style={{ borderColor: 'var(--neon-green-light)' }} data-reveal>
                  Try it out! (Free)
                </button>
              </Link>
            </div>
          </header>

          {/* Hero Animation */}
          <aside className="justify-self-center" data-reveal>
            <Lottie
              src="/lottie/3D Shape Animation.lottie"
              autoplay
              loop
              width={320}
              height={320}
              applyChromeFilter={true}
              pauseOnInvisible={true}
            />
          </aside>
        </div>

        <NeonDivider className="mt-20 max-w-6xl mx-auto" />
      </section>

      {/* How It Works Section */}
      <section className="relative px-6 py-20 overflow-hidden">
        {/* Background Lines Wave Animation - DISABLED FOR PERFORMANCE */}
        {/* TODO: Replace with optimized smaller Lottie or CSS animation */}
        {/* The 1920x1080 Lottie was causing 70-100ms frame times */}
        <div className="absolute inset-0 opacity-[0.05] pointer-events-none -z-10">
          {/* Simple CSS gradient background instead */}
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
            <div data-reveal className="text-center">
              <div className="w-12 h-12 rounded-full bg-neon-dark/10 border border-neon-blue-dark/30 flex items-center justify-center mx-auto mb-6">
                <span className="text-neon font-mono text-xl font-bold">1</span>
              </div>
              <h3 className="text-xl font-mono text-neon-white mb-3">Paste your endpoint & set a price</h3>
              <p className="text-neon-grey font-mono text-sm leading-relaxed">
                Configure your API URL, method, and pricing in seconds.
              </p>
            </div>

            {/* Step 2 */}
            <div data-reveal className="text-center">
              <div className="w-12 h-12 rounded-full bg-neon-dark/10 border border-neon-blue-dark/30 flex items-center justify-center mx-auto mb-6">
                <span className="text-neon font-mono text-xl font-bold">2</span>
              </div>
              <h3 className="text-xl font-mono text-neon-white mb-3">Share your Blink anywhere</h3>
              <p className="text-neon-grey font-mono text-sm leading-relaxed">
                Get a shareable link that unfurls beautifully on social.
              </p>
            </div>

            {/* Step 3 */}
            <div data-reveal className="text-center">
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
            <p className="text-neon-grey font-mono text-sm">
              <span className="text-neon-blue-light">✓</span> We verify payment on-chain before executing your API.
            </p>
          </div>
        </div>
      </section>
    </main>
  )
}
