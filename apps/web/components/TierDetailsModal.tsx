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
        <DialogTitle className="text-2xl sm:text-3xl font-sans font-light text-[--neon-white] flex items-center gap-3">
          <span>{getTierDisplayInfo(currentTier).icon}</span>
          <span>B402 Token Holder Tiers</span>
        </DialogTitle>
        <DialogDescription className="text-[--neon-grey] font-mono text-sm">
          Hold B402 tokens to unlock exclusive discounts and benefits across the platform
        </DialogDescription>
      </DialogHeader>

      {/* Current Status */}
      {currentTier !== 'NONE' && (
        <div className="p-4 rounded-lg bg-green-900/20 border-2 border-dashed border-green-500/60">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <span className="text-green-400 font-mono text-sm font-bold">Your Current Tier:</span>
              <Badge className="bg-green-500/20 text-green-400 border-green-500/30">
                {getTierDisplayInfo(currentTier).label}
              </Badge>
            </div>
            <span className="text-green-300 font-mono text-xs">{balance.toLocaleString()} B402</span>
          </div>

          {/* Progress to next tier */}
          {nextTierInfo && (
            <div className="mt-3">
              <div className="flex justify-between text-xs font-mono text-[--neon-grey] mb-1">
                <span>Progress to {nextTierInfo.name}</span>
                <span>{nextTierInfo.tokensNeeded.toLocaleString()} B402 needed</span>
              </div>
              <div className="w-full h-2 bg-[--neon-black] rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-[--neon-blue-dark] to-[--neon-blue-light] transition-all duration-500"
                  style={{ width: `${nextTierInfo.progress}%` }}
                />
              </div>
            </div>
          )}

          {currentTier === 'DIAMOND' && (
            <p className="text-green-300 font-mono text-xs mt-2">
              🎉 You've reached the maximum tier! Enjoy all premium benefits.
            </p>
          )}
        </div>
      )}

      {currentTier === 'NONE' && nextTierInfo && (
        <div className="p-4 rounded-lg bg-yellow-900/20 border-2 border-dashed border-yellow-500/60">
          <p className="text-yellow-400 font-mono text-sm font-bold mb-2">
            You're {nextTierInfo.tokensNeeded.toLocaleString()} B402 away from Bronze tier!
          </p>
          <p className="text-yellow-300 font-mono text-xs">
            Start saving on every transaction by holding B402 tokens.
          </p>
        </div>
      )}

      {/* Tier Comparison Table */}
      <div className="overflow-x-auto">
        <table className="w-full border-collapse">
          <thead>
            <tr className="border-b-2 border-[--neon-blue-light]">
              <th className="p-3 text-left text-[--neon-white] font-mono text-sm">Benefit</th>
              {tiers.map((tier) => {
                const tierInfo = getTierDisplayInfo(tier)
                const isCurrentTier = tier === currentTier
                return (
                  <th
                    key={tier}
                    className={cn(
                      "p-3 text-center font-mono text-sm",
                      isCurrentTier && "bg-green-900/20"
                    )}
                  >
                    <div className="flex flex-col items-center gap-1">
                      <span className="text-2xl">{tierInfo.icon}</span>
                      <span className={cn(
                        "text-xs font-bold",
                        tier === 'BRONZE' && "text-amber-700",
                        tier === 'SILVER' && "text-gray-400",
                        tier === 'GOLD' && "text-yellow-400",
                        tier === 'DIAMOND' && "text-cyan-400"
                      )}>
                        {tier}
                      </span>
                      <span className="text-[--neon-grey] text-[10px]">
                        {thresholds[tier].toLocaleString()} B402
                      </span>
                      {isCurrentTier && (
                        <Badge className="bg-green-500/20 text-green-400 border-green-500/30 text-[10px] px-1 py-0">
                          ACTIVE
                        </Badge>
                      )}
                    </div>
                  </th>
                )
              })}
            </tr>
          </thead>
          <tbody className="text-[--neon-grey] font-mono text-xs">
            {/* Slot Machine Benefits */}
            <tr className="border-b border-[--neon-grey]/20">
              <td className="p-3 font-bold text-[--neon-white]" colSpan={5}>
                <span className="flex items-center gap-2"><Gamepad2 className="w-4 h-4" /> Slot Machine</span>
              </td>
            </tr>
            <tr className="border-b border-[--neon-grey]/10">
              <td className="p-3">Entry Discount</td>
              {tiers.map((tier) => {
                const benefits = allBenefits[tier]
                const isCurrentTier = tier === currentTier
                return (
                  <td key={tier} className={cn("p-3 text-center", isCurrentTier && "bg-green-900/10")}>
                    {benefits.slotMachine.discountPercent}%
                  </td>
                )
              })}
            </tr>
            <tr className="border-b border-[--neon-grey]/10">
              <td className="p-3">Payout Multiplier</td>
              {tiers.map((tier) => {
                const benefits = allBenefits[tier]
                const isCurrentTier = tier === currentTier
                return (
                  <td key={tier} className={cn("p-3 text-center", isCurrentTier && "bg-green-900/10")}>
                    {benefits.slotMachine.bonusMultiplier}x
                  </td>
                )
              })}
            </tr>
            <tr className="border-b border-[--neon-grey]/20">
              <td className="p-3">Free Spins/Day</td>
              {tiers.map((tier) => {
                const benefits = allBenefits[tier]
                const isCurrentTier = tier === currentTier
                return (
                  <td key={tier} className={cn("p-3 text-center", isCurrentTier && "bg-green-900/10")}>
                    {benefits.slotMachine.freeSpinsDaily}
                  </td>
                )
              })}
            </tr>

            {/* Lottery Benefits */}
            <tr className="border-b border-[--neon-grey]/20">
              <td className="p-3 font-bold text-[--neon-white]" colSpan={5}>
                <span className="flex items-center gap-2"><Ticket className="w-4 h-4" /> Lottery</span>
              </td>
            </tr>
            <tr className="border-b border-[--neon-grey]/10">
              <td className="p-3">Entry Discount</td>
              {tiers.map((tier) => {
                const benefits = allBenefits[tier]
                const isCurrentTier = tier === currentTier
                return (
                  <td key={tier} className={cn("p-3 text-center", isCurrentTier && "bg-green-900/10")}>
                    {benefits.lottery.discountPercent}%
                  </td>
                )
              })}
            </tr>
            <tr className="border-b border-[--neon-grey]/10">
              <td className="p-3">Bonus Entries</td>
              {tiers.map((tier) => {
                const benefits = allBenefits[tier]
                const isCurrentTier = tier === currentTier
                return (
                  <td key={tier} className={cn("p-3 text-center", isCurrentTier && "bg-green-900/10")}>
                    +{benefits.lottery.bonusEntries}
                  </td>
                )
              })}
            </tr>
            <tr className="border-b border-[--neon-grey]/20">
              <td className="p-3">Win Boost</td>
              {tiers.map((tier) => {
                const benefits = allBenefits[tier]
                const isCurrentTier = tier === currentTier
                return (
                  <td key={tier} className={cn("p-3 text-center", isCurrentTier && "bg-green-900/10")}>
                    +{benefits.lottery.winBoostPercent}%
                  </td>
                )
              })}
            </tr>

            {/* Blink Benefits */}
            <tr className="border-b border-[--neon-grey]/20">
              <td className="p-3 font-bold text-[--neon-white]" colSpan={5}>
                <span className="flex items-center gap-2"><Zap className="w-4 h-4" /> API Blinks</span>
              </td>
            </tr>
            <tr className="border-b border-[--neon-grey]/10">
              <td className="p-3">Creator Fee Discount</td>
              {tiers.map((tier) => {
                const benefits = allBenefits[tier]
                const isCurrentTier = tier === currentTier
                return (
                  <td key={tier} className={cn("p-3 text-center", isCurrentTier && "bg-green-900/10")}>
                    {benefits.blinks.creatorFeeDiscount}%
                  </td>
                )
              })}
            </tr>
            <tr className="border-b border-[--neon-grey]/10">
              <td className="p-3">Priority Execution</td>
              {tiers.map((tier) => {
                const benefits = allBenefits[tier]
                const isCurrentTier = tier === currentTier
                return (
                  <td key={tier} className={cn("p-3 text-center", isCurrentTier && "bg-green-900/10")}>
                    {benefits.blinks.priorityExecution ? <Check className="w-4 h-4 mx-auto text-green-400" /> : '—'}
                  </td>
                )
              })}
            </tr>
            <tr className="border-b border-[--neon-grey]/10">
              <td className="p-3">Custom Branding</td>
              {tiers.map((tier) => {
                const benefits = allBenefits[tier]
                const isCurrentTier = tier === currentTier
                return (
                  <td key={tier} className={cn("p-3 text-center", isCurrentTier && "bg-green-900/10")}>
                    {benefits.blinks.customBranding ? <Check className="w-4 h-4 mx-auto text-green-400" /> : '—'}
                  </td>
                )
              })}
            </tr>
          </tbody>
        </table>
      </div>

      {/* CTA Buttons */}
      <div className="flex gap-3 justify-end pt-4 border-t border-[--neon-grey]/20">
        {nextTierInfo && (
          <Link href={`https://jup.ag/swap/USDC-B402`} target="_blank" rel="noopener noreferrer">
            <Button className="bg-[--neon-blue-dark] hover:bg-[--neon-blue-light] text-white font-mono">
              Buy {nextTierInfo.tokensNeeded.toLocaleString()} B402 to Upgrade
            </Button>
          </Link>
        )}
        <Button variant="outline" onClick={onClose} className="font-mono">
          Close
        </Button>
      </div>
    </div>
  )
}
