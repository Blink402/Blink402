// Solana helper utilities for Blink402
// Handles USDC transfers, payment verification, and transaction building

import { createLogger } from '@blink402/config'

const logger = createLogger('@blink402/solana')

import {
  Connection,
  PublicKey,
  Transaction,
  TransactionInstruction,
  TransactionMessage,
  VersionedTransaction,
  Keypair,
  SystemProgram,
  ComputeBudgetProgram,
  clusterApiUrl,
} from '@solana/web3.js'
import {
  getAssociatedTokenAddress,
  createAssociatedTokenAccountInstruction,
  createTransferCheckedInstruction,
  getAccount,
  TOKEN_PROGRAM_ID,
} from '@solana/spl-token'
// Note: We don't use @solana/pay's validateTransfer or findReference directly anymore
// They fail with StructError on null costUnits in newer Solana RPC responses
// We implement wrapped versions with proper error handling
import BigNumber from 'bignumber.js'

// Export the new Solana Pay verification functions
export {
  verifyPaymentWithSolanaPay,
  findTransactionByReference,
  validateTransferWithRetry,
  type PaymentVerificationOptions,
  type PaymentVerificationResult,
} from './solana-pay-verification'

// Export retry utilities
export {
  withExponentialBackoff,
  retrySolanaRpc,
  withTimeout,
  sleep,
  type RetryOptions,
} from './retry-utils'

// Export payer extraction utilities
export {
  extractPayerFromTransaction,
  extractPayerWithRetry,
  type ExtractedPayerInfo
} from './extract-payer'

// Export transaction builder utilities
export {
  buildUsdcPaymentTransaction,
  validateWalletAddress,
  getUsdcMintForNetwork,
  usdcToAtomic,
  atomicToUsdc,
  type BuildUsdcPaymentTxParams
} from './transaction-builder'

// Export B402 token holder verification and benefits
export {
  getB402HolderTier,
  applyB402Discount,
  getTierDisplayInfo,
  getTierThresholds,
  getAllTierBenefits,
  getRemainingFreeSpins,
  validateB402Mint,
  B402_MINT,
  B402_DECIMALS,
  type TokenHolderTier,
  type TokenHolderInfo,
  type TokenBenefits,
} from './token-holder'

// Export spam token detection
export {
  detectSpamToken,
  detectSpamTokens,
  getRiskLevelDescription,
  getRiskLevelEmoji,
  getRiskLevelColor,
  type SpamRiskLevel,
  type SpamDetectionResult,
  type TokenForSpamCheck,
} from './spam-detector'

// USDC Mint addresses (network-dependent)
// Source: https://www.npmjs.com/package/@payai/x402-solana (official USDC mints)
const USDC_MINT_MAINNET = new PublicKey('EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v')
const USDC_MINT_DEVNET = new PublicKey('4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU')

/**
 * Get the correct USDC mint address for the current network
 * Supports custom USDC mint via NEXT_PUBLIC_USDC_MINT env var
 */
export function getUsdcMint(network?: 'devnet' | 'mainnet-beta'): PublicKey {
  // Allow override via env var (useful for custom tokens or testing)
  if (process.env.NEXT_PUBLIC_USDC_MINT) {
    return new PublicKey(process.env.NEXT_PUBLIC_USDC_MINT)
  }

  // Determine network from env if not provided
  const targetNetwork = network || process.env.NEXT_PUBLIC_SOLANA_NETWORK || 'mainnet-beta'

  return targetNetwork === 'devnet' ? USDC_MINT_DEVNET : USDC_MINT_MAINNET
}

// Legacy export for backwards compatibility (defaults to mainnet)
export const USDC_MINT = USDC_MINT_MAINNET

// USDC has 6 decimals
export const USDC_DECIMALS = 6

// SOL has 9 decimals (lamports)
export const SOL_DECIMALS = 9
export const LAMPORTS_PER_SOL = 1_000_000_000

// Get Solana connection (with fallback RPC endpoints)
export function getConnection(): Connection {
  const rpcUrl = process.env.NEXT_PUBLIC_SOLANA_RPC_URL || process.env.SOLANA_RPC_URL || clusterApiUrl('mainnet-beta')

  return new Connection(rpcUrl, {
    commitment: 'confirmed',
    confirmTransactionInitialTimeout: 60000,
  })
}

// Convert SOL amount (e.g., "0.01") to lamports (smallest unit)
export function solToLamports(amount: string | number): bigint {
  const bn = new BigNumber(amount)
  return BigInt(bn.multipliedBy(LAMPORTS_PER_SOL).toFixed(0))
}

// Convert lamports to SOL display amount
export function lamportsToSol(lamports: bigint | number): string {
  const bn = new BigNumber(lamports.toString())
  return bn.dividedBy(LAMPORTS_PER_SOL).toFixed(9)
}

// Convert USDC amount (e.g., "0.03") to lamports (smallest unit)
export function usdcToLamports(amount: string | number): bigint {
  const bn = new BigNumber(amount)
  return BigInt(bn.multipliedBy(10 ** USDC_DECIMALS).toFixed(0))
}

// Convert lamports to USDC display amount
export function lamportsToUsdc(lamports: bigint | number): string {
  const bn = new BigNumber(lamports.toString())
  const value = bn.dividedBy(10 ** USDC_DECIMALS).toNumber()
  
  // Remove trailing zeros for cleaner display
  return value.toString()
}

