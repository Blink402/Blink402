/**
 * Wallet Address Extraction Utilities
 *
 * Extract wallet addresses from various sources for rate limiting and tracking.
 * Supports x402 payment headers, transaction signatures, and authenticated wallets.
 */

import { VersionedTransaction } from '@solana/web3.js'
import { getConnection } from '@blink402/solana'

/**
 * Extract wallet address from various sources
 *
 * Priority order:
 * 1. Explicit user wallet (from Privy authentication in reward mode)
 * 2. x402 payment header (charge mode)
 * 3. Transaction signature lookup (legacy reward mode)
 *
 * @param params - Extraction parameters
 * @returns Wallet address if found, null otherwise
 */
export async function extractWalletAddress(params: {
  paymentHeader?: string
  signature?: string
  userWallet?: string
  reference?: string
}): Promise<string | null> {
  const { paymentHeader, signature, userWallet } = params

  // Priority 1: Explicit user wallet from Privy authentication (reward mode)
  if (userWallet) {
    return userWallet
  }

  // Priority 2: Extract from x402 payment header (charge mode)
  if (paymentHeader) {
    const wallet = await extractWalletFromPaymentHeader(paymentHeader)
    if (wallet) return wallet
  }

  // Priority 3: Extract from transaction signature (legacy reward mode)
  if (signature) {
    const wallet = await extractWalletFromSignature(signature)
    if (wallet) return wallet
  }

  return null
}

/**
 * Extract wallet address from x402 payment header
 * @param paymentHeader - Base64-encoded x402 payment header
 * @returns Wallet address if found, null otherwise
 */
export async function extractWalletFromPaymentHeader(
  paymentHeader: string
): Promise<string | null> {
  try {
    const headerData = JSON.parse(
      Buffer.from(paymentHeader, 'base64').toString('utf-8')
    )

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

  return null
}

/**
 * Extract wallet address from transaction signature
 * @param signature - Solana transaction signature
 * @returns Wallet address if found, null otherwise
 */
export async function extractWalletFromSignature(
  signature: string
): Promise<string | null> {
  try {
    const connection = getConnection()
    const tx = await connection.getTransaction(signature, {
      commitment: 'finalized',
      maxSupportedTransactionVersion: 0,
    })

    if (tx && tx.transaction.message.staticAccountKeys.length > 0) {
      return tx.transaction.message.staticAccountKeys[0].toBase58()
    }
  } catch (error) {
    // Ignore on-chain lookup errors
  }

  return null
}
