/**
 * x402 Proxy Route - FIXED VERSION with Redis Distributed Locking
 *
 * This version solves the race condition bug identified in the code review.
 * Multiple concurrent requests with the same reference are now properly handled.
 */

import { FastifyPluginAsync } from 'fastify'
import {
  getBlinkBySlug,
  getRunByReference,
  updateRunPayment,
  markRunExecuted,
  markRunFailed,
} from '@blink402/database'
import {
  getConnection,
  verifyPayment,
  usdcToLamports,
  solToLamports,
  parsePublicKey,
  getUsdcMint,
} from '@blink402/solana'
import {
  withLock,
  getCacheOrFetch,
  deleteCache,
  getIdempotentResponse,
  setIdempotentResponse,
} from '@blink402/redis'

// Constants
const MAX_RESPONSE_SIZE = 10 * 1024 * 1024 // 10MB
const UPSTREAM_TIMEOUT = 30000 // 30 seconds
const BLINK_CACHE_TTL = 300 // 5 minutes

/**
 * Read response with size limit (prevents DoS)
 */
async function readResponseWithLimit(response: Response, maxSize: number): Promise<string> {
  const reader = response.body?.getReader()
  if (!reader) throw new Error('No response body')

  const chunks: Uint8Array[] = []
  let totalSize = 0

  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      totalSize += value.length
      if (totalSize > maxSize) {
        throw new Error(`Response exceeds maximum size of ${maxSize} bytes`)
      }

      chunks.push(value)
    }
  } finally {
    reader.releaseLock()
  }

  const allChunks = new Uint8Array(totalSize)
  let position = 0
  for (const chunk of chunks) {
    allChunks.set(chunk, position)
    position += chunk.length
  }

  return new TextDecoder().decode(allChunks)
}

/**
 * Validate upstream URL to prevent SSRF attacks
 * Implements comprehensive protection against various SSRF bypass techniques
 */
async function validateUpstreamUrl(urlString: string): Promise<void> {
  let url: URL
  try {
    url = new URL(urlString)
  } catch {
    throw new Error('Invalid URL format')
  }

  // Only allow HTTP/HTTPS
  if (!['http:', 'https:'].includes(url.protocol)) {
    throw new Error('Only HTTP/HTTPS protocols allowed')
  }

  const hostname = url.hostname.toLowerCase()

  // Block localhost variations (including IPv6)
  const localhostPatterns = [
    /^localhost$/i,
    /^127\./,  // 127.0.0.0/8
    /^0\.0\.0\.0$/,
    /^::1$/,   // IPv6 localhost
    /^::$/,    // IPv6 any
    /^0:0:0:0:0:0:0:1$/,  // IPv6 localhost expanded
  ]

  for (const pattern of localhostPatterns) {
    if (pattern.test(hostname)) {
      throw new Error('Localhost access not allowed')
    }
  }

  // Block private IP ranges (RFC 1918)
  const privateIpPatterns = [
    /^10\./,                           // 10.0.0.0/8
    /^172\.(1[6-9]|2[0-9]|3[0-1])\./,  // 172.16.0.0/12
    /^192\.168\./,                     // 192.168.0.0/16
    /^169\.254\./,                     // Link-local (169.254.0.0/16)
    /^fc00:/i,                         // IPv6 private (fc00::/7)
    /^fd[0-9a-f]{2}:/i,                // IPv6 ULA
    /^fe80:/i,                         // IPv6 link-local
  ]

  for (const pattern of privateIpPatterns) {
    if (pattern.test(hostname)) {
      throw new Error('Private IP ranges not allowed')
    }
  }

  // Block cloud metadata endpoints
  const metadataPatterns = [
    /metadata\.google\.internal/i,     // Google Cloud
    /169\.254\.169\.254/,              // AWS, Azure, etc.
    /metadata\.azure\./i,               // Azure
    /metadata\.packet\./i,              // Packet/Equinix
    /metadata\.platformequinix\./i,     // Platform Equinix
  ]

  for (const pattern of metadataPatterns) {
    if (pattern.test(hostname)) {
      throw new Error('Cloud metadata endpoints not allowed')
    }
  }

  // Block decimal/octal/hex IP notation
  // e.g., http://2130706433 (127.0.0.1 in decimal)
  if (/^\d+$/.test(hostname)) {
    throw new Error('Decimal IP notation not allowed')
  }

  // Block URLs with credentials (potential for SSRF through auth)
  if (url.username || url.password) {
    throw new Error('URLs with credentials not allowed')
  }

  // Additional validation: ensure hostname has at least one dot (prevents single-word internal hostnames)
  // Exception: allow localhost-style names only if they're not blocked above
  if (!hostname.includes('.') && !hostname.includes(':')) {
    throw new Error('Invalid hostname format')
  }

  // Block common internal TLDs
  const blockedTlds = [
    '.local',
    '.internal',
    '.corp',
    '.home',
    '.lan',
    '.intranet',
  ]

  for (const tld of blockedTlds) {
    if (hostname.endsWith(tld)) {
      throw new Error('Internal TLDs not allowed')
    }
  }
}

