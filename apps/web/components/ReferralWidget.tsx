'use client'

import { useEffect, useState } from 'react'
import { Gift, X } from 'lucide-react'
import { initReferralTracking, getReferralInfo } from '@/lib/referral-tracking'

/**
 * Referral Widget - Shows banner when user has active referral attribution
 * Displays in bottom-right corner of screen
 */
export function ReferralWidget() {
  const [visible, setVisible] = useState(false)
  const [referralInfo, setReferralInfo] = useState<{
    code: string | null
    daysRemaining: number | null
  }>({ code: null, daysRemaining: null })

  useEffect(() => {
    // Initialize tracking and get info
    initReferralTracking()
    const info = getReferralInfo()

    if (info.code && info.daysRemaining) {
      setReferralInfo({
        code: info.code,
        daysRemaining: info.daysRemaining
      })
      setVisible(true)
    }
  }, [])

  if (!visible || !referralInfo.code) {
    return null
  }

  return (
    <div className="fixed bottom-4 right-4 z-50 max-w-sm">
      <div className="bg-gradient-to-r from-[--neon-blue-light] to-[--neon-blue-dark] rounded-lg shadow-lg p-4 border border-[--neon-blue-light]">
        <button
          onClick={() => setVisible(false)}
          className="absolute top-2 right-2 text-white hover:text-gray-300 transition"
          aria-label="Close"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="flex items-start gap-3 pr-6">
          <div className="p-2 bg-white bg-opacity-20 rounded-full">
            <Gift className="w-5 h-5 text-white" />
          </div>
          <div className="flex-1">
            <h3 className="font-medium text-white mb-1">Referral Active! 🎉</h3>
            <p className="text-sm text-white text-opacity-90 mb-2">
              You were referred by code <span className="font-mono font-bold">{referralInfo.code}</span>
            </p>
            <p className="text-xs text-white text-opacity-75">
              Your referrer will earn commission when you make purchases.
              {referralInfo.daysRemaining && ` ${referralInfo.daysRemaining} days remaining.`}
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
