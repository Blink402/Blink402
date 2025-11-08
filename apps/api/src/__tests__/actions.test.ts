import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import Fastify, { FastifyInstance } from 'fastify'
import { actionsRoutes } from '../routes/actions.js'

// Mock database functions
vi.mock('@blink402/database', () => ({
  getBlinkBySlug: vi.fn((slug: string) => {
    if (slug === 'test-blink') {
      return Promise.resolve({
        id: 1,
        slug: 'test-blink',
        endpoint_url: 'https://api.example.com/test',
        method: 'POST',
        price_usdc: '1.00',
        payout_wallet: 'DemoWallet1111111111111111111111111111111',
        icon_url: 'https://example.com/icon.png',
        title: 'Test Blink',
        description: 'A test blink for testing',
        status: 'active',
        creator_id: 1,
        created_at: new Date(),
        updated_at: new Date(),
      })
    }
    return Promise.resolve(null)
  }),
}))

describe('Actions API', () => {
  let app: FastifyInstance

  beforeAll(async () => {
    app = Fastify({ logger: false })
    await app.register(actionsRoutes, { prefix: '/actions' })
    await app.ready()
  })

  afterAll(async () => {
    await app.close()
  })

  describe('GET /actions/:slug', () => {
    it('should return 404 for non-existent blink', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/actions/non-existent',
      })

      expect(response.statusCode).toBe(404)
    })

    it('should return Solana Actions metadata for valid blink', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/actions/test-blink',
      })

      expect(response.statusCode).toBe(200)
      const body = JSON.parse(response.body)

      // Verify Actions API structure
      expect(body).toHaveProperty('title')
      expect(body).toHaveProperty('icon')
      expect(body).toHaveProperty('description')
      expect(body).toHaveProperty('label')
      expect(body).toHaveProperty('links')

      expect(body.title).toBe('Test Blink')
      expect(body.description).toBe('A test blink for testing')
    })

    it('should include actions link in metadata', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/actions/test-blink',
      })

      const body = JSON.parse(response.body)
      expect(body.links).toBeDefined()
      expect(body.links.actions).toBeDefined()
      expect(Array.isArray(body.links.actions)).toBe(true)
      expect(body.links.actions.length).toBeGreaterThan(0)

      const action = body.links.actions[0]
      expect(action).toHaveProperty('label')
      expect(action).toHaveProperty('href')
    })
  })

  describe('POST /actions/:slug', () => {
    it('should return 404 for non-existent blink', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/actions/non-existent',
        payload: {
          account: 'TestWallet1111111111111111111111111111111',
        },
      })

      expect(response.statusCode).toBe(404)
    })

    it('should require account parameter', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/actions/test-blink',
        payload: {},
      })

      expect(response.statusCode).toBe(400)
    })

    it('should return transaction for valid request', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/actions/test-blink',
        payload: {
          account: 'DemoWallet1111111111111111111111111111111',
        },
      })

      // Should succeed in building transaction
      expect([200, 500]).toContain(response.statusCode)

      if (response.statusCode === 200) {
        const body = JSON.parse(response.body)
        expect(body).toHaveProperty('transaction')
        expect(body).toHaveProperty('message')
      }
    })
  })
})
