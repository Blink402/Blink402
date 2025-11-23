"use client"

import { getTierDisplayInfo, type TokenHolderTier } from "@blink402/solana"
import { cn } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Check } from "lucide-react"
import { useEffect, useState } from "react"
import Link from "next/link"

interface SavingsCalculatorCardProps {
  tier: Exclude<TokenHolderTier, 'NONE'>
  tokensRequired: number
  monthlySavings: number
  weeksToROI: number
  isCurrentTier?: boolean
  isMostPopular?: boolean
  b402PriceUSDC: number
  onBuyClick: () => void
}

export function SavingsCalculatorCard({
  tier,
  tokensRequired,
  monthlySavings,
  weeksToROI,
  isCurrentTier = false,
  isMostPopular = false,
  b402PriceUSDC,
  onBuyClick
}: SavingsCalculatorCardProps) {
  const tierDisplay = getTierDisplayInfo(tier)
  const [displaySavings, setDisplaySavings] = useState(0)
  const [displayROI, setDisplayROI] = useState(0)

  // Animate numbers when they change
  useEffect(() => {
    const savingsInterval = setInterval(() => {
      setDisplaySavings(prev => {
        if (prev < monthlySavings) {
          return Math.min(prev + (monthlySavings / 20), monthlySavings)
        }
        return monthlySavings
      })
    }, 30)

    const roiInterval = setInterval(() => {
      setDisplayROI(prev => {
        if (prev < weeksToROI) {
          return Math.min(prev + (weeksToROI / 20), weeksToROI)
        }
        return weeksToROI
      })
    }, 30)

    return () => {
      clearInterval(savingsInterval)
      clearInterval(roiInterval)
    }
  }, [monthlySavings, weeksToROI])

  const tierCost = tokensRequired * b402PriceUSDC

  return (
    <div
      className={cn(
        "relative group",
        "p-6 rounded-lg",
        "border-2 border-dashed",
        "transition-all duration-300",
        "hover:scale-105",
        tier === 'BRONZE' && "border-amber-700/60 bg-gradient-to-br from-amber-900/20 to-[--neon-dark]",
        tier === 'SILVER' && "border-gray-400/60 bg-gradient-to-br from-gray-600/20 to-[--neon-dark]",
        tier === 'GOLD' && "border-yellow-400/60 bg-gradient-to-br from-yellow-600/20 to-[--neon-dark]",
        tier === 'DIAMOND' && "border-cyan-400/60 bg-gradient-to-br from-cyan-600/20 to-[--neon-dark]",
        isCurrentTier && "ring-2 ring-green-500 border-green-500",
        isMostPopular && !isCurrentTier && "ring-2 ring-[--neon-blue-light]"
      )}
      style={{
        boxShadow: `0 0 16px ${tier === 'BRONZE' ? 'rgba(217, 119, 6, 0.3)' :
            tier === 'SILVER' ? 'rgba(156, 163, 175, 0.3)' :
              tier === 'GOLD' ? 'rgba(251, 191, 36, 0.3)' :
                'rgba(34, 211, 238, 0.3)'
          }`
      }}
    >
      {/* Badges */}
      <div className="absolute top-3 right-3 flex flex-col gap-1">
        {isMostPopular && !isCurrentTier && (
          <Badge className="bg-[--neon-blue-dark] text-white border-[--neon-blue-light] text-[10px] px-2 py-0">
            MOST POPULAR
          </Badge>
        )}
        {isCurrentTier && (
          <Badge className="bg-green-500/20 text-green-400 border-green-500/30 text-[10px] px-2 py-0">
            YOUR TIER
          </Badge>
        )}
      </div>

      {/* Tier Icon & Name */}
      <div className="text-center mb-6">
        <div className="text-5xl mb-2 animate-pulse" style={{ animationDuration: '2s' }}>
          {tierDisplay.icon}
        </div>
        <h3 className={cn(
          "text-xl font-bold font-mono mb-1",
          tier === 'BRONZE' && "text-amber-700",
          tier === 'SILVER' && "text-gray-400",
          tier === 'GOLD' && "text-yellow-400",
          tier === 'DIAMOND' && "text-cyan-400"
        )}>
          {tier}
        </h3>
        <p className="text-[--neon-grey] font-mono text-xs">
          {tokensRequired.toLocaleString()} B402
        </p>
        <p className="text-[--neon-grey] font-mono text-[10px] mt-1">
          (~${tierCost.toFixed(2)} at current price)
        </p>
      </div>

      {/* Divider */}
      <div className="h-px bg-gradient-to-r from-transparent via-[--neon-grey]/30 to-transparent mb-6" />

      {/* Savings Stats */}
      <div className="space-y-4 mb-6">
        <div>
          <div className="text-[--neon-grey] font-mono text-xs mb-1">Monthly Savings</div>
          <div className={cn(
            "text-2xl font-bold font-mono",
            tier === 'BRONZE' && "text-amber-600",
            tier === 'SILVER' && "text-gray-300",
            tier === 'GOLD' && "text-yellow-300",
            tier === 'DIAMOND' && "text-cyan-300"
          )}>
            ${displaySavings.toFixed(2)}
          </div>
        </div>

        <div>
          <div className="text-[--neon-grey] font-mono text-xs mb-1">ROI Period</div>
          <div className={cn(
            "text-xl font-bold font-mono",
            tier === 'BRONZE' && "text-amber-600",
            tier === 'SILVER' && "text-gray-300",
            tier === 'GOLD' && "text-yellow-300",
            tier === 'DIAMOND' && "text-cyan-300"
          )}>
            {displayROI.toFixed(0)} weeks
          </div>
        </div>
      </div>

      {/* CTA Button */}
      {isCurrentTier ? (
        <Button
          disabled
          className="w-full bg-green-500/20 text-green-400 border-2 border-green-500/30 font-mono cursor-not-allowed"
        >
          <div className="flex items-center justify-center gap-1">
            <Check className="w-3 h-3" /> Active Tier
          </div>
        </Button>
      ) : (
        <Link
          href="https://jup.ag/tokens/2mESiwuVdfft9PxG7x36rvDvex6ccyY8m8BKCWJqpump"
          target="_blank"
          rel="noopener noreferrer"
          className="block"
        >
          <Button
            onClick={onBuyClick}
            className={cn(
              "w-full font-mono font-bold transition-all duration-200",
              tier === 'BRONZE' && "bg-amber-700 hover:bg-amber-600 text-white",
              tier === 'SILVER' && "bg-gray-500 hover:bg-gray-400 text-white",
              tier === 'GOLD' && "bg-yellow-600 hover:bg-yellow-500 text-black",
              tier === 'DIAMOND' && "bg-cyan-500 hover:bg-cyan-400 text-black"
            )}
          >
            Buy Now
          </Button>
        </Link>
      )}

      {/* Hover gradient effect */}
      <div
        className="absolute inset-0 rounded-lg opacity-0 group-hover:opacity-10 transition-opacity pointer-events-none"
        style={{
          background: `radial-gradient(circle at center, ${tier === 'BRONZE' ? 'rgba(217, 119, 6, 0.5)' :
              tier === 'SILVER' ? 'rgba(156, 163, 175, 0.5)' :
                tier === 'GOLD' ? 'rgba(251, 191, 36, 0.5)' :
                  'rgba(34, 211, 238, 0.5)'
            }, transparent)`
        }}
      />
    </div>
  )
}
