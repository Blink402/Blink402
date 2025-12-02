/**
 * PayAI x402 Payment Service
 *
 * Handles payment verification and settlement using PayAI facilitator.
 * Uses the x402-solana SDK for standardized x402 payment processing.
 */

import { X402PaymentHandler } from 'x402-solana/server'
import { VersionedTransaction } from '@solana/web3.js'
import { createLogger } from '@blink402/config'

const logger = createLogger('payment:payai')

/**
 * PayAI payment verification result
 */
export interface PayAIVerificationResult {
  verified: boolean
  payer: string
  signature: string
}

/**
 * Payment requirements for PayAI verification
 */
export interface PaymentRequirements {
  price: {
    amount: number // Amount in micro-units (e.g., 10000 = 0.01 USDC)
    asset: {
      address: string // Token mint address
      decimals: number // Token decimals
    }
  }
  network: 'solana' | 'solana-devnet'
  config: {
    description: string
    resource: string // Full URL to the resource
  }
}

/**
 * Initialize PayAI payment handler
 */
export function initializePayAIHandler(): X402PaymentHandler {
  return new X402PaymentHandler({
    network: process.env.SOLANA_NETWORK === 'devnet' ? 'solana-devnet' : 'solana',
    treasuryAddress: process.env.TREASURY_WALLET || process.env.PAYOUT_WALLET || '',
    facilitatorUrl: 'https://facilitator.payai.network',
  })
}

/**
 * Extract payer wallet from x402 payment header
 *
 * CRITICAL: PayAI uses a designated fee payer (2wKupLR9q6wXYppw8Gr2NvWxKBUqm4PPJKkQfoxHDBg4)
 * The actual user wallet is in the SPL Token transfer instruction as the authority.
 *
 * @param paymentHeader - Base64-encoded x402 payment header
 * @returns Payer wallet address or empty string if extraction fails
 */
export function extractPayerFromX402(paymentHeader: string): string {
  try {
    const headerData = JSON.parse(Buffer.from(paymentHeader, 'base64').toString('utf-8'))

    // x402 header format: {x402Version, scheme, network, payload: {transaction}}
    if (!headerData.payload || !headerData.payload.transaction) {
      logger.warn('Payment header missing transaction payload')
      return ''
    }

    const txBytes = Buffer.from(headerData.payload.transaction, 'base64')
    const tx = VersionedTransaction.deserialize(txBytes)

    // Find the SPL Token transfer instruction (should be instruction 3)
    // Transaction structure: [ComputeBudget, ComputeBudget, TokenTransfer]
    if (!tx.message.compiledInstructions || tx.message.compiledInstructions.length < 3) {
      logger.warn('Transaction missing compiled instructions')
      return ''
    }

    const transferIx = tx.message.compiledInstructions[2]

    // For SPL Token transferChecked instruction, the authority (actual user) is account index 3
    // Accounts: [source, mint, destination, authority, ...]
    if (!transferIx.accountKeyIndexes || transferIx.accountKeyIndexes.length < 4) {
      logger.warn('Transfer instruction missing account indexes')
      return ''
    }

    const authorityIndex = transferIx.accountKeyIndexes[3]
    const payer = tx.message.staticAccountKeys[authorityIndex].toBase58()

    logger.info('Extracted actual user wallet from transfer instruction', { payer, authorityIndex })
    return payer
  } catch (error) {
    logger.warn('Could not extract payer from payment header', {
      error: error instanceof Error ? error.message : String(error)
    })
    return ''
  }
}

/**
 * Extract transaction signature from x402 payment header
 *
 * Note: Transaction will be signed by facilitator during settlement.
 * This extracts the transaction structure for tracking purposes.
 *
 * @param paymentHeader - Base64-encoded x402 payment header
 * @param reference - Fallback reference if extraction fails
 * @returns Transaction signature or reference as fallback
 */
