/**
 * Traditional Solana Pay Payment Service
 *
 * Handles on-chain payment verification using reference-based tracking.
 * This is the original Solana Pay / Solana Actions standard.
 */

import { Connection, PublicKey } from '@solana/web3.js'
import { getConnection, verifyPayment, extractPayerWithRetry, getUsdcMint } from '@blink402/solana'
import { getLogger } from '@blink402/config'

const logger = getLogger()

/**
 * Solana Pay verification result
 */
export interface SolanaPayVerificationResult {
  verified: boolean
  signature: string
  payer: string
  amount: string
}

/**
 * Payment verification parameters
 */
export interface SolanaPayVerificationParams {
  reference: string // Reference keypair public key (base58)
  recipient: string // Payment recipient wallet (base58)
  amount: number // Amount in lamports (SOL) or micro-units (USDC)
  token: 'SOL' | 'USDC' // Payment token
  timeout?: number // Verification timeout in milliseconds (default: 30000)
}

/**
 * Verify payment on-chain using Solana Pay reference tracking
 *
 * @param params - Verification parameters
 * @returns Verification result with signature, payer, and amount
 * @throws Error if payment verification fails
 */
export async function verifySolanaPayPayment(
  params: SolanaPayVerificationParams
): Promise<SolanaPayVerificationResult> {
  const { reference, recipient, amount, token, timeout = 30000 } = params

  logger.info('Verifying payment on-chain', {
    reference,
    recipient,
    amount,
    token
  })

  const connection = getConnection()

  // Parse public keys
  let referenceKey: PublicKey
  let recipientKey: PublicKey

  try {
    referenceKey = new PublicKey(reference)
    recipientKey = new PublicKey(recipient)
  } catch (error) {
    throw new Error('Invalid reference or recipient public key')
  }

  // Determine if using native SOL or SPL token
  const isSOL = token === 'SOL'
  const splToken = isSOL ? undefined : getUsdcMint()

  // Verify payment on-chain
  const verificationResult = await verifyPayment({
    connection,
    reference: referenceKey,
    recipient: recipientKey,
    amount: BigInt(amount),
    splToken,
    timeout
  })

  logger.info('Traditional Solana Pay verification successful', {
    signature: verificationResult.signature,
    amount: verificationResult.amount.toString(),
    token
  })

  // Extract payer from on-chain transaction
  const payer = await extractPayerWithRetry(
    connection,
    verificationResult.signature,
    3 // max retries
  )

  if (!payer) {
    throw new Error('Could not extract payer from transaction')
  }

  logger.info('Payment verified via traditional Solana Pay', {
    signature: verificationResult.signature,
    payer
  })

  return {
    verified: true,
    signature: verificationResult.signature,
    payer,
    amount: verificationResult.amount.toString()
  }
}

/**
 * Verify payment with automatic retry on transient errors
 *
 * @param params - Verification parameters
 * @param maxRetries - Maximum number of retries (default: 3)
 * @param retryDelay - Delay between retries in milliseconds (default: 1000)
 * @returns Verification result
 * @throws Error if all retries fail
 */
export async function verifySolanaPayPaymentWithRetry(
  params: SolanaPayVerificationParams,
  maxRetries: number = 3,
  retryDelay: number = 1000
): Promise<SolanaPayVerificationResult> {
  let lastError: Error | null = null

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await verifySolanaPayPayment(params)
    } catch (error) {
      lastError = error as Error
      logger.warn(`Solana Pay verification failed (attempt ${attempt}/${maxRetries})`, error as Error, {
        reference: params.reference
      })

      if (attempt < maxRetries) {
        await new Promise(resolve => setTimeout(resolve, retryDelay))
      }
    }
  }

  throw new Error(`Payment verification failed after ${maxRetries} attempts: ${lastError?.message}`)
}