// Get or create associated token account for USDC
export async function getOrCreateTokenAccount(
  connection: Connection,
  payer: PublicKey,
  owner: PublicKey,
  mint?: PublicKey
): Promise<{ address: PublicKey; instruction?: TransactionInstruction }> {
  // Use network-aware USDC mint if not specified
  const tokenMint = mint || getUsdcMint()
  const associatedToken = await getAssociatedTokenAddress(tokenMint, owner)

  try {
    // Try to fetch the account
    await getAccount(connection, associatedToken)
    return { address: associatedToken }
  } catch (error) {
    // Account doesn't exist, need to create it
    const instruction = createAssociatedTokenAccountInstruction(
      payer, // payer
      associatedToken, // ata
      owner, // owner
      tokenMint // mint
    )
    return { address: associatedToken, instruction }
  }
}

/**
 * @deprecated This function was used for server-side transaction building in Solana Actions.
 * The ONCHAIN x402 flow uses client-side transaction building instead.
 * For charge mode: Build transactions client-side in the frontend (see apps/web/app/checkout/page.tsx)
 * For reward mode: Use buildRewardTransaction() instead
 *
 * Kept for backwards compatibility with fallback proxy only.
 */
// Build a SOL transfer transaction (simpler than USDC!)
export async function buildSolTransferTransaction(params: {
  connection: Connection
  sender: PublicKey
  recipient: PublicKey
  amount: bigint
  reference: PublicKey
  memo?: string
  platformWallet?: PublicKey
  platformFeeBps?: number // basis points (e.g., 250 = 2.5%)
}): Promise<Transaction> {
  const { connection, sender, recipient, amount, reference, memo, platformWallet, platformFeeBps = 0 } = params

  const instructions: TransactionInstruction[] = []

  // Calculate platform fee and creator amount
  let creatorAmount = amount
  let platformAmount = BigInt(0)

  if (platformWallet && platformFeeBps > 0) {
    platformAmount = (amount * BigInt(platformFeeBps)) / BigInt(10000)
    creatorAmount = amount - platformAmount
  }

  // Create SOL transfer to creator
  const creatorTransferInstruction = SystemProgram.transfer({
    fromPubkey: sender,
    toPubkey: recipient,
    lamports: Number(creatorAmount),
  })

  // Add reference as read-only key (Solana Pay standard)
  creatorTransferInstruction.keys.push({
    pubkey: reference,
    isSigner: false,
    isWritable: false,
  })

  instructions.push(creatorTransferInstruction)

  // Create platform fee transfer if applicable
  if (platformWallet && platformAmount > BigInt(0)) {
    const platformTransferInstruction = SystemProgram.transfer({
      fromPubkey: sender,
      toPubkey: platformWallet,
      lamports: Number(platformAmount),
    })
    instructions.push(platformTransferInstruction)
  }

  // Add memo if provided
  if (memo) {
    const memoProgram = new PublicKey('MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr')
    const memoInstruction = new TransactionInstruction({
      keys: [],
      programId: memoProgram,
      data: Buffer.from(memo, 'utf8'),
    })
    instructions.push(memoInstruction)
  }

  // Get LATEST blockhash for best simulation results
  const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash('finalized')

  // Create transaction
  const transaction = new Transaction()
  transaction.add(...instructions)
  transaction.recentBlockhash = blockhash
  transaction.feePayer = sender
  transaction.lastValidBlockHeight = lastValidBlockHeight

  return transaction
}

/**
 * @deprecated This function was used for server-side transaction building in Solana Actions.
 * The ONCHAIN x402 flow uses client-side transaction building instead.
 * For charge mode: Build transactions client-side in the frontend (see apps/web/app/checkout/page.tsx)
 * For reward mode: Use buildRewardTransaction() instead
 *
 * Kept for backwards compatibility with fallback proxy only.
 */
// Build a USDC transfer transaction
export async function buildUsdcTransferTransaction(params: {
  connection: Connection
  sender: PublicKey
  recipient: PublicKey
  amount: bigint
  reference: PublicKey
  memo?: string
  platformWallet?: PublicKey
  platformFeeBps?: number // basis points (e.g., 250 = 2.5%)
}): Promise<Transaction> {
  const { connection, sender, recipient, amount, reference, memo, platformWallet, platformFeeBps = 0 } = params

  const instructions: TransactionInstruction[] = []

  // Get network-aware USDC mint
  const usdcMint = getUsdcMint()

  // Calculate platform fee and creator amount
  let creatorAmount = amount
  let platformAmount = BigInt(0)

  if (platformWallet && platformFeeBps > 0) {
    platformAmount = (amount * BigInt(platformFeeBps)) / BigInt(10000)
    creatorAmount = amount - platformAmount
  }

  // Get sender's USDC token account
  const senderTokenAccount = await getAssociatedTokenAddress(usdcMint, sender)

  // Get or create recipient's USDC token account
  const recipientTokenInfo = await getOrCreateTokenAccount(connection, sender, recipient, usdcMint)

  // Add create account instruction if needed
  if (recipientTokenInfo.instruction) {
    instructions.push(recipientTokenInfo.instruction)
  }

  // Add USDC transfer to creator
  const creatorTransferInstruction = createTransferCheckedInstruction(
    senderTokenAccount, // source
    usdcMint, // mint
    recipientTokenInfo.address, // destination
    sender, // owner
    creatorAmount, // amount in lamports (smallest unit)
    USDC_DECIMALS // decimals
  )

  // Add reference as a read-only key to the transfer instruction (Solana Pay standard)
  // This is REQUIRED for payment tracking but does NOT make it a multi-signer transaction
  creatorTransferInstruction.keys.push({
    pubkey: reference,
    isSigner: false,
    isWritable: false,
  })

  instructions.push(creatorTransferInstruction)

  // Add platform fee transfer if applicable
  if (platformWallet && platformAmount > BigInt(0)) {
    const platformTokenInfo = await getOrCreateTokenAccount(connection, sender, platformWallet, usdcMint)

    // Add create platform account instruction if needed
    if (platformTokenInfo.instruction) {
      instructions.push(platformTokenInfo.instruction)
    }

    const platformTransferInstruction = createTransferCheckedInstruction(
      senderTokenAccount, // source
      usdcMint, // mint
      platformTokenInfo.address, // destination
      sender, // owner
      platformAmount, // platform fee amount
      USDC_DECIMALS // decimals
    )

    instructions.push(platformTransferInstruction)
  }

  // Add memo if provided
  if (memo) {
    const memoProgram = new PublicKey('MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr')
    const memoInstruction = new TransactionInstruction({
      keys: [],
      programId: memoProgram,
      data: Buffer.from(memo, 'utf8'),
    })
    instructions.push(memoInstruction)
  }

  // Get LATEST blockhash for best simulation results
  const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash('finalized')

  // Create legacy transaction (keeping for compatibility with existing code)
  const transaction = new Transaction()
  transaction.add(...instructions)
  transaction.recentBlockhash = blockhash
  transaction.feePayer = sender
  transaction.lastValidBlockHeight = lastValidBlockHeight

  return transaction
}

