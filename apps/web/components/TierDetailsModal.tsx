"use client"

import { getAllTierBenefits, getTierThresholds, getTierDisplayInfo, type TokenHolderTier } from "@blink402/solana"
import { cn } from "@/lib/utils"
import { DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import Link from "next/link"
import { Gamepad2, Ticket, Zap, Check, Circle, Award, Medal, Trophy, Gem } from "lucide-react"

interface TierDetailsModalProps {
  currentTier: TokenHolderTier
  balance: number
  nextTierInfo: {
    name: string
    required: number
    tokensNeeded: number
    progress: number
  } | null
  onClose: () => void
}

// Helper function to get tier icon component
const getTierIcon = (tier: TokenHolderTier, className?: string) => {
  const baseClass = cn(
    "text-neon-blue-light",
    "drop-shadow-[0_0_15px_rgba(76,201,240,0.5)]",
    className
  )

  switch (tier) {
    case 'NONE':
      return <Circle className={baseClass} />
    case 'BRONZE':
      return <Award className={baseClass} />
    case 'SILVER':
      return <Medal className={baseClass} />
    case 'GOLD':
      return <Trophy className={baseClass} />
    case 'DIAMOND':
      return <Gem className={baseClass} />
    default:
      return <Circle className={baseClass} />
  }
}

export default function TierDetailsModal({
  currentTier,
  balance,
  nextTierInfo,
  onClose
}: TierDetailsModalProps) {
  const allBenefits = getAllTierBenefits()
  const thresholds = getTierThresholds()
  const tiers: Array<Exclude<TokenHolderTier, 'NONE'>> = ['BRONZE', 'SILVER', 'GOLD', 'DIAMOND']

  return (
    <div className="space-y-6">
      <DialogHeader className="space-y-4">
        <DialogTitle className="text-2xl sm:text-3xl font-sans font-light text-neon-white flex items-center gap-3">
          {getTierIcon(currentTier, "w-8 h-8 sm:w-10 sm:h-10")}
          <span>B402 Token Holder Tiers</span>
        </DialogTitle>
        <DialogDescription className="text-neon-grey font-mono text-sm sm:text-base leading-relaxed">
          Hold B402 tokens to unlock exclusive discounts and benefits across the platform
        </DialogDescription>
      </DialogHeader>

      {/* Current Status */}
      {currentTier !== 'NONE' && (
        <div
          className="p-5 sm:p-7 rounded-lg bg-green-900/10 border-2 border-dashed border-green-500/40"
          style={{
            boxShadow: '0 0 16px rgba(34, 197, 94, 0.15)'
          }}
        >
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-green-400 font-mono text-sm font-bold">Your Current Tier:</span>
              <Badge className="bg-green-500/20 text-green-400 border-green-500/30 font-mono">
                {getTierDisplayInfo(currentTier).label}
              </Badge>
            </div>
            <span className="text-green-300 font-mono text-xs sm:text-sm">{balance.toLocaleString()} B402</span>
          </div>

          {/* Progress to next tier */}
          {nextTierInfo && (
            <div className="mt-4">
              <div className="flex justify-between text-xs font-mono text-neon-grey mb-2">
                <span>Progress to {nextTierInfo.name}</span>
                <span>{nextTierInfo.tokensNeeded.toLocaleString()} B402 needed</span>
              </div>
              <div className="w-full h-2 bg-neon-black rounded-full overflow-hidden border border-neon-blue-dark/30">
                <div
                  className="h-full bg-gradient-to-r from-neon-blue-dark to-neon-blue-light transition-all duration-500"
                  style={{
                    width: `${nextTierInfo.progress}%`,
                    boxShadow: '0 0 8px rgba(90, 180, 255, 0.6)'
                  }}
                />
              </div>
            </div>
          )}

          {currentTier === 'DIAMOND' && (
            <p className="text-green-300 font-mono text-xs mt-3 flex items-center gap-2">
              <span className="text-xl">🎉</span>
              <span>You've reached the maximum tier! Enjoy all premium benefits.</span>
            </p>
          )}
        </div>
      )}

      {currentTier === 'NONE' && nextTierInfo && (
        <div
          className="p-5 sm:p-7 rounded-lg bg-yellow-900/10 border-2 border-dashed border-yellow-500/40"
          style={{
            boxShadow: '0 0 16px rgba(234, 179, 8, 0.15)'
          }}
        >
          <p className="text-yellow-400 font-mono text-sm font-bold mb-3">
            You're {nextTierInfo.tokensNeeded.toLocaleString()} B402 away from Bronze tier!
          </p>
          <p className="text-yellow-300 font-mono text-xs leading-relaxed">
            Start saving on every transaction by holding B402 tokens.
          </p>
        </div>
      )}

      {/* Tier Comparison Table */}
      <div className="space-y-4">
        <h3 className="text-base sm:text-lg lg:text-xl font-mono font-bold text-neon-white mb-1">Tier Benefits Comparison</h3>
        <div className="overflow-x-auto -mx-4 sm:-mx-6 lg:mx-0">
          <div className="inline-block min-w-full px-4 sm:px-6 lg:px-0">
            <table className="w-full border-collapse bg-neon-dark/50 rounded-lg border-2 border-dashed border-neon-blue-dark/40"
              style={{
                boxShadow: 'inset 0 0 20px rgba(0, 0, 0, 0.5)'
              }}
            >
              <thead>
                <tr className="border-b-2 border-neon-blue-light/50">
                  <th className="p-2 sm:p-3 lg:p-4 text-left text-neon-white font-mono text-[10px] sm:text-xs lg:text-sm sticky left-0 bg-neon-black z-10 border-r border-neon-grey/20 min-w-[80px] sm:min-w-[100px]">Benefit</th>
                {tiers.map((tier) => {
                  const isCurrentTier = tier === currentTier
                  return (
                    <th
                      key={tier}
                      className={cn(
                        "p-2 sm:p-3 lg:p-4 text-center font-mono text-[10px] sm:text-xs lg:text-sm w-[70px] sm:w-[90px] lg:w-[110px]",
                        isCurrentTier && "bg-green-900/20 border-l-2 border-r-2 border-green-500/40"
                      )}
                      style={isCurrentTier ? {
                        boxShadow: 'inset 0 0 16px rgba(34, 197, 94, 0.2), 0 0 8px rgba(34, 197, 94, 0.3)'
                      } : {}}
                    >
                      <div className="flex flex-col items-center gap-1 sm:gap-1.5 lg:gap-2">
                        {getTierIcon(tier, "w-5 h-5 sm:w-6 sm:h-6 lg:w-7 lg:h-7")}
                        <span className="text-[10px] sm:text-xs lg:text-sm font-bold text-neon-white">
                          {tier}
                        </span>
                        <span className="text-neon-grey text-[8px] sm:text-[10px] lg:text-xs whitespace-nowrap">
                          {thresholds[tier] >= 1000 ? `${(thresholds[tier] / 1000).toFixed(0)}k` : thresholds[tier]} B402
                        </span>
                        {isCurrentTier && (
                          <Badge className="bg-green-500/20 text-green-400 border-green-500/30 text-[8px] sm:text-[10px] px-1 py-0 font-mono mt-0.5">
                            ACTIVE
                          </Badge>
                        )}
                      </div>
                    </th>
                  )
                })}
              </tr>
            </thead>
            <tbody className="text-neon-grey font-mono text-[10px] sm:text-xs lg:text-sm">
            {/* Slot Machine Benefits */}
            <tr className="border-b-2 border-neon-grey/30 bg-neon-dark/20">
              <td className="p-2 sm:p-3 lg:p-4 font-bold text-neon-white sticky left-0 bg-neon-black z-10 border-r border-neon-grey/20" colSpan={5}>
                <span className="flex items-center gap-1.5 sm:gap-2"><Gamepad2 className="w-3 h-3 sm:w-4 sm:h-4 lg:w-5 lg:h-5" /> <span className="whitespace-nowrap">Slot Machine</span></span>
              </td>
            </tr>
            <tr className="border-b border-neon-grey/10 hover:bg-neon-blue-dark/10 transition-colors">
              <td className="p-2 sm:p-2.5 lg:p-3 sticky left-0 bg-neon-black z-10 border-r border-neon-grey/20">Entry Discount</td>
              {tiers.map((tier) => {
                const benefits = allBenefits[tier]
                const isCurrentTier = tier === currentTier
                return (
                  <td key={tier} className={cn("p-2 sm:p-2.5 lg:p-3 text-center", isCurrentTier && "bg-green-900/10 border-l-2 border-r-2 border-green-500/20")}>
                    <span className="font-bold text-neon-white">{benefits.slotMachine.discountPercent}%</span>
                  </td>
                )
              })}
            </tr>
            <tr className="border-b border-neon-grey/10 hover:bg-neon-blue-dark/10 transition-colors">
              <td className="p-2 sm:p-2.5 lg:p-3 sticky left-0 bg-neon-black z-10 border-r border-neon-grey/20 whitespace-nowrap">Payout Multiplier</td>
              {tiers.map((tier) => {
                const benefits = allBenefits[tier]
                const isCurrentTier = tier === currentTier
                return (
                  <td key={tier} className={cn("p-2 sm:p-2.5 lg:p-3 text-center", isCurrentTier && "bg-green-900/10 border-l-2 border-r-2 border-green-500/20")}>
                    <span className="font-bold text-neon-white">{benefits.slotMachine.bonusMultiplier}x</span>
                  </td>
                )
              })}
            </tr>
            <tr className="border-b-2 border-neon-grey/30 hover:bg-neon-blue-dark/10 transition-colors">
              <td className="p-2 sm:p-2.5 lg:p-3 sticky left-0 bg-neon-black z-10 border-r border-neon-grey/20 whitespace-nowrap">Free Spins/Day</td>
              {tiers.map((tier) => {
                const benefits = allBenefits[tier]
                const isCurrentTier = tier === currentTier
                return (
                  <td key={tier} className={cn("p-2 sm:p-2.5 lg:p-3 text-center", isCurrentTier && "bg-green-900/10 border-l-2 border-r-2 border-green-500/20")}>
                    <span className="font-bold text-neon-white">{benefits.slotMachine.freeSpinsDaily}</span>
                  </td>
                )
              })}
            </tr>

            {/* Lottery Benefits */}
            <tr className="border-b-2 border-neon-grey/30 bg-neon-dark/20">
              <td className="p-2 sm:p-3 lg:p-4 font-bold text-neon-white sticky left-0 bg-neon-black z-10 border-r border-neon-grey/20" colSpan={5}>
                <span className="flex items-center gap-1.5 sm:gap-2"><Ticket className="w-3 h-3 sm:w-4 sm:h-4 lg:w-5 lg:h-5" /> Lottery</span>
              </td>
            </tr>
            <tr className="border-b border-neon-grey/10 hover:bg-neon-blue-dark/10 transition-colors">
              <td className="p-2 sm:p-2.5 lg:p-3 sticky left-0 bg-neon-black z-10 border-r border-neon-grey/20">Entry Discount</td>
              {tiers.map((tier) => {
                const benefits = allBenefits[tier]
                const isCurrentTier = tier === currentTier
                return (
                  <td key={tier} className={cn("p-2 sm:p-2.5 lg:p-3 text-center", isCurrentTier && "bg-green-900/10 border-l-2 border-r-2 border-green-500/20")}>
                    <span className="font-bold text-neon-white">{benefits.lottery.discountPercent}%</span>
                  </td>
                )
              })}
            </tr>
            <tr className="border-b border-neon-grey/10 hover:bg-neon-blue-dark/10 transition-colors">
              <td className="p-2 sm:p-2.5 lg:p-3 sticky left-0 bg-neon-black z-10 border-r border-neon-grey/20">Bonus Entries</td>
              {tiers.map((tier) => {
                const benefits = allBenefits[tier]
                const isCurrentTier = tier === currentTier
                return (
                  <td key={tier} className={cn("p-2 sm:p-2.5 lg:p-3 text-center", isCurrentTier && "bg-green-900/10 border-l-2 border-r-2 border-green-500/20")}>
                    <span className="font-bold text-neon-white">+{benefits.lottery.bonusEntries}</span>
                  </td>
                )
              })}
            </tr>
            <tr className="border-b-2 border-neon-grey/30 hover:bg-neon-blue-dark/10 transition-colors">
              <td className="p-2 sm:p-2.5 lg:p-3 sticky left-0 bg-neon-black z-10 border-r border-neon-grey/20">Win Boost</td>
              {tiers.map((tier) => {
                const benefits = allBenefits[tier]
                const isCurrentTier = tier === currentTier
                return (
                  <td key={tier} className={cn("p-2 sm:p-2.5 lg:p-3 text-center", isCurrentTier && "bg-green-900/10 border-l-2 border-r-2 border-green-500/20")}>
                    <span className="font-bold text-neon-white">+{benefits.lottery.winBoostPercent}%</span>
                  </td>
                )
              })}
            </tr>

            {/* Blink Benefits */}
            <tr className="border-b-2 border-neon-grey/30 bg-neon-dark/20">
              <td className="p-2 sm:p-3 lg:p-4 font-bold text-neon-white sticky left-0 bg-neon-black z-10 border-r border-neon-grey/20" colSpan={5}>
                <span className="flex items-center gap-1.5 sm:gap-2"><Zap className="w-3 h-3 sm:w-4 sm:h-4 lg:w-5 lg:h-5" /> API Blinks</span>
              </td>
            </tr>
            <tr className="border-b border-neon-grey/10 hover:bg-neon-blue-dark/10 transition-colors">
              <td className="p-2 sm:p-2.5 lg:p-3 sticky left-0 bg-neon-black z-10 border-r border-neon-grey/20 whitespace-nowrap">Creator Fee Discount</td>
              {tiers.map((tier) => {
                const benefits = allBenefits[tier]
                const isCurrentTier = tier === currentTier
                return (
                  <td key={tier} className={cn("p-2 sm:p-2.5 lg:p-3 text-center", isCurrentTier && "bg-green-900/10 border-l-2 border-r-2 border-green-500/20")}>
                    <span className="font-bold text-neon-white">{benefits.blinks.creatorFeeDiscount}%</span>
                  </td>
                )
              })}
            </tr>
            <tr className="border-b border-neon-grey/10 hover:bg-neon-blue-dark/10 transition-colors">
              <td className="p-2 sm:p-2.5 lg:p-3 sticky left-0 bg-neon-black z-10 border-r border-neon-grey/20 whitespace-nowrap">Priority Execution</td>
              {tiers.map((tier) => {
                const benefits = allBenefits[tier]
                const isCurrentTier = tier === currentTier
                return (
                  <td key={tier} className={cn("p-2 sm:p-2.5 lg:p-3 text-center", isCurrentTier && "bg-green-900/10 border-l-2 border-r-2 border-green-500/20")}>
                    {benefits.blinks.priorityExecution ? <Check className="w-3 h-3 sm:w-4 sm:h-4 lg:w-5 lg:h-5 mx-auto text-green-400" /> : <span className="text-neon-grey">—</span>}
                  </td>
                )
              })}
            </tr>
            <tr className="hover:bg-neon-blue-dark/10 transition-colors">
              <td className="p-2 sm:p-2.5 lg:p-3 sticky left-0 bg-neon-black z-10 border-r border-neon-grey/20 whitespace-nowrap">Custom Branding</td>
              {tiers.map((tier) => {
                const benefits = allBenefits[tier]
                const isCurrentTier = tier === currentTier
                return (
                  <td key={tier} className={cn("p-2 sm:p-2.5 lg:p-3 text-center", isCurrentTier && "bg-green-900/10 border-l-2 border-r-2 border-green-500/20")}>
                    {benefits.blinks.customBranding ? <Check className="w-3 h-3 sm:w-4 sm:h-4 lg:w-5 lg:h-5 mx-auto text-green-400" /> : <span className="text-neon-grey">—</span>}
                  </td>
                )
              })}
            </tr>
          </tbody>
        </table>
        </div>
      </div>
      </div>

      {/* CTA Buttons */}
      <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 sm:justify-end pt-8 mt-2 border-t-2 border-dashed border-neon-blue-dark/30">
        {nextTierInfo && (
          <Link
            href={`https://jup.ag/tokens/2mESiwuVdfft9PxG7x36rvDvex6ccyY8m8BKCWJqpump`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex-1 sm:flex-initial"
          >
            <Button
              className="w-full bg-neon-blue-dark hover:bg-neon-blue-light text-white font-mono border-2 border-dashed border-neon-blue-light/50 transition-all duration-200"
              style={{
                boxShadow: '0 0 12px rgba(90, 180, 255, 0.3)'
              }}
            >
              Buy B402 to Upgrade →
            </Button>
          </Link>
        )}
        <Button
          variant="outline"
          onClick={onClose}
          className="flex-1 sm:flex-initial font-mono bg-neon-dark border-2 border-dashed border-neon-grey/30 text-neon-white hover:bg-neon-grey/10 hover:border-neon-grey/50 transition-all"
        >
          Close
        </Button>
      </div>
    </div>
  )
}
