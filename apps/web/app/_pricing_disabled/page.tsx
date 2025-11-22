"use client"
import { useEffect } from "react"
import { mountReveals } from "@/lib/reveal"
import { Check } from "lucide-react"
import Lottie from "@/components/Lottie"

export default function PricingPage() {
  useEffect(() => {
    mountReveals()
  }, [])

  const plans = [
    {
      name: "Free",
      price: "$0",
      description: "Perfect for testing and small projects",
      features: [
        "Up to 10 Blinks",
        "10,000 requests/month per Blink",
        "Basic analytics",
        "Community support",
      ],
      cta: "Get Started",
      href: "/create",
    },
    {
      name: "Pro",
      price: "$29",
      period: "/month",
      description: "For professionals and growing businesses",
      features: [
        "Unlimited Blinks",
        "1,000,000 requests/month per Blink",
        "Advanced analytics",
        "Priority support",
        "Custom domains",
        "Receipt NFTs",
      ],
      cta: "Start Free Trial",
      href: "/create",
      highlighted: true,
    },
    {
      name: "Enterprise",
      price: "Custom",
      description: "For high-volume applications",
      features: [
        "Unlimited everything",
        "Dedicated infrastructure",
        "SLA guarantee",
        "24/7 support",
        "Custom integrations",
        "Volume discounts",
      ],
      cta: "Contact Sales",
      href: "mailto:sales@blink402.dev",
    },
  ]

  return (
    <main className="min-h-screen px-6 py-16">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <header className="relative text-center mb-16" data-reveal>
          {/* Background 3D Cubes Animation */}
          <div className="hidden sm:block absolute top-1/2 -right-24 -translate-y-1/2 opacity-15 pointer-events-none -z-10">
            <Lottie
              src="/lottie/3D Cubes.lottie"
              autoplay
              loop
              width={280}
              height={280}
              applyNeonFilter={true}
            />
          </div>

          <h1
            className="font-sans text-neon-white mb-4"
            style={{
              letterSpacing: "-0.04em",
              fontWeight: 300,
              fontSize: "clamp(40px, 6vw, 72px)",
              lineHeight: 1.1,
            }}
          >
            Simple, transparent pricing
          </h1>
          <p className="text-neon-grey font-mono text-lg max-w-2xl mx-auto">
            Pay only for what you use. All plans include our core features.
          </p>
        </header>

        {/* Pricing Cards */}
        <div className="grid md:grid-cols-3 gap-8 mb-16">
          {plans.map((plan, index) => (
            <div
              key={plan.name}
              data-reveal
              style={{ animationDelay: `${index * 100}ms` }}
              className={`
                relative p-8 rounded-lg border transition-all
                ${
                  plan.highlighted
                    ? "border-neon-blue-light bg-neon-dark/50 scale-105"
                    : "border-neon-grey/20 bg-neon-dark/30"
                }
              `}
            >
              {plan.highlighted && (
                <div className="absolute -top-4 left-1/2 -translate-x-1/2 px-4 py-1 bg-neon rounded-full">
                  <span className="text-neon-black text-xs font-mono font-medium">
                    Most Popular
                  </span>
                </div>
              )}

              <div className="mb-6">
                <h3 className="text-2xl font-sans font-light text-neon-white mb-2">
                  {plan.name}
                </h3>
                <div className="flex items-baseline gap-1 mb-2">
                  <span className="text-4xl font-sans font-light text-neon-white">
                    {plan.price}
                  </span>
                  {plan.period && (
                    <span className="text-neon-grey font-mono text-sm">
                      {plan.period}
                    </span>
                  )}
                </div>
                <p className="text-neon-grey font-mono text-sm">
                  {plan.description}
                </p>
              </div>

              <ul className="space-y-3 mb-8">
                {plan.features.map((feature) => (
                  <li key={feature} className="flex items-start gap-3">
                    <Check className="text-neon-blue-light mt-0.5 shrink-0" size={18} />
                    <span className="text-neon-white font-mono text-sm">
                      {feature}
                    </span>
                  </li>
                ))}
              </ul>

              <a
                href={plan.href}
                className={`
                  block w-full text-center py-3 rounded font-mono text-sm transition-all
                  ${
                    plan.highlighted
                      ? "bg-neon-gradient text-neon-black hover:shadow-[0_0_20px_rgba(38,53,80,0.4)] active:shadow-[0_0_15px_rgba(38,53,80,0.5)] active:scale-98"
                      : "border border-dashed-neon text-neon-white hover:shadow-[0_0_20px_rgba(38,53,80,0.2)] active:shadow-[0_0_15px_rgba(38,53,80,0.3)] active:scale-98"
                  }
                `}
              >
                {plan.cta}
              </a>
            </div>
          ))}
        </div>

        {/* FAQ Section */}
        <section className="max-w-3xl mx-auto" data-reveal>
          <h2 className="text-3xl font-sans font-light text-neon-white mb-8 text-center">
            Frequently Asked Questions
          </h2>
          
          <div className="space-y-6">
            <div className="border border-neon-grey/20 rounded-lg p-6 bg-neon-dark/30">
              <h3 className="font-mono text-neon-white mb-2">
                How does pay-per-call work?
              </h3>
              <p className="text-neon-grey font-mono text-sm">
                Each time someone runs your Blink, they pay a small USDC amount on Solana. 
                You set the price. We handle verification and proxy the API call.
              </p>
            </div>

            <div className="border border-neon-grey/20 rounded-lg p-6 bg-neon-dark/30">
              <h3 className="font-mono text-neon-white mb-2">
                What happens if I exceed my plan limits?
              </h3>
              <p className="text-neon-grey font-mono text-sm">
                Blinks will continue to work, but you'll be charged $0.001 per additional request. 
                You can upgrade at any time to avoid overage fees.
              </p>
            </div>

            <div className="border border-neon-grey/20 rounded-lg p-6 bg-neon-dark/30">
              <h3 className="font-mono text-neon-white mb-2">
                Can I change plans later?
              </h3>
              <p className="text-neon-grey font-mono text-sm">
                Yes! You can upgrade or downgrade your plan at any time. 
                Changes take effect immediately, and we'll prorate your billing.
              </p>
            </div>

            <div className="border border-neon-grey/20 rounded-lg p-6 bg-neon-dark/30">
              <h3 className="font-mono text-neon-white mb-2">
                What's the platform fee?
              </h3>
              <p className="text-neon-grey font-mono text-sm">
                We take 2.5% of each transaction to cover infrastructure and Solana fees. 
                The rest goes directly to your wallet.
              </p>
            </div>
          </div>
        </section>
      </div>
    </main>
  )
}