/**
 * Build a REWARD transaction where creator pays the user
 * Used for "reward mode" blinks where users get paid for completing actions
 *
 * @param params.connection - Solana connection
 * @param params.creator - Creator's wallet (sender, pays fees + reward)
 * @param params.user - User's wallet (recipient)
 * @param params.amount - Reward amount in lamports
 * @param params.reference - Reference keypair for tracking
 * @param params.memo - Optional memo
 * @param params.tokenMint - Optional token mint (undefined for SOL, USDC mint for USDC)
 * @returns Unsigned transaction (must be signed by creator server-side)
 */
export async function buildRewardTransaction(params: {
  connection: Connection
  creator: PublicKey
  user: PublicKey
  amount: bigint
  reference?: PublicKey // Optional - only needed for on-chain payment tracking
  memo?: string
  tokenMint?: PublicKey // undefined for SOL, USDC mint for USDC
}): Promise<Transaction> {
  const { connection, creator, user, amount, reference, memo, tokenMint } = params

  const instructions: TransactionInstruction[] = []

  // CRITICAL: Set compute unit limit FIRST to prevent "exceeded CUs meter" errors
  // Reward transactions need 80k units for: ATA creation (~23k) + transfer (~6k) + memo (~13k) + buffer
  // Without sufficient compute units, memo instruction fails with "exceeded CUs meter at BPF instruction"
  // Priority fee ensures fast confirmation (prevents TransactionExpiredBlockheightExceededError)
  instructions.push(
    ComputeBudgetProgram.setComputeUnitLimit({ units: 80_000 }), // MUST be 80k or higher
    ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 500_000 }) // 0.0005 SOL priority fee
  )

  if (tokenMint) {
    // SPL Token (USDC) reward
    const creatorTokenAccount = await getAssociatedTokenAddress(tokenMint, creator)
    const userTokenInfo = await getOrCreateTokenAccount(connection, creator, user, tokenMint)

    // Add create account instruction if user doesn't have token account
    if (userTokenInfo.instruction) {
      instructions.push(userTokenInfo.instruction)
    }

    // Create transfer instruction (creator → user)
    const transferInstruction = createTransferCheckedInstruction(
      creatorTokenAccount, // source (creator's token account)
      tokenMint, // mint
      userTokenInfo.address, // destination (user's token account)
      creator, // owner (creator)
      amount, // reward amount
      USDC_DECIMALS // decimals
    )

    // Add reference as read-only key for tracking (optional)
    if (reference) {
      transferInstruction.keys.push({
        pubkey: reference,
        isSigner: false,
        isWritable: false,
      })
    }

    instructions.push(transferInstruction)
  } else {
    // Native SOL reward
    const transferInstruction = SystemProgram.transfer({
      fromPubkey: creator,
      toPubkey: user,
      lamports: Number(amount),
    })

    // Add reference as read-only key (optional)
    if (reference) {
      transferInstruction.keys.push({
        pubkey: reference,
        isSigner: false,
        isWritable: false,
      })
    }

    instructions.push(transferInstruction)
  }

  // Add memo if provided
  if (memo) {
    const memoProgram = new PublicKey('MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr')
    const memoInstruction = new TransactionInstruction({
      keys: [],
      programId: memoProgram,
      data: Buffer.from(memo, 'utf8'),
    })
    instructions.push(memoInstruction)
  }

  // Get latest blockhash (use 'confirmed' not 'finalized' for fresher blockhash)
  // 'finalized' is 32+ blocks old, leaving less validity time before expiration
  const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash('confirmed')

  // Create transaction with creator as fee payer
  const transaction = new Transaction()
  transaction.add(...instructions)
  transaction.recentBlockhash = blockhash
  transaction.feePayer = creator // Creator pays all fees
  transaction.lastValidBlockHeight = lastValidBlockHeight

  return transaction
}

/**
 * Sign and broadcast a reward transaction with retry logic
 * SECURITY CRITICAL: Creator keypair must be securely managed
 *
 * @param params.connection - Solana connection
 * @param params.transaction - Unsigned reward transaction
 * @param params.creatorKeypair - Creator's keypair (from secure storage)
 * @param params.skipConfirmation - Skip waiting for confirmation (faster for concurrent claims)
 * @returns Transaction signature
 */
