"use client"

import { useEffect } from "react"
import { UseCaseCard } from "@/components/UseCaseCard"
import NeonDivider from "@/components/NeonDivider"
import { mountReveals } from "@/lib/reveal"
import { mountScramble } from "@/lib/scramble"
import { Bot, BarChart3, Gem, Search, Gamepad2, Code2, Palette, Zap, ArrowRight } from "lucide-react"

export default function UseCasesPage() {
  useEffect(() => {
    mountReveals()
    mountScramble()
  }, [])

  const useCases = [
    {
      icon: <Bot className="w-12 h-12" />,
      title: "AI & Machine Learning",
      description: "Gate access to AI models, inference APIs, and ML services. Perfect for AI-powered tools, chatbots, and predictive analytics.",
      category: "AI/ML",
      examples: [
        {
          name: "GPT-4 API Calls",
          description: "Pay-per-use for OpenAI completions",
          price: "$0.50/call"
        },
        {
          name: "Image Generation",
          description: "DALL-E, Midjourney, Stable Diffusion",
          price: "$1.00/image"
        },
        {
          name: "Text-to-Speech",
          description: "ElevenLabs, Google TTS",
          price: "$0.25/request"
        },
        {
          name: "Sentiment Analysis",
          description: "Real-time emotion detection",
          price: "$0.10/analysis"
        }
      ]
    },
    {
      icon: <BarChart3 className="w-12 h-12" />,
      title: "Data & Analytics",
      description: "Monetize access to real-time data feeds, market analytics, and business intelligence APIs. Instant micro-payments for data queries.",
      category: "Data",
      examples: [
        {
          name: "Crypto Price Feeds",
          description: "Live prices from DexScreener",
          price: "$0.05/query"
        },
        {
          name: "Stock Market Data",
          description: "Real-time quotes and historical data",
          price: "$0.25/query"
        },
        {
          name: "Weather API",
          description: "Hyperlocal forecasts and alerts",
          price: "$0.10/request"
        },
        {
          name: "NFT Analytics",
          description: "Floor prices, volume, rarity",
          price: "$0.15/lookup"
        }
      ]
    },
    {
      icon: <Gem className="w-12 h-12" />,
      title: "Premium Content",
      description: "Gate exclusive content, premium articles, research reports, and educational materials. Perfect for creators and publishers.",
      category: "Content",
      examples: [
        {
          name: "Research Reports",
          description: "Unlock premium analysis and insights",
          price: "$2.00/report"
        },
        {
          name: "Tutorial Videos",
          description: "Step-by-step learning content",
          price: "$1.50/video"
        },
        {
          name: "Premium Articles",
          description: "In-depth journalism and analysis",
          price: "$0.50/article"
        },
        {
          name: "Exclusive Podcasts",
          description: "Early access to audio content",
          price: "$1.00/episode"
        }
      ]
    },
    {
      icon: <Search className="w-12 h-12" />,
      title: "Search & Discovery",
      description: "Monetize advanced search, recommendation engines, and discovery tools. Pay-per-query pricing for enhanced search capabilities.",
      category: "Search",
      examples: [
        {
          name: "Semantic Search",
          description: "AI-powered contextual search",
          price: "$0.15/query"
        },
        {
          name: "Product Recommendations",
          description: "Personalized shopping suggestions",
          price: "$0.20/request"
        },
        {
          name: "Content Discovery",
          description: "Similar articles and media",
          price: "$0.10/query"
        },
        {
          name: "Job Matching",
          description: "AI-powered candidate matching",
          price: "$0.50/search"
        }
      ]
    },
    {
      icon: <Gamepad2 className="w-12 h-12" />,
      title: "Interactive & Gaming",
      description: "Monetize games, interactive experiences, and entertainment APIs. From slot machines to lottery systems and beyond.",
      category: "Gaming",
      examples: [
        {
          name: "Slot Machine",
          description: "Classic casino-style slot game",
          price: "$0.10/spin",
          demoSlug: "slot-machine"
        },
        {
          name: "Lottery Entries",
          description: "Blockchain lottery system",
          price: "$1.00/entry",
          demoSlug: "lottery"
        },
        {
          name: "Trivia Games",
          description: "Quiz and challenge platform",
          price: "$0.25/game"
        },
        {
          name: "Mystery Box",
          description: "Random rewards and collectibles",
          price: "$0.50/box"
        }
      ]
    },
    {
      icon: <Code2 className="w-12 h-12" />,
      title: "Developer Tools",
      description: "Gate access to developer APIs, code generation, testing tools, and infrastructure services. Perfect for SaaS platforms.",
      category: "DevTools",
      examples: [
        {
          name: "Code Generation",
          description: "AI-powered code completion",
          price: "$0.30/request"
        },
        {
          name: "API Testing",
          description: "Load testing and monitoring",
          price: "$0.40/test"
        },
        {
          name: "Database Queries",
          description: "Premium data access",
          price: "$0.20/query"
        },
        {
          name: "Screenshot API",
          description: "Website rendering service",
          price: "$0.15/screenshot"
        }
      ]
    },
    {
      icon: <Palette className="w-12 h-12" />,
      title: "Creative Services",
      description: "Monetize design tools, media processing, and creative APIs. From logo generation to video editing and beyond.",
      category: "Creative",
      examples: [
        {
          name: "Logo Generation",
          description: "AI-powered brand identity",
          price: "$2.00/logo"
        },
        {
          name: "Video Editing",
          description: "Automated clip creation",
          price: "$1.50/video"
        },
        {
          name: "Photo Enhancement",
          description: "AI upscaling and restoration",
          price: "$0.50/image"
        },
        {
          name: "Music Generation",
          description: "AI-composed background tracks",
          price: "$1.00/track"
        }
      ]
    }
  ]

  return (
    <main className="min-h-screen bg-neon-black relative overflow-hidden">
      {/* Noise overlay */}
      <div className="noise-overlay" />

      {/* Hero Section */}
      <section className="relative pt-32 pb-16 px-4">
        <div className="max-w-7xl mx-auto text-center">
          <div className="inline-block mb-4 text-neon-blue-light animate-float" data-reveal>
            <Zap className="w-16 h-16 mx-auto drop-shadow-[0_0_15px_rgba(76,201,240,0.5)]" />
          </div>
          <h1
            className="text-5xl sm:text-6xl md:text-7xl font-sans font-light text-neon-white mb-6 tracking-tight"
            data-reveal
            data-scramble
          >
            Use <span className="text-neon-blue-light">Cases</span>
          </h1>
          <p
            className="text-xl sm:text-2xl text-neon-grey font-mono max-w-3xl mx-auto leading-relaxed"
            data-reveal
          >
            Turn any API into a monetizable Blink. From AI models to data feeds,
            <br className="hidden sm:block" />
            explore real-world examples across every industry.
          </p>
        </div>

        {/* Stats Banner */}
        <div className="max-w-5xl mx-auto mt-12 grid grid-cols-1 sm:grid-cols-3 gap-6" data-reveal>
          <div className="text-center p-6 glass-panel rounded-lg hover:border-neon-blue-light/30 transition-colors">
            <div className="text-4xl font-bold font-mono text-neon-blue-light drop-shadow-[0_0_10px_rgba(76,201,240,0.3)]">7</div>
            <div className="text-sm font-mono text-neon-grey mt-1">Categories</div>
          </div>
          <div className="text-center p-6 glass-panel rounded-lg hover:border-neon-blue-light/30 transition-colors">
            <div className="text-4xl font-bold font-mono text-neon-blue-light drop-shadow-[0_0_10px_rgba(76,201,240,0.3)]">28+</div>
            <div className="text-sm font-mono text-neon-grey mt-1">Example APIs</div>
          </div>
          <div className="text-center p-6 glass-panel rounded-lg hover:border-neon-blue-light/30 transition-colors">
            <div className="text-4xl font-bold font-mono text-neon-blue-light drop-shadow-[0_0_10px_rgba(76,201,240,0.3)]">$0.05</div>
            <div className="text-sm font-mono text-neon-grey mt-1">Starting Price</div>
          </div>
        </div>
      </section>

      <NeonDivider className="max-w-6xl mx-auto mb-16 opacity-50" />

      {/* Use Cases Grid */}
      <section className="pb-20 px-4">
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {useCases.map((useCase, idx) => (
              <UseCaseCard
                key={idx}
                icon={useCase.icon}
                title={useCase.title}
                description={useCase.description}
                examples={useCase.examples}
                category={useCase.category}
              />
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="pb-20 px-4">
        <div className="max-w-4xl mx-auto text-center" data-reveal>
          <div className="p-8 sm:p-12 rounded-lg glass-card border border-neon-blue-light/20 relative overflow-hidden group">
            <div className="absolute inset-0 bg-gradient-to-br from-neon-blue-primary/10 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />

            <h2 className="text-3xl sm:text-4xl font-sans font-light text-neon-white mb-4 relative z-10">
              Ready to Monetize Your API?
            </h2>
            <p className="text-neon-grey font-mono text-base mb-8 max-w-2xl mx-auto relative z-10">
              Create your first payment-gated Blink in under 2 minutes. No smart contracts, no complex setup.
            </p>
            <a
              href="/create"
              className="inline-flex items-center gap-2 px-8 py-4 rounded-lg bg-neon-blue-primary hover:bg-neon-blue-light text-neon-white font-mono font-bold border border-neon-blue-light/50 transition-all duration-200 shadow-[0_0_20px_rgba(67,97,238,0.4)] hover:shadow-[0_0_30px_rgba(76,201,240,0.6)] relative z-10 hover:-translate-y-1"
            >
              <span>Create Your Blink</span>
              <ArrowRight className="w-5 h-5" />
            </a>
          </div>
        </div>
      </section>
    </main>
  )
}
