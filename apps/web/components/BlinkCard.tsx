"use client"
import React from "react"
import Link from "next/link"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"

type BlinkCardProps = {
  id: string
  slug: string
  title: string
  description: string
  price_usdc: string
  category: string
  runs: number
  icon_url?: string
  status: "active" | "archived" | "paused"
}

const BlinkCard = React.memo(function BlinkCard({
  id,
  slug,
  title,
  description,
  price_usdc,
  category,
  runs,
  status,
}: BlinkCardProps) {
  try {
    return (
      <Link href={`/blink/${slug}`} className="block group">
        <div
          data-testid="blink-card"
          className="relative h-full min-h-[260px] sm:min-h-[280px] md:min-h-[300px] p-4 sm:p-5 md:p-6 bg-neon-dark border border-neon-grey/20 rounded-lg transition-all duration-300 hover:border-neon-blue-light/60 hover:shadow-[0_0_30px_rgba(38,53,80,0.3)] hover:-translate-y-1"
          style={{
            backgroundColor: 'var(--neon-dark)',
            border: '1px solid rgba(157, 157, 157, 0.2)'
          }}
        >
          {/* Status Badge */}
          {status === "archived" && (
            <div className="absolute top-3 right-3 sm:top-4 sm:right-4 px-2 py-1 text-[10px] sm:text-xs border border-neon-grey/40 text-neon-grey rounded">
              Archived
            </div>
          )}
          {status === "paused" && (
            <div className="absolute top-3 right-3 sm:top-4 sm:right-4 px-2 py-1 text-[10px] sm:text-xs border border-yellow-500/40 text-yellow-500 rounded">
              Paused
            </div>
          )}

          {/* Category Badge */}
          <div className="mb-3 sm:mb-4 inline-block px-2 py-1 text-xs border border-neon-blue-dark/40 text-neon-blue-light bg-neon-blue-dark/10 font-mono rounded">
            {category}
          </div>

          {/* Title */}
          <h3 data-testid="blink-title" className="text-lg sm:text-xl font-mono text-neon-white mb-2 group-hover:text-neon-blue-light transition-colors line-clamp-2">
            {title}
          </h3>

          {/* Description */}
          <p className="text-xs sm:text-sm text-neon-grey font-mono mb-3 sm:mb-4 line-clamp-2">{description}</p>

          {/* Stats & Price Row */}
          <div className="flex items-center justify-between mt-auto pt-3 sm:pt-4 border-t border-neon-grey/20">
            {/* Runs Count */}
            <div className="flex items-center gap-1.5 sm:gap-2">
              <span className="text-neon-grey font-mono text-[10px] sm:text-xs">Runs:</span>
              <span className="text-neon-white font-mono text-xs sm:text-sm font-semibold">
                {runs.toLocaleString()}
              </span>
            </div>

            {/* Price */}
            <div className="flex items-center gap-1">
              <span className="text-neon-blue-light font-mono text-base sm:text-lg font-bold">${price_usdc}</span>
              <span className="text-neon-grey font-mono text-[10px] sm:text-xs">USDC</span>
            </div>
          </div>

          {/* Hover Glow Effect */}
          <div className="absolute inset-0 rounded-lg bg-gradient-to-br from-neon-blue-light/0 via-neon-blue-dark/0 to-neon-blue-light/0 opacity-0 group-hover:opacity-10 transition-opacity duration-300 pointer-events-none" />
        </div>
      </Link>
    )
  } catch (error) {
    // Error rendering card - log in development only
    if (process.env.NODE_ENV === 'development') {
      console.error('BlinkCard error:', error)
    }
    return <div className="p-4 bg-red-500 text-white">Error rendering card</div>
  }
})

export default BlinkCard