export async function signAndBroadcastReward(params: {
  connection: Connection
  transaction: Transaction
  creatorKeypair: Keypair
  skipConfirmation?: boolean
}): Promise<string> {
  const { connection, transaction, creatorKeypair, skipConfirmation = false } = params

  try {
    // Get a FRESH blockhash right before signing to prevent expiration
    const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash('confirmed')
    transaction.recentBlockhash = blockhash
    transaction.lastValidBlockHeight = lastValidBlockHeight

    // Sign transaction with creator's keypair
    transaction.sign(creatorKeypair)

    // Serialize and broadcast with priority fees (from buildRewardTransaction)
    const signature = await connection.sendRawTransaction(
      transaction.serialize(),
      {
        skipPreflight: false, // Run preflight checks
        preflightCommitment: 'confirmed',
        maxRetries: 3,
      }
    )

    logger.info('Reward transaction broadcasted', {
      signature,
      creator: creatorKeypair.publicKey.toBase58(),
      skipConfirmation,
    })

    // Optionally wait for confirmation (disabled for high-throughput reward claims)
    if (!skipConfirmation) {
      if (!transaction.recentBlockhash) {
        throw new Error('Transaction missing recentBlockhash')
      }

      await connection.confirmTransaction({
        signature,
        blockhash: transaction.recentBlockhash,
        lastValidBlockHeight: transaction.lastValidBlockHeight!,
      }, 'confirmed')

      logger.info('Reward transaction confirmed', { signature })
    }

    return signature
  } catch (error) {
    // Enhanced error handling for common Solana transaction failures
    if (error instanceof Error) {
      // TransactionExpiredBlockheightExceededError - transaction took too long to confirm
      if (error.name === 'TransactionExpiredBlockheightExceededError' || error.message.includes('block height exceeded')) {
        logger.error('Reward transaction expired - blockhash too old', {
          error: error.message,
          creator: creatorKeypair.publicKey.toBase58(),
        })
        throw new Error('Transaction expired waiting for confirmation. This usually means network congestion. Please try again.')
      }

      // TransactionExpiredTimeoutError - timeout waiting for confirmation
      if (error.message.includes('timeout')) {
        logger.error('Reward transaction timeout', {
          error: error.message,
          creator: creatorKeypair.publicKey.toBase58(),
        })
        throw new Error('Transaction confirmation timeout. The transaction may still succeed - check your wallet.')
      }

      // Insufficient funds
      if (error.message.includes('insufficient funds') || error.message.includes('Attempt to debit')) {
        logger.error('Insufficient funds for reward', {
          error: error.message,
          creator: creatorKeypair.publicKey.toBase58(),
        })
        throw new Error('Creator wallet has insufficient funds to pay reward + network fees.')
      }

      logger.error('Reward transaction failed', {
        error: error.message,
        errorName: error.name,
        errorStack: error.stack,
        creator: creatorKeypair.publicKey.toBase58(),
      })
    } else {
      logger.error('Reward transaction failed - unknown error', {
        error: JSON.stringify(error),
        creator: creatorKeypair.publicKey.toBase58(),
      })
    }

    throw error
  }
}

/**
 * Build a REFUND transaction where platform refunds the user
 * Used when API execution fails after successful payment
 *
 * @param params.connection - Solana connection
 * @param params.platformWallet - Platform refund wallet (sender, pays fees)
 * @param params.user - User's wallet (recipient of refund)
 * @param params.amount - Refund amount in lamports (typically matches original payment)
 * @param params.reference - Original reference keypair for tracking
 * @param params.memo - Optional memo (e.g., "Refund for failed API execution")
 * @param params.tokenMint - Token mint (undefined for SOL, USDC mint for USDC)
 * @returns Unsigned transaction (must be signed by platform keypair server-side)
 */
export async function buildRefundTransaction(params: {
  connection: Connection
  platformWallet: PublicKey
  user: PublicKey
  amount: bigint
  reference: PublicKey
  memo?: string
  tokenMint?: PublicKey // undefined for SOL, USDC mint for USDC
}): Promise<Transaction> {
  const { connection, platformWallet, user, amount, reference, memo, tokenMint } = params

  const instructions: TransactionInstruction[] = []

  if (tokenMint) {
    // SPL Token (USDC) refund
    const platformTokenAccount = await getAssociatedTokenAddress(tokenMint, platformWallet)
    const userTokenInfo = await getOrCreateTokenAccount(connection, platformWallet, user, tokenMint)

    // Add create account instruction if user doesn't have token account
    if (userTokenInfo.instruction) {
      instructions.push(userTokenInfo.instruction)
    }

    // Create transfer instruction (platform → user)
    const transferInstruction = createTransferCheckedInstruction(
      platformTokenAccount, // source (platform's token account)
      tokenMint, // mint
      userTokenInfo.address, // destination (user's token account)
      platformWallet, // owner (platform)
      amount, // refund amount
      USDC_DECIMALS // decimals
    )

    // Add reference as read-only key for tracking
    transferInstruction.keys.push({
      pubkey: reference,
      isSigner: false,
      isWritable: false,
    })

    instructions.push(transferInstruction)
  } else {
    // Native SOL refund
    const transferInstruction = SystemProgram.transfer({
      fromPubkey: platformWallet,
      toPubkey: user,
      lamports: Number(amount),
    })

    // Add reference as read-only key
    transferInstruction.keys.push({
      pubkey: reference,
      isSigner: false,
      isWritable: false,
    })

    instructions.push(transferInstruction)
  }

  // Add memo if provided
  if (memo) {
    const memoProgram = new PublicKey('MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr')
    const memoInstruction = new TransactionInstruction({
      keys: [],
      programId: memoProgram,
      data: Buffer.from(memo, 'utf8'),
    })
    instructions.push(memoInstruction)
  }

  // Get latest blockhash
  const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash('finalized')

  // Create transaction with platform as fee payer
  const transaction = new Transaction()
  transaction.add(...instructions)
  transaction.recentBlockhash = blockhash
  transaction.feePayer = platformWallet // Platform pays all fees
  transaction.lastValidBlockHeight = lastValidBlockHeight

  return transaction
}