export function extractSignatureFromX402(paymentHeader: string, reference: string): string {
  try {
    const headerData = JSON.parse(Buffer.from(paymentHeader, 'base64').toString('utf-8'))

    if (!headerData.payload?.transaction) {
      return reference
    }

    const txBytes = Buffer.from(headerData.payload.transaction, 'base64')
    const tx = VersionedTransaction.deserialize(txBytes)

    // Transaction will be signed by facilitator during settlement
    // For now, use reference as placeholder until we get on-chain confirmation
    return reference
  } catch (error) {
    logger.warn('Could not extract transaction from payment header', {
      error: error instanceof Error ? error.message : String(error)
    })
    return reference
  }
}

/**
 * Create PayAI payment requirements from our internal format
 *
 * @param handler - Initialized PayAI handler
 * @param requirements - Our internal payment requirements
 * @returns PayAI SDK payment requirements
 */
async function createSDKPaymentRequirements(
  handler: X402PaymentHandler,
  requirements: PaymentRequirements
) {
  return await handler.createPaymentRequirements({
    price: {
      amount: String(requirements.price.amount), // Convert number to string
      asset: {
        address: requirements.price.asset.address,
        decimals: requirements.price.asset.decimals
      }
    },
    network: requirements.network,
    config: {
      description: requirements.config.description,
      resource: requirements.config.resource as `${string}://${string}` // Type assertion for URL format
    }
  })
}

/**
 * Verify payment using PayAI facilitator
 *
 * @param handler - Initialized PayAI handler
 * @param paymentHeader - Base64-encoded x402 payment header
 * @param requirements - Payment requirements for verification
 * @returns True if payment is verified
 * @throws Error if verification fails
 */
export async function verifyPayAIPayment(
  handler: X402PaymentHandler,
  paymentHeader: string,
  requirements: PaymentRequirements
): Promise<boolean> {
  logger.info('Verifying payment with PayAI facilitator', {
    amount: requirements.price.amount,
    network: requirements.network
  })

  // Convert to SDK format
  const sdkRequirements = await createSDKPaymentRequirements(handler, requirements)

  // NOTE: PayAI SDK returns boolean, not object
  const isVerified = await handler.verifyPayment(paymentHeader, sdkRequirements)

  if (!isVerified) {
    throw new Error('PayAI payment verification failed - invalid payment')
  }

  logger.info('PayAI payment verification successful', { verified: true })
  return true
}

/**
 * Settle payment using PayAI facilitator
 *
 * This broadcasts the transaction on-chain via the facilitator.
 *
 * @param handler - Initialized PayAI handler
 * @param paymentHeader - Base64-encoded x402 payment header
 * @param requirements - Payment requirements for settlement
 * @throws Error if settlement fails
 */
export async function settlePayAIPayment(
  handler: X402PaymentHandler,
  paymentHeader: string,
  requirements: PaymentRequirements
): Promise<void> {
  logger.info('Settling payment with PayAI facilitator')

  // Convert to SDK format
  const sdkRequirements = await createSDKPaymentRequirements(handler, requirements)

  await handler.settlePayment(paymentHeader, sdkRequirements)

  logger.info('PayAI payment settlement successful')
}

/**
 * Complete PayAI payment flow: verify + settle + extract payer
 *
 * @param handler - Initialized PayAI handler
 * @param paymentHeader - Base64-encoded x402 payment header
 * @param requirements - Payment requirements
 * @param reference - Payment reference for fallback
 * @returns Verification result with payer and signature
 * @throws Error if verification or settlement fails
 */
export async function processPayAIPayment(
  handler: X402PaymentHandler,
  paymentHeader: string,
  requirements: PaymentRequirements,
  reference: string
): Promise<PayAIVerificationResult> {
  // Step 1: Verify payment
  await verifyPayAIPayment(handler, paymentHeader, requirements)

  // Step 2: Settle payment
  await settlePayAIPayment(handler, paymentHeader, requirements)

  // Step 3: Extract payer and signature
  const payer = extractPayerFromX402(paymentHeader)
  const signature = extractSignatureFromX402(paymentHeader, reference)

  return {
    verified: true,
    payer,
    signature
  }
}
