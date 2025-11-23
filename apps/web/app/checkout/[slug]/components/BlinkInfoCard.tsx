/**
 * Displays blink information and pricing details on checkout page
 */
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import NeonDivider from "@/components/NeonDivider"
import type { BlinkData } from "@/lib/types"

interface BlinkInfoCardProps {
  blink: BlinkData
  finalPrice: number
  savings: number
  discountPercent: number
}

export function BlinkInfoCard({
  blink,
  finalPrice,
  savings,
  discountPercent
}: BlinkInfoCardProps) {
  return (
    <Card className="bg-neon-dark border-neon-blue-dark/20 p-4 sm:p-6">
      <div className="flex items-start gap-3 sm:gap-4 mb-4 sm:mb-6">
        <div className="w-12 h-12 sm:w-16 sm:h-16 bg-neon-black border border-neon-blue-dark/30 rounded-lg flex items-center justify-center flex-shrink-0">
          <span className="text-neon font-mono text-xl sm:text-2xl">⚡</span>
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 sm:gap-3 mb-2 flex-wrap">
            <h3 className="text-neon-white font-mono text-base sm:text-lg">{blink.title}</h3>
            <Badge className="bg-neon-blue-dark/20 text-neon-blue-light border-neon-blue-dark/30 text-xs">
              {blink.category}
            </Badge>
          </div>
          <p className="text-neon-grey font-mono text-xs sm:text-sm">{blink.description}</p>
        </div>
      </div>

      <NeonDivider className="my-3 sm:my-4" />

      <div className="space-y-2 sm:space-y-3">
        <div className="flex justify-between items-center">
          <span className="text-neon-grey font-mono text-xs sm:text-sm">Price</span>
          {savings > 0 ? (
            <div className="flex items-center gap-2">
              <span className="text-neon-grey font-mono text-xs line-through">${blink.price_usdc}</span>
              <span className="text-neon-white font-mono font-bold text-sm sm:text-base">
                ${finalPrice.toFixed(2)} USDC
              </span>
              <span className="text-green-400 font-mono text-xs">(-{discountPercent}%)</span>
            </div>
          ) : (
            <span className="text-neon-white font-mono font-bold text-sm sm:text-base">
              ${blink.price_usdc} USDC
            </span>
          )}
        </div>
        <div className="flex justify-between items-center">
          <span className="text-neon-grey font-mono text-xs sm:text-sm">Network</span>
          <Badge variant="outline" className="border-neon-blue-dark/30 text-neon-blue-light text-xs">
            Solana
          </Badge>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-neon-grey font-mono text-xs sm:text-sm">Payment Method</span>
          <span className="text-neon-blue-light font-mono text-xs sm:text-sm">ONCHAIN x402</span>
        </div>
      </div>
    </Card>
  )
}
