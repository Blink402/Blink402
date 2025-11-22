/**
 * Referral Tracking Utility
 * Handles URL parameter capture, localStorage storage, and API tracking for referral codes
 */

const REFERRAL_CODE_KEY = 'blink402_ref_code'
const REFERRAL_EXPIRY_KEY = 'blink402_ref_expiry'
const REFERRAL_EXPIRY_DAYS = 30 // Referral attribution window

/**
 * Extract referral code from URL parameters
 * Checks both ?ref=CODE and ?referral=CODE
 */
export function extractReferralCode(): string | null {
  if (typeof window === 'undefined') return null

  const urlParams = new URLSearchParams(window.location.search)
  return urlParams.get('ref') || urlParams.get('referral')
}

/**
 * Store referral code in localStorage with expiry
 */
export function storeReferralCode(code: string): void {
  if (typeof window === 'undefined' || !code) return

  try {
    const expiryDate = new Date()
    expiryDate.setDate(expiryDate.getDate() + REFERRAL_EXPIRY_DAYS)

    localStorage.setItem(REFERRAL_CODE_KEY, code)
    localStorage.setItem(REFERRAL_EXPIRY_KEY, expiryDate.toISOString())

    console.log('[Referral] Stored referral code:', code, 'Expires:', expiryDate.toISOString())
  } catch (error) {
    console.error('[Referral] Failed to store referral code:', error)
  }
}

/**
 * Retrieve stored referral code (if not expired)
 * Returns null if expired or not found
 */
export function getStoredReferralCode(): string | null {
  if (typeof window === 'undefined') return null

  try {
    const code = localStorage.getItem(REFERRAL_CODE_KEY)
    const expiryString = localStorage.getItem(REFERRAL_EXPIRY_KEY)

    if (!code || !expiryString) return null

    const expiry = new Date(expiryString)
    const now = new Date()

    if (now > expiry) {
      // Expired - clear storage
      clearReferralCode()
      console.log('[Referral] Referral code expired, cleared from storage')
      return null
    }

    return code
  } catch (error) {
    console.error('[Referral] Failed to retrieve referral code:', error)
    return null
  }
}

/**
 * Clear stored referral code
 */
export function clearReferralCode(): void {
  if (typeof window === 'undefined') return

  try {
    localStorage.removeItem(REFERRAL_CODE_KEY)
    localStorage.removeItem(REFERRAL_EXPIRY_KEY)
    console.log('[Referral] Cleared referral code from storage')
  } catch (error) {
    console.error('[Referral] Failed to clear referral code:', error)
  }
}

/**
 * Track referral attribution with backend API
 * Should be called after wallet connection when user makes first payment
 */
export async function trackReferral(params: {
  code: string
  wallet: string
}): Promise<{ success: boolean; message?: string }> {
  const { code, wallet } = params

  if (!code || !wallet) {
    return { success: false, message: 'Missing code or wallet' }
  }

  try {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'
    const response = await fetch(`${apiUrl}/referrals/track`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ code, wallet }),
    })

    const data = await response.json()

    if (response.ok && data.success) {
      console.log('[Referral] Successfully tracked referral:', { code, wallet })
      return { success: true }
    } else {
      console.warn('[Referral] Failed to track referral:', data)
      return { success: false, message: data.error || 'Failed to track referral' }
    }
  } catch (error) {
    console.error('[Referral] API error while tracking referral:', error)
    return { success: false, message: 'Network error' }
  }
}

/**
 * Initialize referral tracking on page load
 * Extracts code from URL and stores it if present
 * Returns the active referral code (from URL or storage)
 */
export function initReferralTracking(): string | null {
  // Check URL first
  const urlCode = extractReferralCode()

  if (urlCode) {
    // New referral code from URL - store it
    storeReferralCode(urlCode)
    return urlCode
  }

  // No URL code - check storage
  return getStoredReferralCode()
}

/**
 * Check if user has an active referral attribution
 */
export function hasActiveReferral(): boolean {
  return getStoredReferralCode() !== null
}

/**
 * Get referral info for display
 */
export function getReferralInfo(): {
  code: string | null
  expiresAt: Date | null
  daysRemaining: number | null
} {
  if (typeof window === 'undefined') {
    return { code: null, expiresAt: null, daysRemaining: null }
  }

  const code = getStoredReferralCode()
  if (!code) {
    return { code: null, expiresAt: null, daysRemaining: null }
  }

  const expiryString = localStorage.getItem(REFERRAL_EXPIRY_KEY)
  if (!expiryString) {
    return { code, expiresAt: null, daysRemaining: null }
  }

  const expiresAt = new Date(expiryString)
  const now = new Date()
  const daysRemaining = Math.ceil((expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))

  return { code, expiresAt, daysRemaining }
}

/**
 * Hook for React components
 * Usage: const { code, track } = useReferralTracking()
 */
export function useReferralTracking() {
  if (typeof window === 'undefined') {
    return {
      code: null,
      hasReferral: false,
      track: async () => ({ success: false }),
      clear: () => {},
      info: { code: null, expiresAt: null, daysRemaining: null }
    }
  }

  const code = initReferralTracking()
  const hasReferral = hasActiveReferral()
  const info = getReferralInfo()

  return {
    code,
    hasReferral,
    track: trackReferral,
    clear: clearReferralCode,
    info
  }
}
