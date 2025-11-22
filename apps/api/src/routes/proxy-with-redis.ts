/**
 * x402 Proxy Route - FIXED VERSION with Redis Distributed Locking
 *
 * This version solves the race condition bug identified in the code review.
 * Multiple concurrent requests with the same reference are now properly handled.
 */

import { FastifyPluginAsync } from 'fastify'
import { VersionedTransaction } from '@solana/web3.js'
import {
  getBlinkBySlug,
  getRunByReference,
  updateRunPaymentAtomic,
  markRunExecuted,
  markRunFailed,
  getPool,
  getRewardClaimCount,
  createRewardClaim,
  calculateReferralCommission,
  markCommissionPaid,
} from '@blink402/database'
import {
  getConnection,
  verifyPayment,
  usdcToLamports,
  solToLamports,
  parsePublicKey,
  getUsdcMint,
  extractPayerWithRetry,
  buildRewardTransaction,
  signAndBroadcastReward,
  verifyMessageSignature,
  generateChallengeMessage,
} from '@blink402/solana'
import { Keypair } from '@solana/web3.js'
import {
  withLock,
  withLockSafe,
  getCacheOrFetch,
  deleteCache,
  getIdempotentResponse,
  setIdempotentResponse,
  checkRateLimit,
  storeChallenge,
  getChallenge,
  markNonceUsed,
  isNonceUsed,
} from '@blink402/redis'
// PayAI x402 SDK for payment verification and settlement
import { X402PaymentHandler } from 'x402-solana/server'
import { updateCircuitBreaker } from '../utils/endpoint-health.js'

// Constants
const MAX_RESPONSE_SIZE = 10 * 1024 * 1024 // 10MB
const UPSTREAM_TIMEOUT = 30000 // 30 seconds
const BLINK_CACHE_TTL = 300 // 5 minutes

// ========== FIX PACK 6: RATE LIMITING CONFIGURATION ==========
// Per-wallet rate limiting to prevent spam and abuse
const RATE_LIMIT_WINDOW_SECONDS = 3600 // 1 hour sliding window
const RATE_LIMIT_MAX_REQUESTS = 10 // 10 requests per wallet per hour
const RATE_LIMIT_REWARD_MAX = 5 // Stricter limit for reward blinks (5 per hour)

// ========== PAYAI x402 HANDLER INITIALIZATION ==========
// Initialize PayAI payment handler with treasury wallet and network config
const payaiHandler = new X402PaymentHandler({
  network: process.env.SOLANA_NETWORK === 'devnet' ? 'solana-devnet' : 'solana',
  treasuryAddress: process.env.TREASURY_WALLET || process.env.PAYOUT_WALLET || '',
  facilitatorUrl: 'https://facilitator.payai.network',
})

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

// ========== FIX PACK 6: WALLET ADDRESS EXTRACTION HELPER ==========
/**
 * Extract wallet address from various sources for rate limiting
 * Supports: x402 payment header, transaction signature, or Privy-authenticated wallet
 */
async function extractWalletAddress(params: {
  paymentHeader?: string
  signature?: string
  userWallet?: string
  reference?: string
}): Promise<string | null> {
  const { paymentHeader, signature, userWallet, reference } = params

  // Priority 1: Explicit user wallet from Privy authentication (reward mode)
  if (userWallet) {
    return userWallet
  }

  // Priority 2: Extract from x402 payment header (charge mode)
  if (paymentHeader) {
    try {
      const headerData = JSON.parse(Buffer.from(paymentHeader, 'base64').toString('utf-8'))
      if (headerData.payload && headerData.payload.transaction) {
        const txBytes = Buffer.from(headerData.payload.transaction, 'base64')
        const tx = VersionedTransaction.deserialize(txBytes)
        if (tx.message.staticAccountKeys && tx.message.staticAccountKeys.length > 0) {
          return tx.message.staticAccountKeys[0].toBase58()
        }
      }
    } catch (error) {
      // Ignore parsing errors - wallet extraction is best-effort for rate limiting
    }
  }

  // Priority 3: Extract from transaction signature (legacy reward mode)
  if (signature) {
    try {
      const connection = getConnection()
      const tx = await connection.getTransaction(signature, {
        commitment: 'finalized',
        maxSupportedTransactionVersion: 0,
      })
      if (tx) {
        return tx.transaction.message.staticAccountKeys[0].toBase58()
      }
    } catch (error) {
      // Ignore on-chain lookup errors
    }
  }

  return null
}

