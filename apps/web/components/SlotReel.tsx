"use client"

import { useEffect, useRef } from "react"
import { animate } from "motion"
import type { SlotSymbol } from "@blink402/types"
import { cn } from "@/lib/utils"

interface SlotReelProps {
  symbol: SlotSymbol
  isSpinning: boolean
  delay?: number // Animation delay in seconds
  finalSymbol?: SlotSymbol // The final result symbol to land on
  onSpinComplete?: () => void
}

export function SlotReel({ symbol, isSpinning, delay = 0, finalSymbol, onSpinComplete }: SlotReelProps) {
  const reelRef = useRef<HTMLDivElement>(null)
  const symbolsRef = useRef<HTMLDivElement>(null)

  // All possible symbols for spinning effect
  const allSymbols: SlotSymbol[] = ['🎰', '💎', '⚡', '🍊', '🍋', '🍒']

  useEffect(() => {
    if (!symbolsRef.current) return

    if (isSpinning) {
      // Spin animation - fast rotation through all symbols
      const animation = animate(
        symbolsRef.current,
        {
          y: [0, -600], // Scroll through symbols (6 symbols * 100px each)
        } as any,
        {
          duration: 0.8 + delay, // Staggered timing
          delay,
          easing: "ease-in",
          repeat: 2, // Spin 2 full cycles
        } as any
      )

      // After spinning, snap to final symbol
      animation.finished.then(() => {
        if (symbolsRef.current) {
          // Calculate the y position to land on the correct final symbol
          const targetSymbol = finalSymbol || symbol
          const finalIndex = allSymbols.indexOf(targetSymbol)
          const finalY = finalIndex >= 0 ? -(finalIndex * 100) : 0

          animate(
            symbolsRef.current,
            { y: finalY } as any,
            {
              duration: 0.5,
              easing: [0.34, 1.56, 0.64, 1], // Bounce easing (--ease-bounce)
            } as any
          ).finished.then(() => {
            onSpinComplete?.()
          })
        }
      })

      return () => animation.cancel()
    }
  }, [isSpinning, delay, finalSymbol, symbol, onSpinComplete, allSymbols])

  return (
    <div
      ref={reelRef}
      className={cn(
        "relative h-24 w-24 overflow-hidden rounded-lg",
        "border-2 border-dashed border-[--neon-blue-light]",
        "bg-[--neon-black]",
        "flex items-center justify-center"
      )}
      style={{
        boxShadow: isSpinning
          ? "0 0 16px rgba(90, 180, 255, 0.7), 0 0 32px rgba(90, 180, 255, 0.4)"
          : "0 0 8px rgba(90, 180, 255, 0.3)",
      }}
    >
      {/* Reel symbols container */}
      <div
        ref={symbolsRef}
        className="flex flex-col items-center justify-center"
        style={{
          transform: "translateY(0)",
        }}
      >
        {isSpinning ? (
          // Show all symbols during spin
          allSymbols.map((s, i) => (
            <div
              key={i}
              className="h-24 w-24 flex items-center justify-center text-5xl"
              style={{
                textShadow: "0 0 8px rgba(90, 180, 255, 0.4)",
              }}
            >
              {s}
            </div>
          ))
        ) : (
          // Show final symbol when not spinning
          <div
            className="h-24 w-24 flex items-center justify-center text-5xl font-bold"
            style={{
              textShadow: "0 0 12px rgba(90, 180, 255, 0.6)",
            }}
          >
            {symbol}
          </div>
        )}
      </div>
    </div>
  )
}
