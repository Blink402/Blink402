// UUID v4 generator with crypto.randomUUID polyfill for older browsers
// Falls back to Math.random() if crypto is not available

import { logger } from './logger'

export function generateUUID(): string {
  // Use native crypto.randomUUID if available (modern browsers)
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }

  // Use crypto.getRandomValues if available (older browsers with crypto)
  if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
    return generateUUIDWithCrypto()
  }

  // Fallback to Math.random (less secure, but works everywhere)
  logger.debug('Using Math.random() for UUID generation. Not cryptographically secure.')
  return generateUUIDWithMath()
}

function generateUUIDWithCrypto(): string {
  const bytes = new Uint8Array(16)
  crypto.getRandomValues(bytes)

  // Set version (4) and variant bits
  bytes[6] = (bytes[6] & 0x0f) | 0x40
  bytes[8] = (bytes[8] & 0x3f) | 0x80

  const hex = Array.from(bytes)
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')

  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
}

function generateUUIDWithMath(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0
    const v = c === 'x' ? r : (r & 0x3) | 0x8
    return v.toString(16)
  })
}
