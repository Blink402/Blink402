/**
 * ONCHAIN Connect SDK Payment Service
 *
 * Handles trust-based payment processing for ONCHAIN Connect SDK.
 * Unlike PayAI and Solana Pay, ONCHAIN has already verified and settled
 * the payment, so we just trust the txHash they provide.
 */

import { getLogger } from '@blink402/config'

const logger = getLogger()

/**
 * ONCHAIN Connect verification result
 */
export interface OnchainVerificationResult {
  verified: boolean
  txHash: string
  payer: string // Not available in ONCHAIN Connect - returns empty string
}

/**
 * Trust ONCHAIN Connect SDK payment
 *
 * ONCHAIN Connect SDK has already verified and settled the payment
 * on their end. We just need to record the txHash and trust it.
 *
 * @param txHash - Transaction hash from ONCHAIN Connect
 * @param reference - Payment reference for logging
 * @returns Verification result with txHash
 */
export async function trustOnchainPayment(
  txHash: string,
  reference: string
): Promise<OnchainVerificationResult> {
  logger.info('Trusting ONCHAIN Connect SDK settlement', {
    reference,
    txHash
  })

  // ONCHAIN Connect uses a simple txHash format
  // They have already verified and settled the payment
  // We just record it for tracking purposes

  if (!txHash) {
    throw new Error('Missing txHash from ONCHAIN Connect')
  }

  logger.info('Payment trusted via ONCHAIN Connect SDK', {
    reference,
    txHash
  })

  return {
    verified: true,
    txHash,
    payer: '' // Payer not available in simple txHash format
  }
}

/**
 * Validate ONCHAIN Connect txHash format
 *
 * @param txHash - Transaction hash to validate
 * @returns True if valid
 */
export function isValidOnchainTxHash(txHash: string): boolean {
  // ONCHAIN Connect txHash should be a base58 Solana transaction signature
  // Typical length: 87-88 characters
  return txHash.length >= 80 && txHash.length <= 90 && /^[1-9A-HJ-NP-Za-km-z]+$/.test(txHash)
}
