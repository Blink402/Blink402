"use client"

import { cn } from "@/lib/utils"

interface GradientTextProps {
  children: React.ReactNode
  className?: string
  as?: 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6' | 'p' | 'span'
  animate?: boolean
}

/**
 * Text with neon gradient effect
 * Perfect for headlines and CTAs
 */
export function GradientText({
  children,
  className,
  as: Component = 'span',
  animate = false
}: GradientTextProps) {
  return (
    <Component
      className={cn(
        "bg-clip-text text-transparent bg-gradient-to-r from-neon-blue-dark via-neon-blue-light to-neon-blue-glow",
        animate && "animate-gradient bg-[length:200%_auto]",
        className
      )}
    >
      {children}
    </Component>
  )
}
