import { FastifyPluginAsync } from 'fastify'
import { randomBytes } from 'crypto'

/**
 * Demo Routes - Free "Try it out!" endpoint
 *
 * Provides a free, no-wallet-required demo of how Blinks work.
 * Uses the Dog Facts API as a sample external API.
 * All operations are ephemeral (no database writes).
 */

// In-memory rate limiting for demo endpoint
const demoRateLimits = new Map<string, { count: number; resetAt: number }>()

function checkDemoRateLimit(ip: string, maxRequests: number = 10, windowMs: number = 60000): boolean {
  const now = Date.now()
  const limit = demoRateLimits.get(ip)

  if (!limit || now > limit.resetAt) {
    demoRateLimits.set(ip, { count: 1, resetAt: now + windowMs })
    return true
  }

  if (limit.count >= maxRequests) {
    return false
  }

  limit.count++
  return true
}

// Cleanup expired rate limit entries every 5 minutes
setInterval(() => {
  const now = Date.now()
  for (const [ip, limit] of demoRateLimits.entries()) {
    if (now > limit.resetAt) {
      demoRateLimits.delete(ip)
    }
  }
}, 5 * 60 * 1000)

/**
 * Fetch a random dog fact from the Dog Facts API
 */
async function fetchDogFact(): Promise<{ fact: string }> {
  try {
    const response = await fetch('https://dogapi.dog/api/v2/facts?limit=1', {
      method: 'GET',
      headers: { 'Accept': 'application/json' },
      signal: AbortSignal.timeout(5000), // 5 second timeout
    })

    if (!response.ok) {
      throw new Error(`Dog API returned ${response.status}`)
    }

    const data = await response.json() as any

    // Dog API returns: { "data": [{ "id": "...", "type": "fact", "attributes": { "body": "..." } }] }
    const fact = data?.data?.[0]?.attributes?.body || 'Dogs are amazing animals!'

    return { fact }
  } catch (error) {
    throw new Error('Failed to fetch dog fact: ' + (error instanceof Error ? error.message : 'Unknown error'))
  }
}

/**
 * Simulate a realistic delay for UX (payment verification would normally take time)
 */
function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

export const demoRoutes: FastifyPluginAsync = async (fastify) => {
  /**
   * POST /demo/dog-facts
   *
   * Free demo endpoint that simulates the full Blink payment flow:
   * 1. Simulates transaction creation
   * 2. Simulates payment verification (with realistic delays)
   * 3. Calls the Dog Facts API
   * 4. Returns the result
   *
   * No wallet required, no real payments, no database writes.
   */
  fastify.post('/dog-facts', async (request, reply) => {
    // Get client IP for rate limiting
    const ip = request.ip || 'unknown'

    // Apply demo-specific rate limiting (10 requests/minute)
    if (!checkDemoRateLimit(ip)) {
      return reply.code(429).send({
        success: false,
        error: 'Demo rate limit exceeded',
        details: 'You can make up to 10 demo requests per minute. Please wait and try again.',
      })
    }

    fastify.log.info({ ip }, 'Demo request received')

    try {
      // Step 1: Generate mock transaction reference
      const mockReference = randomBytes(16).toString('hex')
      const mockSignature = randomBytes(32).toString('hex')

      fastify.log.debug({ mockReference, mockSignature }, 'Generated mock transaction')

      // Step 2: Simulate payment verification delay (realistic UX)
      await delay(800) // 800ms to simulate on-chain verification

      // Step 3: Call the Dog Facts API
      const startTime = Date.now()
      const result = await fetchDogFact()
      const duration = Date.now() - startTime

      fastify.log.info({ duration }, 'Dog fact fetched successfully')

      // Step 4: Return demo response
      return reply.code(200).send({
        success: true,
        demo: true,
        message: 'Demo successful! In production, this would have been a paid request.',
        data: {
          fact: result.fact,
          metadata: {
            reference: mockReference,
            signature: mockSignature,
            duration_ms: duration,
            timestamp: new Date().toISOString(),
          },
        },
      })
    } catch (error) {
      fastify.log.error({ error, ip }, 'Demo request failed')

      return reply.code(500).send({
        success: false,
        demo: true,
        error: 'Demo request failed',
        details: error instanceof Error ? error.message : 'Unknown error',
      })
    }
  })

  /**
   * GET /demo/info
   *
   * Returns information about the demo endpoint
   */
  fastify.get('/info', async (request, reply) => {
    return reply.code(200).send({
      success: true,
      demo: {
        name: 'Dog Facts Demo',
        description: 'Free demo showing how Blinks work - no wallet required!',
        endpoint: '/demo/dog-facts',
        method: 'POST',
        rateLimit: '10 requests per minute',
        upstreamApi: 'https://dogapi.dog/api/v2/facts',
        features: [
          'Mock transaction generation',
          'Simulated payment verification',
          'Real external API call',
          'No database writes',
          'No wallet required',
          'Completely free',
        ],
      },
    })
  })
}
