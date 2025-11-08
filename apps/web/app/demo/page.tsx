import { DemoRunner } from '@/components/DemoRunner'

export const metadata = {
  title: 'Demo - Blink402',
  description: 'Try our payment-gated API system with a free demo - no wallet required!',
}

export default function DemoPage() {
  return (
    <main className="min-h-screen bg-neon-black">
      {/* Noise overlay */}
      <div className="noise-overlay" />

      <div className="relative mx-auto max-w-5xl px-4 py-16 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-12 text-center">
          <h1 className="mb-4 font-heading text-4xl font-light text-white md:text-5xl">
            Try it{' '}
            <span className="bg-gradient-to-r from-neon-green-light to-neon-green-dark bg-clip-text text-transparent">
              Free
            </span>
          </h1>
          <p className="mx-auto max-w-2xl text-lg text-neon-grey">
            Experience how Blink402 works without connecting a wallet. This demo simulates the
            complete payment flow and calls a real external API.
          </p>
        </div>

        {/* How it Works */}
        <div className="mb-12 rounded-lg border border-dashed border-neon-green-light/30 bg-neon-dark p-6">
          <h2 className="mb-4 font-heading text-xl font-light text-neon-green-light">
            How This Demo Works
          </h2>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
            <div>
              <div className="mb-2 text-2xl">1️⃣</div>
              <div className="text-sm font-medium text-white">Generate Transaction</div>
              <div className="text-xs text-neon-grey">Create mock payment reference</div>
            </div>
            <div>
              <div className="mb-2 text-2xl">2️⃣</div>
              <div className="text-sm font-medium text-white">Verify Payment</div>
              <div className="text-xs text-neon-grey">Simulate blockchain verification</div>
            </div>
            <div>
              <div className="mb-2 text-2xl">3️⃣</div>
              <div className="text-sm font-medium text-white">Call API</div>
              <div className="text-xs text-neon-grey">Execute real Dog Facts API</div>
            </div>
            <div>
              <div className="mb-2 text-2xl">4️⃣</div>
              <div className="text-sm font-medium text-white">Get Result</div>
              <div className="text-xs text-neon-grey">Display API response</div>
            </div>
          </div>
        </div>

        {/* Demo Runner */}
        <DemoRunner />

        {/* CTA */}
        <div className="mt-12 rounded-lg border border-dashed border-neon-green-light/30 bg-neon-dark p-6 text-center">
          <h3 className="mb-2 font-heading text-xl font-light text-white">
            Ready to create your own?
          </h3>
          <p className="mb-4 text-neon-grey">
            Turn any API into a pay-per-call Blink. Monetize access with Solana micropayments.
          </p>
          <a
            href="/create"
            className="inline-block rounded-lg border-2 border-dashed border-neon-green-light px-6 py-3 font-medium text-neon-green-light transition-all hover:border-neon-green-dark hover:bg-neon-green-light/10 hover:text-neon-green-dark hover:shadow-[0_0_20px_rgba(39,218,180,0.3)]"
          >
            Create Your First Blink
          </a>
        </div>
      </div>
    </main>
  )
}
