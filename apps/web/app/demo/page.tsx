"use client"
import { useEffect } from "react"
import { DemoRunner } from '@/components/DemoRunner'
import { mountReveals } from "@/lib/reveal"
import { mountScramble } from "@/lib/scramble"

export default function DemoPage() {
  useEffect(() => {
    mountReveals()
    mountScramble()
  }, [])

  return (
    <main className="min-h-screen">
      <div className="relative mx-auto max-w-5xl px-4 py-16 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-12 text-center" data-reveal>
          <h1 className="mb-4 font-sans text-4xl font-light text-neon-white md:text-5xl" data-scramble>
            Try it{' '}
            <span className="bg-gradient-to-r from-neon-blue-light to-neon-blue-dark bg-clip-text text-transparent">
              Free
            </span>
          </h1>
          <p className="mx-auto max-w-2xl text-lg text-neon-grey font-mono">
            Experience how Blink402 works without connecting a wallet. This demo simulates the
            complete payment flow and calls a real external API.
          </p>
        </div>

        {/* How it Works */}
        <div className="mb-12 rounded-lg border border-dashed border-neon-blue-light/30 bg-neon-dark p-6" data-reveal>
          <h2 className="mb-4 font-sans text-xl font-light text-neon-blue-light">
            How This Demo Works
          </h2>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
            <div>
              <div className="mb-2 w-12 h-12 rounded-full bg-neon-dark border border-neon-blue-dark/30 flex items-center justify-center mx-auto md:mx-0">
                <span className="text-neon font-mono text-xl font-bold">1</span>
              </div>
              <div className="text-sm font-medium text-neon-white font-mono">Generate Transaction</div>
              <div className="text-xs text-neon-grey font-mono">Create mock payment reference</div>
            </div>
            <div>
              <div className="mb-2 w-12 h-12 rounded-full bg-neon-dark border border-neon-blue-dark/30 flex items-center justify-center mx-auto md:mx-0">
                <span className="text-neon font-mono text-xl font-bold">2</span>
              </div>
              <div className="text-sm font-medium text-neon-white font-mono">Verify Payment</div>
              <div className="text-xs text-neon-grey font-mono">Simulate blockchain verification</div>
            </div>
            <div>
              <div className="mb-2 w-12 h-12 rounded-full bg-neon-dark border border-neon-blue-dark/30 flex items-center justify-center mx-auto md:mx-0">
                <span className="text-neon font-mono text-xl font-bold">3</span>
              </div>
              <div className="text-sm font-medium text-neon-white font-mono">Call API</div>
              <div className="text-xs text-neon-grey font-mono">Execute real Dog Facts API</div>
            </div>
            <div>
              <div className="mb-2 w-12 h-12 rounded-full bg-neon-dark border border-neon-blue-dark/30 flex items-center justify-center mx-auto md:mx-0">
                <span className="text-neon font-mono text-xl font-bold">4</span>
              </div>
              <div className="text-sm font-medium text-neon-white font-mono">Get Result</div>
              <div className="text-xs text-neon-grey font-mono">Display API response</div>
            </div>
          </div>
        </div>

        {/* Demo Runner */}
        <div data-reveal>
          <DemoRunner />
        </div>

        {/* CTA */}
        <div className="mt-12 rounded-lg border border-dashed border-neon-blue-light/30 bg-neon-dark p-6 text-center" data-reveal>
          <h3 className="mb-2 font-sans text-xl font-light text-neon-white">
            Ready to create your own?
          </h3>
          <p className="mb-4 text-neon-grey font-mono">
            Turn any API into a pay-per-call Blink. Monetize access with Solana micropayments.
          </p>
          <a
            href="/create"
            className="inline-block rounded-lg border-2 border-dashed border-neon-blue-light px-6 py-3 font-medium font-mono text-neon-blue-light transition-all hover:border-neon-blue-dark hover:bg-neon-blue-light/10 hover:text-neon-blue-dark hover:shadow-[0_0_20px_rgba(90,180,255,0.3)]"
          >
            Create Your First Blink
          </a>
        </div>
      </div>
    </main>
  )
}
