import { FastifyPluginAsync } from 'fastify'
import { updateRunPaymentAtomic, markRunExecuted, getRunByReference, getBlinkById } from '@blink402/database'
import { getConnection } from '@blink402/solana'

/**
 * Verify that a transaction signature exists and is confirmed on-chain
 * @param signature - The transaction signature to verify
 * @returns true if transaction exists and is confirmed, false otherwise
 */
async function verifyTransactionOnChain(signature: string): Promise<boolean> {
  try {
    const connection = getConnection()

    // Fetch transaction with confirmed commitment
    const transaction = await connection.getTransaction(signature, {
      commitment: 'confirmed',
      maxSupportedTransactionVersion: 0, // Support versioned transactions
    })

    // Transaction exists and is confirmed
    return transaction !== null
  } catch (error) {
    console.error('Failed to verify transaction on-chain:', error)
    return false
  }
}

/**
 * POST /api/actions/submit/:reference
 *
 * Callback endpoint for Phantom to send transaction signature after submission.
 * Called automatically by wallet after transaction is confirmed on-chain.
 *
 * Flow:
 * 1. Update run with signature
 * 2. Verify payment on-chain
 * 3. Execute API call
 * 4. Store response and mark as executed
 * 5. Return View Results link
 */
export const actionsSubmitRoutes: FastifyPluginAsync = async (fastify) => {
  // POST endpoint to receive signature from wallet
  fastify.post<{
    Body: {
      account: string      // Wallet address that signed
      signature: string    // Transaction signature on Solana blockchain
    }
    Params: {
      reference: string    // Reference UUID from the URL
    }
  }>('/:reference', async (request, reply) => {
    const { account, signature } = request.body
    const { reference } = request.params

    try {
      fastify.log.info({
        reference,
        signature,
        account
      }, 'Received transaction signature callback from wallet')

      // IDEMPOTENCY: Check if this reference was already processed
      const existingRun = await getRunByReference(reference)

      if (existingRun && existingRun.signature) {
        // Already processed - return success response (idempotent)
        fastify.log.info({
          reference,
          existingSignature: existingRun.signature
        }, 'Callback already processed, returning cached response (idempotent)')

        return reply.code(200).send({
          type: 'external-link',
          icon: 'https://blink402.dev/logo.png',
          title: '✅ Payment Confirmed!',
          description: `Transaction: ${existingRun.signature.substring(0, 8)}...${existingRun.signature.substring(existingRun.signature.length - 8)}`,
          label: 'View Results',
          externalLink: `https://blink402.dev/results/${reference}`
        })
      }

      if (!signature || !account) {
        return reply.code(400).send({
          error: 'Missing signature or account in request body'
        })
      }

      // SECURITY: Verify transaction exists and is confirmed on-chain
      // Prevents spoofed callbacks from executing API without actual payment
      fastify.log.info({ signature }, 'Verifying transaction on-chain...')
      const isConfirmed = await verifyTransactionOnChain(signature)

      if (!isConfirmed) {
        fastify.log.warn({
          signature,
          account,
          reference
        }, 'Transaction not found or not confirmed on-chain - rejecting callback')

        return reply.code(400).send({
          error: 'Transaction not confirmed',
          message: 'The provided transaction signature was not found on-chain or is not yet confirmed'
        })
      }

      fastify.log.info({ signature }, 'Transaction verified on-chain ✅')

      // Update run with signature and payer (using atomic version for concurrency safety)
      await updateRunPaymentAtomic({
        reference,
        signature,
        payer: account
      })

      fastify.log.info({ reference, signature }, 'Updated run with transaction signature')

      // Get run and blink details for API execution
      const run = await getRunByReference(reference)
      if (!run) {
        fastify.log.error({ reference }, 'Run not found after payment update')
        return reply.code(404).send({ error: 'Run not found' })
      }

      const blink = await getBlinkById(run.blink_id)
      if (!blink) {
        fastify.log.error({ blinkId: run.blink_id }, 'Blink not found')
        return reply.code(404).send({ error: 'Blink not found' })
      }

      // Execute API call in background (don't block response)
      // Transaction has been verified on-chain before reaching this point
      setImmediate(async () => {
        // Execute API call
        const startTime = Date.now()
        try {
          // Build request body from metadata
          const requestBody: any = {}
          if (run.metadata?.targetWallet) requestBody.wallet = run.metadata.targetWallet
          if (run.metadata?.text) requestBody.text = run.metadata.text
          if (run.metadata?.tokenAddress) requestBody.tokenAddress = run.metadata.tokenAddress
          if (run.metadata?.imagePrompt) requestBody.imagePrompt = run.metadata.imagePrompt

          const response = await fetch(blink.endpoint_url, {
            method: blink.method,
            headers: {
              'Content-Type': 'application/json',
              'User-Agent': 'Blink402/1.0'
            },
            body: blink.method !== 'GET' ? JSON.stringify(requestBody) : undefined
          })

          const responseData = await response.json()
          const duration = Date.now() - startTime

          // Mark run as executed with response data
          await markRunExecuted({
            reference,
            durationMs: duration,
            responseData: responseData
          })

          fastify.log.info({
            reference,
            duration,
            status: response.status
          }, 'API executed successfully after callback')

        } catch (error) {
          fastify.log.error({
            error: error instanceof Error ? error.message : String(error),
            reference
          }, 'Failed to execute API after callback')
        }
      })

      fastify.log.info({ reference, signature }, 'Callback processed, API execution started in background')

      // Return external link to results page (opens in browser)
      // Using 'external-link' type per Solana Actions spec to open URL in browser
      // instead of 'action' type which would treat it as an Action endpoint
      return reply.code(200).send({
        type: 'external-link',
        icon: 'https://blink402.dev/logo.png',
        title: '✅ Payment Confirmed!',
        description: `Transaction: ${signature.substring(0, 8)}...${signature.substring(signature.length - 8)}`,
        label: 'View Results',
        externalLink: `https://blink402.dev/results/${reference}`
      })

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      const errorStack = error instanceof Error ? error.stack : undefined

      fastify.log.error({
        error: errorMessage,
        stack: errorStack,
        reference,
        signature,
        account
      }, 'Failed to process signature callback')

      return reply.code(500).send({
        error: 'Failed to process signature callback',
        message: errorMessage
      })
    }
  })
}
