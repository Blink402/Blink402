"use client"
import { useEffect, useState } from "react"
import Link from "next/link"
import { mountReveals } from "@/lib/reveal"
import { mountScramble } from "@/lib/scramble"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import NeonDivider from "@/components/NeonDivider"
import Lottie from "@/components/Lottie"
import BlinkEmbed from "@/components/BlinkEmbed"

export default function DocsPage() {
  const [activeSection, setActiveSection] = useState("overview")

  useEffect(() => {
    mountReveals()
    mountScramble()
  }, [])

  const sections = [
    { id: "overview", title: "Overview" },
    { id: "how-it-works", title: "How It Works" },
    { id: "try-it-live", title: "Try It Live" },
    { id: "x402-protocol", title: "x402 Protocol" },
    { id: "agent-integration", title: "Agent Integration" },
    { id: "refunds", title: "Refunds & Credits" },
    { id: "security", title: "Security" },
  ]

  return (
    <main className="min-h-screen">
      {/* Header */}
      <section className="relative px-6 py-12 md:py-16 overflow-hidden">
        {/* Background Circle Animation */}
        <div className="absolute top-1/2 right-0 -translate-y-1/2 opacity-15 pointer-events-none -z-10">
          <Lottie
            src="/lottie/Circle.lottie"
            autoplay
            loop
            width={500}
            height={500}
            applyNeonFilter={true}
          />
        </div>

        <div className="max-w-6xl mx-auto relative z-10">
          <nav className="mb-8 font-mono text-sm text-neon-grey" data-reveal>
            <Link href="/" className="link-gradient hover:text-neon-blue-light transition-colors">
              Home
            </Link>
            <span className="mx-2">/</span>
            <span className="text-neon-white">Docs</span>
          </nav>

          <h1
            data-reveal
            data-scramble
            className="text-5xl md:text-6xl font-sans text-neon-white mb-4"
            style={{ fontWeight: 300, letterSpacing: "-0.04em" }}
          >
            Documentation
          </h1>

          <p className="text-lg text-neon-grey font-mono max-w-2xl" data-reveal>
            Everything you need to know about Blink402, Solana Blinks, and the x402 protocol.
          </p>

          <NeonDivider className="mt-12" />
        </div>
      </section>

      {/* Content */}
      <section className="px-6 pb-20">
        <div className="max-w-6xl mx-auto">
          {/* Mobile: Horizontal scrolling tabs */}
          <nav className="lg:hidden overflow-x-auto -mx-6 px-6 mb-8" data-reveal>
            <div className="flex gap-2 min-w-max pb-2">
              {sections.map((section) => (
                <button
                  key={section.id}
                  onClick={() => {
                    setActiveSection(section.id)
                    document.getElementById(section.id)?.scrollIntoView({ behavior: "smooth" })
                  }}
                  className={`px-4 py-2 rounded font-mono text-sm whitespace-nowrap transition-all ${
                    activeSection === section.id
                      ? "bg-neon-blue-dark/20 text-neon-blue-light border border-neon-blue-light"
                      : "text-neon-grey bg-neon-dark/40 active:bg-neon-dark/60"
                  }`}
                >
                  {section.title}
                </button>
              ))}
            </div>
          </nav>

          {/* Desktop: Sidebar + Content Grid */}
          <div className="grid lg:grid-cols-[250px_1fr] gap-8">
            {/* Desktop Sidebar - hidden on mobile */}
            <aside className="hidden lg:block lg:sticky lg:top-8 h-fit">
              <nav className="space-y-2" data-reveal>
                {sections.map((section) => (
                  <button
                    key={section.id}
                    onClick={() => {
                      setActiveSection(section.id)
                      document.getElementById(section.id)?.scrollIntoView({ behavior: "smooth" })
                    }}
                    className={`w-full text-left px-4 py-2 rounded font-mono text-sm transition-all ${
                      activeSection === section.id
                        ? "bg-neon-blue-dark/20 text-neon-blue-light border-l-2 border-neon-blue-light"
                        : "text-neon-grey hover:text-neon-white hover:bg-neon-dark/40 active:bg-neon-dark/60"
                    }`}
                  >
                    {section.title}
                  </button>
                ))}
              </nav>
            </aside>

            {/* Main Content */}
            <div className="space-y-12 min-w-0">
            {/* Overview */}
            <section id="overview" data-reveal>
              <h2 className="text-3xl font-sans text-neon-white mb-4" style={{ fontWeight: 300 }}>
                Overview
              </h2>
              <Card className="p-4 md:p-6 bg-neon-dark/40 border-neon-grey/20">
                <p className="font-mono text-sm md:text-base text-neon-grey mb-4 leading-relaxed">
                  Blink402 turns <strong className="text-neon-white">any HTTP endpoint</strong> into a{" "}
                  <strong className="text-neon-white">pay-per-call Blink (Solana Action)</strong> that can be shared
                  on X/Discord/web.
                </p>
                <p className="font-mono text-sm md:text-base text-neon-grey mb-4 leading-relaxed">
                  Users click, approve micro-payments in USDC on Solana, and our proxy executes the API
                  call—<strong className="text-neon-white">no accounts, API keys, or custom smart contracts needed</strong>.
                </p>

                <div className="mt-6 pt-6 border-t border-neon-grey/20">
                  <h3 className="text-base md:text-lg font-mono text-neon-white mb-3">Key Benefits</h3>
                  <ul className="space-y-3 md:space-y-2 font-mono text-xs md:text-sm text-neon-grey">
                    <li className="flex items-start gap-2 md:gap-3">
                      <span className="text-neon-blue-light shrink-0 mt-0.5">✓</span>
                      <span className="leading-relaxed">Zero accounts or API keys for buyers</span>
                    </li>
                    <li className="flex items-start gap-2 md:gap-3">
                      <span className="text-neon-blue-light shrink-0 mt-0.5">✓</span>
                      <span className="leading-relaxed">Near-instant settlement in USDC on Solana</span>
                    </li>
                    <li className="flex items-start gap-2 md:gap-3">
                      <span className="text-neon-blue-light shrink-0 mt-0.5">✓</span>
                      <span className="leading-relaxed">No custom on-chain programs required</span>
                    </li>
                    <li className="flex items-start gap-2 md:gap-3">
                      <span className="text-neon-blue-light shrink-0 mt-0.5">✓</span>
                      <span className="leading-relaxed">Shareable links that unfurl beautifully</span>
                    </li>
                  </ul>
                </div>
              </Card>
            </section>

            {/* How It Works */}
            <section id="how-it-works" data-reveal>
              <h2 className="text-3xl font-sans text-neon-white mb-4" style={{ fontWeight: 300 }}>
                How It Works
              </h2>

              <div className="space-y-6">
                {/* For Creators */}
                <Card className="p-4 md:p-6 bg-neon-dark/40 border-neon-grey/20">
                  <h3 className="text-lg md:text-xl font-mono text-neon-blue-light mb-4">For Creators</h3>
                  <div className="space-y-4 md:space-y-6 font-mono text-xs md:text-sm">
                    <div className="flex gap-3 md:gap-4">
                      <div className="shrink-0 w-7 h-7 md:w-8 md:h-8 rounded-full bg-neon-blue-dark/20 border border-neon-blue-light/40 flex items-center justify-center text-neon font-bold text-xs md:text-sm">
                        1
                      </div>
                      <div className="min-w-0">
                        <h4 className="text-neon-white mb-1 text-sm md:text-base leading-tight">Paste your endpoint & set price</h4>
                        <p className="text-neon-grey leading-relaxed">Configure your API URL, method, and pricing in seconds.</p>
                      </div>
                    </div>

                    <div className="flex gap-3 md:gap-4">
                      <div className="shrink-0 w-7 h-7 md:w-8 md:h-8 rounded-full bg-neon-blue-dark/20 border border-neon-blue-light/40 flex items-center justify-center text-neon font-bold text-xs md:text-sm">
                        2
                      </div>
                      <div className="min-w-0">
                        <h4 className="text-neon-white mb-1 text-sm md:text-base leading-tight">Get shareable link & QR code</h4>
                        <p className="text-neon-grey leading-relaxed">
                          Receive a Blink URL and Solana Pay QR that unfurls beautifully on social media.
                        </p>
                      </div>
                    </div>

                    <div className="flex gap-3 md:gap-4">
                      <div className="shrink-0 w-7 h-7 md:w-8 md:h-8 rounded-full bg-neon-blue-dark/20 border border-neon-blue-light/40 flex items-center justify-center text-neon font-bold text-xs md:text-sm">
                        3
                      </div>
                      <div className="min-w-0">
                        <h4 className="text-neon-white mb-1 text-sm md:text-base leading-tight">Earn instantly</h4>
                        <p className="text-neon-grey leading-relaxed">
                          Every time someone runs your Blink, you get paid directly to your wallet.
                        </p>
                      </div>
                    </div>
                  </div>
                </Card>

                {/* For Buyers */}
                <Card className="p-4 md:p-6 bg-neon-dark/40 border-neon-grey/20">
                  <h3 className="text-lg md:text-xl font-mono text-neon-blue-light mb-4">For Buyers (Human)</h3>
                  <div className="space-y-4 md:space-y-6 font-mono text-xs md:text-sm">
                    <div className="flex gap-3 md:gap-4">
                      <div className="shrink-0 w-7 h-7 md:w-8 md:h-8 rounded-full bg-neon-blue-dark/20 border border-neon-blue-light/40 flex items-center justify-center text-neon font-bold text-xs md:text-sm">
                        1
                      </div>
                      <div className="min-w-0">
                        <h4 className="text-neon-white mb-1 text-sm md:text-base leading-tight">Click the Blink</h4>
                        <p className="text-neon-grey leading-relaxed">Find a Blink on X, Discord, or the catalog.</p>
                      </div>
                    </div>

                    <div className="flex gap-3 md:gap-4">
                      <div className="shrink-0 w-7 h-7 md:w-8 md:h-8 rounded-full bg-neon-blue-dark/20 border border-neon-blue-light/40 flex items-center justify-center text-neon font-bold text-xs md:text-sm">
                        2
                      </div>
                      <div className="min-w-0">
                        <h4 className="text-neon-white mb-1 text-sm md:text-base leading-tight">Wallet popup</h4>
                        <p className="text-neon-grey leading-relaxed">Approve the USDC payment on-chain (typically $0.01-$0.10).</p>
                      </div>
                    </div>

                    <div className="flex gap-3 md:gap-4">
                      <div className="shrink-0 w-7 h-7 md:w-8 md:h-8 rounded-full bg-neon-blue-dark/20 border border-neon-blue-light/40 flex items-center justify-center text-neon font-bold text-xs md:text-sm">
                        3
                      </div>
                      <div className="min-w-0">
                        <h4 className="text-neon-white mb-1 text-sm md:text-base leading-tight">Get instant result</h4>
                        <p className="text-neon-grey leading-relaxed">
                          API executes automatically after payment verification, result shown immediately.
                        </p>
                      </div>
                    </div>
                  </div>
                </Card>
              </div>
            </section>

            {/* Try It Live */}
            <section id="try-it-live" data-reveal>
              <h2 className="text-3xl font-sans text-neon-white mb-4" style={{ fontWeight: 300 }}>
                Try It Live
              </h2>

              <Card className="p-4 md:p-6 bg-gradient-to-br from-neon-blue-dark/10 to-transparent border-2 border-neon-blue-light/30 mb-6">
                <div className="flex items-start gap-3 mb-4">
                  <span className="text-2xl">⚡</span>
                  <div>
                    <h3 className="text-lg font-mono text-neon-white mb-2">Test the Full Flow</h3>
                    <p className="font-mono text-sm text-neon-grey leading-relaxed">
                      Experience the complete Blink402 flow right here in the docs. Connect your wallet, pay just <strong className="text-neon-white">$0.01 USDC</strong>, and see AI enhance your tweet in real-time. This is a <strong className="text-neon-white">real transaction</strong> on Solana mainnet using the ONCHAIN x402 protocol.
                    </p>
                  </div>
                </div>

                <ul className="space-y-2 font-mono text-xs text-neon-grey mb-6 pl-9">
                  <li className="flex items-start gap-2">
                    <span className="text-neon-blue-light shrink-0">✓</span>
                    <span>Real USDC payment ($0.01) on Solana mainnet</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-neon-blue-light shrink-0">✓</span>
                    <span>Instant settlement via ONCHAIN x402 (sub-2s)</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-neon-blue-light shrink-0">✓</span>
                    <span>AI-powered tweet enhancement by GPT-4</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-neon-blue-light shrink-0">✓</span>
                    <span>See transaction on Solscan after execution</span>
                  </li>
                </ul>

                <BlinkEmbed slug="punchup-tweet" className="max-w-2xl mx-auto" />
              </Card>

              <Card className="p-4 bg-neon-dark/20 border-neon-grey/20">
                <p className="font-mono text-xs text-neon-grey text-center">
                  💡 <strong className="text-neon-white">Don't have USDC?</strong> You can get some on{" "}
                  <a
                    href="https://jup.ag/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-neon-blue-light hover:text-neon-blue-light/80 underline"
                  >
                    Jupiter Exchange
                  </a>
                  {" "}or{" "}
                  <a
                    href="https://raydium.io/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-neon-blue-light hover:text-neon-blue-light/80 underline"
                  >
                    Raydium
                  </a>
                  {" "}in seconds.
                </p>
              </Card>
            </section>

            {/* x402 Protocol */}
            <section id="x402-protocol" data-reveal>
              <h2 className="text-3xl font-sans text-neon-white mb-4" style={{ fontWeight: 300 }}>
                x402 Protocol
              </h2>

              <Card className="p-4 md:p-6 bg-neon-dark/40 border-neon-grey/20">
                <p className="font-mono text-sm md:text-base text-neon-grey mb-6 leading-relaxed">
                  Blink402 implements the <strong className="text-neon-white">x402 Payment Required</strong> HTTP
                  standard, allowing both humans and agents/bots to pay for API access programmatically.
                </p>

                <h3 className="text-base md:text-lg font-mono text-neon-white mb-3">How x402 Works</h3>
                <div className="bg-neon-black/60 p-3 md:p-4 rounded border border-neon-grey/20 mb-6 overflow-hidden">
                  <ol className="space-y-2 md:space-y-3 font-mono text-xs md:text-sm text-neon-grey">
                    <li className="leading-relaxed">
                      <span className="text-neon-blue-light">1.</span> Client makes request to{" "}
                      <code className="text-neon-white break-all">POST /bazaar/:slug</code>
                    </li>
                    <li className="leading-relaxed">
                      <span className="text-neon-blue-light">2.</span> Server responds with{" "}
                      <code className="text-neon-white">402 Payment Required</code> and payment details
                    </li>
                    <li className="leading-relaxed">
                      <span className="text-neon-blue-light">3.</span> Client pays on Solana using provided details
                    </li>
                    <li className="leading-relaxed">
                      <span className="text-neon-blue-light">4.</span> Client retries request with{" "}
                      <code className="text-neon-white">signature</code> header
                    </li>
                    <li className="leading-relaxed">
                      <span className="text-neon-blue-light">5.</span> Server verifies payment on-chain and proxies API
                      call
                    </li>
                  </ol>
                </div>

                <h3 className="text-base md:text-lg font-mono text-neon-white mb-3">Example 402 Response</h3>
                <pre className="bg-neon-black/60 p-3 md:p-4 rounded text-xs font-mono text-neon-grey overflow-x-auto border border-neon-grey/20">
                  {`{
  "status": 402,
  "price": "0.03",
  "currency": "USDC",
  "recipient": "9xQe...xyz789",
  "reference": "8cdbb0e6-6c3e-4a8d-9b9a-0a7b31b0a2a1",
  "action_url": "https://blink402-production.up.railway.app/actions/colorize",
  "expires_at": 1730582400
}`}
                </pre>
              </Card>
            </section>

            {/* Agent Integration */}
            <section id="agent-integration" data-reveal>
              <h2 className="text-3xl font-sans text-neon-white mb-4" style={{ fontWeight: 300 }}>
                Agent Integration
              </h2>

              <Card className="p-4 md:p-6 bg-neon-dark/40 border-neon-grey/20">
                <p className="font-mono text-sm md:text-base text-neon-grey mb-6 leading-relaxed">
                  Bots and AI agents can use Blink402 APIs programmatically by following the x402 payment flow.
                </p>

                <h3 className="text-base md:text-lg font-mono text-neon-white mb-3">TypeScript Example</h3>
                <pre className="bg-neon-black/60 p-3 md:p-4 rounded text-xs font-mono text-neon-grey overflow-x-auto border border-neon-grey/20 mb-6">
                  {`import { Connection, Keypair, Transaction } from '@solana/web3.js'
import { getAssociatedTokenAddress, createTransferInstruction } from '@solana/spl-token'

async function callBlink402(slug: string, payload: any) {
  // 1. Initial request
  const res = await fetch(\`https://blink402-production.up.railway.app/bazaar/\${slug}\`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  })

  if (res.status !== 402) {
    return res.json() // Already paid or error
  }

  // 2. Parse payment details
  const { price, recipient, reference, action_url } = await res.json()

  // 3. Build & sign payment transaction
  const connection = new Connection('https://api.mainnet-beta.solana.com')
  const payer = Keypair.fromSecretKey(/* your key */)
  
  // ... build USDC transfer with reference ...

  const signature = await connection.sendTransaction(tx, [payer])
  await connection.confirmTransaction(signature)

  // 4. Retry with signature
  const finalRes = await fetch(\`https://blink402-production.up.railway.app/bazaar/\${slug}\`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Signature': signature
    },
    body: JSON.stringify(payload)
  })

  return finalRes.json()
}`}
                </pre>

                <div className="bg-neon-blue-dark/10 border border-neon-blue-light/30 p-3 md:p-4 rounded">
                  <p className="font-mono text-xs md:text-sm text-neon-white leading-relaxed">
                    <strong>💡 Tip:</strong> Use Solana Pay's{" "}
                    <code className="text-neon-blue-light">validateTransfer</code> standard for building transactions.
                  </p>
                </div>
              </Card>
            </section>

            {/* Refunds */}
            <section id="refunds" data-reveal>
              <h2 className="text-3xl font-sans text-neon-white mb-4" style={{ fontWeight: 300 }}>
                Refunds & Credits
              </h2>

              <Card className="p-4 md:p-6 bg-neon-dark/40 border-neon-grey/20">
                <div className="space-y-4 md:space-y-6 font-mono text-xs md:text-sm">
                  <div>
                    <h3 className="text-neon-white mb-2 text-sm md:text-base">When are refunds issued?</h3>
                    <p className="text-neon-grey leading-relaxed">
                      Refunds or credits are <strong className="text-neon-white">only issued for upstream API
                      failures</strong>—cases where the endpoint returned a 5xx error or timed out. Payment
                      verification failures or invalid requests are not eligible.
                    </p>
                  </div>

                  <div className="pt-4 border-t border-neon-grey/20">
                    <h3 className="text-neon-white mb-2 text-sm md:text-base">Refund process</h3>
                    <ul className="space-y-2 md:space-y-3 text-neon-grey">
                      <li className="flex items-start gap-2 md:gap-3">
                        <span className="text-neon-blue-light shrink-0 mt-0.5">•</span>
                        <span className="leading-relaxed">Automatic credit issuance for eligible failures</span>
                      </li>
                      <li className="flex items-start gap-2 md:gap-3">
                        <span className="text-neon-blue-light shrink-0 mt-0.5">•</span>
                        <span className="leading-relaxed">Credits appear in your dashboard within 1 hour</span>
                      </li>
                      <li className="flex items-start gap-2 md:gap-3">
                        <span className="text-neon-blue-light shrink-0 mt-0.5">•</span>
                        <span className="leading-relaxed">Use credits on future runs or request withdrawal</span>
                      </li>
                    </ul>
                  </div>

                  <div className="pt-4 border-t border-neon-grey/20">
                    <h3 className="text-neon-white mb-2 text-sm md:text-base">Not eligible for refunds</h3>
                    <ul className="space-y-2 md:space-y-3 text-neon-grey">
                      <li className="flex items-start gap-2 md:gap-3">
                        <span className="text-red-400 shrink-0 mt-0.5">✗</span>
                        <span className="leading-relaxed">Invalid payment signatures</span>
                      </li>
                      <li className="flex items-start gap-2 md:gap-3">
                        <span className="text-red-400 shrink-0 mt-0.5">✗</span>
                        <span className="leading-relaxed">Wrong recipient or amount</span>
                      </li>
                      <li className="flex items-start gap-2 md:gap-3">
                        <span className="text-red-400 shrink-0 mt-0.5">✗</span>
                        <span className="leading-relaxed">Upstream API returned 4xx (client error)</span>
                      </li>
                      <li className="flex items-start gap-2 md:gap-3">
                        <span className="text-red-400 shrink-0 mt-0.5">✗</span>
                        <span className="leading-relaxed">Rate limit exceeded</span>
                      </li>
                    </ul>
                  </div>
                </div>
              </Card>
            </section>

            {/* Security */}
            <section id="security" data-reveal>
              <h2 className="text-3xl font-sans text-neon-white mb-4" style={{ fontWeight: 300 }}>
                Security
              </h2>

              <Card className="p-4 md:p-6 bg-neon-dark/40 border-neon-grey/20">
                <div className="space-y-4 md:space-y-6">
                  <div>
                    <h3 className="text-base md:text-lg font-mono text-neon-white mb-3">Payment Verification</h3>
                    <p className="font-mono text-xs md:text-sm text-neon-grey mb-3 leading-relaxed">
                      All payments are verified on-chain using Solana Pay's <code className="text-neon-white">validateTransfer</code>:
                    </p>
                    <ul className="space-y-2 md:space-y-3 font-mono text-xs md:text-sm text-neon-grey">
                      <li className="flex items-start gap-2 md:gap-3">
                        <span className="text-neon-blue-light shrink-0 mt-0.5">✓</span>
                        <span className="leading-relaxed">Correct recipient wallet</span>
                      </li>
                      <li className="flex items-start gap-2 md:gap-3">
                        <span className="text-neon-blue-light shrink-0 mt-0.5">✓</span>
                        <span className="leading-relaxed">Exact USDC amount</span>
                      </li>
                      <li className="flex items-start gap-2 md:gap-3">
                        <span className="text-neon-blue-light shrink-0 mt-0.5">✓</span>
                        <span className="leading-relaxed">Valid reference UUID</span>
                      </li>
                      <li className="flex items-start gap-2 md:gap-3">
                        <span className="text-neon-blue-light shrink-0 mt-0.5">✓</span>
                        <span className="leading-relaxed">Transaction confirmed on-chain</span>
                      </li>
                    </ul>
                  </div>

                  <div className="pt-4 md:pt-6 border-t border-neon-grey/20">
                    <h3 className="text-base md:text-lg font-mono text-neon-white mb-3">Idempotency</h3>
                    <p className="font-mono text-xs md:text-sm text-neon-grey leading-relaxed">
                      Each payment <code className="text-neon-white">reference</code> can only be used once. Attempting
                      to reuse a reference returns <code className="text-neon-white">409 Conflict</code>.
                    </p>
                  </div>

                  <div className="pt-4 md:pt-6 border-t border-neon-grey/20">
                    <h3 className="text-base md:text-lg font-mono text-neon-white mb-3">Rate Limiting</h3>
                    <p className="font-mono text-xs md:text-sm text-neon-grey mb-3 leading-relaxed">
                      Rate limits are enforced per wallet/IP and per individual Blink to prevent abuse:
                    </p>
                    <ul className="space-y-2 md:space-y-3 font-mono text-xs md:text-sm text-neon-grey">
                      <li className="flex items-start gap-2 md:gap-3">
                        <span className="text-neon-blue-light shrink-0 mt-0.5">•</span>
                        <span className="leading-relaxed">Per wallet: 100 requests/hour across all Blinks</span>
                      </li>
                      <li className="flex items-start gap-2 md:gap-3">
                        <span className="text-neon-blue-light shrink-0 mt-0.5">•</span>
                        <span className="leading-relaxed">Per Blink: 1000 requests/hour total</span>
                      </li>
                      <li className="flex items-start gap-2 md:gap-3">
                        <span className="text-neon-blue-light shrink-0 mt-0.5">•</span>
                        <span className="leading-relaxed">Exceeded limits return <code className="text-neon-white">429 Too Many Requests</code></span>
                      </li>
                    </ul>
                  </div>

                  <div className="pt-4 md:pt-6 border-t border-neon-grey/20">
                    <h3 className="text-base md:text-lg font-mono text-neon-white mb-3">Upstream Protection</h3>
                    <ul className="space-y-2 md:space-y-3 font-mono text-xs md:text-sm text-neon-grey">
                      <li className="flex items-start gap-2 md:gap-3">
                        <span className="text-neon-blue-light shrink-0 mt-0.5">✓</span>
                        <span className="leading-relaxed">Allowlist of permitted upstream domains</span>
                      </li>
                      <li className="flex items-start gap-2 md:gap-3">
                        <span className="text-neon-blue-light shrink-0 mt-0.5">✓</span>
                        <span className="leading-relaxed">Content-type validation</span>
                      </li>
                      <li className="flex items-start gap-2 md:gap-3">
                        <span className="text-neon-blue-light shrink-0 mt-0.5">✓</span>
                        <span className="leading-relaxed">Response size caps (5-10MB)</span>
                      </li>
                      <li className="flex items-start gap-2 md:gap-3">
                        <span className="text-neon-blue-light shrink-0 mt-0.5">✓</span>
                        <span className="leading-relaxed">Timeout limits per Blink</span>
                      </li>
                      <li className="flex items-start gap-2 md:gap-3">
                        <span className="text-neon-blue-light shrink-0 mt-0.5">✓</span>
                        <span className="leading-relaxed">CORS restrictions prevent third-party redirects</span>
                      </li>
                    </ul>
                  </div>
                </div>
              </Card>
            </section>

            {/* CTA */}
            <Card className="p-6 md:p-8 bg-linear-to-br from-neon-blue-dark/20 to-neon-blue-light/10 border-neon-blue-light/30" data-reveal>
              <h2 className="text-xl md:text-2xl font-sans text-neon-white mb-4" style={{ fontWeight: 300 }}>
                Ready to get started?
              </h2>
              <p className="font-mono text-sm md:text-base text-neon-grey mb-6 leading-relaxed">
                Create your first Blink in under a minute or explore the catalog to see what's possible.
              </p>
              <div className="flex flex-col sm:flex-row gap-4">
                <Link href="/create">
                  <button className="btn-primary btn-ripple w-full sm:w-auto">Create a Blink</button>
                </Link>
                <Link href="/catalog">
                  <button className="btn-ghost btn-ripple w-full sm:w-auto">Browse Catalog</button>
                </Link>
              </div>
            </Card>
          </div>
          </div>
        </div>
      </section>
    </main>
  )
}
