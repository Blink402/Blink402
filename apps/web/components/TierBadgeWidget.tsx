"use client"

import { useEffect, useState } from "react"
import { usePrivy, useWallets } from "@privy-io/react-auth"
import { getB402HolderTier, getTierDisplayInfo, getTierThresholds, type TokenHolderTier } from "@blink402/solana"
import { cn } from "@/lib/utils"
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog"
import TierDetailsModal from "./TierDetailsModal"
import { Circle, Award, Medal, Gem, Info } from "lucide-react"

interface TierBadgeWidgetProps {
  variant?: 'desktop' | 'mobile'
  className?: string
}

const TierIcon = ({ tier, className }: { tier: TokenHolderTier, className?: string }) => {
  switch (tier) {
    case 'BRONZE':
      return <Award className={cn("text-amber-700", className)} />;
    case 'SILVER':
      return <Medal className={cn("text-gray-400", className)} />;
    case 'GOLD':
      return <Medal className={cn("text-yellow-400", className)} />;
    case 'DIAMOND':
      return <Gem className={cn("text-cyan-400", className)} />;
    default:
      return <Circle className={cn("text-gray-500", className)} />;
  }
}

export function TierBadgeWidget({ variant = 'desktop', className }: TierBadgeWidgetProps) {
  const { authenticated, user, ready } = usePrivy()
  const { wallets } = useWallets()

  // Get wallet address (same pattern as checkout/slot machine)
  const wallet = wallets[0]
  const solanaAccount: any = user?.linkedAccounts?.find(
    (account: any) => account.type === 'wallet' && account.chainType === 'solana'
  )
  const connectedWallet = (solanaAccount as any)?.address || wallet?.address
  const connected = authenticated && !!connectedWallet

  const [tier, setTier] = useState<TokenHolderTier>('NONE')
  const [balance, setBalance] = useState<number>(0)
  const [isLoading, setIsLoading] = useState(false)
  const [isOpen, setIsOpen] = useState(false)
  const [nextTierInfo, setNextTierInfo] = useState<{
    name: string
    required: number
    tokensNeeded: number
    progress: number
  } | null>(null)

  // Fetch tier when wallet connects
  useEffect(() => {
    const fetchTier = async () => {
      if (!connected || !connectedWallet || !ready) {
        setTier('NONE')
        setBalance(0)
        setNextTierInfo(null)
        return
      }

      setIsLoading(true)
      try {
        const holderInfo = await getB402HolderTier(connectedWallet)
        setTier(holderInfo.tier)
        setBalance(holderInfo.balance)

        // Calculate next tier info
        const thresholds = getTierThresholds()
        const tierOrder: Array<Exclude<TokenHolderTier, 'NONE'>> = ['BRONZE', 'SILVER', 'GOLD', 'DIAMOND']
        const currentTierIndex = tierOrder.indexOf(holderInfo.tier as any)

        if (currentTierIndex < tierOrder.length - 1) {
          const nextTier = tierOrder[currentTierIndex + 1]
          const required = thresholds[nextTier]
          const tokensNeeded = Math.max(0, required - holderInfo.balance)
          const progress = Math.min(100, (holderInfo.balance / required) * 100)

          setNextTierInfo({
            name: nextTier,
            required,
            tokensNeeded,
            progress
          })
        } else if (holderInfo.tier === 'DIAMOND') {
          // Already max tier
          setNextTierInfo(null)
        } else {
          // No tier yet, show Bronze as next
          const required = thresholds.BRONZE
          const tokensNeeded = required - holderInfo.balance
          const progress = (holderInfo.balance / required) * 100

          setNextTierInfo({
            name: 'BRONZE',
            required,
            tokensNeeded,
            progress
          })
        }
      } catch (error) {
        console.error('Failed to fetch B402 tier:', error)
        setTier('NONE')
        setBalance(0)
        setNextTierInfo(null)
      } finally {
        setIsLoading(false)
      }
    }

    fetchTier()
  }, [connected, connectedWallet, ready])

  if (!connected || !ready) {
    return null // Don't show badge if wallet not connected
  }

  const tierDisplay = getTierDisplayInfo(tier)

  // Format balance for display
  const formatBalance = (bal: number): string => {
    if (bal >= 1_000_000) return `${(bal / 1_000_000).toFixed(1)}M`
    if (bal >= 1_000) return `${(bal / 1_000).toFixed(1)}k`
    return bal.toFixed(0)
  }

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <button
          className={cn(
            "relative group",
            "flex items-center gap-2 px-3 py-2 rounded-lg",
            "border-2 border-dashed border-[--neon-blue-light]/60",
            "bg-[--neon-dark] hover:bg-[--neon-black]",
            "transition-all duration-200",
            "hover:border-[--neon-blue-light]",
            "hover:scale-105",
            variant === 'mobile' && "w-full justify-between",
            className
          )}
          style={{
            boxShadow: "0 0 12px rgba(90, 180, 255, 0.3)",
          }}
          disabled={isLoading}
        >
          {isLoading ? (
            <>
              <div className="w-6 h-6 rounded-full bg-[--neon-grey]/20 animate-pulse" />
              <div className="flex flex-col items-start gap-1">
                <div className="w-16 h-3 bg-[--neon-grey]/20 rounded animate-pulse" />
                <div className="w-12 h-2 bg-[--neon-grey]/20 rounded animate-pulse" />
              </div>
            </>
          ) : (
            <>
              {/* Tier Icon */}
              <span className="animate-pulse" style={{ animationDuration: '2s' }}>
                <TierIcon tier={tier} className="w-6 h-6" />
              </span>

              {/* Balance & Tier Info */}
              <div className="flex flex-col items-start">
                <span className="text-[--neon-white] font-mono text-xs font-bold">
                  {formatBalance(balance)} B402
                </span>
                <span className={cn(
                  "font-mono text-[10px]",
                  tier === 'NONE' && "text-[--neon-grey]",
                  tier === 'BRONZE' && "text-amber-700",
                  tier === 'SILVER' && "text-gray-400",
                  tier === 'GOLD' && "text-yellow-400",
                  tier === 'DIAMOND' && "text-cyan-400"
                )}>
                  {tier === 'NONE' ? 'No Tier' : tierDisplay.label.replace(' Tier', '')}
                </span>
              </div>

              {/* Tooltip Indicator (chevron or info icon) */}
              {variant === 'desktop' && (
                <Info className="w-3 h-3 text-[--neon-grey] group-hover:text-[--neon-blue-light] transition-colors" />
              )}
            </>
          )}

          {/* Gradient overlay on hover */}
          <div
            className="absolute inset-0 rounded-lg opacity-0 group-hover:opacity-20 transition-opacity pointer-events-none"
            style={{
              background: `linear-gradient(135deg, ${tier === 'BRONZE' ? 'rgba(217, 119, 6, 0.3)' :
                  tier === 'SILVER' ? 'rgba(156, 163, 175, 0.3)' :
                    tier === 'GOLD' ? 'rgba(251, 191, 36, 0.3)' :
                      tier === 'DIAMOND' ? 'rgba(34, 211, 238, 0.3)' :
                        'rgba(90, 180, 255, 0.3)'
                }, transparent)`
            }}
          />
        </button>
      </DialogTrigger>

      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto bg-[--neon-dark] border-2 border-[--neon-blue-light]">
        <TierDetailsModal
          currentTier={tier}
          balance={balance}
          nextTierInfo={nextTierInfo}
          onClose={() => setIsOpen(false)}
        />
      </DialogContent>
    </Dialog>
  )
}
