"use client"
import { useEffect, useState, useMemo } from "react"
import { mountReveals } from "@/lib/reveal"
import { mountScramble } from "@/lib/scramble"
import { getBlinks } from "@/lib/api"
import type { BlinkData } from "@/lib/types"
import { logger } from '@/lib/logger'
import NeonDivider from "@/components/NeonDivider"
import BlinkCard from "@/components/BlinkCard"
import Lottie from "@/components/Lottie"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import Link from "next/link"
import { motion } from "motion/react"
import { MagneticButton } from "@/components/MagneticButton"

const CATEGORIES = ["All", "AI/ML", "Utilities", "Data", "API Tools", "Web3"]

export default function CatalogPage() {
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedCategory, setSelectedCategory] = useState("All")
  const [sortBy, setSortBy] = useState("popular")
  const [blinks, setBlinks] = useState<BlinkData[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    mountReveals()
    mountScramble()

    // Load blinks from API
    getBlinks()
      .then((data) => {
        setBlinks(data)
        setError(null)
      })
      .catch((err) => {
        logger.error('Failed to load blinks:', err)
        setError(err.message || 'Failed to load Blinks')
      })
      .finally(() => {
        setIsLoading(false)
      })
  }, [])

  // Filter and sort blinks (memoized to prevent unnecessary recalculations)
  const filteredBlinks = useMemo(() => {
    return blinks.filter((blink) => {
      const matchesSearch =
        searchQuery === "" ||
        blink.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        blink.description.toLowerCase().includes(searchQuery.toLowerCase())

      const matchesCategory = selectedCategory === "All" || blink.category === selectedCategory

      return matchesSearch && matchesCategory
    }).sort((a, b) => {
      switch (sortBy) {
        case "popular":
          return b.runs - a.runs
        case "price-low":
          return parseFloat(a.price_usdc) - parseFloat(b.price_usdc)
        case "price-high":
          return parseFloat(b.price_usdc) - parseFloat(a.price_usdc)
        case "recent":
          return 0 // Would use created_at in real implementation
        default:
          return 0
      }
    })
  }, [blinks, searchQuery, selectedCategory, sortBy])

  return (
    <main className="min-h-screen">
      {/* Header */}
      <section className="relative overflow-hidden px-4 sm:px-6 py-12 md:py-24">
        <div className="max-w-7xl mx-auto">
          <header data-reveal className="text-center mb-8 md:mb-12">
            <h1
              data-scramble
              className="font-sans text-neon-white mb-3 md:mb-4 text-3xl md:text-4xl lg:text-5xl"
            >
              Browse the Catalog
            </h1>
            <p className="text-neon-grey font-mono text-sm md:text-lg max-w-2xl mx-auto px-2">
              Discover pay-per-call APIs. Click, pay pennies, get instant results.
            </p>
          </header>

          {/* Filters */}
          <div data-reveal className="mb-6 md:mb-8 flex flex-col gap-3 md:gap-4">
            {/* Search Bar - Full Width */}
            <div className="w-full">
              <Input
                type="search"
                placeholder="Search Blinks..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="bg-neon-dark border-neon-blue-dark/30 text-neon-white placeholder:text-neon-grey font-mono text-sm md:text-base h-11 md:h-auto"
              />
            </div>

            {/* Category and Sort - Side by Side on Mobile */}
            <div className="flex gap-3 w-full">
              <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                <SelectTrigger className="flex-1 bg-neon-dark border-neon-blue-dark/30 text-neon-white font-mono text-sm md:text-base h-11 md:h-auto">
                  <SelectValue placeholder="Category" />
                </SelectTrigger>
                <SelectContent className="bg-neon-dark border-neon-blue-dark/30 text-neon-white">
                  {CATEGORIES.map((cat) => (
                    <SelectItem key={cat} value={cat} className="font-mono text-sm">
                      {cat}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={sortBy} onValueChange={setSortBy}>
                <SelectTrigger className="flex-1 bg-neon-dark border-neon-blue-dark/30 text-neon-white font-mono text-sm md:text-base h-11 md:h-auto">
                  <SelectValue placeholder="Sort by" />
                </SelectTrigger>
                <SelectContent className="bg-neon-dark border-neon-blue-dark/30 text-neon-white">
                  <SelectItem value="popular" className="font-mono text-sm">
                    Most Popular
                  </SelectItem>
                  <SelectItem value="recent" className="font-mono text-sm">
                    Recently Added
                  </SelectItem>
                  <SelectItem value="price-low" className="font-mono text-sm">
                    Price: Low to High
                  </SelectItem>
                  <SelectItem value="price-high" className="font-mono text-sm">
                    Price: High to Low
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Results count */}
          <div data-reveal className="mb-4 md:mb-6">
            <p className="text-neon-grey font-mono text-xs md:text-sm">
              {filteredBlinks.length} Blink{filteredBlinks.length !== 1 ? "s" : ""} found
            </p>
          </div>

          {/* Loading state */}
          {isLoading && (
            <div className="text-center py-16">
              <Lottie
                src="/lottie/Loading (Neon spinning).lottie"
                autoplay
                loop
                width={64}
                height={64}
                className="mx-auto mb-4"
              />
              <p className="text-neon-grey font-mono text-sm">Loading Blinks...</p>
            </div>
          )}

          {/* Error state */}
          {!isLoading && error && (
            <div className="text-center py-16">
              <p className="text-red-400 font-mono text-lg mb-4">❌ {error}</p>
              <button
                onClick={() => {
                  setIsLoading(true)
                  setError(null)
                  getBlinks()
                    .then((data) => {
                      setBlinks(data)
                      setError(null)
                    })
                    .catch((err) => {
                      setError(err.message || 'Failed to load Blinks')
                    })
                    .finally(() => {
                      setIsLoading(false)
                    })
                }}
                className="btn-ghost font-mono"
              >
                Try Again
              </button>
            </div>
          )}

          {/* Blinks Grid - Simplified animations for better performance */}
          {filteredBlinks.length > 0 ? (
            <motion.div
              className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.3 }}
            >
              {filteredBlinks.map((blink) => (
                <BlinkCard
                  key={blink.id}
                  id={blink.id}
                  slug={blink.slug}
                  title={blink.title}
                  description={blink.description}
                  price_usdc={blink.price_usdc}
                  category={blink.category}
                  runs={blink.runs}
                  status={blink.status}
                />
              ))}
            </motion.div>
          ) : (
            <div className="text-center py-12 md:py-16">
              <p className="text-neon-grey font-mono text-base md:text-lg">No blinks to display</p>
            </div>
          )}

          {/* Empty state */}
          {!isLoading && !error && filteredBlinks.length === 0 && (
            <div data-reveal className="text-center py-16">
              <Lottie
                src="/lottie/Empty-State-Simple.lottie"
                autoplay
                loop
                width={200}
                height={200}
                className="mx-auto mb-6"
              />
              <p className="text-neon-grey font-mono text-lg mb-4">No Blinks found matching your criteria</p>
              <button
                onClick={() => {
                  setSearchQuery("")
                  setSelectedCategory("All")
                }}
                className="btn-ghost font-mono"
              >
                Clear filters
              </button>
            </div>
          )}

          <NeonDivider className="mt-20" />
        </div>
      </section>

      {/* CTA Section */}
      <section className="px-4 sm:px-6 py-12 md:py-16">
        <div className="max-w-7xl mx-auto text-center" data-reveal>
          <h2
            data-scramble
            className="text-2xl md:text-3xl lg:text-4xl font-sans text-neon-white mb-4 md:mb-6"
          >
            Have an API to monetize?
          </h2>
          <p className="text-neon-grey font-mono text-sm md:text-base lg:text-lg mb-6 md:mb-8 max-w-2xl mx-auto px-2">
            Turn your endpoint into a pay-per-call Blink in minutes.
          </p>
          <Link href="/create">
            <MagneticButton className="btn-primary">Create your Blink</MagneticButton>
          </Link>
        </div>
      </section>
    </main>
  )
}
