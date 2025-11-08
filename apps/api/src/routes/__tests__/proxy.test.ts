import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest'
import Fastify, { FastifyInstance } from 'fastify'
import { proxyRoutes } from '../proxy'
import {
  getBlinkBySlug,
  createBlink,
  createRun,
  getOrCreateCreator,
  getRunByReference,
  closePool,
} from '@blink402/database'
import { generateReference } from '@blink402/solana'

describe('x402 Proxy Payment Flow', () => {
  let app: FastifyInstance
  let testBlinkSlug: string
  let testCreatorId: string
  let testBlinkId: string

  beforeAll(async () => {
    // Create Fastify app with proxy routes
    app = Fastify({ logger: false })
    await app.register(proxyRoutes, { prefix: '/bazaar' })

    // Create test creator and blink
    // Valid 44-character Solana wallet addresses for testing
    testCreatorId = await getOrCreateCreator('Test1Creator1Wallet11111111111111111111111111')
    const blinkData = await createBlink({
      slug: `test-proxy-${Date.now()}`,
      title: 'Test Proxy Blink',
      description: 'Test blink for payment flow',
      endpoint_url: 'https://httpbin.org/post', // Echo service for testing
      method: 'POST',
      price_usdc: '0.01',
      category: 'test',
      icon_url: 'https://example.com/icon.png',
      payout_wallet: 'Test1Payout1Wallet11111111111111111111111111',
      creator_wallet: 'Test1Creator1Wallet1111111111111111111111111',
    })

    testBlinkSlug = blinkData.slug
    testBlinkId = blinkData.id
  })

  afterAll(async () => {
    await app.close()
    await closePool()
  })

  describe('402 Payment Required', () => {
    it('should return 402 when no reference provided', async () => {
      const response = await app.inject({
        method: 'POST',
        url: `/bazaar/${testBlinkSlug}`,
        payload: { data: { test: 'value' } },
      })

      expect(response.statusCode).toBe(402)
      const body = JSON.parse(response.body)
      expect(body.status).toBe(402)
      expect(body.message).toBe('Payment Required')
      expect(body.price).toBe('0.01')
      expect(body.currency).toBeDefined()
      expect(body.recipient).toBe('Test1Payout1Wallet11111111111111111111111111')
      expect(body.action_url).toContain('/actions/')
      expect(body.expires_at).toBeGreaterThan(Math.floor(Date.now() / 1000))
    })

    it('should return 404 for non-existent blink', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/bazaar/non-existent-slug',
        payload: {},
      })

      expect(response.statusCode).toBe(404)
      const body = JSON.parse(response.body)
      expect(body.error).toBe('Blink not found')
    })
  })

  describe('Reference Validation', () => {
    it('should return 400 for invalid reference', async () => {
      const response = await app.inject({
        method: 'POST',
        url: `/bazaar/${testBlinkSlug}`,
        payload: {
          reference: 'InvalidReferenceKey11111111111111111111',
          signature: 'MockSignature',
        },
      })

      expect(response.statusCode).toBe(400)
      const body = JSON.parse(response.body)
      expect(body.error).toContain('Invalid reference')
    })

    it('should return error for expired reference', async () => {
      // Create a run with an expired timestamp (by manipulating created_at in DB)
      const reference = generateReference().toBase58()

      // Create run normally
      await createRun({
        blinkId: testBlinkId,
        reference,
      })

      // Manually expire it by setting expires_at to the past
      const { getPool } = await import('@blink402/database')
      await getPool().query(
        `UPDATE runs SET expires_at = NOW() - INTERVAL '1 hour' WHERE reference = $1`,
        [reference]
      )

      const response = await app.inject({
        method: 'POST',
        url: `/bazaar/${testBlinkSlug}`,
        payload: {
          reference,
          signature: 'MockSignature',
        },
      })

      // Should fail because reference is expired (marked as 'failed' by getRunByReference)
      expect(response.statusCode).toBe(402)
    })
  })

  describe('Payment Verification (Mock Mode)', () => {
    it('should verify payment and execute upstream API in mock mode', async () => {
      // Create a valid pending run
      const reference = generateReference().toBase58()
      await createRun({
        blinkId: testBlinkId,
        reference,
      })

      // Mock signature
      const mockSignature = `MOCK_${reference.slice(0, 44)}_VERIFIED`

      const response = await app.inject({
        method: 'POST',
        url: `/bazaar/${testBlinkSlug}`,
        payload: {
          reference,
          signature: mockSignature,
          data: { test: 'payment verified' },
        },
      })

      expect(response.statusCode).toBe(200)
      const body = JSON.parse(response.body)
      expect(body.success).toBe(true)
      expect(body.reference).toBe(reference)
      expect(body.signature).toBe(mockSignature)
      expect(body.duration_ms).toBeGreaterThan(0)

      // Verify run is marked as executed
      const run = await getRunByReference(reference)
      expect(run?.status).toBe('executed')
      expect(run?.signature).toBe(mockSignature)
    })

    it('should handle payment verification failure gracefully', async () => {
      // Create a valid pending run
      const reference = generateReference().toBase58()
      await createRun({
        blinkId: testBlinkId,
        reference,
      })

      // Invalid signature that will fail verification (not in MOCK format)
      const invalidSignature = 'InvalidSignatureFormat'

      const response = await app.inject({
        method: 'POST',
        url: `/bazaar/${testBlinkSlug}`,
        payload: {
          reference,
          signature: invalidSignature,
        },
      })

      // Should return 402 for payment verification failure
      expect(response.statusCode).toBe(402)
      const body = JSON.parse(response.body)
      expect(body.error).toContain('verification failed')

      // Verify run is marked as failed
      const run = await getRunByReference(reference)
      expect(run?.status).toBe('failed')
    })
  })

  describe('Idempotency', () => {
    it('should return cached result for already executed run', async () => {
      // Create a run and execute it
      const reference = generateReference().toBase58()
      await createRun({
        blinkId: testBlinkId,
        reference,
      })

      const mockSignature = `MOCK_${reference.slice(0, 44)}_VERIFIED`

      // First request - should execute normally
      const firstResponse = await app.inject({
        method: 'POST',
        url: `/bazaar/${testBlinkSlug}`,
        payload: {
          reference,
          signature: mockSignature,
          data: { test: 'first call' },
        },
      })

      expect(firstResponse.statusCode).toBe(200)

      // Second request with same reference - should return cached (idempotent)
      const secondResponse = await app.inject({
        method: 'POST',
        url: `/bazaar/${testBlinkSlug}`,
        payload: {
          reference,
          signature: mockSignature,
          data: { test: 'second call' },
        },
      })

      expect(secondResponse.statusCode).toBe(200)
      const body = JSON.parse(secondResponse.body)
      expect(body.message).toContain('Already executed')
      expect(body.cached).toBe(true)
      expect(body.reference).toBe(reference)
      expect(body.signature).toBe(mockSignature)
    })

    it('should not allow reuse of reference for different blink', async () => {
      // Create another test blink
      const secondBlinkData = await createBlink({
        slug: `test-proxy-2-${Date.now()}`,
        title: 'Second Test Blink',
        description: 'Second test blink',
        endpoint_url: 'https://httpbin.org/post',
        method: 'POST',
        price_usdc: '0.02',
        category: 'test',
        icon_url: 'https://example.com/icon2.png',
        payout_wallet: 'Test2Payout1Wallet11111111111111111111111111',
        creator_wallet: 'Test1Creator1Wallet1111111111111111111111111',
      })

      // Create run for first blink
      const reference = generateReference().toBase58()
      await createRun({
        blinkId: testBlinkId,
        reference,
      })

      // Try to use same reference for second blink (different blink_id)
      // This should fail because the reference is tied to the first blink
      const mockSignature = `MOCK_${reference.slice(0, 44)}_VERIFIED`

      const response = await app.inject({
        method: 'POST',
        url: `/bazaar/${secondBlinkData.slug}`,
        payload: {
          reference,
          signature: mockSignature,
        },
      })

      // Should return 400 because reference doesn't match the blink
      expect(response.statusCode).toBe(400)
    })
  })

  describe('Upstream API Execution', () => {
    it('should pass reference and signature to upstream API', async () => {
      const reference = generateReference().toBase58()
      await createRun({
        blinkId: testBlinkId,
        reference,
      })

      const mockSignature = `MOCK_${reference.slice(0, 44)}_VERIFIED`

      const response = await app.inject({
        method: 'POST',
        url: `/bazaar/${testBlinkSlug}`,
        payload: {
          reference,
          signature: mockSignature,
          data: { custom: 'data' },
        },
      })

      expect(response.statusCode).toBe(200)
      const body = JSON.parse(response.body)

      // httpbin.org/post echoes back the request
      // The upstream API should receive reference, signature, and custom data
      expect(body.success).toBe(true)
      expect(body.data).toBeDefined()
    })

    it('should handle upstream API timeout gracefully', async () => {
      // Create a blink with a slow endpoint
      const slowBlinkData = await createBlink({
        slug: `test-slow-${Date.now()}`,
        title: 'Slow Endpoint Test',
        description: 'Test timeout handling',
        endpoint_url: 'https://httpbin.org/delay/35', // 35 second delay (exceeds 30s timeout)
        method: 'GET',
        price_usdc: '0.01',
        category: 'test',
        icon_url: 'https://example.com/icon.png',
        payout_wallet: 'Test1Payout1Wallet11111111111111111111111111',
        creator_wallet: 'Test1Creator1Wallet1111111111111111111111111',
      })

      const reference = generateReference().toBase58()
      await createRun({
        blinkId: slowBlinkData.id,
        reference,
      })

      const mockSignature = `MOCK_${reference.slice(0, 44)}_VERIFIED`

      const response = await app.inject({
        method: 'POST',
        url: `/bazaar/${slowBlinkData.slug}`,
        payload: {
          reference,
          signature: mockSignature,
        },
      })

      // Should return 500 for upstream timeout
      expect(response.statusCode).toBe(500)
      const body = JSON.parse(response.body)
      expect(body.error).toBe('API execution failed')

      // Run should be marked as failed
      const run = await getRunByReference(reference)
      expect(run?.status).toBe('failed')
    }, 40000) // Increase test timeout to 40 seconds
  })

  describe('Blink Status', () => {
    it('should return 403 for paused blink', async () => {
      // Create a paused blink
      const pausedBlinkData = await createBlink({
        slug: `test-paused-${Date.now()}`,
        title: 'Paused Blink',
        description: 'Test paused status',
        endpoint_url: 'https://httpbin.org/post',
        method: 'POST',
        price_usdc: '0.01',
        category: 'test',
        icon_url: 'https://example.com/icon.png',
        payout_wallet: 'Test1Payout1Wallet11111111111111111111111111',
        creator_wallet: 'Test1Creator1Wallet1111111111111111111111111',
      })

      // Manually set status to paused
      const { getPool } = await import('@blink402/database')
      await getPool().query(
        `UPDATE blinks SET status = 'paused' WHERE id = $1`,
        [pausedBlinkData.id]
      )

      const response = await app.inject({
        method: 'POST',
        url: `/bazaar/${pausedBlinkData.slug}`,
        payload: {},
      })

      expect(response.statusCode).toBe(403)
      const body = JSON.parse(response.body)
      expect(body.error).toContain('not active')
    })
  })
})
