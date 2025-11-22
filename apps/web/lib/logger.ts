/**
 * Production-safe logging utility
 * Only logs in development or when explicitly enabled
 */

const isProduction = process.env.NODE_ENV === 'production'
const isClient = typeof window !== 'undefined'

// Only log in development or when debug is explicitly enabled
const shouldLog = !isProduction || process.env.NEXT_PUBLIC_DEBUG === 'true'

export const logger = {
  /**
   * Debug logs - only in development
   */
  debug: (...args: any[]) => {
    if (shouldLog) {
      console.log('[DEBUG]', ...args)
    }
  },

  /**
   * Info logs - only in development
   */
  info: (...args: any[]) => {
    if (shouldLog) {
      console.info('[INFO]', ...args)
    }
  },

  /**
   * Warning logs - always shown but with context
   */
  warn: (...args: any[]) => {
    if (isProduction) {
      // In production, only log critical warnings
      if (args.some(arg => 
        typeof arg === 'string' && (
          arg.includes('localStorage') || 
          arg.includes('crypto') ||
          arg.includes('wallet')
        )
      )) {
        console.warn('[WARN]', ...args)
      }
    } else {
      console.warn('[WARN]', ...args)
    }
  },

  /**
   * Error logs - always shown for debugging
   */
  error: (...args: any[]) => {
    console.error('[ERROR]', ...args)
  },

  /**
   * Success logs - only in development
   */
  success: (...args: any[]) => {
    if (shouldLog) {
      console.log('[SUCCESS]', ...args)
    }
  }
}

/**
 * Performance logging - only in development
 */
export const perfLogger = {
  time: (label: string) => {
    if (shouldLog && isClient) {
      console.time(`[PERF] ${label}`)
    }
  },

  timeEnd: (label: string) => {
    if (shouldLog && isClient) {
      console.timeEnd(`[PERF] ${label}`)
    }
  }
}