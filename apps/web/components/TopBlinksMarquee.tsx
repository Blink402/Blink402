"use client"
import { useEffect, useState } from "react"
import { usePathname } from "next/navigation"
import Link from "next/link"
import { X } from "lucide-react"

const STORAGE_KEY = "v2-announcement-dismissed"

export default function TopBlinksMarquee() {
  const pathname = usePathname()
  const [isDismissed, setIsDismissed] = useState(true) // Start as dismissed to prevent flash

  // Hide on checkout page
  const isCheckoutPage = pathname?.startsWith('/checkout')

  useEffect(() => {
    // Check if announcement was dismissed
    const dismissed = localStorage.getItem(STORAGE_KEY)
    setIsDismissed(dismissed === "true")
  }, [])

  const handleDismiss = () => {
    localStorage.setItem(STORAGE_KEY, "true")
    setIsDismissed(true)
  }

  // Don't render if dismissed or on checkout page
  if (isDismissed || isCheckoutPage) {
    return null
  }

  return (
    <div className="relative w-full bg-gradient-to-r from-neon-blue-dark/30 via-neon-blue-light/20 to-neon-blue-dark/30 border-b border-neon-blue-light/40 overflow-hidden">
      <Link
        href="/updates"
        className="block relative flex items-center justify-center h-10 sm:h-10 px-4 pr-10 hover:bg-neon-blue-dark/20 transition-colors cursor-pointer"
      >
        <div className="flex items-center gap-2 sm:gap-3 text-xs sm:text-sm font-mono flex-wrap justify-center">
          <span className="text-neon-blue-light text-base sm:text-lg">🚀</span>
          <span className="text-neon-white font-semibold">Now Live:</span>
          <span className="text-neon-blue-light hidden sm:inline">Blink402 v2 with ONCHAIN x402 Integration</span>
          <span className="text-neon-blue-light sm:hidden">Blink402 v2</span>
          <span className="text-neon-grey hidden sm:inline">•</span>
          <span className="text-neon-white hidden sm:inline">Sub-second settlements</span>
        </div>
      </Link>

      {/* Close Button */}
      <button
        onClick={handleDismiss}
        className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-neon-grey hover:text-neon-white transition-colors z-10 bg-neon-dark/80 backdrop-blur-sm rounded"
        aria-label="Dismiss announcement banner"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  )
}
