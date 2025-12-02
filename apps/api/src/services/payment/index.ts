/**
 * Payment Service Facade
 *
 * Unified interface for all payment verification methods:
 * - PayAI x402 (facilitator-based settlement)
 * - Traditional Solana Pay (on-chain verification)
 * - ONCHAIN Connect SDK (trust-based)
 *
 * This facade simplifies payment handling in route handlers by providing
 * a consistent interface across all payment methods.
 */

import { X402PaymentHandler } from 'x402-solana/server'
import {
  PayAIVerificationResult,
  PaymentRequirements,
  initializePayAIHandler,
  processPayAIPayment,
  extractPayerFromX402,
  extractSignatureFromX402,
  verifyPayAIPayment,
  settlePayAIPayment
} from './payai.js'
import {
  SolanaPayVerificationResult,
  SolanaPayVerificationParams,
  verifySolanaPayPayment,
  verifySolanaPayPaymentWithRetry
} from './solana-pay.js'
import {
  OnchainVerificationResult,
  trustOnchainPayment,
  isValidOnchainTxHash
} from './onchain.js'

/**
 * Payment method type
 */
export type PaymentMethod = 'payai-x402' | 'solana-pay' | 'onchain-connect'

/**
 * Unified payment verification result
 */
export interface PaymentVerificationResult {
  method: PaymentMethod
  verified: boolean
  signature: string
  payer: string
  facilitator?: string // For PayAI and ONCHAIN
  facilitatorTxHash?: string // For PayAI and ONCHAIN
}

/**
 * Payment service configuration
 */
export interface PaymentServiceConfig {
  payaiHandler?: X402PaymentHandler
  enableRetry?: boolean
  maxRetries?: number
  retryDelay?: number
}

/**
 * Payment Service - Unified payment verification interface
 */
export class PaymentService {
  private payaiHandler: X402PaymentHandler

  constructor(config?: PaymentServiceConfig) {
    this.payaiHandler = config?.payaiHandler || initializePayAIHandler()
  }

  /**
   * Verify PayAI x402 payment
   */
  async verifyPayAI(
    paymentHeader: string,
    requirements: PaymentRequirements,
    reference: string
  ): Promise<PaymentVerificationResult> {
    const result = await processPayAIPayment(
      this.payaiHandler,
      paymentHeader,
      requirements,
      reference
    )

    return {
      method: 'payai-x402',
      verified: result.verified,
      signature: result.signature,
      payer: result.payer,
      facilitator: 'PayAI',
      facilitatorTxHash: result.signature
    }
  }

  /**
   * Verify traditional Solana Pay payment
   */
  async verifySolanaPay(
    params: SolanaPayVerificationParams,
    enableRetry: boolean = false
  ): Promise<PaymentVerificationResult> {
    const result = enableRetry
      ? await verifySolanaPayPaymentWithRetry(params)
      : await verifySolanaPayPayment(params)

    return {
      method: 'solana-pay',
      verified: result.verified,
      signature: result.signature,
      payer: result.payer
    }
  }

  /**
   * Trust ONCHAIN Connect SDK payment
   */
  async trustOnchain(
    txHash: string,
    reference: string
  ): Promise<PaymentVerificationResult> {
    const result = await trustOnchainPayment(txHash, reference)

    return {
      method: 'onchain-connect',
      verified: result.verified,
      signature: result.txHash,
      payer: result.payer,
      facilitator: 'ONCHAIN Connect SDK',
      facilitatorTxHash: result.txHash
    }
  }

  /**
   * Auto-detect payment method and verify
   *
   * @param params - Detection parameters
   * @returns Verification result
   */
  async verifyPayment(params: {
    paymentHeader?: string
    txHash?: string
    reference: string
    recipient?: string
    amount?: number
    token?: 'SOL' | 'USDC'
    paymentRequirements?: PaymentRequirements
  }): Promise<PaymentVerificationResult> {
    const { paymentHeader, txHash, reference, recipient, amount, token, paymentRequirements } = params

    // Detect payment method based on available parameters
    if (txHash) {
      // ONCHAIN Connect SDK flow
      return this.trustOnchain(txHash, reference)
    }

    if (paymentHeader && paymentRequirements) {
      // PayAI x402 flow
      return this.verifyPayAI(paymentHeader, paymentRequirements, reference)
    }

    if (recipient && amount && token) {
      // Traditional Solana Pay flow
      return this.verifySolanaPay({
        reference,
        recipient,
        amount,
        token
      })
    }

    throw new Error('Could not detect payment method - missing required parameters')
  }
}

/**
 * Create payment service singleton
 */
let paymentService: PaymentService | null = null

export function getPaymentService(): PaymentService {
  if (!paymentService) {
    paymentService = new PaymentService()
  }
  return paymentService
}

/**
 * Re-export all types and functions for convenience
 */
export type {
  PayAIVerificationResult,
  PaymentRequirements,
  SolanaPayVerificationResult,
  SolanaPayVerificationParams,
  OnchainVerificationResult
}

export {
  initializePayAIHandler,
  processPayAIPayment,
  extractPayerFromX402,
  extractSignatureFromX402,
  verifyPayAIPayment,
  settlePayAIPayment,
  verifySolanaPayPayment,
  verifySolanaPayPaymentWithRetry,
  trustOnchainPayment,
  isValidOnchainTxHash
}
