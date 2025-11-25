"use client"

import { useEffect, useState } from "react"
import { usePrivy, useWallets } from "@privy-io/react-auth"
import { getB402HolderTier, getTierDisplayInfo, getTierThresholds, type TokenHolderTier } from "@blink402/solana"
import { cn } from "@/lib/utils"
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog"
import TierDetailsModal from "./TierDetailsModal"
import { Circle, Award, Medal, Trophy, Gem, Info } from "lucide-react"

interface TierBadgeWidgetProps {
  variant?: 'desktop' | 'mobile'
  className?: string
}

const TierIcon = ({ tier, className }: { tier: TokenHolderTier, className?: string }) => {
  const baseClass = cn(
    "text-neon-blue-light",
    "drop-shadow-[0_0_15px_rgba(76,201,240,0.5)]",
    className
  )

  switch (tier) {
    case 'BRONZE':
      return <Award className={baseClass} />;
    case 'SILVER':
      return <Medal className={baseClass} />;
    case 'GOLD':
      return <Trophy className={baseClass} />;
    case 'DIAMOND':
      return <Gem className={baseClass} />;
    default:
      return <Circle className={baseClass} />;
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
            variant === 'desktop' && "flex items-center gap-2 h-10 px-3 py-2 rounded-lg",
            variant === 'mobile' && "flex items-center gap-2 px-3 py-2 rounded-lg w-full justify-between",
            "border border-dashed border-[--neon-blue-light]/50",
            "bg-[--neon-surface]/80 hover:bg-[--neon-surface]",
            "backdrop-blur-sm",
            "transition-all duration-200",
            "hover:border-[--neon-blue-light]",
            "hover:shadow-[0_0_16px_rgba(76,201,240,0.3)]",
            "hover:scale-[1.02]",
            className
          )}
          disabled={isLoading}
        >
          {isLoading ? (
            <>
              <div className="w-5 h-5 rounded-full bg-[--neon-grey]/20 animate-pulse" />
              <div className="flex flex-col items-start gap-1">
                <div className="w-16 h-3 bg-[--neon-grey]/20 rounded animate-pulse" />
                <div className="w-12 h-2 bg-[--neon-grey]/20 rounded animate-pulse" />
              </div>
            </>
          ) : (
            <>
              {/* Tier Icon */}
              <span className="flex-shrink-0 animate-pulse" style={{ animationDuration: '2s' }}>
                <TierIcon tier={tier} className={cn(
                  variant === 'desktop' && "w-5 h-5",
                  variant === 'mobile' && "w-6 h-6"
                )} />
              </span>

              {/* Balance & Tier Info */}
              <div className="flex flex-col items-start flex-1 min-w-0">
                <span className="text-[--neon-white] font-mono text-xs font-bold truncate">
                  {formatBalance(balance)} B402
                </span>
                <span className={cn(
                  "font-mono text-[10px] truncate",
                  tier === 'NONE' && "text-[--neon-grey]",
                  tier === 'BRONZE' && "text-amber-500",
                  tier === 'SILVER' && "text-slate-400",
                  tier === 'GOLD' && "text-yellow-400",
                  tier === 'DIAMOND' && "text-cyan-400"
                )}>
                  {tier === 'NONE' ? 'No Tier' : tierDisplay.label.replace(' Tier', '')}
                </span>
              </div>

              {/* Info icon - subtle indicator this is clickable */}
              <Info className="w-3.5 h-3.5 text-[--neon-grey] group-hover:text-[--neon-blue-light] transition-colors flex-shrink-0" />
            </>
          )}

          {/* Gradient overlay on hover */}
          <div
            className="absolute inset-0 rounded-lg opacity-0 group-hover:opacity-10 transition-opacity duration-200 pointer-events-none"
            style={{
              background: `linear-gradient(135deg, ${
                tier === 'BRONZE' ? 'rgba(217, 119, 6, 0.5)' :
                tier === 'SILVER' ? 'rgba(148, 163, 184, 0.5)' :
                tier === 'GOLD' ? 'rgba(251, 191, 36, 0.5)' :
                tier === 'DIAMOND' ? 'rgba(34, 211, 238, 0.5)' :
                'rgba(90, 180, 255, 0.5)'
              }, transparent)`
            }}
          />
        </button>
      </DialogTrigger>

      <DialogContent
        className="max-w-[95vw] sm:max-w-4xl max-h-[90vh] overflow-y-auto bg-neon-black border-2 border-dashed border-neon-blue-light p-4 sm:p-6 lg:p-8"
        style={{
          boxShadow: '0 0 40px rgba(90, 180, 255, 0.3), inset 0 0 60px rgba(0, 0, 0, 0.8)'
        }}
      >
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
