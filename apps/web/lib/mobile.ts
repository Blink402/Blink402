/**
 * Mobile device detection utilities
 * Used to provide mobile-specific wallet connection UX
 */

// Type declarations for wallet browser extensions
declare global {
  interface Window {
    phantom?: {
      solana?: any
    }
    solflare?: {
      isSolflare?: boolean
    }
  }
}

/**
 * Detect if the user is on a mobile device
 * Checks user agent and touch capability
 */
export function isMobileDevice(): boolean {
  if (typeof window === 'undefined') return false

  // Check user agent for mobile keywords
  const userAgent = navigator.userAgent.toLowerCase()
  const mobileKeywords = [
    'android',
    'webos',
    'iphone',
    'ipad',
    'ipod',
    'blackberry',
    'windows phone',
    'mobile',
  ]

  const isMobileUA = mobileKeywords.some(keyword => userAgent.includes(keyword))

  // Also check for touch capability (tablets, etc.)
  const isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0

  // Check screen size (mobile typically < 768px)
  const isSmallScreen = window.innerWidth < 768

  // Device is mobile if it has mobile UA OR (touch + small screen)
  return isMobileUA || (isTouchDevice && isSmallScreen)
}

/**
 * Detect if the user is on an Android device
 */
export function isAndroid(): boolean {
  if (typeof window === 'undefined') return false
  return /android/i.test(navigator.userAgent)
}

/**
 * Detect if the user is on an iOS device (iPhone, iPad, iPod)
 */
export function isIOS(): boolean {
  if (typeof window === 'undefined') return false
  return /iphone|ipad|ipod/i.test(navigator.userAgent)
}

/**
 * Detect if the user is on a tablet (iPad, Android tablet)
 */
export function isTablet(): boolean {
  if (typeof window === 'undefined') return false

  const userAgent = navigator.userAgent.toLowerCase()

  // Check for iPad
  if (/ipad/.test(userAgent)) return true

  // Check for Android tablet (has 'android' but not 'mobile')
  if (/android/.test(userAgent) && !/mobile/.test(userAgent)) return true

  // Check for large touch screen (tablets typically > 768px)
  const isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0
  const isLargeScreen = window.innerWidth >= 768 && window.innerWidth < 1024

  return isTouchDevice && isLargeScreen
}

/**
 * Check if we should use wallet deeplinks instead of browser extension
 * Returns true on mobile browsers where wallet extensions aren't available
 */
export function shouldUseDeeplink(): boolean {
  if (typeof window === 'undefined') return false

  // Always use deeplinks on mobile
  if (isMobileDevice()) return true

  // Check if wallet adapter is available in browser
  // If window.solana exists, browser extension is available
  const hasWalletExtension = typeof window !== 'undefined' && 'solana' in window

  // Use deeplink if no extension is detected
  return !hasWalletExtension
}

/**
 * Get the appropriate Phantom deeplink for the current platform
 * @param dappUrl - The URL of your dapp (e.g., https://your-app.com)
 * @param referrer - Optional referrer URL
 * @returns Phantom Browse deeplink URL
 */
export function getPhantomBrowseDeeplink(dappUrl: string, referrer?: string): string {
  const encodedUrl = encodeURIComponent(dappUrl)
  const encodedReferrer = referrer ? encodeURIComponent(referrer) : encodedUrl

  // Phantom Browse deeplink format
  // This opens your dapp inside Phantom's in-app browser
  return `https://phantom.app/ul/browse/${encodedUrl}?ref=${encodedReferrer}`
}

/**
 * Get the appropriate Solflare deeplink for the current platform
 * @param dappUrl - The URL of your dapp
 * @returns Solflare deeplink URL
 */
export function getSolflareDeeplink(dappUrl: string): string {
  const encodedUrl = encodeURIComponent(dappUrl)

  // Solflare uses a different deeplink format
  return `https://solflare.com/ul/v1/browse/${encodedUrl}`
}

/**
 * Detect which mobile wallet app is installed (if any)
 * This is a best-effort detection - not always accurate
 */
export function getInstalledMobileWallet(): 'phantom' | 'solflare' | 'unknown' {
  if (typeof window === 'undefined') return 'unknown'

  // Check if Phantom mobile is detected via wallet adapter
  if ('phantom' in window && window.phantom?.solana) {
    return 'phantom'
  }

  // Check if Solflare mobile is detected
  if ('solflare' in window && window.solflare?.isSolflare) {
    return 'solflare'
  }

  // Can't reliably detect which wallet is installed on mobile
  // User will need to choose
  return 'unknown'
}

/**
 * Get user-friendly device description for logging/debugging
 */
export function getDeviceInfo(): {
  isMobile: boolean
  isAndroid: boolean
  isIOS: boolean
  isTablet: boolean
  shouldUseDeeplink: boolean
  installedWallet: string
  userAgent: string
} {
  return {
    isMobile: isMobileDevice(),
    isAndroid: isAndroid(),
    isIOS: isIOS(),
    isTablet: isTablet(),
    shouldUseDeeplink: shouldUseDeeplink(),
    installedWallet: getInstalledMobileWallet(),
    userAgent: typeof window !== 'undefined' ? navigator.userAgent : 'SSR',
  }
}

/**
 * Open a URL in the appropriate way for mobile vs desktop
 * @param url - The URL to open
 * @param target - Target for window.open (default: '_blank')
 */
export function openUrl(url: string, target: '_blank' | '_self' = '_blank'): void {
  if (typeof window === 'undefined') return

  // On mobile, use window.location for better compatibility
  if (isMobileDevice() && target === '_self') {
    window.location.href = url
  } else {
    // Desktop or _blank target
    window.open(url, target, 'noopener,noreferrer')
  }
}