/**
 * Sign and broadcast a refund transaction
 * SECURITY CRITICAL: Platform refund keypair must be securely managed
 *
 * @param params.connection - Solana connection
 * @param params.transaction - Unsigned refund transaction
 * @param params.platformKeypair - Platform's refund keypair (from secure storage/env var)
 * @returns Transaction signature
 */
export async function executeRefund(params: {
  connection: Connection
  transaction: Transaction
  platformKeypair: Keypair
}): Promise<string> {
  const { connection, transaction, platformKeypair } = params

  // Sign transaction with platform's keypair
  transaction.sign(platformKeypair)

  // Serialize and broadcast
  const signature = await connection.sendRawTransaction(
    transaction.serialize(),
    {
      skipPreflight: false, // Run preflight checks
      preflightCommitment: 'confirmed',
      maxRetries: 3,
    }
  )

  logger.info('Refund transaction broadcasted', {
    signature,
    platform: platformKeypair.publicKey.toBase58(),
  })

  // Wait for confirmation with timeout
  const latestBlockhash = await connection.getLatestBlockhash()
  await connection.confirmTransaction({
    signature,
    ...latestBlockhash,
  }, 'confirmed')

  logger.info('Refund transaction confirmed', { signature })

  return signature
}

/**
 * Verify a refund transaction was confirmed on-chain
 * Similar to verifyPayment but with less strict validation (just check it exists and succeeded)
 *
 * @param params.connection - Solana connection
 * @param params.signature - Refund transaction signature
 * @returns Transaction details
 */
export async function verifyRefundTransaction(params: {
  connection: Connection
  signature: string
}): Promise<{
  signature: string
  confirmed: boolean
  timestamp: number
}> {
  const { connection, signature } = params

  try {
    // Get transaction details using raw RPC call (avoids costUnits: null issue)
    const tx = await getTransactionRaw(connection, signature, {
      commitment: 'confirmed',
      maxSupportedTransactionVersion: 0,
    })

    if (!tx) {
      throw new Error(`Refund transaction not found on-chain. Signature: ${signature}`)
    }

    // Check if transaction succeeded
    if (tx.meta?.err) {
      const errorDetail = JSON.stringify(tx.meta.err)
      throw new Error(
        `Refund transaction failed on Solana blockchain. Error: ${errorDetail}`
      )
    }

    logger.info('Refund transaction verified', {
      signature,
      blockTime: tx.blockTime,
    })

    return {
      signature,
      confirmed: true,
      timestamp: tx.blockTime || Math.floor(Date.now() / 1000),
    }
  } catch (error) {
    logger.error('Refund verification failed', { signature, error })
    throw error
  }
}

/**
 * Manual validation of transfer details by parsing transaction instructions
 * This is more reliable than @solana/pay's validateTransfer which fails with null costUnits
 */
async function validateTransferManually(params: {
  connection: Connection
  transaction: any // ParsedTransactionWithMeta or ConfirmedTransaction
  expectedRecipient: PublicKey
  expectedAmount: bigint
  expectedToken?: PublicKey // undefined for SOL, USDC mint for USDC
  reference: PublicKey
}): Promise<void> {
  const { connection, transaction, expectedRecipient, expectedAmount, expectedToken, reference } = params

  // Verify transaction metadata exists
  if (!transaction.meta || !transaction.transaction) {
    throw new Error('Transaction metadata not available for validation')
  }

  // Step 1: Verify reference is in transaction
  // Raw RPC returns accountKeys as array of strings (jsonParsed format)
  const accountKeys = transaction.transaction.message.accountKeys || []
  const referenceStr = reference.toBase58()
  const referenceFound = accountKeys.some((key: any) => {
    // Handle both string format and object format
    const keyStr = typeof key === 'string' ? key : key.pubkey
    return keyStr === referenceStr
  })

  if (!referenceFound) {
    throw new Error('Reference not found in transaction - this is not the expected payment')
  }

  // Step 2: Parse and validate transfer based on token type
  if (expectedToken) {
    // SPL Token transfer (e.g., USDC)
    await validateSplTokenTransfer({
      connection,
      transaction,
      expectedRecipient,
      expectedAmount,
      expectedToken,
    })
  } else {
    // Native SOL transfer
    validateSolTransfer({
      transaction,
      expectedRecipient,
      expectedAmount,
    })
  }

  logger.debug('Manual validation passed', {
    recipient: expectedRecipient.toBase58(),
    amount: expectedAmount.toString(),
    tokenType: expectedToken ? 'SPL token' : 'SOL',
  })
}

/**
 * Validate SPL token transfer (e.g., USDC)
 */
