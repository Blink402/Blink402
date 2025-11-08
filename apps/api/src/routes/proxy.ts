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
  acquireLock,
  releaseLock,
  isRedisConnected,
} from '@blink402/redis'

/**
 * Validates that a URL is safe to proxy to (prevents SSRF attacks)
 * @param url - The URL to validate
 * @returns true if URL is safe, false otherwise
 */
function isValidProxyUrl(url: string): { valid: boolean; error?: string } {
  try {
    const parsed = new URL(url)

    // Only allow HTTP and HTTPS protocols
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return { valid: false, error: `Invalid protocol: ${parsed.protocol}. Only http: and https: are allowed.` }
    }

    // Block localhost and loopback addresses
    const hostname = parsed.hostname.toLowerCase()
    if (hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '[::1]' || hostname.startsWith('127.')) {
      return { valid: false, error: 'Localhost URLs are not allowed' }
    }

    // Block private IP ranges (RFC 1918)
    // 10.0.0.0/8, 172.16.0.0/12, 192.168.0.0/16
    if (hostname.startsWith('10.') || hostname.startsWith('192.168.') || hostname.match(/^172\.(1[6-9]|2[0-9]|3[0-1])\./)) {
      return { valid: false, error: 'Private IP addresses are not allowed' }
    }

    // Block link-local addresses (169.254.0.0/16)
    if (hostname.startsWith('169.254.')) {
      return { valid: false, error: 'Link-local addresses are not allowed' }
    }

    // Block IPv6 private ranges
    if (hostname.startsWith('[fc') || hostname.startsWith('[fd') || hostname.startsWith('[fe80')) {
      return { valid: false, error: 'Private IPv6 addresses are not allowed' }
    }

    // Block metadata service endpoints (cloud providers)
    if (hostname === '169.254.169.254' || hostname === 'metadata.google.internal') {
      return { valid: false, error: 'Cloud metadata endpoints are not allowed' }
    }

    return { valid: true }
  } catch (error) {
    return { valid: false, error: 'Invalid URL format' }
  }
}

