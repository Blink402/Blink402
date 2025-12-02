/**
 * Tests for Proxy Constants
 */

import { describe, it, expect } from 'vitest'
import {
  MAX_RESPONSE_SIZE,
  UPSTREAM_TIMEOUT,
  BLINK_CACHE_TTL,
  RATE_LIMIT_WINDOW_SECONDS,
  RATE_LIMIT_MAX_REQUESTS,
  RATE_LIMIT_REWARD_MAX,
  PAYAI_FACILITATOR_URL,
  getPayAINetwork,
  getTreasuryWallet
} from '../proxy-constants.js'

describe('Proxy Constants', () => {
  it('should export response size limit', () => {
    expect(MAX_RESPONSE_SIZE).toBe(10 * 1024 * 1024) // 10MB
    expect(typeof MAX_RESPONSE_SIZE).toBe('number')
  })

  it('should export upstream timeout', () => {
    expect(UPSTREAM_TIMEOUT).toBe(30000) // 30 seconds
    expect(typeof UPSTREAM_TIMEOUT).toBe('number')
  })

  it('should export blink cache TTL', () => {
    expect(BLINK_CACHE_TTL).toBe(300) // 5 minutes
    expect(typeof BLINK_CACHE_TTL).toBe('number')
  })

  it('should export rate limit configuration', () => {
    expect(RATE_LIMIT_WINDOW_SECONDS).toBe(3600) // 1 hour
    expect(RATE_LIMIT_MAX_REQUESTS).toBe(10)
    expect(RATE_LIMIT_REWARD_MAX).toBe(5)
  })

  it('should export PayAI facilitator URL', () => {
    expect(PAYAI_FACILITATOR_URL).toBe('https://facilitator.payai.network')
    expect(typeof PAYAI_FACILITATOR_URL).toBe('string')
  })

  describe('getPayAINetwork', () => {
    it('should return correct network based on environment', () => {
      const network = getPayAINetwork()
      expect(network).toMatch(/^(solana|solana-devnet)$/)
    })

    it('should default to mainnet when SOLANA_NETWORK is not devnet', () => {
      const originalEnv = process.env.SOLANA_NETWORK
      process.env.SOLANA_NETWORK = 'mainnet-beta'

      expect(getPayAINetwork()).toBe('solana')

      process.env.SOLANA_NETWORK = originalEnv
    })
  })

  describe('getTreasuryWallet', () => {
    it('should return treasury wallet from environment', () => {
      const wallet = getTreasuryWallet()
      expect(typeof wallet).toBe('string')
    })
  })
})
