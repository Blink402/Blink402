"use client"
import { useEffect, useState } from "react"
import { mountReveals } from "@/lib/reveal"
import { mountScramble } from "@/lib/scramble"
import { BLINK_TEMPLATES, getTemplateCategoriesWithCounts, getPopularTemplates } from "@/lib/templates"
import type { BlinkTemplate } from "@blink402/types"
import NeonDivider from "@/components/NeonDivider"
import Lottie from "@/components/Lottie"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Card } from "@/components/ui/card"
import Link from "next/link"

export default function EasyCreatePage() {
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedCategory, setSelectedCategory] = useState<BlinkTemplate["category"] | "all">("all")

  useEffect(() => {
    mountReveals()
    mountScramble()
  }, [])

  // Filter templates
  const filteredTemplates = BLINK_TEMPLATES.filter((template) => {
    const matchesSearch =
      searchQuery === "" ||
      template.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      template.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      template.tags?.some(tag => tag.toLowerCase().includes(searchQuery.toLowerCase()))

    const matchesCategory = selectedCategory === "all" || template.category === selectedCategory

    return matchesSearch && matchesCategory
  })

  const popularTemplates = getPopularTemplates()
  const categories = getTemplateCategoriesWithCounts()

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
              Easy Mode: Pick a Template
            </h1>
            <p className="text-neon-grey font-mono text-lg max-w-2xl mx-auto">
              No coding required. Pick a template, customize it, and start earning in 30 seconds.
            </p>
          </header>

          {/* Quick Actions */}
          <div data-reveal className="flex flex-col sm:flex-row gap-4 mb-12 justify-center">
            <Link href="/create" className="btn-ghost font-mono text-center">
              Advanced Mode →
            </Link>
          </div>

          {/* Search & Filter */}
          <div data-reveal className="mb-8">
            <div className="max-w-2xl mx-auto">
              <Input
                type="search"
                placeholder="Search templates... (try 'joke', 'crypto', 'generator')"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="bg-neon-dark border-neon-blue-dark/30 text-neon-white placeholder:text-neon-grey font-mono text-base"
              />
            </div>
          </div>

          {/* Category Filters */}
          <div data-reveal className="flex flex-wrap gap-2 mb-12 justify-center">
            <button
              onClick={() => setSelectedCategory("all")}
              className={`px-4 py-2 rounded border font-mono text-sm transition-all ${
                selectedCategory === "all"
                  ? "bg-neon-green-light/10 border-neon-green-light text-neon-green-light"
                  : "bg-neon-dark border-neon-grey/30 text-neon-grey hover:border-neon-green-light/50"
              }`}
            >
              All ({BLINK_TEMPLATES.length})
            </button>
            {categories.map(({ category, count }) => (
              <button
                key={category}
                onClick={() => setSelectedCategory(category)}
                className={`px-4 py-2 rounded border font-mono text-sm transition-all capitalize ${
                  selectedCategory === category
                    ? "bg-neon-green-light/10 border-neon-green-light text-neon-green-light"
                    : "bg-neon-dark border-neon-grey/30 text-neon-grey hover:border-neon-green-light/50"
                }`}
              >
                {category.replace("-", " ")} ({count})
              </button>
            ))}
          </div>

          {/* Popular Templates Section */}
          {selectedCategory === "all" && searchQuery === "" && popularTemplates.length > 0 && (
            <div data-reveal className="mb-12">
              <h2 className="text-2xl font-sans text-neon-white mb-6 flex items-center gap-2">
                <span data-scramble>Popular Templates</span>
                <Badge className="bg-neon-green-light/10 text-neon-green-light border-neon-green-light">
                  Most Used
                </Badge>
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
                {popularTemplates.map((template) => (
                  <TemplateCard key={template.id} template={template} />
                ))}
              </div>
              <NeonDivider />
            </div>
          )}

          {/* Results count */}
          <div data-reveal className="mb-6">
            <p className="text-neon-grey font-mono text-sm">
              {filteredTemplates.length} template{filteredTemplates.length !== 1 ? "s" : ""} found
            </p>
          </div>

          {/* Templates Grid */}
          {filteredTemplates.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredTemplates.map((template) => (
                <TemplateCard key={template.id} template={template} />
              ))}
            </div>
          ) : (
            <div data-reveal className="text-center py-16">
              <Lottie
                src="/lottie/Empty-State-Simple.lottie"
                autoplay
                loop
                width={200}
                height={200}
                className="mx-auto mb-6"
              />
              <p className="text-neon-grey font-mono text-lg mb-4">No templates found matching your criteria</p>
              <button
                onClick={() => {
                  setSearchQuery("")
                  setSelectedCategory("all")
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

      {/* Help Section */}
      <section className="px-6 py-16">
        <div className="max-w-7xl mx-auto text-center" data-reveal>
          <h2
            data-scramble
            className="text-3xl md:text-4xl font-sans text-neon-white mb-6 heading-sm"
          >
            Need something custom?
          </h2>
          <p className="text-neon-grey font-mono text-lg mb-8 max-w-2xl mx-auto">
            Use Advanced Mode to configure any API endpoint with full control.
          </p>
          <Link href="/create" className="btn-primary">
            Switch to Advanced Mode
          </Link>
        </div>
      </section>
    </main>
  )
}

/**
 * TemplateCard component for displaying individual templates
 */
function TemplateCard({ template }: { template: BlinkTemplate }) {
  return (
    <Link href={`/create/easy/${template.id}`}>
      <Card
        data-reveal
        className="bg-neon-dark border-dashed-neon p-6 hover:bg-neon-dark/80 transition-all cursor-pointer group h-full"
      >
        {/* Icon & Badge */}
        <div className="flex items-start justify-between mb-4">
          <div className="w-12 h-12 bg-neon-green-light/10 rounded border border-neon-green-light/30 flex items-center justify-center">
            <span className="text-2xl">
              {template.category === "fun" && "🎉"}
              {template.category === "utilities" && "🛠️"}
              {template.category === "data" && "📊"}
              {template.category === "ai-ml" && "🤖"}
              {template.category === "web3" && "🔗"}
            </span>
          </div>
          {template.is_popular && (
            <Badge className="bg-neon-green-light/10 text-neon-green-light border-neon-green-light text-xs">
              Popular
            </Badge>
          )}
        </div>

        {/* Title */}
        <h3 className="text-xl font-sans text-neon-white mb-2 group-hover:text-neon-green-light transition-colors">
          {template.name}
        </h3>

        {/* Description */}
        <p className="text-neon-grey font-mono text-sm mb-4 line-clamp-2">
          {template.description}
        </p>

        {/* Tags */}
        {template.tags && template.tags.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-4">
            {template.tags.slice(0, 3).map((tag) => (
              <span
                key={tag}
                className="px-2 py-1 bg-neon-dark border border-neon-grey/30 text-neon-grey text-xs font-mono rounded"
              >
                #{tag}
              </span>
            ))}
          </div>
        )}

        {/* Footer */}
        <div className="flex items-center justify-between text-xs font-mono text-neon-grey pt-4 border-t border-neon-grey/20">
          <span className="capitalize">{template.category.replace("-", " ")}</span>
          {template.estimated_setup_time && (
            <span>⚡ {template.estimated_setup_time}</span>
          )}
        </div>
      </Card>
    </Link>
  )
}
