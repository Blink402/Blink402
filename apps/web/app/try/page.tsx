'use client'

import { useEffect } from 'react'
import { mountReveals } from '@/lib/reveal'
import { mountScramble } from '@/lib/scramble'
import { DemoRunner } from '@/components/DemoRunner'
import NeonDivider from '@/components/NeonDivider'

export default function TryPage() {
  useEffect(() => {
    mountReveals()
    mountScramble()
  }, [])

  return (
    <div className="min-h-screen">
      {/* Hero Section */}
      <section className="px-4 py-16 md:py-24">
        <div className="mx-auto max-w-4xl">
          <div data-reveal className="space-y-6 text-center">
            <h1 className="font-heading text-4xl font-light tracking-tight md:text-6xl">
              <span data-scramble>Try it out!</span>
            </h1>
            <p className="mx-auto max-w-2xl text-lg text-neon-grey md:text-xl">
              Experience how Blinks work without needing a wallet or making any payments.
              This free demo simulates the entire payment flow using a real API.
            </p>
          </div>
        </div>
      </section>

      <NeonDivider />

      {/* Demo Section */}
      <section className="px-4 py-16">
        <div className="mx-auto max-w-5xl">
          <div data-reveal className="space-y-8">
            {/* What happens section */}
            <div className="rounded-lg border border-dashed border-neon-blue-light/30 bg-neon-dark p-6 md:p-8">
              <h2 className="mb-4 font-heading text-2xl font-light md:text-3xl">
                What happens when you click &quot;Run Demo&quot;?
              </h2>
              <ol className="space-y-3 text-neon-grey">
                <li className="flex items-start gap-3">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-neon-blue-light text-xs text-neon-blue-light">
                    1
                  </span>
                  <span>
                    <strong className="text-white">Mock Transaction Created</strong> - We generate a fake
                    transaction reference (no real blockchain involved)
                  </span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-neon-blue-light text-xs text-neon-blue-light">
                    2
                  </span>
                  <span>
                    <strong className="text-white">Payment Simulated</strong> - We add a realistic delay to
                    mimic on-chain verification (800ms)
                  </span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-neon-blue-light text-xs text-neon-blue-light">
                    3
                  </span>
                  <span>
                    <strong className="text-white">Real API Called</strong> - We call the{' '}
                    <a
                      href="https://dogapi.dog"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-neon-blue-light underline hover:text-neon-blue-dark"
                    >
                      Dog Facts API
                    </a>{' '}
                    to fetch a random dog fact
                  </span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-neon-blue-light text-xs text-neon-blue-light">
                    4
                  </span>
                  <span>
                    <strong className="text-white">Result Displayed</strong> - You see the dog fact along
                    with mock transaction details
                  </span>
                </li>
              </ol>
            </div>

            {/* Demo Runner Component */}
            <DemoRunner />

            {/* How it works in production */}
            <div className="rounded-lg border border-dashed border-neon-blue-light/30 bg-neon-dark p-6 md:p-8">
              <h2 className="mb-4 font-heading text-2xl font-light md:text-3xl">
                How it works in production
              </h2>
              <div className="space-y-4 text-neon-grey">
                <p>
                  In a real Blink, instead of simulating the payment, you would:
                </p>
                <ol className="space-y-2 pl-6 list-decimal">
                  <li>
                    Connect your Solana wallet (like Phantom, Backpack, or Solflare)
                  </li>
                  <li>
                    Sign a real USDC or SOL payment transaction for the API call price
                  </li>
                  <li>
                    The payment gets verified on the Solana blockchain
                  </li>
                  <li>
                    Once verified, the API call executes and you receive the result
                  </li>
                  <li>
                    The creator receives the payment directly to their wallet
                  </li>
                </ol>
                <p className="pt-4 text-sm">
                  <strong className="text-white">Why Blinks?</strong> Blinks turn any HTTP endpoint into a
                  pay-per-call API without requiring API keys, accounts, or custom smart contracts. Perfect
                  for monetizing APIs, AI models, data feeds, and more.
                </p>
              </div>
            </div>

            {/* CTA */}
            <div data-reveal className="text-center">
              <p className="mb-4 text-neon-grey">Ready to create your own Blink?</p>
              <a
                href="/create"
                className="btn-primary inline-flex items-center gap-2 rounded-lg border-2 border-dashed border-neon-blue-light bg-transparent px-8 py-3 font-medium text-neon-blue-light transition-all hover:border-neon-blue-dark hover:bg-neon-blue-light/10 hover:text-neon-blue-dark hover:shadow-[0_0_20px_rgba(39,218,180,0.3)]"
              >
                Create a Blink
                <svg
                  className="h-5 w-5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M13 7l5 5m0 0l-5 5m5-5H6"
                  />
                </svg>
              </a>
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}