async function validateSplTokenTransfer(params: {
  connection: Connection
  transaction: any
  expectedRecipient: PublicKey
  expectedAmount: bigint
  expectedToken: PublicKey
}): Promise<void> {
  const { connection, transaction, expectedRecipient, expectedAmount, expectedToken } = params

  // Get the expected recipient's associated token account for this token
  const expectedRecipientATA = await getAssociatedTokenAddress(expectedToken, expectedRecipient)

  // Look through post-token balances to find transfers
  const postTokenBalances = transaction.meta.postTokenBalances || []
  const preTokenBalances = transaction.meta.preTokenBalances || []

  // Find the token account that received tokens
  let transferFound = false
  let actualAmount = BigInt(0)

  for (const postBalance of postTokenBalances) {
    const preBalance = preTokenBalances.find((pb: any) => pb.accountIndex === postBalance.accountIndex)

    // Calculate the change in balance
    const postAmount = BigInt(postBalance.uiTokenAmount.amount)
    const preAmount = preBalance ? BigInt(preBalance.uiTokenAmount.amount) : BigInt(0)
    const balanceChange = postAmount - preAmount

    // Check if this is the recipient's ATA and received tokens
    // Raw RPC returns accountKeys as array of strings (jsonParsed format)
    const accountKeys = transaction.transaction.message.accountKeys || []
    const accountKey = accountKeys[postBalance.accountIndex]
    const accountPubkeyStr = typeof accountKey === 'string' ? accountKey : accountKey.pubkey

    if (accountPubkeyStr === expectedRecipientATA.toBase58() && balanceChange > 0) {
      transferFound = true
      actualAmount = balanceChange

      // Verify the token mint matches
      if (postBalance.mint !== expectedToken.toBase58()) {
        throw new Error(
          `Wrong token received. Expected ${expectedToken.toBase58()}, got ${postBalance.mint}`
        )
      }

      break
    }
  }

  if (!transferFound) {
    throw new Error(
      `No SPL token transfer found to recipient ${expectedRecipient.toBase58()}. ` +
      `Expected transfer to ATA ${expectedRecipientATA.toBase58()}`
    )
  }

  // Verify amount matches (allow small rounding differences due to decimals)
  const amountDifference = actualAmount > expectedAmount
    ? actualAmount - expectedAmount
    : expectedAmount - actualAmount

  // Allow up to 1 unit difference for rounding (e.g., 1 lamport for USDC's 6 decimals)
  if (amountDifference > BigInt(1)) {
    throw new Error(
      `Wrong amount transferred. Expected ${expectedAmount}, got ${actualAmount}. ` +
      `Difference: ${amountDifference}`
    )
  }

  logger.debug('SPL token transfer validated', {
    recipient: expectedRecipient.toBase58(),
    recipientATA: expectedRecipientATA.toBase58(),
    amount: actualAmount.toString(),
    mint: expectedToken.toBase58(),
  })
}

/**
 * Validate native SOL transfer
 */
function validateSolTransfer(params: {
  transaction: any
  expectedRecipient: PublicKey
  expectedAmount: bigint
}): void {
  const { transaction, expectedRecipient, expectedAmount } = params

  // For SOL transfers, check the pre/post balances
  const postBalances = transaction.meta.postBalances || []
  const preBalances = transaction.meta.preBalances || []

  // Find the recipient's account in the transaction
  // Raw RPC returns accountKeys as array of strings (jsonParsed format)
  const accountKeys = transaction.transaction.message.accountKeys || []
  const recipientStr = expectedRecipient.toBase58()
  const recipientIndex = accountKeys.findIndex((key: any) => {
    const keyStr = typeof key === 'string' ? key : key.pubkey
    return keyStr === recipientStr
  })

  if (recipientIndex === -1) {
    throw new Error(`Recipient ${expectedRecipient.toBase58()} not found in transaction accounts`)
  }

  // Calculate balance change
  const postBalance = BigInt(postBalances[recipientIndex] || 0)
  const preBalance = BigInt(preBalances[recipientIndex] || 0)
  const balanceChange = postBalance - preBalance

  if (balanceChange <= 0) {
    throw new Error(`No SOL received by ${expectedRecipient.toBase58()}. Balance change: ${balanceChange}`)
  }

  // Verify amount (allow small difference for rent/fees)
  const amountDifference = balanceChange > expectedAmount
    ? balanceChange - expectedAmount
    : expectedAmount - balanceChange

  // Allow up to 0.001 SOL difference (1_000_000 lamports) for potential rent-exempt reserves
  if (amountDifference > BigInt(1_000_000)) {
    throw new Error(
      `Wrong SOL amount transferred. Expected ${expectedAmount}, got ${balanceChange}. ` +
      `Difference: ${amountDifference}`
    )
  }

  logger.debug('SOL transfer validated', {
    recipient: expectedRecipient.toBase58(),
    amount: balanceChange.toString(),
  })
}

/**
 * Get transaction via raw RPC call to bypass web3.js struct validation
 * @solana/web3.js v1.x validates costUnits as optional(number()) which rejects null
 * Modern Solana RPCs return costUnits: null (deprecated field), causing StructError
 */
async function getTransactionRaw(connection: Connection, signature: string, options?: {
  commitment?: 'confirmed' | 'finalized'
  maxSupportedTransactionVersion?: number
}): Promise<any> {
  // Make raw RPC call bypassing web3.js validation
  // @ts-ignore - accessing internal _rpcRequest method
  const result = await connection._rpcRequest('getTransaction', [
    signature,
    {
      commitment: options?.commitment || 'confirmed',
      maxSupportedTransactionVersion: options?.maxSupportedTransactionVersion ?? 0,
      encoding: 'jsonParsed',
    },
  ])

  console.log('[getTransactionRaw] Raw RPC result:', JSON.stringify(result).substring(0, 200))

  if (result?.error) {
    throw new Error(`RPC error: ${result.error.message || JSON.stringify(result.error)}`)
  }

  if (!result?.result) {
    console.log('[getTransactionRaw] Full result structure:', JSON.stringify(result))
    return null
  }

  return result.result
}

