'use client'

import { useEffect } from 'react'
import Link from 'next/link'
import { ArrowLeft, Zap, Shield, Bot, Sparkles, ExternalLink, Rocket, Lock, Globe } from 'lucide-react'
import { mountReveals } from '@/lib/reveal'
import { mountScramble } from '@/lib/scramble'

export default function UpdatesPage() {
  useEffect(() => {
    mountReveals()
    mountScramble()
  }, [])

  const updates = [
    {
      icon: <Zap className="w-6 h-6 text-neon-blue-light" />,
      title: "ONCHAIN x402 Payment Protocol",
      subtitle: "Powered by ONCHAIN",
      description: "Complete migration to ONCHAIN's intelligent x402 payment aggregator, bringing best-in-class payment infrastructure to Blink402.",
      features: [
        {
          name: "Multi-Facilitator Routing",
          detail: "Automatic routing across Coinbase CDP, thirdweb, PayAI, OctonetAI, and more with intelligent failover"
        },
        {
          name: "2.1s Settlement Time",
          detail: "Average payment settlement in just 2.1 seconds with automatic retry and health monitoring"
        },
        {
          name: "Cross-Chain Payments",
          detail: "Pay from Solana, receive on Base (or vice versa) - seamless cross-chain settlement"
        },
        {
          name: "Cost Optimization",
          detail: "Smart routing based on speed, cost, or reliability priorities to minimize fees"
        },
        {
          name: "Production-Ready Infrastructure",
          detail: "Battle-tested error handling, rate limiting, and monitoring built for scale"
        }
      ],
      link: "https://onchain.fi",
      linkText: "Learn about ONCHAIN",
      date: "January 2025"
    },
    {
      icon: <Lock className="w-6 h-6 text-neon-blue-light" />,
      title: "Privy Wallet Integration",
      subtitle: "Powered by Privy",
      description: "Enterprise-grade wallet infrastructure with social login, embedded wallets, and seamless authentication trusted by 75M+ accounts.",
      features: [
        {
          name: "Social Login",
          detail: "Sign in with email, Twitter, GitHub, or passkey - no complicated wallet setup required"
        },
        {
          name: "Embedded Wallets",
          detail: "Self-custodial wallets created automatically - users maintain full control without managing seed phrases"
        },
        {
          name: "Multi-Wallet Support",
          detail: "Support for Phantom, Solflare, MetaMask, Coinbase Wallet, and WalletConnect"
        },
        {
          name: "SOC 2 Compliance",
          detail: "Enterprise security with TEE encryption, key sharding, and hardware-secured infrastructure"
        },
        {
          name: "Progressive Authentication",
          detail: "Start simple, add security layers as needed - MFA and advanced compliance when required"
        }
      ],
      link: "https://privy.io",
      linkText: "Learn about Privy",
      note: "Acquired by Stripe in June 2025, bringing even stronger financial infrastructure",
      date: "January 2025"
    },
    {
      icon: <Bot className="w-6 h-6 text-neon-blue-light" />,
      title: "Telegram Bot Integration",
      subtitle: "Access Blinks directly from Telegram",
      description: "Run payment-gated API calls directly from Telegram with our fully-featured bot integration.",
      features: [
        {
          name: "Browse Blinks",
          detail: "Discover and explore all available Blinks directly in your Telegram chats"
        },
        {
          name: "One-Tap Payments",
          detail: "Execute payment-gated API calls without leaving Telegram"
        },
        {
          name: "Real-Time Notifications",
          detail: "Get instant updates on payment status and API execution results"
        },
        {
          name: "Wallet Integration",
          detail: "Seamless Solana wallet connection through Telegram mini-apps"
        },
        {
          name: "Creator Dashboard Access",
          detail: "Monitor your Blinks performance and earnings from Telegram"
        }
      ],
      link: "https://t.me/blinkx402",
      linkText: "Try the Telegram Bot",
      date: "January 2025"
    },
    {
      icon: <Sparkles className="w-6 h-6 text-neon-blue-light" />,
      title: "Simplified User Interface",
      subtitle: "Clarity meets design",
      description: "Complete UI/UX overhaul focused on clarity, accessibility, and helping users understand the platform instantly.",
      features: [
        {
          name: "Streamlined Navigation",
          detail: "Reduced clutter with clear, focused navigation paths and improved information architecture"
        },
        {
          name: "Enhanced Onboarding",
          detail: "Step-by-step guides and contextual help to get users from zero to their first Blink in under 2 minutes"
        },
        {
          name: "Clearer Pricing Display",
          detail: "Transparent cost breakdown with real-time fee calculations and network status"
        },
        {
          name: "Better Error Messages",
          detail: "Human-readable error messages with actionable next steps instead of technical jargon"
        },
        {
          name: "Mobile-First Responsive",
          detail: "Fully optimized for mobile with 48px touch targets and thumb-friendly interactions"
        },
        {
          name: "Accessibility Improvements",
          detail: "WCAG 2.1 AA compliance with keyboard navigation, screen reader support, and reduced motion preferences"
        }
      ],
      date: "January 2025"
    },
    {
      icon: <Shield className="w-6 h-6 text-neon-blue-light" />,
      title: "Security Enhancements",
      subtitle: "Your funds, protected",
      description: "Advanced security measures to protect against wallet exploits and ensure safe payment processing.",
      features: [
        {
          name: "Manual Message Signing",
          detail: "Prevents wallet Jito instruction injection attacks by requiring explicit message signing"
        },
        {
          name: "Transaction Validation",
          detail: "Automatic detection and blocking of wallet modifications to payment instructions"
        },
        {
          name: "Redis Distributed Locking",
          detail: "Prevents race conditions and duplicate execution in production with Redis-based locks"
        },
        {
          name: "On-Chain Verification",
          detail: "All payments verified on-chain before API execution - no trust required"
        },
        {
          name: "Rate Limiting",
          detail: "Distributed rate limiting to prevent abuse and protect API endpoints"
        }
      ],
      date: "January 2025"
    },
    {
      icon: <Rocket className="w-6 h-6 text-neon-blue-light" />,
      title: "Performance Optimizations",
      subtitle: "Faster, smoother, better",
      description: "Comprehensive performance improvements across the stack for lightning-fast user experiences.",
      features: [
        {
          name: "Payment Flow Optimization",
          detail: "Median end-to-end payment latency under 2 seconds with verify+forward under 800ms"
        },
        {
          name: "Reduced Bundle Size",
          detail: "Removed legacy dependencies and optimized imports - 40% smaller JavaScript bundle"
        },
        {
          name: "Database Query Optimization",
          detail: "Connection pooling and optimized queries for faster dashboard and analytics loading"
        },
        {
          name: "Smart Caching",
          detail: "Redis caching for frequently accessed data with intelligent invalidation"
        }
      ],
      date: "January 2025"
    },
    {
      icon: <Globe className="w-6 h-6 text-neon-blue-light" />,
      title: "Developer Experience",
      subtitle: "Built for builders",
      description: "Enhanced documentation, APIs, and tools to make building on Blink402 even easier.",
      features: [
        {
          name: "Monorepo Architecture",
          detail: "Turborepo-based monorepo with shared packages for types, Solana utilities, and database layers"
        },
        {
          name: "Comprehensive Documentation",
          detail: "Detailed integration guides, API references, and code examples for all features"
        },
        {
          name: "TypeScript-First",
          detail: "Fully typed APIs and SDKs with IntelliSense support for better developer experience"
        },
        {
          name: "Improved API Responses",
          detail: "Consistent error handling and detailed response schemas across all endpoints"
        }
      ],
      date: "January 2025"
    }
  ]

  return (
    <div className="min-h-screen bg-neon-black">
      {/* Hero Section */}
      <section className="border-b border-neon-grey/20 pt-24 pb-16">
        <div className="container mx-auto px-4 max-w-5xl">
          <div data-reveal>
            <Link
              href="/"
              className="inline-flex items-center gap-2 text-neon-grey hover:text-neon-blue-light transition-colors mb-8 text-sm font-mono group"
            >
              <ArrowLeft size={16} className="group-hover:-translate-x-1 transition-transform" />
              Back to Home
            </Link>
          </div>

          <div data-reveal>
            <h1 className="text-5xl md:text-6xl font-light tracking-tight text-neon-white mb-6" data-scramble>
              Platform Updates
            </h1>
            <p className="text-xl text-neon-grey max-w-3xl leading-relaxed">
              We've shipped major improvements to make Blink402 faster, more secure, and easier to use than ever before.
            </p>
          </div>

          {/* Quick Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-12" data-reveal>
            <div className="border border-neon-grey/20 rounded p-4 bg-neon-dark/30">
              <div className="text-3xl font-mono text-neon-blue-light mb-1">2.1s</div>
              <div className="text-sm text-neon-grey">Avg Settlement</div>
            </div>
            <div className="border border-neon-grey/20 rounded p-4 bg-neon-dark/30">
              <div className="text-3xl font-mono text-neon-blue-light mb-1">75M+</div>
              <div className="text-sm text-neon-grey">Accounts (Privy)</div>
            </div>
            <div className="border border-neon-grey/20 rounded p-4 bg-neon-dark/30">
              <div className="text-3xl font-mono text-neon-blue-light mb-1">8+</div>
              <div className="text-sm text-neon-grey">Facilitators</div>
            </div>
            <div className="border border-neon-grey/20 rounded p-4 bg-neon-dark/30">
              <div className="text-3xl font-mono text-neon-blue-light mb-1">SOC 2</div>
              <div className="text-sm text-neon-grey">Compliance</div>
            </div>
          </div>
        </div>
      </section>

      {/* Updates List */}
      <section className="py-16">
        <div className="container mx-auto px-4 max-w-5xl">
          <div className="space-y-12">
            {updates.map((update, index) => (
              <div
                key={index}
                data-reveal
                className="border border-neon-grey/20 rounded-lg p-8 bg-neon-dark/20 hover:border-neon-blue-dark/40 transition-all"
              >
                {/* Header */}
                <div className="flex items-start gap-4 mb-6">
                  <div className="p-3 rounded-lg bg-neon-blue-dark/20 border border-neon-blue-dark/40">
                    {update.icon}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h2 className="text-2xl font-light text-neon-white">
                        {update.title}
                      </h2>
                      <span className="text-xs font-mono text-neon-grey px-2 py-1 border border-neon-grey/20 rounded">
                        {update.date}
                      </span>
                    </div>
                    {update.subtitle && (
                      <p className="text-sm text-neon-blue-light font-mono mb-2">
                        {update.subtitle}
                      </p>
                    )}
                    <p className="text-neon-grey leading-relaxed">
                      {update.description}
                    </p>
                  </div>
                </div>

                {/* Features */}
                <div className="space-y-3 mb-6">
                  {update.features.map((feature, featureIndex) => (
                    <div
                      key={featureIndex}
                      className="flex gap-3 p-3 rounded bg-neon-black/40"
                    >
                      <div className="w-1.5 h-1.5 rounded-full bg-neon-blue-light mt-2 flex-shrink-0" />
                      <div>
                        <div className="text-neon-white font-mono text-sm mb-1">
                          {feature.name}
                        </div>
                        <div className="text-neon-grey text-sm leading-relaxed">
                          {feature.detail}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Footer */}
                <div className="flex flex-col gap-3">
                  {update.note && (
                    <div className="text-sm text-neon-grey italic border-l-2 border-neon-blue-dark/40 pl-4">
                      {update.note}
                    </div>
                  )}
                  {update.link && (
                    <Link
                      href={update.link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 text-neon-blue-light hover:text-neon-white transition-colors text-sm font-mono group w-fit"
                    >
                      {update.linkText}
                      <ExternalLink size={14} className="group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
                    </Link>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="border-t border-neon-grey/20 py-16">
        <div className="container mx-auto px-4 max-w-5xl text-center" data-reveal>
          <h2 className="text-3xl font-light text-neon-white mb-4">
            Ready to try the new Blink402?
          </h2>
          <p className="text-neon-grey mb-8 max-w-2xl mx-auto">
            Experience faster payments, better security, and improved user experience with our latest updates.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              href="/create"
              className="btn-primary text-center"
            >
              Create Your First Blink
            </Link>
            <Link
              href="/catalog"
              className="px-6 py-3 rounded border border-neon-grey/30 text-neon-white hover:border-neon-blue-light/60 hover:text-neon-blue-light transition-all font-mono"
            >
              Browse Catalog
            </Link>
          </div>
        </div>
      </section>

      {/* Partners Section */}
      <section className="border-t border-neon-grey/20 py-12 bg-neon-dark/20">
        <div className="container mx-auto px-4 max-w-5xl">
          <div data-reveal className="text-center">
            <p className="text-sm text-neon-grey font-mono mb-6">POWERED BY</p>
            <div className="flex flex-wrap items-center justify-center gap-8 md:gap-12">
              <Link
                href="https://onchain.fi"
                target="_blank"
                rel="noopener noreferrer"
                className="group"
              >
                <div className="text-2xl font-mono text-neon-grey group-hover:text-neon-blue-light transition-colors">
                  ONCHAIN
                </div>
                <div className="text-xs text-neon-grey/60 text-center mt-1">x402 Payments</div>
              </Link>
              <div className="w-px h-8 bg-neon-grey/20" />
              <Link
                href="https://privy.io"
                target="_blank"
                rel="noopener noreferrer"
                className="group"
              >
                <div className="text-2xl font-mono text-neon-grey group-hover:text-neon-blue-light transition-colors">
                  PRIVY
                </div>
                <div className="text-xs text-neon-grey/60 text-center mt-1">Wallet Infrastructure</div>
              </Link>
              <div className="w-px h-8 bg-neon-grey/20" />
              <Link
                href="https://solana.com"
                target="_blank"
                rel="noopener noreferrer"
                className="group"
              >
                <div className="text-2xl font-mono text-neon-grey group-hover:text-neon-blue-light transition-colors">
                  SOLANA
                </div>
                <div className="text-xs text-neon-grey/60 text-center mt-1">Blockchain</div>
              </Link>
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}
