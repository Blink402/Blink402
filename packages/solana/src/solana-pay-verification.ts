// Official Solana Pay verification implementation
// Uses @solana/pay's validateTransfer and findReference with proper error handling

import {
  Connection,
  PublicKey,
  Commitment,
} from '@solana/web3.js'
import {
  findReference,
  FindReferenceError,
  validateTransfer,
  ValidateTransferError,
} from '@solana/pay'
import BigNumber from 'bignumber.js'
import { createLogger } from '@blink402/config'

const logger = createLogger('@blink402/solana-pay-verification')

export interface PaymentVerificationOptions {
  connection: Connection
  reference: PublicKey
  recipient: PublicKey
  amount: bigint | BigNumber
  splToken?: PublicKey
  timeout?: number
  commitment?: Commitment
}

export interface PaymentVerificationResult {
  signature: string
  blockTime?: number | null
  slot: number
  confirmationStatus?: string
}

/**
 * Verify a payment using official Solana Pay methods with polling and proper error handling
 * Replaces custom verification implementation with battle-tested official methods
 */
export async function verifyPaymentWithSolanaPay(
  options: PaymentVerificationOptions
): Promise<PaymentVerificationResult> {
  const {
    connection,
    reference,
    recipient,
    amount,
    splToken,
    timeout = 30000, // Default 30 seconds
    commitment = 'finalized', // Use finalized for production
  } = options

  const startTime = Date.now()
  const pollInterval = 1000 // 1 second between polls
  let attempts = 0
  const maxAttempts = Math.floor(timeout / pollInterval)

  logger.info('Starting payment verification with Solana Pay', {
    reference: reference.toBase58(),
    recipient: recipient.toBase58(),
    amount: amount.toString(),
    splToken: splToken?.toBase58(),
    commitment,
    maxAttempts,
  })

  // Poll for the transaction with the reference
  while (attempts < maxAttempts) {
    try {
      // Step 1: Find the transaction with the reference
      const signatureInfo = await findReference(connection, reference, {
        finality: commitment as 'confirmed' | 'finalized',
      })

      logger.info('Transaction found with reference', {
        signature: signatureInfo.signature,
        slot: signatureInfo.slot,
        confirmationStatus: signatureInfo.confirmationStatus,
        attempts: attempts + 1,
      })

      // Step 2: Validate the transaction details
      try {
        const validationOptions = {
          commitment: commitment as 'confirmed' | 'finalized',
        }

        // Convert amount to BigNumber if it's bigint
        const amountBN = typeof amount === 'bigint'
          ? new BigNumber(amount.toString())
          : amount

        await validateTransfer(
          connection,
          signatureInfo.signature,
          {
            recipient,
            amount: amountBN,
            splToken,
            reference,
          },
          validationOptions
        )

        logger.info('Payment validated successfully', {
          signature: signatureInfo.signature,
          recipient: recipient.toBase58(),
          amount: amountBN.toString(),
          splToken: splToken?.toBase58(),
        })

        return {
          signature: signatureInfo.signature,
          blockTime: signatureInfo.blockTime,
          slot: signatureInfo.slot,
          confirmationStatus: signatureInfo.confirmationStatus,
        }

      } catch (validateError) {
        if (validateError instanceof ValidateTransferError) {
          const errorMessage = validateError.message.toLowerCase()

          // Handle specific validation errors
          if (errorMessage.includes('recipient not found')) {
            throw new Error(`Payment went to wrong recipient. Expected: ${recipient.toBase58()}`)
          }
          if (errorMessage.includes('amount')) {
            throw new Error(`Payment amount mismatch. Expected: ${amount.toString()}`)
          }
          if (errorMessage.includes('token')) {
            throw new Error(`Wrong token type. Expected SPL token: ${splToken?.toBase58() || 'SOL'}`)
          }
          if (errorMessage.includes('reference')) {
            throw new Error(`Reference mismatch in transaction`)
          }

          // Generic validation error
          throw new Error(`Payment validation failed: ${validateError.message}`)
        }
        throw validateError
      }

    } catch (error) {
      if (error instanceof FindReferenceError) {
        // Transaction not found yet, continue polling
        logger.debug('Transaction not found yet, continuing to poll', {
          attempts: attempts + 1,
          maxAttempts,
          elapsed: Date.now() - startTime,
        })

        attempts++

        // Check if we've exceeded timeout
        if (Date.now() - startTime > timeout) {
          throw new Error(`Payment verification timeout after ${timeout}ms. Transaction not found.`)
        }

        // Wait before next poll
        await new Promise(resolve => setTimeout(resolve, pollInterval))
        continue
      }

      // Re-throw other errors
      throw error
    }
  }

  // Should not reach here, but handle max attempts exceeded
  throw new Error(`Payment verification failed after ${maxAttempts} attempts. Transaction not found.`)
}

/**
 * Find a transaction by reference without validation
 * Useful for checking transaction status without validating amounts
 */
export async function findTransactionByReference(
  connection: Connection,
  reference: PublicKey,
  options?: {
    commitment?: Commitment
    limit?: number
  }
): Promise<string | null> {
  try {
    const signatureInfo = await findReference(connection, reference, {
      finality: (options?.commitment || 'confirmed') as 'confirmed' | 'finalized',
    })

    return signatureInfo.signature
  } catch (error) {
    if (error instanceof FindReferenceError) {
      return null
    }
    throw error
  }
}

/**
 * Validate a transaction with retry logic for transient errors
 */
export async function validateTransferWithRetry(
  connection: Connection,
  signature: string,
  expectedDetails: {
    recipient: PublicKey
    amount: BigNumber
    splToken?: PublicKey
    reference?: PublicKey
  },
  options?: {
    maxRetries?: number
    retryDelay?: number
    commitment?: Commitment
  }
): Promise<void> {
  const maxRetries = options?.maxRetries || 3
  const retryDelay = options?.retryDelay || 1000
  const commitment = options?.commitment || 'finalized'

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      await validateTransfer(
        connection,
        signature,
        expectedDetails,
        { commitment: commitment as 'confirmed' | 'finalized' }
      )
      return // Success
    } catch (error) {
      if (error instanceof ValidateTransferError) {
        // Don't retry validation errors - these are permanent failures
        throw error
      }

      // Retry on RPC errors
      if (attempt < maxRetries - 1) {
        logger.warn('Validation failed, retrying', {
          error: error instanceof Error ? error.message : String(error),
          attempt: attempt + 1,
          maxRetries,
        })

        await new Promise(resolve => setTimeout(resolve, retryDelay * Math.pow(2, attempt)))
        continue
      }

      throw error
    }
  }
}