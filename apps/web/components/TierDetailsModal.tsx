"use client"

import { getAllTierBenefits, getTierThresholds, getTierDisplayInfo, type TokenHolderTier } from "@blink402/solana"
import { cn } from "@/lib/utils"
import { DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import Link from "next/link"
import { Gamepad2, Ticket, Zap, Check } from "lucide-react"

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
      <DialogHeader>
        <DialogTitle className="text-2xl sm:text-3xl font-sans font-light text-neon-white flex items-center gap-3">
          <span>{getTierDisplayInfo(currentTier).icon}</span>
          <span>B402 Token Holder Tiers</span>
        </DialogTitle>
        <DialogDescription className="text-neon-grey font-mono text-sm">
          Hold B402 tokens to unlock exclusive discounts and benefits across the platform
        </DialogDescription>
      </DialogHeader>

      {/* Current Status */}
      {currentTier !== 'NONE' && (
        <div
          className="p-4 sm:p-6 rounded-lg bg-green-900/10 border-2 border-dashed border-green-500/40"
          style={{
            boxShadow: '0 0 16px rgba(34, 197, 94, 0.15)'
          }}
        >
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-3">
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
          className="p-4 sm:p-6 rounded-lg bg-yellow-900/10 border-2 border-dashed border-yellow-500/40"
          style={{
            boxShadow: '0 0 16px rgba(234, 179, 8, 0.15)'
          }}
        >
          <p className="text-yellow-400 font-mono text-sm font-bold mb-2">
            You're {nextTierInfo.tokensNeeded.toLocaleString()} B402 away from Bronze tier!
          </p>
          <p className="text-yellow-300 font-mono text-xs">
            Start saving on every transaction by holding B402 tokens.
          </p>
        </div>
      )}

      {/* Tier Comparison Table */}
      <div className="overflow-x-auto -mx-2 sm:mx-0">
        <div className="inline-block min-w-full px-2 sm:px-0">
          <table className="w-full border-collapse bg-neon-dark/30 rounded-lg border border-neon-blue-dark/20">
            <thead>
              <tr className="border-b-2 border-neon-blue-light/50">
                <th className="p-3 text-left text-neon-white font-mono text-xs sm:text-sm sticky left-0 bg-neon-dark z-10">Benefit</th>
                {tiers.map((tier) => {
                  const tierInfo = getTierDisplayInfo(tier)
                  const isCurrentTier = tier === currentTier
                  return (
                    <th
                      key={tier}
                      className={cn(
                        "p-2 sm:p-3 text-center font-mono text-xs sm:text-sm min-w-[80px] sm:min-w-[100px]",
                        isCurrentTier && "bg-green-900/20"
                      )}
                      style={isCurrentTier ? { boxShadow: 'inset 0 0 12px rgba(34, 197, 94, 0.15)' } : {}}
                    >
                      <div className="flex flex-col items-center gap-1">
                        <span className="text-xl sm:text-2xl">{tierInfo.icon}</span>
                        <span className={cn(
                          "text-[10px] sm:text-xs font-bold",
                          tier === 'BRONZE' && "text-amber-600",
                          tier === 'SILVER' && "text-gray-400",
                          tier === 'GOLD' && "text-yellow-400",
                          tier === 'DIAMOND' && "text-cyan-400"
                        )}>
                          {tier}
                        </span>
                        <span className="text-neon-grey text-[9px] sm:text-[10px]">
                          {thresholds[tier].toLocaleString()} B402
                        </span>
                        {isCurrentTier && (
                          <Badge className="bg-green-500/20 text-green-400 border-green-500/30 text-[9px] px-1 py-0 font-mono">
                            ACTIVE
                          </Badge>
                        )}
                      </div>
                    </th>
                  )
                })}
              </tr>
            </thead>
            <tbody className="text-neon-grey font-mono text-[10px] sm:text-xs">
            {/* Slot Machine Benefits */}
            <tr className="border-b border-neon-grey/20 bg-neon-dark/10">
              <td className="p-2 sm:p-3 font-bold text-neon-white sticky left-0 bg-neon-dark z-10" colSpan={5}>
                <span className="flex items-center gap-2"><Gamepad2 className="w-3 h-3 sm:w-4 sm:h-4" /> Slot Machine</span>
              </td>
            </tr>
            <tr className="border-b border-neon-grey/10 hover:bg-neon-blue-dark/5 transition-colors">
              <td className="p-2 sm:p-3 sticky left-0 bg-neon-dark z-10">Entry Discount</td>
              {tiers.map((tier) => {
                const benefits = allBenefits[tier]
                const isCurrentTier = tier === currentTier
                return (
                  <td key={tier} className={cn("p-2 sm:p-3 text-center", isCurrentTier && "bg-green-900/10")}>
                    {benefits.slotMachine.discountPercent}%
                  </td>
                )
              })}
            </tr>
            <tr className="border-b border-neon-grey/10 hover:bg-neon-blue-dark/5 transition-colors">
              <td className="p-2 sm:p-3 sticky left-0 bg-neon-dark z-10">Payout Multiplier</td>
              {tiers.map((tier) => {
                const benefits = allBenefits[tier]
                const isCurrentTier = tier === currentTier
                return (
                  <td key={tier} className={cn("p-2 sm:p-3 text-center", isCurrentTier && "bg-green-900/10")}>
                    {benefits.slotMachine.bonusMultiplier}x
                  </td>
                )
              })}
            </tr>
            <tr className="border-b border-neon-grey/20 hover:bg-neon-blue-dark/5 transition-colors">
              <td className="p-2 sm:p-3 sticky left-0 bg-neon-dark z-10">Free Spins/Day</td>
              {tiers.map((tier) => {
                const benefits = allBenefits[tier]
                const isCurrentTier = tier === currentTier
                return (
                  <td key={tier} className={cn("p-2 sm:p-3 text-center", isCurrentTier && "bg-green-900/10")}>
                    {benefits.slotMachine.freeSpinsDaily}
                  </td>
                )
              })}
            </tr>

            {/* Lottery Benefits */}
            <tr className="border-b border-neon-grey/20 bg-neon-dark/10">
              <td className="p-2 sm:p-3 font-bold text-neon-white sticky left-0 bg-neon-dark z-10" colSpan={5}>
                <span className="flex items-center gap-2"><Ticket className="w-3 h-3 sm:w-4 sm:h-4" /> Lottery</span>
              </td>
            </tr>
            <tr className="border-b border-neon-grey/10 hover:bg-neon-blue-dark/5 transition-colors">
              <td className="p-2 sm:p-3 sticky left-0 bg-neon-dark z-10">Entry Discount</td>
              {tiers.map((tier) => {
                const benefits = allBenefits[tier]
                const isCurrentTier = tier === currentTier
                return (
                  <td key={tier} className={cn("p-2 sm:p-3 text-center", isCurrentTier && "bg-green-900/10")}>
                    {benefits.lottery.discountPercent}%
                  </td>
                )
              })}
            </tr>
            <tr className="border-b border-neon-grey/10 hover:bg-neon-blue-dark/5 transition-colors">
              <td className="p-2 sm:p-3 sticky left-0 bg-neon-dark z-10">Bonus Entries</td>
              {tiers.map((tier) => {
                const benefits = allBenefits[tier]
                const isCurrentTier = tier === currentTier
                return (
                  <td key={tier} className={cn("p-2 sm:p-3 text-center", isCurrentTier && "bg-green-900/10")}>
                    +{benefits.lottery.bonusEntries}
                  </td>
                )
              })}
            </tr>
            <tr className="border-b border-neon-grey/20 hover:bg-neon-blue-dark/5 transition-colors">
              <td className="p-2 sm:p-3 sticky left-0 bg-neon-dark z-10">Win Boost</td>
              {tiers.map((tier) => {
                const benefits = allBenefits[tier]
                const isCurrentTier = tier === currentTier
                return (
                  <td key={tier} className={cn("p-2 sm:p-3 text-center", isCurrentTier && "bg-green-900/10")}>
                    +{benefits.lottery.winBoostPercent}%
                  </td>
                )
              })}
            </tr>

            {/* Blink Benefits */}
            <tr className="border-b border-neon-grey/20 bg-neon-dark/10">
              <td className="p-2 sm:p-3 font-bold text-neon-white sticky left-0 bg-neon-dark z-10" colSpan={5}>
                <span className="flex items-center gap-2"><Zap className="w-3 h-3 sm:w-4 sm:h-4" /> API Blinks</span>
              </td>
            </tr>
            <tr className="border-b border-neon-grey/10 hover:bg-neon-blue-dark/5 transition-colors">
              <td className="p-2 sm:p-3 sticky left-0 bg-neon-dark z-10">Creator Fee Discount</td>
              {tiers.map((tier) => {
                const benefits = allBenefits[tier]
                const isCurrentTier = tier === currentTier
                return (
                  <td key={tier} className={cn("p-2 sm:p-3 text-center", isCurrentTier && "bg-green-900/10")}>
                    {benefits.blinks.creatorFeeDiscount}%
                  </td>
                )
              })}
            </tr>
            <tr className="border-b border-neon-grey/10 hover:bg-neon-blue-dark/5 transition-colors">
              <td className="p-2 sm:p-3 sticky left-0 bg-neon-dark z-10">Priority Execution</td>
              {tiers.map((tier) => {
                const benefits = allBenefits[tier]
                const isCurrentTier = tier === currentTier
                return (
                  <td key={tier} className={cn("p-2 sm:p-3 text-center", isCurrentTier && "bg-green-900/10")}>
                    {benefits.blinks.priorityExecution ? <Check className="w-3 h-3 sm:w-4 sm:h-4 mx-auto text-green-400" /> : '—'}
                  </td>
                )
              })}
            </tr>
            <tr className="hover:bg-neon-blue-dark/5 transition-colors">
              <td className="p-2 sm:p-3 sticky left-0 bg-neon-dark z-10">Custom Branding</td>
              {tiers.map((tier) => {
                const benefits = allBenefits[tier]
                const isCurrentTier = tier === currentTier
                return (
                  <td key={tier} className={cn("p-2 sm:p-3 text-center", isCurrentTier && "bg-green-900/10")}>
                    {benefits.blinks.customBranding ? <Check className="w-3 h-3 sm:w-4 sm:h-4 mx-auto text-green-400" /> : '—'}
                  </td>
                )
              })}
            </tr>
          </tbody>
        </table>
        </div>
      </div>

      {/* CTA Buttons */}
      <div className="flex flex-col sm:flex-row gap-3 sm:justify-end pt-6 border-t-2 border-dashed border-neon-blue-dark/30">
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
