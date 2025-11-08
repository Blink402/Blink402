import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import Fastify, { FastifyInstance } from 'fastify'

describe('Root Endpoint', () => {
  let app: FastifyInstance

  beforeAll(async () => {
    app = Fastify({ logger: false })

    // Register root route
    app.get('/', async () => {
      return {
        name: 'Blink402 API',
        version: '0.1.0',
        status: 'running',
      }
    })

    await app.ready()
  })

  afterAll(async () => {
    await app.close()
  })

  describe('GET /', () => {
    it('should return API information', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/',
      })

      expect(response.statusCode).toBe(200)
      const body = JSON.parse(response.body)
      expect(body.name).toBe('Blink402 API')
      expect(body.version).toBe('0.1.0')
      expect(body.status).toBe('running')
    })

    it('should have correct content type', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/',
      })

      expect(response.headers['content-type']).toContain('application/json')
    })
  })
})
