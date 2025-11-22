/**
 * Transaction Builder Utilities for Solana USDC Payments
 *
 * Provides reusable functions for building Solana transactions that comply
 * with ONCHAIN x402 EXACT-SVM requirements:
 * - Exactly 3 instructions (2 ComputeBudget + 1 SPL Token Transfer)
 * - VersionedTransaction format (v0)
 * - PayAI fee payer to prevent Phantom Lighthouse MEV injection
 *
 * @see apps/web/app/checkout/[slug]/page.tsx for original implementation
 */

import {
  Connection,
  PublicKey,
  TransactionMessage,
  VersionedTransaction,
  ComputeBudgetProgram,
} from '@solana/web3.js'
import {
  getAssociatedTokenAddress,
  createTransferCheckedInstruction,
  getAccount,
} from '@solana/spl-token'
import { createLogger } from '@blink402/config'

const logger = createLogger('@blink402/solana-transaction-builder')

/**
 * CRITICAL: PayAI fee payer prevents Phantom Lighthouse MEV injection
 *
 * When fee payer ≠ user's wallet, Phantom skips Lighthouse MEV protection injection.
 * This keeps the transaction at exactly 3 instructions (ONCHAIN EXACT-SVM requirement).
 * PayAI co-signs and pays network fees during settlement.
 *
 * @see https://onchain.fi/docs - ONCHAIN documentation
 * @see apps/web/app/test-onchain/page.tsx:44 - Original discovery
 */
const PAYAI_FEE_PAYER = new PublicKey("2wKupLR9q6wXYppw8Gr2NvWxKBUqm4PPJKkQfoxHDBg4")

/**
 * USDC Mint addresses (network-dependent)
 */
const USDC_MINT_MAINNET = new PublicKey("EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v")
const USDC_MINT_DEVNET = new PublicKey("4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU")
const USDC_DECIMALS = 6

/**
 * Parameters for building a USDC payment transaction
 */
export interface BuildUsdcPaymentTxParams {
  /** Solana connection */
  connection: Connection
  /** User's wallet public key (the payer) */
  payer: PublicKey
  /** Merchant's wallet public key (the recipient) */
  merchant: PublicKey
  /** Amount in USDC (e.g., 0.01 for $0.01) */
  amountUsdc: number
  /** Network to use (defaults to mainnet) */
  network?: 'mainnet-beta' | 'devnet'
}

/**
 * Build a USDC payment transaction for ONCHAIN x402
 *
 * This function creates a VersionedTransaction with EXACTLY 3 instructions:
 * 1. ComputeBudgetProgram.setComputeUnitLimit (40,000 units)
 * 2. ComputeBudgetProgram.setComputeUnitPrice (1 microlamport)
 * 3. SPL Token Transfer (USDC from payer to merchant)
 *
 * The transaction uses PayAI's fee payer to prevent Phantom Lighthouse from
 * injecting additional instructions that would break ONCHAIN's EXACT-SVM verification.
 *
 * @param params - Transaction building parameters
 * @returns Unsigned VersionedTransaction ready for wallet signing
 * @throws Error if payer/merchant addresses are invalid or ATAs cannot be created
 *
 * @example
 * ```typescript
 * const tx = await buildUsdcPaymentTransaction({
 *   connection,
 *   payer: userWalletPublicKey,
 *   merchant: new PublicKey(blink.payout_wallet),
 *   amountUsdc: blink.price_usdc,
 *   network: 'mainnet-beta'
 * })
 *
 * const signedTx = await window.solana.signTransaction(tx)
 * ```
 */
