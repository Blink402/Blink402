import { FastifyPluginAsync } from 'fastify'
import { VersionedTransaction } from '@solana/web3.js'
import {
  getBlinkBySlug,
  getRunByReference,
  getRunBySignature,
  updateRunPayment,
  updateRunPaymentAtomic,
  markRunExecuted,
  markRunFailed,
  getRewardClaimCount,
  createRewardClaim,
  createRefund,
  markRefundIssued,
  markRefundFailed,
  createCreatorDebt,
  getPlatformConfig,
  getPool,
} from '@blink402/database'
import {
  getConnection,
  verifyPayment,
  verifyPaymentWithSolanaPay,
  usdcToLamports,
  solToLamports,
  parsePublicKey,
  getUsdcMint,
  retrySolanaRpc,
  extractPayerWithRetry,
  buildRewardTransaction,
  signAndBroadcastReward,
  buildRefundTransaction,
  executeRefund,
} from '@blink402/solana'
import {
  acquireLock,
  releaseLock,
  isRedisConnected,
} from '@blink402/redis'
import {
  verifyPayment as verifyOnchainPayment,
  settlePayment as settleOnchainPayment,
} from '@blink402/onchain'
import { Keypair } from '@solana/web3.js'
import { retryWithBackoff, updateCircuitBreaker } from '../utils/endpoint-health.js'

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

    // Extract payment header from X-PAYMENT header (x402 protocol standard)
    const payment_header = request.headers['x-payment'] as string | undefined

    const { reference, signature, data } = request.body

    // Log incoming data for wallet-analyzer to debug
    if (slug === 'wallet-analyzer') {
      fastify.log.info({ data, reference }, 'Wallet-analyzer proxy request received')
    }

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

      const paymentMode = blink.payment_mode || 'charge'

      // ========== REWARD MODE HANDLING ==========
      if (paymentMode === 'reward') {
        // Reward mode: Creator pays user for completing action
        // Accept either signature (legacy) OR user_wallet (Privy authenticated)
        const userWalletFromBody = (data as any)?.user_wallet

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
          const urlParams = (data as any)?._urlParams || {}

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
            ...(data || {}),
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

          // Sign and broadcast reward transaction
          const rewardSignature = await signAndBroadcastReward({
            connection,
            transaction: rewardTx,
            creatorKeypair,
          })

          fastify.log.info({
            slug,
            userWallet,
            rewardSignature,
            rewardAmount: blink.reward_amount,
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
            reward_amount: blink.reward_amount,
            reward_token: blink.payment_token,
            message: `Successfully claimed ${blink.reward_amount} ${blink.payment_token} reward!`,
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
      // If no reference provided, return 402 Payment Required
      if (!reference) {
        const network = process.env.SOLANA_NETWORK || 'mainnet-beta'
        // ONCHAIN network names: 'solana' (mainnet) or 'solana-devnet'
        const networkName = network === 'mainnet-beta' ? 'solana' : 'solana-devnet'

        // Determine payment token and amount based on blink configuration
        const isUSDC = blink.payment_token === 'USDC'
        const mint = isUSDC ? getUsdcMint().toBase58() : 'native' // 'native' for SOL
        const decimals = isUSDC ? 6 : 9 // USDC has 6 decimals, SOL has 9
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

      // Check if run exists, create if needed for x402 flow
      let run = await getRunByReference(reference)
      if (!run && payment_header) {
        fastify.log.info({ reference, blinkId: blink.id }, 'Creating new run for x402 payment')
        const { createRun } = await import('@blink402/database')
        run = await createRun({
          blinkId: blink.id,
          reference,
          metadata: { flow: 'x402' }
        })
      }

      if (!run) {
        return reply.code(400).send({
          error: 'Invalid reference. Please provide payment header to create transaction.',
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
        if (lockedRun.status === 'pending' && payment_header) {
          // Declare variables outside try block for error handling access
          let settleResponse: any
          let payer = ''

          try {
            // ONCHAIN x402: Verify payment using ONCHAIN facilitator API
            fastify.log.info({ reference }, 'Verifying payment with ONCHAIN API')

            // Validate price
            if (!blink.price_usdc || parseFloat(blink.price_usdc) <= 0) {
              throw new Error(`Invalid blink price: ${blink.price_usdc}. Blink configuration error.`)
            }

            // ONCHAIN only supports USDC on Solana (not native SOL)
            // See: https://onchain.fi/docs - Solana support is USDC only
            const expectedToken = 'USDC' as const

            // Format amount to 2 decimal places (ONCHAIN expects "1.00" format, not "1.000000")
            const formattedAmount = parseFloat(blink.price_usdc).toFixed(2)

            // Step 1: Verify payment with ONCHAIN API
            const verifyResponse = await verifyOnchainPayment({
              paymentHeader: payment_header,
              sourceNetwork: 'solana',
              destinationNetwork: 'solana',
              recipientAddress: blink.payout_wallet,
              expectedAmount: formattedAmount,
              expectedToken,
              priority: 'balanced'
            })

            fastify.log.info({
              reference,
              facilitator: verifyResponse.data.facilitator,
              valid: verifyResponse.data.valid
            }, 'ONCHAIN payment verification successful')

            // Step 2: Settle payment with ONCHAIN API
            settleResponse = await settleOnchainPayment({
              paymentHeader: payment_header,
              sourceNetwork: 'solana',
              destinationNetwork: 'solana',
              priority: 'balanced'
            })

            fastify.log.info({
              reference,
              facilitator: settleResponse.data.facilitator,
              txHash: settleResponse.data.txHash
            }, 'ONCHAIN payment settlement successful')

            // Extract payer from x402 payment header
            try {
              const headerData = JSON.parse(Buffer.from(payment_header, 'base64').toString('utf-8'))
              // x402 header format (Solana SVM spec): {x402Version, scheme, network, payload: {transaction}}
              // @see https://github.com/coinbase/x402/blob/main/specs/schemes/exact/scheme_exact_svm.md
              if (headerData.payload && headerData.payload.transaction) {
                // Decode the signed transaction to extract payer (fee payer = first account)
                const txBytes = Buffer.from(headerData.payload.transaction, 'base64')
                const tx = VersionedTransaction.deserialize(txBytes)
                // Extract fee payer (first static account key)
                if (tx.message.staticAccountKeys && tx.message.staticAccountKeys.length > 0) {
                  payer = tx.message.staticAccountKeys[0].toBase58()
                }
              }
            } catch (e) {
              fastify.log.warn({ error: e }, 'Could not extract payer from payment header')
            }

            // Payment verified on-chain, now update database atomically
            await updateRunPaymentAtomic({
              reference,
              signature: settleResponse.data.txHash, // Use facilitator tx hash as signature
              payer,
            })

            // Update run in database with x402 metadata
            await getPool().query(
              `UPDATE runs
               SET payment_method = $1, facilitator = $2, facilitator_tx_hash = $3
               WHERE reference = $4`,
              ['x402', settleResponse.data.facilitator, settleResponse.data.txHash, reference]
            )

            fastify.log.info({
              reference,
              facilitator: settleResponse.data.facilitator,
              txHash: settleResponse.data.txHash
            }, 'Payment verified and settled via ONCHAIN')

            // Re-fetch the run to get updated status
            const updatedRun = await getRunByReference(reference)
            if (updatedRun) {
              lockedRun.status = updatedRun.status
              lockedRun.signature = updatedRun.signature
              lockedRun.payer = updatedRun.payer
              lockedRun.metadata = updatedRun.metadata // CRITICAL: Include metadata for wallet-analyzer!
            }
          } catch (error) {
            // Handle both verification and database errors
            const errorMessage = error instanceof Error ? error.message : String(error)

            // Check if this is a duplicate payment error (database error after successful verification)
            if (errorMessage.includes('already processed') || errorMessage.includes('already used')) {
              fastify.log.info({
                reference,
                signature: settleResponse?.data?.txHash,
              }, 'Payment already processed by another request (race condition handled)')
              // Fetch the updated run to get the execution status
              const processedRun = await getRunByReference(reference)
              if (processedRun && processedRun.status === 'paid') {
                // Continue with execution
                lockedRun.status = processedRun.status
                lockedRun.signature = processedRun.signature
                lockedRun.payer = processedRun.payer
                lockedRun.metadata = processedRun.metadata // Include metadata!
              } else {
                // Already executed or failed, return appropriate response
                return reply.code(200).send({
                  message: 'Already processed',
                  reference,
                  signature: processedRun?.signature || settleResponse?.data?.txHash,
                  cached: true,
                })
              }
            } else if (settleResponse && settleResponse.data) {
              // Payment verified via ONCHAIN but database update failed
              // Do NOT mark run as failed - payment is valid!
              fastify.log.error({
                error,
                reference,
                signature: settleResponse.data.txHash,
                payer,
                slug,
              }, '🚨 CRITICAL: ONCHAIN payment verified but database update failed - manual intervention required')

              return reply.code(500).send({
                error: 'Database error',
                message: 'Payment was verified via ONCHAIN but failed to record. Please contact support with this reference.',
                reference,
                signature: settleResponse.data.txHash,
              })
            } else {
              // Payment verification failed with ONCHAIN
              await markRunFailed(reference)
              fastify.log.error({ error, reference }, 'ONCHAIN payment verification failed')
              return reply.code(402).send({
                error: 'Payment verification failed',
                details: errorMessage,
              })
            }
          }
        }

        // CRITICAL: Check that payment was actually verified before executing API
        // Status must be 'paid' or 'executed' AND must have signature proving payment
        if (lockedRun.status !== 'paid' && lockedRun.status !== 'executed') {
          fastify.log.warn({
            reference,
            status: lockedRun.status,
            slug,
          }, 'Attempted API execution without payment - invalid status')
          return reply.code(402).send({
            error: 'Payment required',
            message: 'Payment has not been verified. Please complete payment first.',
            reference,
          })
        }

        // CRITICAL: Even if status is paid/executed, verify signature exists
        // Runs without signatures indicate payment bypass attempts
        if (!lockedRun.signature) {
          fastify.log.error({
            reference,
            status: lockedRun.status,
            slug,
          }, '🚨 SECURITY: Run marked as paid/executed but missing payment signature')
          return reply.code(402).send({
            error: 'Payment required',
            message: 'Invalid payment state detected. Please request a new payment transaction.',
            reference,
          })
        }

      // Payment verified, execute the upstream API
      try {
        // Handle internal routes (convert to full URL)
        let targetUrl = blink.endpoint_url
        let isInternalEndpoint = false

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

        // Validate URL to prevent SSRF attacks (skip for internal endpoints)
        if (!isInternalEndpoint) {
          const validation = isValidProxyUrl(targetUrl)
          if (!validation.valid) {
            fastify.log.error({ targetUrl, error: validation.error, slug, reference }, 'SSRF validation failed')
            throw new Error(`Invalid endpoint URL: ${validation.error}`)
          }
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

        // Prepare request body - include reference, signature, payer, and metadata for upstream API
        const requestBody = {
          ...(data || {}), // User-provided data
          reference, // Payment reference for idempotency
          signature: lockedRun.signature, // Transaction signature for verification
          payer: lockedRun.payer, // Include payer wallet for endpoints that need it
          // Include target_wallet from metadata if it exists (for wallet-analyzer)
          ...(lockedRun.metadata?.target_wallet ? { target_wallet: lockedRun.metadata.target_wallet } : {}),
        }

        // Log request body for wallet-analyzer debugging
        if (slug === 'wallet-analyzer') {
          fastify.log.info({
            slug,
            reference,
            metadata: lockedRun.metadata,
            target_wallet: lockedRun.metadata?.target_wallet,
            requestBody
          }, 'Wallet-analyzer request details')
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

        // Update circuit breaker - successful API call
        await updateCircuitBreaker(blink.id, slug, true, getPool(), fastify.log)

        // Mark run as executed
        await markRunExecuted({
          reference,
          durationMs: duration,
        })

        // Return successful response - avoid double-nesting data structure
        // If upstream API already returns {data: ...}, use it directly
        // Otherwise, wrap responseData in our standard format
        const isAlreadyWrapped =
          typeof responseData === 'object' &&
          responseData !== null &&
          !Array.isArray(responseData) &&
          ('data' in responseData || 'html' in responseData || 'type' in responseData)

        if (isAlreadyWrapped) {
          // Upstream response already has structured data - merge with our metadata
          return reply.code(200).send({
            success: true,
            ...responseData, // Spread upstream response (may include data, html, type, etc.)
            reference,
            signature: lockedRun.signature,
            duration_ms: duration,
          })
        } else {
          // Simple response - wrap in our standard format
          return reply.code(200).send({
            success: true,
            data: responseData,
            reference,
            signature: lockedRun.signature,
            duration_ms: duration,
          })
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error'
        const verifyStartTime = Date.now()

        // Mark run as failed first
        await markRunFailed(reference)

        // Update circuit breaker - failed API call
        await updateCircuitBreaker(blink.id, slug, false, getPool(), fastify.log)

        fastify.log.error({
          error,
          slug,
          reference,
          errorMessage,
          runStatus: lockedRun.status,
          hasSignature: !!lockedRun.signature,
        }, 'API execution failed')

        // ========== REFUND LOGIC ==========
        // If payment was successful but API execution failed, issue a refund
        let refundIssued = false
        let refundError: string | null = null

        if (lockedRun.signature && (lockedRun.status === 'paid' || lockedRun.status === 'executed')) {
          try {
            fastify.log.info({
              reference,
              slug,
              signature: lockedRun.signature,
              payer: lockedRun.payer,
            }, 'Payment confirmed but execution failed - issuing refund')

            // Create refund record
            const refund = await createRefund({
              runId: lockedRun.id,
              amountUsdc: blink.price_usdc.toString(),
              reason: `API execution failed: ${errorMessage.substring(0, 200)}`,
            })

            // Get platform refund wallet keypair from env
            const platformKeypairBase58 = process.env.PLATFORM_REFUND_KEYPAIR
            if (!platformKeypairBase58) {
              throw new Error('PLATFORM_REFUND_KEYPAIR not configured')
            }

            // Parse platform keypair
            const platformKeypair = Keypair.fromSecretKey(
              Buffer.from(JSON.parse(platformKeypairBase58))
            )

            // Parse payer address
            const payerPubkey = parsePublicKey(lockedRun.payer || '')
            if (!payerPubkey) {
              throw new Error(`Invalid payer address: ${lockedRun.payer}`)
            }

            // Determine refund amount and token
            const paymentToken = blink.payment_token
            const refundAmount = paymentToken === 'SOL'
              ? solToLamports(blink.price_usdc)
              : usdcToLamports(blink.price_usdc)

            const tokenMint = paymentToken === 'USDC' ? getUsdcMint() : undefined

            // Build refund transaction
            const connection = getConnection()
            const referencePubkey = parsePublicKey(reference)
            if (!referencePubkey) {
              throw new Error('Invalid reference')
            }

            const refundTx = await buildRefundTransaction({
              connection,
              platformWallet: platformKeypair.publicKey,
              user: payerPubkey,
              amount: refundAmount,
              reference: referencePubkey,
              memo: `Refund for failed execution - Blink: ${slug}`,
              tokenMint,
            })

            // Execute refund (sign and broadcast)
            const refundSignature = await executeRefund({
              connection,
              transaction: refundTx,
              platformKeypair,
            })

            // Mark refund as issued
            await markRefundIssued({
              refundId: refund.id,
              signature: refundSignature,
            })

            // Create creator debt record
            await createCreatorDebt({
              creatorId: blink.creator_id,
              blinkId: blink.id,
              refundId: refund.id,
              amountUsdc: blink.price_usdc.toString(),
            })

            refundIssued = true

            const refundDuration = Date.now() - verifyStartTime

            fastify.log.info({
              reference,
              refundId: refund.id,
              refundSignature,
              amount: blink.price_usdc,
              payer: lockedRun.payer,
              refundDurationMs: refundDuration,
            }, '✅ Refund issued successfully')

          } catch (refundErr) {
            refundError = refundErr instanceof Error ? refundErr.message : String(refundErr)

            fastify.log.error({
              error: refundErr,
              reference,
              slug,
              payer: lockedRun.payer,
            }, '❌ Refund failed - manual intervention required')

            // Attempt to mark refund as failed if we have a refund ID
            // This is best-effort - if it fails, logs will capture it
          }
        }

        // Log metrics
        const executionDuration = Date.now() - startTime
        fastify.log.info({
          slug,
          reference,
          executionDurationMs: executionDuration,
          refundIssued,
          refundError,
          event: 'x402_execution_failed',
        }, 'x402 execution metrics')

        // Return error response with refund status
        return reply.code(500).send({
          error: 'API execution failed',
          details: errorMessage,
          refund: refundIssued
            ? {
                issued: true,
                message: 'Your payment has been automatically refunded',
              }
            : refundError
            ? {
                issued: false,
                message: 'Refund failed - please contact support',
                error: refundError,
              }
            : {
                issued: false,
                message: 'No refund needed (payment not confirmed)',
              },
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
