/**
 * Environment-aware logger for shared packages
 *
 * This logger works in both Node.js and browser environments.
 * It respects LOG_LEVEL environment variable and is silent in production by default.
 */

type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'silent'

const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
  silent: 4,
}

class Logger {
  private level: LogLevel
  private packageName: string

  constructor(packageName: string = 'unknown') {
    this.packageName = packageName

    // Determine log level from environment
    const envLevel = (
      typeof process !== 'undefined'
        ? process.env?.LOG_LEVEL || process.env?.NODE_ENV
        : 'production'
    ) as string

    // Default levels based on environment
    if (envLevel === 'production') {
      this.level = 'error' // Only errors in production
    } else if (envLevel === 'test') {
      this.level = 'silent' // Silent during tests
    } else {
      this.level = 'info' // Info and above in development
    }

    // Allow explicit log level override
    if (LOG_LEVELS[envLevel as LogLevel] !== undefined) {
      this.level = envLevel as LogLevel
    }
  }

  private shouldLog(level: LogLevel): boolean {
    return LOG_LEVELS[level] >= LOG_LEVELS[this.level]
  }

  private formatMessage(level: string, message: string, meta?: Record<string, unknown>): string {
    const timestamp = new Date().toISOString()
    const prefix = `[${timestamp}] [${this.packageName}] ${level.toUpperCase()}`

    if (meta && Object.keys(meta).length > 0) {
      return `${prefix}: ${message} ${JSON.stringify(meta)}`
    }
    return `${prefix}: ${message}`
  }

  debug(message: string, meta?: Record<string, unknown>): void {
    if (this.shouldLog('debug')) {
      console.debug(this.formatMessage('debug', message, meta))
    }
  }

  info(message: string, meta?: Record<string, unknown>): void {
    if (this.shouldLog('info')) {
      console.info(this.formatMessage('info', message, meta))
    }
  }

  warn(message: string, meta?: Record<string, unknown>): void {
    if (this.shouldLog('warn')) {
      console.warn(this.formatMessage('warn', message, meta))
    }
  }

  error(message: string, error?: Error | unknown, meta?: Record<string, unknown>): void {
    if (this.shouldLog('error')) {
      const errorMeta = error instanceof Error
        ? {
            ...meta,
            error: error.message,
            stack: error.stack
          }
        : { ...meta, error: String(error) }

      console.error(this.formatMessage('error', message, errorMeta))
    }
  }

  /**
   * Set the log level dynamically
   */
  setLevel(level: LogLevel): void {
    this.level = level
  }

  /**
   * Get current log level
   */
  getLevel(): LogLevel {
    return this.level
  }
}

/**
 * Create a logger instance for a specific package
 */
export function createLogger(packageName: string): Logger {
  return new Logger(packageName)
}

/**
 * Default logger instance
 */
export const logger = new Logger('blink402')

export type { Logger, LogLevel }
