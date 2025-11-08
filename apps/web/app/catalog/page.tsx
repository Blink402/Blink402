"use client"
import { useEffect, useState } from "react"
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

  // Filter and sort blinks
  const filteredBlinks = blinks.filter((blink) => {
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

  return (
    <main className="min-h-screen">
      {/* Header */}
      <section className="relative overflow-hidden px-6 py-16 md:py-24">
        <div className="max-w-7xl mx-auto">
          <header data-reveal className="text-center mb-12">
            <h1
              data-scramble
              className="font-sans text-neon-white mb-4 heading-xl"
            >
              Browse the Catalog
            </h1>
            <p className="text-neon-grey font-mono text-lg max-w-2xl mx-auto">
              Discover pay-per-call APIs. Click, pay pennies, get instant results.
            </p>
          </header>

          {/* Filters */}
          <div data-reveal className="mb-8 flex flex-col md:flex-row gap-4 items-center justify-between">
            <div className="w-full md:w-96">
              <Input
                type="search"
                placeholder="Search Blinks..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="bg-neon-dark border-neon-blue-dark/30 text-neon-white placeholder:text-neon-grey font-mono"
              />
            </div>

            <div className="flex gap-4 w-full md:w-auto">
              <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                <SelectTrigger className="w-full md:w-[180px] bg-neon-dark border-neon-blue-dark/30 text-neon-white font-mono">
                  <SelectValue placeholder="Category" />
                </SelectTrigger>
                <SelectContent className="bg-neon-dark border-neon-blue-dark/30 text-neon-white">
                  {CATEGORIES.map((cat) => (
                    <SelectItem key={cat} value={cat} className="font-mono">
                      {cat}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={sortBy} onValueChange={setSortBy}>
                <SelectTrigger className="w-full md:w-[180px] bg-neon-dark border-neon-blue-dark/30 text-neon-white font-mono">
                  <SelectValue placeholder="Sort by" />
                </SelectTrigger>
                <SelectContent className="bg-neon-dark border-neon-blue-dark/30 text-neon-white">
                  <SelectItem value="popular" className="font-mono">
                    Most Popular
                  </SelectItem>
                  <SelectItem value="recent" className="font-mono">
                    Recently Added
                  </SelectItem>
                  <SelectItem value="price-low" className="font-mono">
                    Price: Low to High
                  </SelectItem>
                  <SelectItem value="price-high" className="font-mono">
                    Price: High to Low
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Debug: Always show results count */}
          <div data-reveal className="mb-8">
            <p className="text-neon-grey font-mono text-sm">
              {filteredBlinks.length} Blink{filteredBlinks.length !== 1 ? "s" : ""} found
              <br />
              Debug: isLoading={isLoading.toString()}, error={error?.toString() || 'null'}, blinks={blinks.length}
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

          {/* Blinks Grid */}
          {filteredBlinks.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
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
            </div>
          ) : (
            <div className="text-center py-16">
              <p className="text-neon-grey font-mono text-lg">No blinks to display</p>
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
      <section className="px-6 py-16">
        <div className="max-w-7xl mx-auto text-center" data-reveal>
          <h2
            data-scramble
            className="text-3xl md:text-4xl font-sans text-neon-white mb-6 heading-sm"
          >
            Have an API to monetize?
          </h2>
          <p className="text-neon-grey font-mono text-lg mb-8 max-w-2xl mx-auto">
            Turn your endpoint into a pay-per-call Blink in minutes.
          </p>
          <button className="btn-primary">Create your Blink</button>
        </div>
      </section>
    </main>
  )
}