/**
 * Find transaction signature by reference without struct validation
 * This replaces @solana/pay's findReference which fails with null costUnits
 */
async function findReferenceWithoutValidation(
  connection: Connection,
  reference: PublicKey,
  options?: { finality?: 'confirmed' | 'finalized' }
): Promise<{ signature: string; confirmationStatus: string }> {
  const finality = options?.finality || 'confirmed'

  // Get signatures for the reference account
  const signatures = await connection.getSignaturesForAddress(reference, {
    limit: 10, // Get last 10 transactions
  })

  if (signatures.length === 0) {
    throw new Error('Payment transaction not found. Please complete payment first.')
  }

  // Return the most recent confirmed/finalized transaction
  const confirmedSig = signatures.find(sig =>
    sig.confirmationStatus === 'confirmed' || sig.confirmationStatus === 'finalized'
  )

  if (!confirmedSig) {
    throw new Error('No confirmed transaction found for this payment reference.')
  }

  return {
    signature: confirmedSig.signature,
    confirmationStatus: confirmedSig.confirmationStatus || 'confirmed',
  }
}

/**
 * Verify a payment transaction on-chain
 *
 * IMPORTANT: This function does NOT use @solana/pay's validateTransfer or findReference
 * because they fail with StructError on null costUnits in modern Solana RPC responses.
 * We use custom validation functions instead that parse transaction balances directly.
 *
 * @see findReferenceWithoutValidation - Custom reference finder
 * @see validateTransferManually - Custom transfer validator
 */
export async function verifyPayment(params: {
  connection: Connection
  reference: PublicKey
  recipient: PublicKey
  amount: bigint
  splToken?: PublicKey
  timeout?: number
}): Promise<{
  signature: string
  amount: bigint
  timestamp: number
}> {
  const { connection, reference, recipient, amount, splToken, timeout = 30000 } = params

  // MOCK MODE for testing (enabled via MOCK_PAYMENTS=true env var)
  // This allows tests to run without hitting real Solana RPC endpoints
  // NEVER enable in production (enforced by @blink402/config)
  if (process.env.MOCK_PAYMENTS === 'true' && process.env.NODE_ENV !== 'production') {
    // Generate a deterministic "signature" based on reference
    // This allows idempotency testing (same reference = same mock signature)
    const mockSignature = `MOCK_${reference.toBase58().slice(0, 44)}_VERIFIED`

    return {
      signature: mockSignature,
      amount,
      timestamp: Math.floor(Date.now() / 1000),
    }
  }

  try {
    // Step 1: Find the transaction signature using the reference
    // Use our custom implementation instead of @solana/pay's findReference
    // which fails with StructError on null costUnits
    const signatureInfo = await findReferenceWithoutValidation(connection, reference, { finality: 'confirmed' })
    const signature = signatureInfo.signature

    console.log('[verifyPayment] Found signature:', signature, 'confirmationStatus:', signatureInfo.confirmationStatus)

    // Step 2: CRITICAL FIX - Wait for confirmation BEFORE getting transaction details
    // This prevents false positives where we validate a pending transaction that gets dropped
    const startTime = Date.now()
    let confirmed = false

    while (!confirmed && (Date.now() - startTime < timeout)) {
      const status = await connection.getSignatureStatus(signature)

      if (!status || !status.value) {
        // Transaction not found yet - wait and retry
        console.log('[verifyPayment] Transaction not found yet, waiting...')
        await new Promise(resolve => setTimeout(resolve, 2000))
        continue
      }

      // Check if transaction failed on-chain
      if (status.value.err) {
        throw new Error(
          `Transaction failed on-chain with error: ${JSON.stringify(status.value.err)}. ` +
          `The transaction was rejected by the Solana network.`
        )
      }

      const confirmationStatus = status.value.confirmationStatus

      if (confirmationStatus === 'confirmed' || confirmationStatus === 'finalized') {
        confirmed = true
        console.log('[verifyPayment] Transaction confirmed with status:', confirmationStatus)
      } else {
        // Still processing - wait and retry
        console.log('[verifyPayment] Transaction status:', confirmationStatus, '- waiting for confirmation...')
        await new Promise(resolve => setTimeout(resolve, 2000))
      }
    }

    if (!confirmed) {
      throw new Error(
        `Transaction confirmation timeout after ${timeout}ms. ` +
        `The transaction may still be processing. Signature: ${signature}`
      )
    }

    // Step 3: NOW retrieve full transaction details (safe - already confirmed)
    // Use raw RPC call to bypass web3.js struct validation (costUnits: null issue)
    const tx = await getTransactionRaw(connection, signature, {
      commitment: 'confirmed',
      maxSupportedTransactionVersion: 0,
    })

    console.log('[verifyPayment] Got transaction:', tx ? 'success' : 'null')

    if (!tx) {
      throw new Error(
        `Confirmed transaction not found. This should not happen. Signature: ${signature}`
      )
    }

    // Step 4: Final safety check - verify transaction succeeded (redundant but safe)
    if (tx.meta?.err) {
      const errorDetail = JSON.stringify(tx.meta.err)
      throw new Error(
        `Transaction failed on Solana blockchain. ` +
        `This usually means: insufficient balance, expired blockhash, or account errors. ` +
        `Error: ${errorDetail}. Please submit a new transaction.`
      )
    }

    // Step 5: Validate the transfer details (amount, recipient, reference)
    // Use our comprehensive manual validation instead of @solana/pay's validateTransfer
    // which fails with null costUnits in newer Solana RPC responses
    await validateTransferManually({
      connection,
      transaction: tx,
      expectedRecipient: recipient,
      expectedAmount: amount,
      expectedToken: splToken, // undefined for SOL, USDC mint for USDC
      reference,
    })

    // Step 6: Return successful verification
    return {
      signature,
      amount,
      timestamp: tx.blockTime || Math.floor(Date.now() / 1000),
    }
  } catch (error) {
    // Re-throw error with context
    // Our custom functions already throw descriptive Error messages
    if (error instanceof Error) {
      throw error
    }
    throw new Error(`Payment verification error: ${String(error)}`)
  }
}