export const proxyRoutesWithRedis: FastifyPluginAsync = async (fastify) => {
  // ========== FIX PACK 7: GET /bazaar/:slug/challenge - Generate challenge for reward claims ==========
  fastify.get<{
    Params: { slug: string }
    Querystring: { wallet: string }
  }>('/:slug/challenge', async (request, reply) => {
    const { slug } = request.params
    const { wallet } = request.query

    if (!wallet) {
      return reply.code(400).send({ error: 'wallet query parameter required' })
    }

    // Validate wallet address
    if (!parsePublicKey(wallet)) {
      return reply.code(400).send({ error: 'Invalid wallet address' })
    }

    try {
      // Get blink data
      const blink = await getCacheOrFetch(
        `blink:${slug}`,
        () => getBlinkBySlug(slug),
        BLINK_CACHE_TTL
      )

      if (!blink || blink.status !== 'active') {
        return reply.code(404).send({ error: 'Blink not found or inactive' })
      }

      // Only reward blinks need challenges
      if (blink.payment_mode !== 'reward') {
        return reply.code(400).send({ error: 'Challenge generation only available for reward blinks' })
      }

      // Generate unique nonce (cryptographically random)
      const crypto = await import('crypto')
      const nonce = crypto.randomBytes(32).toString('base64url')
      const timestamp = Date.now()

      // Store challenge in Redis (10 minute expiration)
      const stored = await storeChallenge(nonce, {
        wallet,
        blinkId: blink.id,
        timestamp,
      }, 600)

      if (!stored) {
        return reply.code(500).send({ error: 'Failed to generate challenge. Please try again.' })
      }

      // Generate challenge message to be signed
      const challengeMessage = generateChallengeMessage({
        wallet,
        blinkId: blink.id,
        nonce,
        timestamp,
      })

      return reply.code(200).send({
        challenge: challengeMessage,
        nonce,
        timestamp,
        expiresAt: timestamp + 600000, // 10 minutes from now
      })
    } catch (error) {
      fastify.log.error({ error, slug, wallet }, 'Challenge generation failed')
      return reply.code(500).send({ error: 'Internal server error' })
    }
  })

  // POST /bazaar/:slug - x402 proxy endpoint with Redis locking
  fastify.post<{
    Params: { slug: string }
    Body: { reference?: string; signature?: string; data?: any; paymentTx?: string }
  }>('/:slug', async (request, reply) => {
    const startTime = Date.now()
    const { slug } = request.params

    // Extract payment headers:
    // 1. X-PAYMENT: x402 protocol format (base64 encoded transaction)
    // 2. X-Payment-Tx: ONCHAIN Connect SDK format (simple txHash)
    const payment_header = request.headers['x-payment'] as string | undefined
    const payment_tx = request.headers['x-payment-tx'] as string | undefined

    // ========== FIX PACK 5: EXPLICIT IDEMPOTENCY KEY SUPPORT ==========
    // Extract explicit idempotency key from headers (standard pattern used by Stripe, Square)
    // Supports both standard header names: Idempotency-Key and X-Idempotency-Key
    const explicitIdempotencyKey =
      (request.headers['idempotency-key'] as string | undefined) ||
      (request.headers['x-idempotency-key'] as string | undefined)

    // Validate request body
    if (!request.body) {
      return reply.code(400).send({ error: 'Request body required' })
    }

    const { reference, signature, data, paymentTx, ...restOfBody } = request.body
    const _urlParams = (request.body as any)._urlParams // Backwards compatibility - optional

    // Support both header and body for txHash (ONCHAIN Connect SDK uses body)
    const txHash = payment_tx || paymentTx

    // Merge top-level parameters with data object (for backwards compatibility)
    // Frontend may send parameters at top level OR inside data object
    const mergedData = {
      ...restOfBody, // Top-level params (text, wallet, etc.)
      ...(data || {}) // Explicit data object (takes precedence)
    }
    // Remove special fields that shouldn't be forwarded to API
    delete mergedData._urlParams

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

      const paymentMode = blink.payment_mode || 'charge'
      const startTime = Date.now()

      // ========== FIX PACK 6: PER-WALLET RATE LIMITING ==========
      // Extract wallet address for rate limiting (best-effort, non-blocking)
      const userWalletFromBody = (mergedData as any)?.user_wallet
      const walletAddress = await extractWalletAddress({
        paymentHeader: payment_header,
        signature,
        userWallet: userWalletFromBody,
        reference,
      })

      if (walletAddress) {
        try {
          // Use stricter limits for reward blinks (more prone to abuse)
          const rateLimit = paymentMode === 'reward' ? RATE_LIMIT_REWARD_MAX : RATE_LIMIT_MAX_REQUESTS
          const rateLimitResult = await checkRateLimit(
            `wallet:${walletAddress}`,
            rateLimit,
            RATE_LIMIT_WINDOW_SECONDS
          )

          // Add rate limit headers to all responses
          reply.header('X-Ratelimit-Limit', rateLimit.toString())
          reply.header('X-Ratelimit-Remaining', rateLimitResult.remaining.toString())
          reply.header('X-Ratelimit-Reset', (Date.now() + RATE_LIMIT_WINDOW_SECONDS * 1000).toString())

          if (!rateLimitResult.allowed) {
            fastify.log.warn({
              wallet: walletAddress,
              slug,
              limit: rateLimit,
              window: RATE_LIMIT_WINDOW_SECONDS
            }, 'Rate limit exceeded for wallet')

            return reply.code(429).send({
              error: 'Too Many Requests',
              message: `Rate limit exceeded. You can make ${rateLimit} requests per hour.`,
              retry_after: RATE_LIMIT_WINDOW_SECONDS,
              wallet: walletAddress.substring(0, 8) + '...' // Partial address for privacy
            })
          }

          fastify.log.debug({
            wallet: walletAddress,
            slug,
            remaining: rateLimitResult.remaining,
            limit: rateLimit
          }, 'Rate limit check passed')
        } catch (error) {
          // Rate limiting is best-effort - don't block requests if Redis fails
          fastify.log.warn({ error, wallet: walletAddress }, 'Rate limit check failed (non-blocking)')
        }
      }

      // ========== REWARD MODE HANDLING ==========
      if (paymentMode === 'reward') {
        // Reward mode: Creator pays user for completing action
        // Accept either signature (legacy) OR user_wallet (Privy authenticated)
        const userWalletFromBody = (mergedData as any)?.user_wallet

        if (!reference) {
          return reply.code(400).send({
            error: 'Missing required fields',
            message: 'Reference is required for reward claims'
          })
        }

        if (!signature && !userWalletFromBody) {
          return reply.code(400).send({
            error: 'Missing required fields',
            message: 'Either signature or user_wallet is required for reward claims'
          })
        }

        // Validate reward configuration
        if (!blink.reward_amount || !blink.funded_wallet || !blink.max_claims_per_user) {
          fastify.log.error({ blink }, 'Invalid reward configuration')
          return reply.code(500).send({
            error: 'Invalid blink configuration',
            details: 'Reward mode requires reward_amount, funded_wallet, and max_claims_per_user'
          })
        }

        // Get run for this reference
        const run = await getRunByReference(reference)
        if (!run) {
          return reply.code(400).send({ error: 'Invalid reference' })
        }

        // Determine user wallet - either from signature verification OR from request body (Privy authenticated)
        let userWallet: string

        if (signature) {
          // Legacy flow: Verify memo transaction signature on-chain
          try {
            const connection = getConnection()
            const tx = await connection.getTransaction(signature, {
              commitment: 'finalized',
              maxSupportedTransactionVersion: 0,
            })

            if (!tx) {
              return reply.code(400).send({
                error: 'Transaction not found',
                message: 'Could not verify your signature on-chain'
              })
            }

            // Extract user wallet from transaction fee payer
            userWallet = tx.transaction.message.staticAccountKeys[0].toBase58()
          } catch (error) {
            fastify.log.error({ error, signature }, 'Error verifying signature')
            return reply.code(500).send({
              error: 'Verification failed',
              message: 'Could not verify signature on-chain'
            })
          }
        } else {
          // New flow: Use wallet address from Privy authentication
          userWallet = userWalletFromBody
          fastify.log.info({ reference, userWallet }, 'Using Privy-authenticated wallet for reward claim')
        }

        // ========== FIX PACK 7: CHALLENGE/NONCE VERIFICATION FOR ANTI-SPAM ==========
        // Verify signed challenge if provided (optional but recommended for spam protection)
        const challengeNonce = (mergedData as any)?._challengeNonce
        const challengeSignature = (mergedData as any)?._challengeSignature

        if (challengeNonce && challengeSignature) {
          try {
            // Check if nonce has already been used (replay attack prevention)
            const nonceUsed = await isNonceUsed(challengeNonce)
            if (nonceUsed) {
              return reply.code(403).send({
                error: 'Invalid challenge',
                message: 'This challenge has already been used. Please generate a new challenge.'
              })
            }

            // Retrieve challenge data from Redis
            const challengeData = await getChallenge(challengeNonce)
            if (!challengeData) {
              return reply.code(403).send({
                error: 'Invalid or expired challenge',
                message: 'Challenge not found or expired (10 minute limit). Please generate a new challenge.'
              })
            }

            // Verify challenge belongs to this wallet and blink
            if (challengeData.wallet !== userWallet || challengeData.blinkId !== blink.id) {
              return reply.code(403).send({
                error: 'Invalid challenge',
                message: 'Challenge does not match wallet or blink'
              })
            }

            // Check challenge age (10 minutes max)
            const challengeAge = Date.now() - challengeData.timestamp
            if (challengeAge > 600000) {
              return reply.code(403).send({
                error: 'Challenge expired',
                message: 'Challenge expired (10 minute limit). Please generate a new challenge.'
              })
            }

            // Regenerate challenge message and verify signature
            const expectedMessage = generateChallengeMessage({
              wallet: challengeData.wallet,
              blinkId: challengeData.blinkId,
              nonce: challengeNonce,
              timestamp: challengeData.timestamp,
            })

            const signatureValid = verifyMessageSignature(
              expectedMessage,
              challengeSignature,
              userWallet
            )

            if (!signatureValid) {
              return reply.code(403).send({
                error: 'Invalid signature',
                message: 'Challenge signature verification failed'
              })
            }

            // Mark nonce as used (1 hour expiration)
            await markNonceUsed(challengeNonce, 3600)

            fastify.log.info({
              reference,
              userWallet,
              nonce: challengeNonce,
              challengeAge,
            }, 'Challenge verification successful')
          } catch (error) {
            fastify.log.error({ error, reference, userWallet }, 'Challenge verification error')
            return reply.code(500).send({
              error: 'Challenge verification failed',
              message: 'An error occurred while verifying the challenge'
            })
          }
        } else {
          // Challenge not provided - reject request (prevents bot abuse)
          fastify.log.warn({
            reference,
            userWallet,
            blinkId: blink.id
          }, 'Reward claim rejected: missing challenge signature')

          return reply.code(403).send({
            error: 'Challenge required',
            message: 'Reward claims require a valid challenge signature. Please generate and sign a challenge first.'
          })
        }

        // Check claim limits
        const claimCount = await getRewardClaimCount(blink.id, userWallet)
        if (claimCount >= blink.max_claims_per_user) {
          return reply.code(403).send({
            error: 'Claim limit reached',
            message: `You have already claimed this reward ${claimCount} time(s). Maximum ${blink.max_claims_per_user} claims per wallet.`
          })
        }

        // Call endpoint to validate action completion
        let dynamicRewardAmount = blink.reward_amount // Default to static amount
        try {
          let targetUrl = blink.endpoint_url

          // Extract URL parameters from request body (for placeholder replacement)
          // Support both top-level _urlParams and nested mergedData._urlParams for backwards compatibility
          const urlParams = _urlParams || (mergedData as any)?._urlParams || {}

          // Replace URL placeholders (e.g., {user_input} -> actual value)
          if (Object.keys(urlParams).length > 0) {
            Object.keys(urlParams).forEach((key) => {
              const value = urlParams[key]
              targetUrl = targetUrl.replace(`{${key}}`, encodeURIComponent(value))
            })
            fastify.log.info({ originalUrl: blink.endpoint_url, finalUrl: targetUrl, params: urlParams }, 'Replaced URL placeholders')
          }

          if (targetUrl.startsWith('/')) {
            const apiPort = process.env.PORT || 3001
            const apiBaseUrl = process.env.NODE_ENV === 'production'
              ? (process.env.API_URL || process.env.API_BASE_URL || `http://localhost:${apiPort}`)
              : `http://localhost:${apiPort}`
            targetUrl = `${apiBaseUrl}${targetUrl}`
          }

          const requestBody = {
            ...(mergedData || {}),
            reference,
            signature,
            user_wallet: userWallet,
          }

          const endpointResponse = await fetch(targetUrl, {
            method: blink.method,
            headers: blink.method !== 'GET' ? { 'Content-Type': 'application/json' } : {},
            body: blink.method !== 'GET' ? JSON.stringify(requestBody) : undefined,
            signal: AbortSignal.timeout(30000),
          })

          if (!endpointResponse.ok) {
            const errorText = await endpointResponse.text().catch(() => 'Unknown error')
            // Update circuit breaker - failed endpoint validation
            await updateCircuitBreaker(blink.id, slug, false, getPool(), fastify.log)
            return reply.code(400).send({
              error: 'Action validation failed',
              message: 'Could not verify that you completed the required action',
              details: errorText.substring(0, 200)
            })
          }

          // Parse endpoint response to get dynamic reward amount (for tiered rewards)
          const validationResult = await endpointResponse.json() as {
            reward_amount?: string
            tier?: string
            total_claims?: number
          }
          dynamicRewardAmount = validationResult.reward_amount || blink.reward_amount

          fastify.log.info({
            slug,
            defaultAmount: blink.reward_amount,
            dynamicAmount: dynamicRewardAmount,
            tier: validationResult.tier,
            totalClaims: validationResult.total_claims
          }, 'Using dynamic reward amount from validation endpoint')

          // Update circuit breaker - successful endpoint validation
          await updateCircuitBreaker(blink.id, slug, true, getPool(), fastify.log)

          // Load creator keypair for signing reward transaction
          const creatorKeypairSecret = process.env.REWARD_KEYPAIR_SECRET
          if (!creatorKeypairSecret) {
            fastify.log.error('REWARD_KEYPAIR_SECRET not configured')
            return reply.code(500).send({
              error: 'Server configuration error',
              message: 'Reward payments are not configured on this server'
            })
          }

          const creatorKeypair = Keypair.fromSecretKey(
            Uint8Array.from(JSON.parse(creatorKeypairSecret))
          )

          // Verify that the loaded keypair matches the funded_wallet
          if (creatorKeypair.publicKey.toBase58() !== blink.funded_wallet) {
            fastify.log.error({
              loadedKeypair: creatorKeypair.publicKey.toBase58(),
              expectedWallet: blink.funded_wallet
            }, 'Keypair mismatch')
            return reply.code(500).send({
              error: 'Server configuration error',
              message: 'Reward wallet configuration mismatch'
            })
          }

          // Get Solana connection for reward transaction
          const connection = getConnection()

          // Build reward transaction
          const userPubkey = parsePublicKey(userWallet)
          if (!userPubkey) {
            fastify.log.error({ userWallet }, 'Invalid user wallet address')
            return reply.code(400).send({
              error: 'Invalid wallet address',
              message: 'The provided wallet address is not valid'
            })
          }

          const creatorPubkey = creatorKeypair.publicKey

          // Use dynamic reward amount from validation endpoint (supports tiered rewards)
          const amount = blink.payment_token === 'SOL'
            ? solToLamports(dynamicRewardAmount)
            : usdcToLamports(dynamicRewardAmount)

          // For reward mode, we don't need a reference PublicKey in the transaction
          // The reference (UUID string) is only used for database tracking
          const rewardTx = await buildRewardTransaction({
            connection,
            creator: creatorPubkey,
            user: userPubkey,
            amount,
            reference: undefined, // No on-chain reference needed for reward mode
            memo: `Blink402 reward: ${slug}`,
            tokenMint: blink.payment_token === 'USDC' ? getUsdcMint() : undefined,
          })

          // Sign and broadcast reward transaction (skip confirmation for speed with concurrent claims)
          const rewardSignature = await signAndBroadcastReward({
            connection,
            transaction: rewardTx,
            creatorKeypair,
            skipConfirmation: true, // Don't wait for confirmation - much faster for concurrent claims
          })

          fastify.log.info({
            slug,
            userWallet,
            rewardSignature,
            rewardAmount: dynamicRewardAmount,
            paymentToken: blink.payment_token
          }, 'Reward payment sent successfully')

          // Record claim in database
          await createRewardClaim({
            blinkId: blink.id,
            userWallet,
            reference,
            signature: rewardSignature,
          })

          // Mark run as executed
          const duration = Date.now() - startTime
          await markRunExecuted({ reference, durationMs: duration })

          // Return success response
          return reply.code(200).send({
            success: true,
            reward_paid: true,
            signature: rewardSignature,
            reward_amount: dynamicRewardAmount,
            reward_token: blink.payment_token,
            message: `Successfully claimed ${dynamicRewardAmount} ${blink.payment_token} reward!`,
            reference,
            duration_ms: duration,
          })
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error)
          const errorStack = error instanceof Error ? error.stack : undefined
          fastify.log.error({
            error: errorMessage,
            stack: errorStack,
            slug,
            reference,
            userWallet,
            rewardAmount: dynamicRewardAmount
          }, 'Reward payment failed')
          await markRunFailed(reference)
          // Update circuit breaker - failed reward payment
          await updateCircuitBreaker(blink.id, slug, false, getPool(), fastify.log)
          return reply.code(500).send({
            error: 'Reward payment failed',
            details: errorMessage
          })
        }
      }

      // ========== CHARGE MODE HANDLING (EXISTING LOGIC) ==========
      // If no reference or txHash provided, return 402 Payment Required
      if (!reference && !txHash) {
        const network = process.env.SOLANA_NETWORK || 'mainnet-beta'
        const networkName = network === 'mainnet-beta' ? 'solana' : 'solana-devnet'

        // ONCHAIN x402 ONLY supports USDC on Solana
        // Force USDC regardless of blink.payment_token setting
        const mint = getUsdcMint().toBase58()
        const decimals = 6 // USDC has 6 decimals
        const amount = (parseFloat(blink.price_usdc) * Math.pow(10, decimals)).toString()

        // ONCHAIN x402: Return payment requirements for client-side transaction building
        return reply.code(402).send({
          status: 402,
          message: 'Payment Required',
          payment: {
            recipientWallet: blink.payout_wallet,
            mint,
            amount,
            network: networkName,
            scheme: 'exact'
          },
          description: blink.description,
        })
      }

      // Use txHash or reference as the identifier
      const identifier = txHash || reference
      if (!identifier) {
        return reply.code(400).send({ error: 'No payment identifier provided' })
      }

      // ========== FIX PACK 5: CHECK BOTH PAYMENT IDENTIFIER AND EXPLICIT IDEMPOTENCY KEY ==========
      // Check explicit idempotency key first (if provided)
      if (explicitIdempotencyKey) {
        const cachedByKey = await getIdempotentResponse(explicitIdempotencyKey)
        if (cachedByKey) {
          fastify.log.info(
            { idempotencyKey: explicitIdempotencyKey, identifier },
            'Returning cached response by explicit idempotency key'
          )
          return reply.code(200).send(cachedByKey)
        }
      }

      // Check for idempotent cached response by payment identifier
      const cachedResponse = await getIdempotentResponse(identifier)
      if (cachedResponse) {
        fastify.log.info({ identifier }, 'Returning cached idempotent response by payment identifier')
        return reply.code(200).send(cachedResponse)
      }

      // ========== CRITICAL SECTION WITH SAFE DISTRIBUTED LOCK ==========
      // Uses queue-based lock acquisition to prevent race conditions
      const result = await withLockSafe(
        `payment:${identifier}`,
        async () => {
          // Re-fetch run inside lock to get latest status
          let run = await getRunByReference(identifier)

          // ONCHAIN Connect SDK flow: Use txHash instead of payment header
          // When txHash is provided, ONCHAIN has already verified and settled the payment
          if (!run && txHash) {
            fastify.log.info({ reference, txHash, blinkId: blink.id }, 'Creating new run for ONCHAIN Connect SDK payment')
            const { createRun } = await import('@blink402/database')
            run = await createRun({
              blinkId: blink.id,
              reference: txHash, // Use txHash as reference for ONCHAIN Connect flow
              metadata: { flow: 'onchain-connect' }
            })
          }

          // If run doesn't exist and we have a payment header, create it
          if (!run && payment_header && reference) {
            fastify.log.info({ reference, blinkId: blink.id }, 'Creating new run for x402 payment')
            const { createRun } = await import('@blink402/database')
            run = await createRun({
              blinkId: blink.id,
              reference,
              metadata: { flow: 'x402' }
            })
          }

          if (!run) {
            return {
              code: 400,
              body: { error: 'Invalid reference or payment. Please provide payment header or txHash.' }
            }
          }

          // If run is already executed, return cached result (idempotency)
          if (run.status === 'executed') {
            return {
              code: 200,
              body: {
                message: 'Already executed (idempotent)',
                reference: run.reference,
                signature: run.signature,
                cached: true,
              }
            }
          }

          // If payment failed previously, check why
          if (run.status === 'failed') {
            // Check if payment was actually verified (API failed, not payment)
            if (run.signature && run.payer) {
              // Payment succeeded but API failed - allow retry
              fastify.log.info({
                reference: run.reference,
                signature: run.signature,
                payer: run.payer
              }, 'Run marked failed but payment was verified - allowing API retry')
              run.status = 'paid' // Treat as paid for retry
            } else {
              // Payment verification actually failed
              return {
                code: 402,
                body: { error: 'Payment verification previously failed. Please request a new transaction.' }
              }
            }
          }

          // ONCHAIN Connect SDK flow: Trust ONCHAIN settlement, skip verification
          if (run.status === 'pending' && txHash) {
            try {
              fastify.log.info({ reference: run.reference, txHash }, 'Trusting ONCHAIN Connect SDK settlement')

              // Update run with payment details (trusting ONCHAIN)
              await updateRunPaymentAtomic({
                reference: run.reference,
                signature: txHash,
                payer: '', // Payer not available in simple txHash format
              })

              // Update run in database with ONCHAIN Connect metadata
              await getPool().query(
                `UPDATE runs
                 SET payment_method = $1, facilitator = $2, facilitator_tx_hash = $3
                 WHERE reference = $4`,
                ['onchain-connect', 'ONCHAIN Connect SDK', txHash, run.reference]
              )

              // Update local run object
              run.signature = txHash
              run.status = 'paid'

              fastify.log.info({
                reference: run.reference,
                txHash
              }, 'Payment trusted via ONCHAIN Connect SDK')

            } catch (error) {
              await markRunFailed(run.reference)
              fastify.log.error({ error, reference: run.reference }, 'ONCHAIN Connect payment processing failed')
              return {
                code: 500,
                body: {
                  error: 'Payment processing failed',
                  details: error instanceof Error ? error.message : String(error),
                }
              }
            }
          }

          // If payment not yet verified, verify it now
          if (run.status === 'pending' && payment_header) {
            // x402 flow (ONCHAIN verification)
            try {
              // PayAI x402: Verify payment using PayAI facilitator directly
              fastify.log.info({ reference }, 'Verifying payment with PayAI facilitator')

              // Validate price
              if (!blink.price_usdc || parseFloat(blink.price_usdc) <= 0) {
                throw new Error(`Invalid blink price: ${blink.price_usdc}. Blink configuration error.`)
              }

              // Decode and inspect payment header for debugging
              let decodedHeader: any
              try {
                decodedHeader = JSON.parse(Buffer.from(payment_header, 'base64').toString('utf-8'))
                fastify.log.info({
                  reference,
                  decodedHeader
                }, 'Decoded X-PAYMENT header')
              } catch (e) {
                fastify.log.warn({ error: e, reference }, 'Failed to decode payment header')
              }

              // Prepare PayAI x402 payment requirements
              // x402 SDK expects amount in micro-units (USDC has 6 decimals)
              // Example: 0.01 USDC = 10000 micro-units (0.01 * 1000000)
              const amountInMicroUnits = Math.floor(parseFloat(blink.price_usdc) * 1_000_000).toString()

              // Get USDC mint address for current network
              const usdcMint = getUsdcMint()

              // Create payment requirements using x402 SDK format
              const paymentRequirements = await payaiHandler.createPaymentRequirements({
                price: {
                  amount: amountInMicroUnits,
                  asset: {
                    address: usdcMint.toBase58(),
                    decimals: 6  // USDC has 6 decimals
                  }
                },
                network: process.env.SOLANA_NETWORK === 'devnet' ? 'solana-devnet' : 'solana',
                config: {
                  description: blink.title || 'API Payment',
                  resource: `https://blink402.dev/bazaar/${slug}`,  // Must be full URL
                }
              })

              // Step 1: Verify payment with PayAI
              // NOTE: PayAI SDK returns boolean, not object
              const isVerified = await payaiHandler.verifyPayment(payment_header, paymentRequirements)

              if (!isVerified) {
                throw new Error('PayAI payment verification failed - invalid payment')
              }

              fastify.log.info({
                reference,
                verified: true
              }, 'PayAI payment verification successful')

              // Step 2: Settle payment with PayAI
              // This broadcasts the transaction on-chain via facilitator
              await payaiHandler.settlePayment(payment_header, paymentRequirements)

              fastify.log.info({
                reference
              }, 'PayAI payment settlement successful')

              // Extract actual user wallet from x402 payment header
              // NOTE: staticAccountKeys[0] is PayAI fee payer, NOT the user!
              // We need to extract the authority from the SPL Token transfer instruction
              let payer = ''
              try {
                const headerData = JSON.parse(Buffer.from(payment_header, 'base64').toString('utf-8'))
                // x402 header format: {x402Version, scheme, network, payload: {transaction}}
                if (headerData.payload && headerData.payload.transaction) {
                  const txBytes = Buffer.from(headerData.payload.transaction, 'base64')
                  const tx = VersionedTransaction.deserialize(txBytes)

                  // Find the SPL Token transfer instruction (should be instruction 3)
                  // Transaction structure: [ComputeBudget, ComputeBudget, TokenTransfer]
                  if (tx.message.compiledInstructions && tx.message.compiledInstructions.length >= 3) {
                    const transferIx = tx.message.compiledInstructions[2]
                    // For SPL Token transferChecked instruction, the authority (actual user) is account index 3
                    // Accounts: [source, mint, destination, authority, ...]
                    if (transferIx.accountKeyIndexes && transferIx.accountKeyIndexes.length >= 4) {
                      const authorityIndex = transferIx.accountKeyIndexes[3]
                      payer = tx.message.staticAccountKeys[authorityIndex].toBase58()
                      fastify.log.info({ payer, authorityIndex }, 'Extracted actual user wallet from transfer instruction')
                    }
                  }

                  // Fallback: if extraction failed, use fee payer (will log warning)
                  if (!payer && tx.message.staticAccountKeys && tx.message.staticAccountKeys.length > 0) {
                    payer = tx.message.staticAccountKeys[0].toBase58()
                    fastify.log.warn({ payer }, 'Using fee payer as fallback - refunds may fail!')
                  }
                }
              } catch (e) {
                fastify.log.warn({ error: e }, 'Could not extract payer from payment header')
              }

              // Update run with payment details
              // Note: PayAI SDK doesn't return transaction signature directly
              // We extract it from the payment header instead
              let txSignature = ''
              try {
                const headerData = JSON.parse(Buffer.from(payment_header, 'base64').toString('utf-8'))
                if (headerData.payload?.transaction) {
                  const txBytes = Buffer.from(headerData.payload.transaction, 'base64')
                  const tx = VersionedTransaction.deserialize(txBytes)
                  // Transaction will be signed by facilitator during settlement
                  // For now, use reference as placeholder until we get on-chain confirmation
                  txSignature = run.reference
                }
              } catch (e) {
                fastify.log.warn({ error: e }, 'Could not extract transaction from payment header')
                txSignature = run.reference // Fallback to reference
              }

              await updateRunPaymentAtomic({
                reference: run.reference,
                signature: txSignature,
                payer: payer,
              })

              // Update run in database with x402 metadata
              await getPool().query(
                `UPDATE runs
                 SET payment_method = $1, facilitator = $2, facilitator_tx_hash = $3
                 WHERE reference = $4`,
                ['x402', 'PayAI', txSignature, run.reference]
              )

              // Update local run object
              run.signature = txSignature
              run.payer = payer
              run.status = 'paid'

              fastify.log.info({
                reference,
                facilitator: 'PayAI',
                payer
              }, 'Payment verified and settled via PayAI')

            } catch (error) {
              await markRunFailed(run.reference)
              fastify.log.error({ error, reference: run.reference }, 'PayAI payment verification failed')
              return {
                code: 402,
                body: {
                  error: 'Payment verification failed',
                  details: error instanceof Error ? error.message : String(error),
                }
              }
            }
          }

          // If payment still pending and no payment_header/txHash, verify traditional Solana Pay
          // This handles Solana Actions flow (buy-b402, burn-b402, etc.)
          if (run.status === 'pending' && !payment_header && !txHash) {
            try {
              fastify.log.info({ reference: run.reference }, 'Verifying traditional Solana Pay transaction')

              // Validate price
              if (!blink.price_usdc || parseFloat(blink.price_usdc) <= 0) {
                throw new Error(`Invalid blink price: ${blink.price_usdc}`)
              }

              const connection = getConnection()
              const referenceKey = parsePublicKey(run.reference)
              if (!referenceKey) {
                throw new Error('Invalid reference key format')
              }

              const recipientKey = parsePublicKey(blink.payout_wallet)
              if (!recipientKey) {
                throw new Error('Invalid recipient wallet')
              }

              // Determine payment token and amount
              const isSOL = blink.payment_token === 'SOL'

              // For SOL payments, use amount from run metadata if available
              let expectedAmount: bigint
              if (isSOL && run.metadata?.amountSol) {
                expectedAmount = solToLamports(run.metadata.amountSol)
              } else if (isSOL) {
                // Fallback: use price_usdc field as SOL amount
                expectedAmount = solToLamports(parseFloat(blink.price_usdc))
              } else {
                // USDC payment
                expectedAmount = usdcToLamports(parseFloat(blink.price_usdc))
              }

              // Verify payment on-chain
              const verificationResult = await verifyPayment({
                connection,
                reference: referenceKey,
                recipient: recipientKey,
                amount: expectedAmount,
                splToken: isSOL ? undefined : getUsdcMint(),
                timeout: 30000
              })

              fastify.log.info({
                reference: run.reference,
                signature: verificationResult.signature,
                amount: verificationResult.amount.toString(),
                token: isSOL ? 'SOL' : 'USDC'
              }, 'Traditional Solana Pay verification successful')

              // Extract payer from on-chain transaction
              const { extractPayerWithRetry } = await import('@blink402/solana')
              const payer = await extractPayerWithRetry(
                connection,
                verificationResult.signature,
                3
              )

              // Update run with payment details
              await updateRunPaymentAtomic({
                reference: run.reference,
                signature: verificationResult.signature,
                payer: payer || 'unknown'
              })

              // Update local run object
              run.signature = verificationResult.signature
              run.payer = payer || 'unknown'
              run.status = 'paid'

              fastify.log.info({
                reference: run.reference,
                signature: verificationResult.signature,
                payer: payer || 'unknown'
              }, 'Payment verified via traditional Solana Pay')

            } catch (error) {
              await markRunFailed(run.reference)
              fastify.log.error({ error, reference: run.reference }, 'Traditional Solana Pay verification failed')
              return {
                code: 402,
                body: {
                  error: 'Payment verification failed',
                  details: error instanceof Error ? error.message : String(error),
                  hint: 'Please ensure your transaction is confirmed on-chain'
                }
              }
            }
          }

          // Re-check blink status before execution (creator might have paused it)
          const currentBlink = await getBlinkBySlug(slug)
          if (!currentBlink || currentBlink.status !== 'active') {
            await markRunFailed(run.reference)
            return {
              code: 403,
              body: { error: 'Blink is no longer active' }
            }
          }

          // Payment verified, execute the upstream API
          try {
            let targetUrl = blink.endpoint_url
            let isInternalEndpoint = false

            // Extract URL parameters from request body (for placeholder replacement)
            // Support both top-level _urlParams and nested mergedData._urlParams for backwards compatibility
            const urlParams = _urlParams || (mergedData as any)?._urlParams || {}

            // Replace URL placeholders (e.g., {user_input} -> actual value)
            if (Object.keys(urlParams).length > 0) {
              Object.keys(urlParams).forEach((key) => {
                const value = urlParams[key]
                targetUrl = targetUrl.replace(`{${key}}`, encodeURIComponent(value))
              })
              fastify.log.info({ originalUrl: blink.endpoint_url, finalUrl: targetUrl, params: urlParams }, 'Replaced URL placeholders')
            }

            if (targetUrl.startsWith('/')) {
              isInternalEndpoint = true
              // Internal endpoint - use API server URL, not frontend URL
              const apiPort = process.env.PORT || 3001

              // In production, use the API server URL
              let apiBaseUrl: string
              if (process.env.NODE_ENV === 'production') {
                // Use the API server's public URL if available
                // Never use 0.0.0.0 as it's not a valid hostname for requests
                const portNum = typeof apiPort === 'string' ? parseInt(apiPort, 10) : apiPort
                apiBaseUrl = process.env.API_URL ||
                           process.env.API_BASE_URL ||
                           `http://localhost:${portNum}`  // Use localhost, not 0.0.0.0
              } else {
                // In development, use localhost with the API port
                apiBaseUrl = `http://localhost:${apiPort}`
              }

              targetUrl = `${apiBaseUrl}${targetUrl}`
              fastify.log.info({ targetUrl, endpoint: blink.endpoint_url }, 'Calling internal API endpoint')
            }

            // Validate URL to prevent SSRF (skip for internal endpoints)
            if (!isInternalEndpoint) {
              await validateUpstreamUrl(targetUrl)
            } else {
              // For internal endpoints, still validate protocol but allow localhost
              try {
                const parsed = new URL(targetUrl)
                if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
                  throw new Error(`Invalid protocol for internal endpoint: ${parsed.protocol}`)
                }
              } catch (error) {
                throw new Error(`Invalid internal endpoint URL: ${targetUrl}`)
              }
            }

            // Prepare request body - include payer and metadata for endpoints that need it
            const requestBody = {
              ...(mergedData || {}),
              reference,
              signature: run.signature,
              payer: run.payer, // Include payer wallet for endpoints like wallet-analysis
              // Forward user input parameters from Actions metadata (Fix Pack: Parameter Forwarding)
              ...(run.metadata?.targetWallet ? {
                wallet: run.metadata.targetWallet,           // Wallet analyzer parameter
                target_wallet: run.metadata.targetWallet,    // Legacy compatibility
              } : {}),
              ...(run.metadata?.text ? { text: run.metadata.text } : {}),                    // QR code/text blinks
              ...(run.metadata?.tokenAddress ? { tokenAddress: run.metadata.tokenAddress } : {}), // Token price blinks
              ...(run.metadata?.imagePrompt ? { prompt: run.metadata.imagePrompt } : {}),    // AI image generation
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
              // Update circuit breaker - failed API call
              await updateCircuitBreaker(blink.id, slug, false, getPool(), fastify.log)
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

            // Update circuit breaker - successful API call
            await updateCircuitBreaker(blink.id, slug, true, getPool(), fastify.log)

            // Mark run as executed and store API response data
            await markRunExecuted({
              reference: run.reference,
              durationMs: duration,
              responseData: responseData // Store the API response for results page
            })

            // ========== REFERRAL COMMISSION PAYOUT ==========
            // Calculate and pay commission to referrer if payer was referred
            try {
              const commissionResult = await calculateReferralCommission({
                refereeWallet: run.payer || '',
                runId: run.id,
                amountUsdc: blink.price_usdc
              })

              if (commissionResult.shouldPay && commissionResult.referrerWallet) {
                fastify.log.info({
                  referrer: commissionResult.referrerWallet,
                  referee: run.payer,
                  commission: commissionResult.commissionUsdc,
                  tier: commissionResult.tier,
                  runId: run.id
                }, 'Commission calculated - initiating payout')

                // Get platform keypair for signing commission payouts
                const platformKeypairSecret = process.env.REWARD_KEYPAIR_SECRET
                if (!platformKeypairSecret) {
                  throw new Error('REWARD_KEYPAIR_SECRET not configured - cannot pay commission')
                }

                const platformKeypair = Keypair.fromSecretKey(
                  Uint8Array.from(JSON.parse(platformKeypairSecret))
                )

                // Build and send USDC commission payment
                const commissionAmount = BigInt(usdcToLamports(parseFloat(commissionResult.commissionUsdc)))
                const referrerPubkey = parsePublicKey(commissionResult.referrerWallet)
                if (!referrerPubkey) {
                  throw new Error(`Invalid referrer wallet address: ${commissionResult.referrerWallet}`)
                }

                const connection = getConnection()

                // Use the reward transaction builder (server-side signing)
                const commissionTx = await buildRewardTransaction({
                  connection,
                  creator: platformKeypair.publicKey,
                  user: referrerPubkey,
                  amount: commissionAmount,
                  tokenMint: getUsdcMint(),
                  memo: `Commission: ${commissionResult.tier} tier`
                })

                const commissionSignature = await signAndBroadcastReward({
                  connection,
                  transaction: commissionTx,
                  creatorKeypair: platformKeypair,
                  skipConfirmation: false
                })

                // Get the payout ID from the commission_payouts table
                const payoutResult = await getPool().query(
                  `SELECT id FROM commission_payouts
                   WHERE run_id = $1 AND referrer_wallet = $2
                   ORDER BY paid_at DESC LIMIT 1`,
                  [run.id, commissionResult.referrerWallet]
                )

                if (payoutResult.rows.length > 0) {
                  await markCommissionPaid({
                    payoutId: payoutResult.rows[0].id,
                    signature: commissionSignature
                  })

                  fastify.log.info({
                    referrer: commissionResult.referrerWallet,
                    commission: commissionResult.commissionUsdc,
                    signature: commissionSignature
                  }, 'Commission payout completed successfully')
                }
              }
            } catch (commissionError) {
              // Log commission errors but don't fail the main request
              fastify.log.error({
                error: commissionError,
                runId: run.id,
                payer: run.payer
              }, 'Failed to process referral commission (non-critical error)')
            }

            // Invalidate blink cache (run count changed)
            await deleteCache(`blink:${slug}`)

            const successResponse = {
              success: true,
              data: responseData,
              reference: run.reference,
              signature: run.signature,
              duration_ms: duration,
            }

            // ========== FIX PACK 5: CACHE WITH BOTH PAYMENT IDENTIFIER AND EXPLICIT KEY ==========
            // Cache the successful response for idempotency (24 hour TTL)
            await setIdempotentResponse(identifier, successResponse, 86400) // 24 hours

            // Also cache with explicit idempotency key if provided
            if (explicitIdempotencyKey) {
              await setIdempotentResponse(explicitIdempotencyKey, successResponse, 86400) // 24 hours
              fastify.log.info(
                { idempotencyKey: explicitIdempotencyKey, identifier },
                'Cached response with explicit idempotency key'
              )
            }

            return {
              code: 200,
              body: successResponse
            }

          } catch (error) {
            // Update circuit breaker - failed execution
            await updateCircuitBreaker(blink.id, slug, false, getPool(), fastify.log)

            // DON'T mark run as failed if payment was verified - allow retry
            // Only mark as failed if payment verification itself failed
            const paymentVerified = run.signature && run.payer
            if (!paymentVerified) {
              await markRunFailed(run.reference)
            } else {
              fastify.log.warn({
                reference: run.reference,
                signature: run.signature,
                payer: run.payer,
                error: error instanceof Error ? error.message : String(error)
              }, 'API execution failed but payment was verified - run NOT marked as failed to allow retry')
            }

            if ((error as any).name === 'AbortError') {
              fastify.log.error({ slug, reference: run.reference }, 'Upstream API timeout')
              return {
                code: 504,
                body: {
                  error: 'Upstream API timeout (30s exceeded)',
                  retryAllowed: true,
                  paymentVerified,
                }
              }
            }

            fastify.log.error({ error, slug, reference: run.reference }, 'API execution failed')
            return {
              code: 500,
              body: {
                error: 'API execution failed',
                details: error instanceof Error ? error.message : 'Unknown error',
                retryAllowed: paymentVerified, // Allow retry if payment was verified
              }
            }
          }
        },
        {
          ttl: 15000,      // 15 second lock timeout (enough for payment verification + API execution)
          retries: 5,      // 5 attempts with queue-based ordering (increased from 3)
          retryDelay: 200, // 200ms delay between retries (increased for queue position calculation)
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