export const proxyRoutes: FastifyPluginAsync = async (fastify) => {
  // POST /bazaar/:slug - x402 proxy endpoint
  fastify.post<{
    Params: { slug: string }
    Body: { reference?: string; signature?: string; data?: Record<string, unknown> }
  }>('/:slug', async (request, reply) => {
    const startTime = Date.now()
    const { slug } = request.params
    const { reference, signature, data } = request.body

    try {
      // Get blink data
      const blink = await getBlinkBySlug(slug)
      if (!blink) {
        return reply.code(404).send({ error: 'Blink not found' })
      }

      // Check if blink is active
      if (blink.status !== 'active') {
        return reply.code(403).send({ error: 'Blink is not active' })
      }

      // Validate payment_token is explicitly set
      if (!blink.payment_token || (blink.payment_token !== 'SOL' && blink.payment_token !== 'USDC')) {
        fastify.log.error({ blink, paymentToken: blink.payment_token }, 'Invalid or missing payment_token in proxy')
        return reply.code(500).send({
          error: 'Invalid blink configuration',
          details: 'Payment token must be either SOL or USDC'
        })
      }

      // If no reference provided, return 402 Payment Required
      if (!reference) {
        const baseUrl = process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3001'
        const expiresAt = Math.floor(Date.now() / 1000) + 300 // 5 minutes

        return reply.code(402).send({
          status: 402,
          message: 'Payment Required',
          price: blink.price_usdc,
          currency: blink.payment_token, // Already validated above
          recipient: blink.payout_wallet, // Use payout wallet, not creator wallet
          action_url: `${baseUrl}/actions/${slug}`,
          expires_at: expiresAt,
          description: blink.description,
        })
      }

      // Check if run exists
      const run = await getRunByReference(reference)
      if (!run) {
        return reply.code(400).send({
          error: 'Invalid reference. Please request a new payment transaction.',
        })
      }

      // ========== CRITICAL SECTION: ACQUIRE DISTRIBUTED LOCK ==========
      // Prevent race conditions when multiple requests process same payment concurrently
      const lockKey = `payment:${reference}`
      let lock: string | null = null

      try {
        // Try to acquire lock with retries (3 attempts, 100ms delay)
        // TTL: 15 seconds (auto-expires if process crashes - safety net)
        if (isRedisConnected()) {
          lock = await acquireLock(lockKey, {
            ttl: 15000, // 15 seconds (reduced from 60s to minimize stuck lock window)
            retries: 3,
            retryDelay: 100,
          })

          if (!lock) {
            // Another request is processing this payment
            fastify.log.warn({ reference, slug }, 'Failed to acquire lock - payment processing in progress')
            return reply.code(409).send({
              error: 'Payment processing in progress',
              message: 'Another request is currently processing this payment. Please try again in a moment.',
              retryAfter: 5, // Suggest client retry in 5 seconds
            })
          }

          fastify.log.debug({ reference, lockKey }, 'Lock acquired successfully')
        } else {
          // Redis not available - log warning but continue (fallback to database-level protection)
          fastify.log.warn({ reference }, 'Redis not connected - distributed locking unavailable, using database idempotency')
        }

        // Double-check run status inside lock (another request may have completed it)
        const lockedRun = await getRunByReference(reference)
        if (!lockedRun) {
          return reply.code(400).send({
            error: 'Invalid reference. Please request a new payment transaction.',
          })
        }

        if (lockedRun.status === 'executed') {
          return reply.code(200).send({
            message: 'Already executed (idempotent)',
            reference,
            signature: lockedRun.signature,
            cached: true,
          })
        }

        // If payment not yet verified, verify it now
        if (lockedRun.status === 'pending' && signature) {
        // Separate payment verification from database updates for better error handling
        let paymentVerification
        let payer

        try {
          const connection = getConnection()
          const recipientPubkey = parsePublicKey(blink.payout_wallet) // Use payout wallet for verification
          const referencePubkey = parsePublicKey(reference)

          if (!recipientPubkey || !referencePubkey) {
            throw new Error('Invalid wallet or reference address')
          }

          // Verify the payment on-chain
          // Use validated payment_token (already checked above)
          const paymentToken = blink.payment_token // Guaranteed to be 'SOL' or 'USDC'
          const amount = paymentToken === 'SOL'
            ? solToLamports(blink.price_usdc)
            : usdcToLamports(blink.price_usdc)

          fastify.log.info({
            slug,
            reference,
            paymentToken,
            amount: amount.toString(),
            recipient: recipientPubkey.toBase58(),
            usdcMint: paymentToken === 'USDC' ? getUsdcMint().toBase58() : 'N/A'
          }, 'Verifying payment')

          paymentVerification = await verifyPayment({
            connection,
            reference: referencePubkey,
            recipient: recipientPubkey,
            amount, // Full amount - no platform fee
            splToken: paymentToken === 'SOL' ? undefined : getUsdcMint(),
            timeout: 10000, // 10 seconds
          })

          // Extract the actual payer from the transaction
          payer = paymentVerification.signature // Fallback to signature
          try {
            const tx = await connection.getTransaction(paymentVerification.signature, {
              commitment: 'confirmed',
              maxSupportedTransactionVersion: 0,
            })
            if (tx?.transaction) {
              // The payer is the first account in the transaction (fee payer)
              const accountKeys = tx.transaction.message.getAccountKeys()
              const payerPubkey = accountKeys.get(0)
              if (payerPubkey) {
                payer = payerPubkey.toBase58()
              }
            }
          } catch (error) {
            fastify.log.warn({ error, signature: paymentVerification.signature }, 'Could not extract payer from transaction')
          }
        } catch (error) {
          // Payment verification failed - payment not confirmed on-chain
          await markRunFailed(reference)
          fastify.log.error({
            error,
            errorType: error instanceof Error ? error.constructor.name : typeof error,
            errorString: String(error),
            reference,
            paymentToken: blink.payment_token,
          }, 'Payment verification failed')
          return reply.code(402).send({
            error: 'Payment verification failed',
            details: error instanceof Error ? error.message : (String(error) || 'Unknown error'),
          })
        }

        // Payment verified on-chain, now update database
        try {
          await updateRunPayment({
            reference,
            signature: paymentVerification.signature,
            payer,
          })
        } catch (dbError) {
          // CRITICAL: Payment verified on-chain but database update failed
          // Do NOT mark run as failed - payment is valid!
          fastify.log.error({
            error: dbError,
            reference,
            signature: paymentVerification.signature,
            payer,
            slug,
          }, '🚨 CRITICAL: Payment verified on-chain but database update failed - manual intervention required')

          return reply.code(500).send({
            error: 'Database error',
            message: 'Payment was verified on-chain but failed to record. Please contact support with this reference.',
            reference,
            signature: paymentVerification.signature,
          })
        }
      }

      // Payment verified, execute the upstream API
      try {
        // Handle internal routes (convert to full URL)
        let targetUrl = blink.endpoint_url
        if (targetUrl.startsWith('/')) {
          const baseUrl =
            process.env.APP_URL ||
            process.env.NEXT_PUBLIC_APP_URL ||
            `http://localhost:${process.env.PORT || 3001}`
          targetUrl = `${baseUrl}${targetUrl}`
        }

        // Validate URL to prevent SSRF attacks
        const validation = isValidProxyUrl(targetUrl)
        if (!validation.valid) {
          fastify.log.error({ targetUrl, error: validation.error, slug, reference }, 'SSRF validation failed')
          throw new Error(`Invalid endpoint URL: ${validation.error}`)
        }

        // Prepare request body - include reference and signature for upstream API
        const requestBody = {
          ...(data || {}), // User-provided data
          reference, // Payment reference for idempotency
          signature: lockedRun.signature, // Transaction signature for verification
        }

        // Build headers dynamically
        const headers: Record<string, string> = {
          'Accept': '*/*', // Accept ANY content type - websites, images, APIs, etc.
          'User-Agent': 'Blink402/1.0',
        }

        // Only add Content-Type for non-GET requests
        if (blink.method !== 'GET') {
          headers['Content-Type'] = 'application/json'
        }

        const response = await fetch(targetUrl, {
          method: blink.method,
          headers,
          body: blink.method !== 'GET' ? JSON.stringify(requestBody) : undefined,
          signal: AbortSignal.timeout(30000), // 30 second timeout
        })

        if (!response.ok) {
          const errorText = await response.text().catch(() => 'Unknown error')

          // Provide helpful error messages based on status code
          let errorMessage = `Endpoint returned ${response.status}`
          if (response.status === 404) {
            errorMessage = `Endpoint not found (404). The URL may be incorrect or the resource doesn't exist.`
          } else if (response.status === 405) {
            errorMessage = `Method not allowed (405). Try using ${blink.method === 'GET' ? 'POST' : 'GET'} instead.`
          } else if (response.status === 401 || response.status === 403) {
            errorMessage = `Access denied (${response.status}). This content requires authentication.`
          } else if (response.status >= 500) {
            errorMessage = `Server error (${response.status}). The endpoint is having issues.`
          }

          throw new Error(`${errorMessage} Details: ${errorText.substring(0, 200)}`)
        }

        // Handle response based on content-type - Support ALL content types!
        const contentType = response.headers.get('content-type') || ''
        let responseData

        // Read response body as text first (can only read once)
        const responseText = await response.text()

        // Log content type for debugging
        fastify.log.info({
          slug,
          reference,
          contentType,
          responseSize: responseText.length,
        }, 'Processing response from endpoint')

        if (contentType.includes('application/json')) {
          // JSON API response
          try {
            responseData = JSON.parse(responseText)
          } catch (jsonError) {
            // Content-type claims JSON but isn't valid - still return it
            fastify.log.warn({
              slug,
              reference,
              contentType,
              bodyPreview: responseText.substring(0, 200),
            }, 'Invalid JSON in response, returning as text')
            responseData = {
              data: responseText,
              contentType,
              warning: 'Content-type was JSON but response was not valid JSON'
            }
          }
        } else if (contentType.includes('text/html')) {
          // Website/HTML content - this is valid!
          responseData = {
            html: responseText,
            contentType,
            type: 'website'
          }
        } else if (contentType.includes('image/')) {
          // Image content - return as base64 or URL
          responseData = {
            data: Buffer.from(responseText).toString('base64'),
            contentType,
            type: 'image',
            encoding: 'base64'
          }
        } else if (responseText.trim().startsWith('{') || responseText.trim().startsWith('[')) {
          // No JSON content-type but looks like JSON, try to parse
          try {
            responseData = JSON.parse(responseText)
          } catch {
            // Not valid JSON, return as text
            responseData = { data: responseText, contentType: contentType || 'text/plain' }
          }
        } else {
          // Any other content type (PDFs, text, XML, etc.)
          responseData = {
            data: responseText,
            contentType: contentType || 'text/plain',
            type: 'other'
          }
        }
        const duration = Date.now() - startTime

        // Mark run as executed
        await markRunExecuted({
          reference,
          durationMs: duration,
        })

        // Return successful response
        return reply.code(200).send({
          success: true,
          data: responseData,
          reference,
          signature: lockedRun.signature,
          duration_ms: duration,
        })
      } catch (error) {
        await markRunFailed(reference)
        fastify.log.error({ error, slug, reference }, 'API execution failed')
        return reply.code(500).send({
          error: 'API execution failed',
          details: error instanceof Error ? error.message : 'Unknown error',
        })
      }
    } finally {
      // ========== RELEASE DISTRIBUTED LOCK ==========
      // Always attempt to release lock, even if errors occurred
      if (lock) {
        try {
          if (isRedisConnected()) {
            const released = await releaseLock(lockKey, lock)
            if (released) {
              fastify.log.debug({ reference, lockKey }, 'Lock released successfully')
            } else {
              fastify.log.warn({ reference, lockKey }, 'Lock already released or expired')
            }
          } else {
            // Redis disconnected during processing - lock will auto-expire via TTL
            fastify.log.warn({
              reference,
              lockKey,
              ttl: '15s'
            }, 'Redis disconnected - lock will auto-expire via TTL')
          }
        } catch (error) {
          // Don't throw - lock will auto-expire via TTL (safety net)
          fastify.log.error({
            error,
            reference,
            lockKey,
            errorMessage: error instanceof Error ? error.message : 'Unknown error'
          }, 'Failed to release lock - will auto-expire via TTL')
        }
      }
    }
    } catch (error) {
      fastify.log.error({ error, slug }, 'Error in x402 proxy')
      return reply.code(500).send({
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error',
      })
    }
  })
}