// Wait for payment confirmation with timeout
export async function waitForPayment(params: {
  connection: Connection
  reference: PublicKey
  recipient: PublicKey
  amount: bigint
  splToken?: PublicKey
  timeout?: number
  onProgress?: (elapsed: number) => void
}): Promise<{
  signature: string
  amount: bigint
  timestamp: number
}> {
  const { connection, reference, recipient, amount, splToken, timeout = 90000, onProgress } = params

  const startTime = Date.now()
  const checkInterval = 2000 // Check every 2 seconds

  while (Date.now() - startTime < timeout) {
    try {
      const result = await verifyPayment({
        connection,
        reference,
        recipient,
        amount,
        splToken,
      })

      return result
    } catch (error) {
      // If not found yet, continue waiting
      if (error instanceof Error && error.message.includes('not found')) {
        await new Promise((resolve) => setTimeout(resolve, checkInterval))

        if (onProgress) {
          onProgress(Date.now() - startTime)
        }

        continue
      }

      // Other errors should be thrown
      throw error
    }
  }

  throw new Error('Payment verification timeout. Transaction not found on-chain.')
}

// Generate a reference keypair for tracking payments
export function generateReference(): Keypair {
  return Keypair.generate()
}

// Parse a public key safely
export function parsePublicKey(key: string): PublicKey | null {
  try {
    return new PublicKey(key)
  } catch {
    return null
  }
}

// Validate a Solana address
export function isValidSolanaAddress(address: string): boolean {
  try {
    new PublicKey(address)
    return true
  } catch {
    return false
  }
}

// Get transaction explorer URL
export function getExplorerUrl(signature: string, cluster: 'mainnet-beta' | 'devnet' | 'testnet' = 'mainnet-beta'): string {
  const clusterParam = cluster === 'mainnet-beta' ? '' : `?cluster=${cluster}`
  return `https://solscan.io/tx/${signature}${clusterParam}`
}

// Format a public key for display (shortened)
export function formatPublicKey(key: PublicKey | string, chars: number = 4): string {
  const keyStr = typeof key === 'string' ? key : key.toBase58()
  if (keyStr.length <= chars * 2) return keyStr
  return `${keyStr.slice(0, chars)}...${keyStr.slice(-chars)}`
}

/**
 * Check if payment verification is in mock mode
 * Mock mode bypasses actual on-chain verification for testing
 * NEVER returns true in production (safety check in verifyPayment)
 */
export function isMockPaymentsEnabled(): boolean {
  return process.env.MOCK_PAYMENTS === 'true' && process.env.NODE_ENV !== 'production'
}

// ========== FIX PACK 7: SIGNATURE VERIFICATION FOR ANTI-SPAM ==========

/**
 * Verify that a message was signed by a specific wallet
 * Used for reward blinks to prevent spam/bot attacks
 *
 * @param message - The original message that was signed (e.g., challenge string)
 * @param signature - The signature as base58 string or Uint8Array
 * @param publicKey - The wallet's public key (expected signer)
 * @returns true if signature is valid, false otherwise
 */
export function verifyMessageSignature(
  message: string,
  signature: string | Uint8Array,
  publicKey: string | PublicKey
): boolean {
  try {
    // Import nacl for ed25519 signature verification
    // Solana uses ed25519 for wallet signatures
    const nacl = require('tweetnacl')
    const bs58 = require('bs58')

    // Convert inputs to proper types
    const messageBytes = new TextEncoder().encode(message)
    const signatureBytes = typeof signature === 'string' ? bs58.decode(signature) : signature
    const publicKeyObj = typeof publicKey === 'string' ? new PublicKey(publicKey) : publicKey
    const publicKeyBytes = publicKeyObj.toBytes()

    // Verify signature using ed25519
    return nacl.sign.detached.verify(messageBytes, signatureBytes, publicKeyBytes)
  } catch (error) {
    logger.error('Signature verification failed', { error, message, publicKey })
    return false
  }
}

/**
 * Generate a challenge message for wallet signature
 * Used in reward blinks to prevent replay attacks
 *
 * @param params - Challenge parameters
 * @returns Challenge string to be signed by user's wallet
 */
export function generateChallengeMessage(params: {
  wallet: string
  blinkId: string | number
  nonce: string
  timestamp: number
}): string {
  const { wallet, blinkId, nonce, timestamp} = params
  return `Blink402 Reward Claim\n\nWallet: ${wallet}\nBlink ID: ${blinkId}\nNonce: ${nonce}\nTimestamp: ${timestamp}\n\nSign this message to claim your reward.`
}