export const proxyRoutesWithRedis: FastifyPluginAsync = async (fastify) => {
  // POST /bazaar/:slug - x402 proxy endpoint with Redis locking
  fastify.post<{
    Params: { slug: string }
    Body: { reference?: string; signature?: string; data?: any }
  }>('/:slug', async (request, reply) => {
    const startTime = Date.now()
    const { slug } = request.params

    // Validate request body
    if (!request.body) {
      return reply.code(400).send({ error: 'Request body required' })
    }

    const { reference, signature, data } = request.body

    try {
      // Get blink data (with Redis caching)
      const blink = await getCacheOrFetch(
        `blink:${slug}`,
        () => getBlinkBySlug(slug),
        BLINK_CACHE_TTL
      )

      if (!blink) {
        return reply.code(404).send({ error: 'Blink not found' })
      }

      // Check if blink is active
      if (blink.status !== 'active') {
        return reply.code(403).send({ error: 'Blink is not active' })
      }

      // If no reference provided, return 402 Payment Required
      if (!reference) {
        const baseUrl = process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3001'
        const expiresAt = Math.floor(Date.now() / 1000) + 300 // 5 minutes

        return reply.code(402).send({
          status: 402,
          message: 'Payment Required',
          price: blink.price_usdc,
          currency: blink.payment_token || 'SOL',
          recipient: blink.payout_wallet,
          action_url: `${baseUrl}/actions/${slug}`,
          expires_at: expiresAt,
          description: blink.description,
        })
      }

      // Check for idempotent cached response first
      const cachedResponse = await getIdempotentResponse(reference)
      if (cachedResponse) {
        fastify.log.info({ reference }, 'Returning cached idempotent response')
        return reply.code(200).send(cachedResponse)
      }

      // ========== CRITICAL SECTION WITH DISTRIBUTED LOCK ==========
      // This prevents race conditions when multiple requests arrive simultaneously
      const result = await withLock(
        `payment:${reference}`,
        async () => {
          // Re-fetch run inside lock to get latest status
          const run = await getRunByReference(reference)

          if (!run) {
            return {
              code: 400,
              body: { error: 'Invalid reference. Please request a new payment transaction.' }
            }
          }

          // If run is already executed, return cached result (idempotency)
          if (run.status === 'executed') {
            return {
              code: 200,
              body: {
                message: 'Already executed (idempotent)',
                reference,
                signature: run.signature,
                cached: true,
              }
            }
          }

          // If payment failed previously, reject
          if (run.status === 'failed') {
            return {
              code: 402,
              body: { error: 'Payment verification previously failed. Please request a new transaction.' }
            }
          }

          // If payment not yet verified, verify it now
          if (run.status === 'pending' && signature) {
            try {
              const connection = getConnection()
              const recipientPubkey = parsePublicKey(blink.payout_wallet)
              const referencePubkey = parsePublicKey(reference)

              if (!recipientPubkey || !referencePubkey) {
                throw new Error('Invalid wallet or reference address')
              }

              // Verify the payment on-chain
              const paymentToken = blink.payment_token || 'SOL'

              // Validate price before converting to lamports
              if (!blink.price_usdc || parseFloat(blink.price_usdc) <= 0) {
                throw new Error(`Invalid blink price: ${blink.price_usdc}. Blink configuration error.`)
              }

              const amount = paymentToken === 'SOL'
                ? solToLamports(blink.price_usdc)
                : usdcToLamports(blink.price_usdc)

              const paymentVerification = await verifyPayment({
                connection,
                reference: referencePubkey,
                recipient: recipientPubkey,
                amount,
                splToken: paymentToken === 'SOL' ? undefined : getUsdcMint(),
                timeout: 60000, // 60 seconds - Solana mainnet can be slow
              })

              // CRITICAL: Verify signature matches the payment found on-chain
              // This prevents replay attacks where someone uses a valid reference
              // from a different transaction
              if (signature && paymentVerification.signature !== signature) {
                fastify.log.error({
                  providedSignature: signature,
                  onChainSignature: paymentVerification.signature,
                  reference
                }, 'Signature mismatch - potential attack detected')

                await markRunFailed(reference)
                return {
                  code: 402,
                  body: {
                    error: 'Payment verification failed',
                    details: 'Transaction signature does not match the payment reference. Please submit the correct transaction signature.'
                  }
                }
              }

              // Extract payer from transaction
              let payer = paymentVerification.signature
              try {
                const tx = await connection.getTransaction(paymentVerification.signature, {
                  commitment: 'confirmed',
                  maxSupportedTransactionVersion: 0,
                })
                if (tx?.transaction) {
                  const accountKeys = tx.transaction.message.getAccountKeys()
                  const payerPubkey = accountKeys.get(0)
                  if (payerPubkey) {
                    payer = payerPubkey.toBase58()
                  }
                }
              } catch (error) {
                fastify.log.warn({ error, signature: paymentVerification.signature }, 'Could not extract payer')
              }

              // Update run with payment details
              await updateRunPayment({
                reference,
                signature: paymentVerification.signature,
                payer,
              })

              // Update local run object
              run.signature = paymentVerification.signature
              run.payer = payer
              run.status = 'paid'

            } catch (error) {
              await markRunFailed(reference)
              fastify.log.error({ error, reference }, 'Payment verification failed')
              return {
                code: 402,
                body: {
                  error: 'Payment verification failed',
                  details: error instanceof Error ? error.message : String(error),
                }
              }
            }
          }

          // Re-check blink status before execution (creator might have paused it)
          const currentBlink = await getBlinkBySlug(slug)
          if (!currentBlink || currentBlink.status !== 'active') {
            await markRunFailed(reference)
            return {
              code: 403,
              body: { error: 'Blink is no longer active' }
            }
          }

          // Payment verified, execute the upstream API
          try {
            let targetUrl = blink.endpoint_url
            if (targetUrl.startsWith('/')) {
              const baseUrl =
                process.env.APP_URL ||
                process.env.NEXT_PUBLIC_APP_URL ||
                `http://localhost:${process.env.PORT || 3001}`
              targetUrl = `${baseUrl}${targetUrl}`
            }

            // Validate URL to prevent SSRF
            await validateUpstreamUrl(targetUrl)

            // Prepare request body
            const requestBody = {
              ...(data || {}),
              reference,
              signature: run.signature,
            }

            // Make upstream request with timeout
            const controller = new AbortController()
            const timeoutId = setTimeout(() => controller.abort(), UPSTREAM_TIMEOUT)

            const response = await fetch(targetUrl, {
              method: blink.method,
              headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json',
                'User-Agent': 'Blink402/1.0',
              },
              body: blink.method !== 'GET' ? JSON.stringify(requestBody) : undefined,
              signal: controller.signal,
            })

            clearTimeout(timeoutId)

            if (!response.ok) {
              const errorText = await response.text().catch(() => 'Unknown error')
              fastify.log.error({ slug, status: response.status }, 'Upstream API error')
              throw new Error(`Upstream API returned ${response.status}`)
            }

            // Read response with size limit
            const responseText = await readResponseWithLimit(response, MAX_RESPONSE_SIZE)
            const contentType = response.headers.get('content-type') || ''

            let responseData
            if (contentType.includes('application/json')) {
              try {
                responseData = JSON.parse(responseText)
              } catch (jsonError) {
                throw new Error('Endpoint returned invalid JSON')
              }
            } else if (responseText.trim().startsWith('{') || responseText.trim().startsWith('[')) {
              try {
                responseData = JSON.parse(responseText)
              } catch {
                responseData = { data: responseText, contentType: contentType || 'text/plain' }
              }
            } else {
              responseData = { data: responseText, contentType: contentType || 'text/plain' }
            }

            const duration = Date.now() - startTime

            // Mark run as executed
            await markRunExecuted({ reference, durationMs: duration })

            // Invalidate blink cache (run count changed)
            await deleteCache(`blink:${slug}`)

            const successResponse = {
              success: true,
              data: responseData,
              reference,
              signature: run.signature,
              duration_ms: duration,
            }

            // Cache the successful response for idempotency
            await setIdempotentResponse(reference, successResponse, 3600) // 1 hour

            return {
              code: 200,
              body: successResponse
            }

          } catch (error) {
            await markRunFailed(reference)

            if ((error as any).name === 'AbortError') {
              fastify.log.error({ slug, reference }, 'Upstream API timeout')
              return {
                code: 504,
                body: {
                  error: 'Upstream API timeout (30s exceeded)',
                  retryAllowed: true
                }
              }
            }

            fastify.log.error({ error, slug, reference }, 'API execution failed')
            return {
              code: 500,
              body: {
                error: 'API execution failed',
                details: error instanceof Error ? error.message : 'Unknown error',
              }
            }
          }
        },
        {
          ttl: 15000, // 15 second lock timeout (reduced from 120s to minimize stuck lock window)
          retries: 3,  // 3 attempts with 100ms delay between (matches proxy.ts)
          retryDelay: 100,
        }
      )

      // If lock acquisition failed, return 409 Conflict
      if (!result) {
        fastify.log.warn({ reference }, 'Failed to acquire lock - concurrent request in progress')
        return reply.code(409).send({
          error: 'Payment processing in progress',
          message: 'Another request is currently processing this payment. Please try again in a moment.',
          retryAfter: 5, // Suggest client retry in 5 seconds
        })
      }

      // Return the result from the locked section
      return reply.code(result.code).send(result.body)

    } catch (error) {
      fastify.log.error({ error, slug }, 'Error in x402 proxy')
      return reply.code(500).send({
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error',
      })
    }
  })
}
