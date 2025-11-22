'use client'

import { useState, useEffect } from 'react'
import { X } from 'lucide-react'
import { getLocalStorageItem, setLocalStorageItem } from '@/lib/storage'

export function PromoBanner() {
  const [isVisible, setIsVisible] = useState(false)

  useEffect(() => {
    // Check if banner was previously dismissed
    const dismissed = getLocalStorageItem('promo-banner-dismissed')
    if (!dismissed) {
      setIsVisible(true)
    }
  }, [])

  const handleDismiss = () => {
    setIsVisible(false)
    setLocalStorageItem('promo-banner-dismissed', 'true')
  }

  if (!isVisible) return null

  return (
    <div className="relative bg-neon-dark border-b border-neon-grey/20">
      <a
        href="/updates"
        className="block px-4 py-2 hover:bg-neon-dark/80 transition-colors"
      >
        <div className="flex items-center justify-center gap-2 text-sm font-mono">
          <span className="text-neon-blue-light font-medium">NOW LIVE</span>
          <span className="text-neon-white">Major platform updates: PayAI x402, Privy, Telegram Bot & More</span>
          <span className="text-neon-blue-light">→</span>
        </div>
      </a>

      <button
        onClick={handleDismiss}
        className="absolute right-2 top-1/2 -translate-y-1/2 p-2 min-w-11 min-h-11 flex items-center justify-center hover:bg-neon-black/50 rounded transition-colors z-10"
        aria-label="Dismiss banner"
      >
        <X size={16} className="text-neon-grey hover:text-neon-white" />
      </button>
    </div>
  )
}
