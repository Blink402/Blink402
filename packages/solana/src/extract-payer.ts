/**
 * Extract payer from transaction signature
 * This function fetches the transaction details and identifies who paid
 */

import { Connection, PublicKey } from '@solana/web3.js'
import { createLogger } from '@blink402/config'

const logger = createLogger('@blink402/solana-payer-extraction')

export interface ExtractedPayerInfo {
  payer: string
  signature: string
  blockTime: number | null | undefined
}

/**
 * Extract the payer wallet address from a transaction signature
 * For SOL transfers: the first signer is the payer
 * For SPL token transfers: the owner of the source token account
 */
export async function extractPayerFromTransaction(
  connection: Connection,
  signature: string
): Promise<string | null> {
  try {
    // Fetch the transaction with maximum details
    const transaction = await connection.getParsedTransaction(signature, {
      commitment: 'confirmed',
      maxSupportedTransactionVersion: 0,
    })

    if (!transaction) {
      logger.warn('Transaction not found', { signature })
      return null
    }

    // Log transaction structure for debugging
    logger.debug('Transaction structure', {
      signature,
      hasAccountKeys: !!transaction.transaction.message.accountKeys,
      accountKeysLength: transaction.transaction.message.accountKeys?.length,
      hasInstructions: !!transaction.transaction.message.instructions,
      instructionsLength: transaction.transaction.message.instructions?.length
    })

    // For SOL transfers, the fee payer is always the first account that signed
    // This is the account that initiated and paid for the transaction
    const feePayer = transaction.transaction.message.accountKeys.find(
      account => account.signer
    )

    if (feePayer) {
      const payerAddress = feePayer.pubkey.toBase58()
      logger.info('Extracted payer from transaction', { signature, payer: payerAddress })
      return payerAddress
    }

    // Fallback: check parsed instructions for Transfer
    const instructions = transaction.transaction.message.instructions
    for (const instruction of instructions) {
      if ('parsed' in instruction && instruction.parsed) {
        const { type, info } = instruction.parsed

        // SOL transfer
        if (type === 'transfer' && info.source) {
          logger.info('Extracted payer from SOL transfer', { signature, payer: info.source })
          return info.source
        }

        // SPL Token transfer
        if (type === 'transferChecked' && info.authority) {
          logger.info('Extracted payer from SPL token transfer', { signature, payer: info.authority })
          return info.authority
        }

        // SPL Token transfer (older format)
        if (type === 'transfer' && info.authority) {
          logger.info('Extracted payer from SPL token transfer (legacy)', { signature, payer: info.authority })
          return info.authority
        }
      }
    }

    logger.warn('Could not extract payer from transaction', {
      signature,
      accountKeysCount: transaction.transaction.message.accountKeys?.length || 0,
      instructionsCount: transaction.transaction.message.instructions?.length || 0,
      accountKeys: transaction.transaction.message.accountKeys?.map(k => ({
        pubkey: k.pubkey.toBase58(),
        signer: k.signer,
        writable: k.writable
      }))
    })
    return null

  } catch (error) {
    // Detailed error logging with full error object serialization
    const errorDetails = error instanceof Error
      ? {
          message: error.message,
          name: error.name,
          stack: error.stack,
          cause: (error as any).cause
        }
      : {
          raw: String(error),
          type: typeof error
        }

    logger.error('Error extracting payer from transaction', {
      signature,
      error: errorDetails
    })
    return null
  }
}

/**
 * Extract payer with retry logic for RPC failures
 */
export async function extractPayerWithRetry(
  connection: Connection,
  signature: string,
  maxRetries = 3
): Promise<string | null> {
  let lastError: Error | null = null

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const payer = await extractPayerFromTransaction(connection, signature)
      if (payer) {
        return payer
      }

      // If no payer found but no error, don't retry
      return null

    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error))
      logger.warn(
        'Retrying payer extraction after error',
        { attempt: attempt + 1, maxRetries, error: lastError.message }
      )

      // Wait before retry with exponential backoff
      if (attempt < maxRetries - 1) {
        await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 1000))
      }
    }
  }

  logger.error('Failed to extract payer after all retries', { error: lastError })
  return null
}