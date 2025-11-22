import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import Fastify, { FastifyInstance } from 'fastify'
import { healthRoutes } from '../routes/health.js'

describe('Health Endpoints', () => {
  let app: FastifyInstance

  beforeAll(async () => {
    app = Fastify({ logger: false })
    await app.register(healthRoutes, { prefix: '/health' })
    await app.ready()
  })

  afterAll(async () => {
    await app.close()
  })

  describe('GET /health', () => {
    it('should return healthy status', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/health',
      })

      expect(response.statusCode).toBe(200)
      const body = JSON.parse(response.body)
      expect(body.status).toBe('healthy')
      expect(body.timestamp).toBeDefined()
      expect(body.uptime).toBeGreaterThanOrEqual(0)
    })

    it('should have correct response structure', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/health',
      })

      const body = JSON.parse(response.body)
      expect(body).toHaveProperty('status')
      expect(body).toHaveProperty('timestamp')
      expect(body).toHaveProperty('uptime')
    })
  })

  describe('GET /health/detailed', () => {
    it('should return detailed health status', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/health/detailed',
      })

      expect(response.statusCode).toBe(200)
      const body = JSON.parse(response.body)
      expect(body.status).toBeDefined()
      expect(['healthy', 'degraded']).toContain(body.status)
    })

    it('should include database status', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/health/detailed',
      })

      const body = JSON.parse(response.body)
      expect(body.database).toBeDefined()
      expect(body.database).toHaveProperty('connected')
    })

    it('should include memory information', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/health/detailed',
      })

      const body = JSON.parse(response.body)
      expect(body.memory).toBeDefined()
      expect(body.memory).toHaveProperty('used')
      expect(body.memory).toHaveProperty('total')
      expect(body.memory.used).toBeGreaterThan(0)
    })
  })
})
