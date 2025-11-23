"use client"

import { useState, useMemo, useEffect } from "react"
import { usePrivy, useWallets } from "@privy-io/react-auth"
import { getAllTierBenefits, getTierThresholds, getB402HolderTier, type TokenHolderTier } from "@blink402/solana"
import { useB402Price } from "@/hooks/useB402Price"
import { SavingsCalculatorCard } from "./SavingsCalculatorCard"
import { cn } from "@/lib/utils"
import { Zap, Gamepad2, Ticket, Coins } from "lucide-react"

type ActivityType = 'slot' | 'lottery' | 'blinks'

export function SavingsCalculator() {
  const { authenticated, user, ready } = usePrivy()
  const { wallets } = useWallets()

  // Get wallet address
  const wallet = wallets[0]
  const solanaAccount: any = user?.linkedAccounts?.find(
    (account: any) => account.type === 'wallet' && account.chainType === 'solana'
  )
  const connectedWallet = (solanaAccount as any)?.address || wallet?.address
  const connected = authenticated && !!connectedWallet

  const [activityType, setActivityType] = useState<ActivityType>('blinks')
  const [frequency, setFrequency] = useState(10)
  const [currentTier, setCurrentTier] = useState<TokenHolderTier>('NONE')

  const { price: b402PriceUSDC, isLoading: priceLoading } = useB402Price()

  const allBenefits = getAllTierBenefits()
  const thresholds = getTierThresholds()
  const tiers: Array<Exclude<TokenHolderTier, 'NONE'>> = ['BRONZE', 'SILVER', 'GOLD', 'DIAMOND']

  // Fetch user's current tier if connected
  useEffect(() => {
    const fetchUserTier = async () => {
      if (connected && connectedWallet && ready) {
        try {
          const holderInfo = await getB402HolderTier(connectedWallet)
          setCurrentTier(holderInfo.tier)
        } catch (error) {
          console.error('Failed to fetch user tier:', error)
          setCurrentTier('NONE')
        }
      } else {
        setCurrentTier('NONE')
      }
    }

    fetchUserTier()
  }, [connected, connectedWallet, ready])

  // Base prices for each activity
  const basePrices: Record<ActivityType, number> = {
    slot: 0.10,      // Slot machine entry
    lottery: 1.00,   // Lottery entry
    blinks: 0.50     // Average blink price
  }

  // Calculate savings for all tiers
  const calculations = useMemo(() => {
    const basePrice = basePrices[activityType]

    return tiers.map(tier => {
      const benefits = allBenefits[tier]
      const tokensRequired = thresholds[tier]

      // Get discount percentage based on activity type
      let discountPercent = 0
      if (activityType === 'slot') {
        discountPercent = benefits.slotMachine.discountPercent
      } else if (activityType === 'lottery') {
        discountPercent = benefits.lottery.discountPercent
      } else if (activityType === 'blinks') {
        discountPercent = benefits.blinks.creatorFeeDiscount
      }

      // Calculate weekly and monthly savings
      const weeklySpending = basePrice * frequency
      const weeklySavings = weeklySpending * (discountPercent / 100)
      const monthlySavings = weeklySavings * 4

      // Calculate cost to acquire tier
      const tierCost = tokensRequired * b402PriceUSDC

      // Calculate ROI in weeks
      const weeksToROI = weeklySavings > 0 ? Math.ceil(tierCost / weeklySavings) : Infinity

      return {
        tier,
        tokensRequired,
        discountPercent,
        monthlySavings,
        weeksToROI,
        tierCost
      }
    })
  }, [activityType, frequency, b402PriceUSDC, allBenefits, thresholds])

  const activityOptions = [
    {
      value: 'blinks', label: (
        <span className="flex items-center gap-2"><Zap className="w-4 h-4" /> API Blinks</span>
      ), price: '~$0.50/call'
    },
    {
      value: 'slot', label: (
        <span className="flex items-center gap-2"><Gamepad2 className="w-4 h-4" /> Slot Machine</span>
      ), price: '$0.10/spin'
    },
    {
      value: 'lottery', label: (
        <span className="flex items-center gap-2"><Ticket className="w-4 h-4" /> Lottery</span>
      ), price: '$1.00/entry'
    }
  ]

  return (
    <section className="py-12 px-4" data-reveal>
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <h2 className="text-3xl sm:text-4xl font-sans font-light text-[--neon-white] mb-3">
            <span className="inline-block mr-2"><Coins className="w-8 h-8 inline text-[--neon-blue-light]" /></span>
            Calculate Your B402 Savings
          </h2>
          <p className="text-[--neon-grey] font-mono text-sm sm:text-base max-w-2xl mx-auto">
            See how much you can save by holding B402 tokens. The more you hold, the more you save on every transaction.
          </p>
        </div>

        {/* Controls */}
        <div className="max-w-3xl mx-auto mb-8 space-y-4">
          {/* Activity Type Selector */}
          <div>
            <label className="block text-[--neon-white] font-mono text-sm mb-2">
              Select Activity
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {activityOptions.map(option => (
                <button
                  key={option.value}
                  onClick={() => setActivityType(option.value as ActivityType)}
                  className={cn(
                    "p-3 rounded-lg border-2 border-dashed font-mono text-sm transition-all duration-200",
                    activityType === option.value
                      ? "border-[--neon-blue-light] bg-[--neon-blue-dark]/20 text-[--neon-white]"
                      : "border-[--neon-grey]/30 bg-[--neon-dark] text-[--neon-grey] hover:border-[--neon-grey]/60"
                  )}
                  style={{
                    boxShadow: activityType === option.value ? "0 0 12px rgba(90, 180, 255, 0.3)" : "none"
                  }}
                >
                  <div className="font-bold">{option.label}</div>
                  <div className="text-xs mt-1">{option.price}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Frequency Slider */}
          <div>
            <label className="block text-[--neon-white] font-mono text-sm mb-2">
              How often do you use it?
            </label>
            <div className="flex items-center gap-4">
              <input
                type="range"
                min="1"
                max="50"
                value={frequency}
                onChange={(e) => setFrequency(parseInt(e.target.value))}
                className="flex-1 h-2 bg-[--neon-dark] rounded-lg appearance-none cursor-pointer accent-[--neon-blue-light]"
                style={{
                  background: `linear-gradient(to right, var(--neon-blue-light) 0%, var(--neon-blue-light) ${(frequency / 50) * 100}%, var(--neon-dark) ${(frequency / 50) * 100}%, var(--neon-dark) 100%)`
                }}
              />
              <div className="min-w-[120px] text-right">
                <span className="text-[--neon-blue-light] font-mono text-xl font-bold">{frequency}</span>
                <span className="text-[--neon-grey] font-mono text-sm ml-1">times/week</span>
              </div>
            </div>
          </div>

          {/* Price Loading Indicator */}
          {priceLoading && (
            <div className="text-center">
              <p className="text-[--neon-grey] font-mono text-xs">
                <span className="inline-block w-3 h-3 border-2 border-[--neon-blue-light] border-t-transparent rounded-full animate-spin mr-2" />
                Fetching live B402 price...
              </p>
            </div>
          )}
        </div>

        {/* Tier Cards Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {calculations.map(calc => (
            <SavingsCalculatorCard
              key={calc.tier}
              tier={calc.tier}
              tokensRequired={calc.tokensRequired}
              monthlySavings={calc.monthlySavings}
              weeksToROI={calc.weeksToROI}
              isCurrentTier={calc.tier === currentTier}
              isMostPopular={calc.tier === 'GOLD'}
              b402PriceUSDC={b402PriceUSDC}
              onBuyClick={() => {
                console.log(`Buy ${calc.tier} tier clicked`)
              }}
            />
          ))}
        </div>

        {/* Footer Note */}
        <div className="mt-8 text-center">
          <p className="text-[--neon-grey] font-mono text-xs">
            💡 ROI calculations based on current B402 price of ${b402PriceUSDC.toFixed(4)} USDC
          </p>
          <p className="text-[--neon-grey] font-mono text-xs mt-1">
            Discounts apply automatically when you hold the required B402 tokens
          </p>
        </div>
      </div>
    </section>
  )
}