export async function buildUsdcPaymentTransaction(
  params: BuildUsdcPaymentTxParams
): Promise<VersionedTransaction> {
  const { connection, payer, merchant, amountUsdc, network = 'mainnet-beta' } = params

  logger.info('Building USDC payment transaction', {
    payer: payer.toBase58(),
    merchant: merchant.toBase58(),
    amountUsdc,
    network
  })

  // Select correct USDC mint for network
  const USDC_MINT = network === 'devnet' ? USDC_MINT_DEVNET : USDC_MINT_MAINNET

  // Convert USDC amount to atomic units (6 decimals)
  const amountAtomic = BigInt(Math.round(amountUsdc * 1_000_000))

  // Get Associated Token Addresses for payer and merchant
  let payerATA: PublicKey
  let merchantATA: PublicKey

  try {
    logger.info('Getting payer ATA...', { payer: payer.toBase58() })
    payerATA = await getAssociatedTokenAddress(USDC_MINT, payer)
    logger.info('Payer ATA:', { ata: payerATA.toBase58() })
  } catch (err: any) {
    logger.error('Failed to get payer ATA:', { payer: payer.toBase58(), error: err.message })
    throw new Error(`Your wallet address is invalid or off-curve. Please try disconnecting and reconnecting your wallet.`)
  }

  try {
    logger.info('Getting merchant ATA...', { merchant: merchant.toBase58() })
    merchantATA = await getAssociatedTokenAddress(USDC_MINT, merchant)
    logger.info('Merchant ATA:', { ata: merchantATA.toBase58() })
  } catch (err: any) {
    logger.error('Failed to get merchant ATA:', {
      merchant: merchant.toBase58(),
      error: err.message
    })
    throw new Error(`The merchant's wallet address is invalid (${merchant.toBase58()}). Please contact them to update their payout wallet.`)
  }

  // Verify payer has enough USDC
  try {
    const payerAccount = await getAccount(connection, payerATA)
    const balance = Number(payerAccount.amount) / 1_000_000
    logger.info(`USDC balance: ${balance} USDC`)

    if (balance < amountUsdc) {
      throw new Error(`Insufficient USDC balance. You have ${balance} USDC but need ${amountUsdc} USDC.`)
    }
  } catch (err: any) {
    if (err.message.includes('could not find')) {
      throw new Error('No USDC account found. Please add USDC to your wallet first.')
    }
    throw err
  }

  // Verify merchant ATA exists (ONCHAIN EXACT-SVM requirement)
  const merchantAtaInfo = await connection.getAccountInfo(merchantATA)
  if (!merchantAtaInfo) {
    throw new Error(
      `Merchant USDC account doesn't exist. Please contact the merchant to set up their USDC account.`
    )
  }

  // Get latest blockhash
  const { blockhash } = await connection.getLatestBlockhash('confirmed')

  // Build exactly 3 instructions (ONCHAIN EXACT-SVM requirement)
  const instructions = [
    // Instruction 1: Set compute unit limit
    ComputeBudgetProgram.setComputeUnitLimit({ units: 40_000 }),
    // Instruction 2: Set compute unit price
    ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 1 }),
    // Instruction 3: SPL token transfer
    createTransferCheckedInstruction(
      payerATA,
      USDC_MINT,
      merchantATA,
      payer,
      amountAtomic,
      USDC_DECIMALS
    )
  ]

  logger.info('Transaction has exactly 3 instructions:', {
    count: instructions.length,
    types: [
      'ComputeBudgetProgram.setComputeUnitLimit',
      'ComputeBudgetProgram.setComputeUnitPrice',
      'SPL Token Transfer'
    ]
  })

  // Build VersionedTransaction with PayAI fee payer (prevents Lighthouse injection!)
  const messageV0 = new TransactionMessage({
    payerKey: PAYAI_FEE_PAYER, // PayAI pays network fees
    recentBlockhash: blockhash,
    instructions,
  }).compileToV0Message()

  const transaction = new VersionedTransaction(messageV0)

  logger.info('Transaction built successfully', {
    payerKey: PAYAI_FEE_PAYER.toBase58(),
    blockhash,
    instructionCount: instructions.length
  })

  return transaction
}

/**
 * Validate a wallet public key before using it in transaction building
 *
 * @param address - Public key to validate
 * @param type - Type of address (for error messages)
 * @throws Error if address is invalid
 */
export function validateWalletAddress(address: PublicKey, type: string = 'wallet'): void {
  try {
    // Test if the public key is valid by converting to base58
    address.toBase58()
  } catch (err) {
    throw new Error(`Invalid ${type} address: ${err instanceof Error ? err.message : String(err)}`)
  }
}

/**
 * Get USDC mint address for a specific network
 *
 * @param network - Solana network
 * @returns USDC mint PublicKey
 */
export function getUsdcMintForNetwork(network: 'mainnet-beta' | 'devnet'): PublicKey {
  return network === 'devnet' ? USDC_MINT_DEVNET : USDC_MINT_MAINNET
}

/**
 * Convert USDC amount to atomic units (with 6 decimals)
 *
 * @param amountUsdc - Amount in USDC (e.g., 0.01)
 * @returns Amount in atomic units (e.g., 10000)
 */
export function usdcToAtomic(amountUsdc: number): bigint {
  return BigInt(Math.round(amountUsdc * 1_000_000))
}

/**
 * Convert atomic units to USDC amount
 *
 * @param amountAtomic - Amount in atomic units
 * @returns Amount in USDC
 */
export function atomicToUsdc(amountAtomic: bigint): number {
  return Number(amountAtomic) / 1_000_000
}
