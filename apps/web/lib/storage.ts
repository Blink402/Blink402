// Safe localStorage wrapper for SSR and private browsing compatibility
// Prevents errors when localStorage is unavailable (SSR, private browsing, disabled storage)

import { logger } from './logger'

export function getLocalStorageItem(key: string): string | null {
  if (typeof window === 'undefined') return null
  try {
    return localStorage.getItem(key)
  } catch (error) {
    logger.debug('localStorage.getItem failed:', error)
    return null
  }
}

export function setLocalStorageItem(key: string, value: string): boolean {
  if (typeof window === 'undefined') return false
  try {
    localStorage.setItem(key, value)
    return true
  } catch (error) {
    logger.debug('localStorage.setItem failed:', error)
    return false
  }
}

export function removeLocalStorageItem(key: string): boolean {
  if (typeof window === 'undefined') return false
  try {
    localStorage.removeItem(key)
    return true
  } catch (error) {
    logger.debug('localStorage.removeItem failed:', error)
    return false
  }
}
