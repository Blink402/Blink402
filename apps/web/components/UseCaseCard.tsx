"use client"

import React, { ReactNode } from "react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import Link from "next/link"

interface ExampleAPI {
  name: string
  description: string
  price: string
  demoSlug?: string
  category?: string
}

interface UseCaseCardProps {
  icon: ReactNode
  title: string
  description: string
  examples: ExampleAPI[]
  category: string
  className?: string
}

export const UseCaseCard = React.memo(function UseCaseCard({
  icon,
  title,
  description,
  examples,
  category,
  className
}: UseCaseCardProps) {
  return (
    <div
      className={cn(
        "group relative",
        "p-6 rounded-lg",
        "glass-card",
        "transition-all duration-300",
        "hover:scale-[1.02]",
        className
      )}
      data-reveal
    >
      {/* Category Badge */}
      <div className="absolute top-3 right-3">
        <Badge
          variant="outline"
          className="bg-neon-blue-primary/10 text-neon-blue-light border-neon-blue-light/30 text-[10px] px-2 py-0"
        >
          {category.toUpperCase()}
        </Badge>
      </div>

      {/* Icon & Title */}
      <div className="mb-4">
        <div className="text-neon-blue-light mb-3 group-hover:scale-110 transition-transform duration-300 group-hover:text-neon-cyan">
          {icon}
        </div>
        <h3 className="text-2xl font-sans font-light text-neon-white mb-2 group-hover:text-neon-blue-light transition-colors">
          {title}
        </h3>
        <p className="text-neon-grey font-mono text-sm leading-relaxed">
          {description}
        </p>
      </div>

      {/* Divider */}
      <div className="h-px bg-gradient-to-r from-transparent via-neon-grey/20 to-transparent mb-4" />

      {/* Example APIs */}
      <div className="space-y-3 mb-6">
        <div className="text-neon-blue-light font-mono text-xs font-bold uppercase tracking-wider opacity-80">
          Example Use Cases
        </div>
        {examples.map((example, idx) => (
          <div
            key={idx}
            className="p-3 rounded border border-dashed border-neon-grey/20 bg-neon-black/40 hover:border-neon-blue-light/40 transition-colors hover:bg-neon-blue-primary/5"
          >
            <div className="flex items-start justify-between mb-1">
              <div className="flex-1">
                <div className="text-neon-white font-mono text-sm font-medium">
                  {example.name}
                </div>
                <div className="text-neon-grey font-mono text-xs mt-1">
                  {example.description}
                </div>
              </div>
              <div className="ml-3 text-neon-blue-light font-mono text-xs font-bold whitespace-nowrap">
                {example.price}
              </div>
            </div>
            {example.demoSlug && (
              <Link
                href={`/blink/${example.demoSlug}`}
                className="inline-flex items-center gap-1 text-neon-cyan font-mono text-[10px] hover:underline mt-2"
              >
                Try Live Demo →
              </Link>
            )}
          </div>
        ))}
      </div>

      {/* CTA Button */}
      <Link href="/create" className="block">
        <Button
          className={cn(
            "w-full",
            "bg-neon-blue-primary hover:bg-neon-blue-light",
            "text-neon-white font-mono font-bold",
            "border border-neon-blue-light/50",
            "transition-all duration-200",
            "shadow-[0_0_15px_rgba(67,97,238,0.3)] hover:shadow-[0_0_25px_rgba(76,201,240,0.5)]"
          )}
        >
          Create Similar Blink
        </Button>
      </Link>

      {/* Hover glow effect */}
      <div
        className="absolute inset-0 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none"
        style={{
          background: "radial-gradient(circle at center, rgba(67, 97, 238, 0.15), transparent 70%)",
          mixBlendMode: "screen"
        }}
      />
    </div>
  )
})
