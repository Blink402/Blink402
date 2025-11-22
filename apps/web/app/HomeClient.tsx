"use client"
import { useEffect } from "react"
import Link from "next/link"
import Image from "next/image"
import { mountReveals } from "@/lib/reveal"
import { mountScramble } from "@/lib/scramble"
import Lottie from "@/components/Lottie"
import { AnimatedGrid } from "@/components/AnimatedGrid"
import { GradientText } from "@/components/GradientText"
import { MagneticButton } from "@/components/MagneticButton"

export default function HomeClient() {
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
    <>
      {/* Hero Section */}
      <section className="relative overflow-hidden px-4 sm:px-6 py-16 sm:py-24 md:py-32">
        {/* Animated Background */}
        <AnimatedGrid className="opacity-20" />

        <div className="relative z-10 max-w-6xl mx-auto grid md:grid-cols-[1.3fr_.7fr] gap-8 sm:gap-12 items-center">
          {/* Hero Content */}
          <header data-reveal>
            <h1 className="font-sans heading-hero text-neon-white">
              <span className="text-gradient-animated">Monetize</span> your API in seconds
            </h1>

            <p className="mt-4 sm:mt-6 text-neon-grey font-mono text-base sm:text-lg leading-relaxed text-muted-subtle">
              Paste your HTTP endpoint and generate a link that collects USDC micro-payments and triggers your API call—no server changes required.
            </p>

            <div className="mt-4 sm:mt-5 flex items-center gap-2 text-neon-blue-light font-mono text-sm">
              <Image
                src="/onchain_icon.svg"
                alt="ONCHAIN.fi"
                width={20}
                height={20}
                className="flex-shrink-0"
              />
              <span>Powered by ONCHAIN.fi for sub-second settlement in USDC</span>
            </div>

            <div className="mt-6 sm:mt-8 flex flex-col sm:flex-row flex-wrap gap-3 sm:gap-4">
              <Link href="/create">
                <MagneticButton className="btn-primary btn-ripple" data-reveal>
                  Create a paid link
                </MagneticButton>
              </Link>
              <Link href="/catalog">
                <button className="btn-ghost btn-ripple font-mono" data-reveal>
                  Browse the catalog
                </button>
              </Link>
              <Link href="/try">
                <button className="btn-ghost btn-ripple text-neon-blue-light" style={{ borderColor: 'var(--neon-blue-light)' }} data-reveal>
                  Try it out! (Free)
                </button>
              </Link>
            </div>
          </header>

          {/* Hero Animation */}
          <aside className="justify-self-center" data-reveal>
            <div className="rotate-slow">
              <Lottie
                src="/lottie/3D Shape Animation.lottie"
                autoplay
                loop
                width={320}
                height={320}
                applyNeonFilter={true}
                pauseOnInvisible={true}
              />
            </div>
          </aside>
        </div>
      </section>
    </>
  )
}
