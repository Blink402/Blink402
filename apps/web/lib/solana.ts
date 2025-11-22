// Solana helper utilities for Blink402
// Handles USDC transfers, payment verification, and transaction building

import {
  Connection,
  PublicKey,
  Transaction,
  TransactionInstruction,
  Keypair,
  SystemProgram,
  clusterApiUrl,
} from '@solana/web3.js'
import {
  getAssociatedTokenAddress,
  createAssociatedTokenAccountInstruction,
  createTransferCheckedInstruction,
  getAccount,
} from '@solana/spl-token'
import { validateTransfer, ValidateTransferError, ValidateTransferFields, FindReferenceError, findReference } from '@solana/pay'
import BigNumber from 'bignumber.js'

// USDC Mint address on Solana mainnet
export const USDC_MINT = new PublicKey('EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v')

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
  mint: PublicKey = USDC_MINT
): Promise<{ address: PublicKey; instruction?: TransactionInstruction }> {
  const associatedToken = await getAssociatedTokenAddress(mint, owner)

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
      mint // mint
    )
    return { address: associatedToken, instruction }
  }
}

/**
 * @deprecated This function builds legacy Transaction format.
 * For x402 payments, use the checkout flow which builds VersionedTransaction (v0 format).
 * See: apps/web/app/checkout/[slug]/page.tsx for current implementation.
 *
 * This function is kept for reference but should not be used in production.
 */
export async function buildSolTransferTransaction(params: {
  connection: Connection
  sender: PublicKey
  recipient: PublicKey
  amount: bigint
  reference: PublicKey
  memo?: string
}): Promise<Transaction> {
  const { connection, sender, recipient, amount, reference, memo } = params

  const instructions: TransactionInstruction[] = []

  // Create SOL transfer instruction using SystemProgram
  const transferInstruction = SystemProgram.transfer({
    fromPubkey: sender,
    toPubkey: recipient,
    lamports: Number(amount),
  })

  // Add reference as read-only key (Solana Pay standard)
  transferInstruction.keys.push({
    pubkey: reference,
    isSigner: false,
    isWritable: false,
  })

  instructions.push(transferInstruction)

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
 * @deprecated This function builds legacy Transaction format.
 * For x402 payments, use the checkout flow which builds VersionedTransaction (v0 format).
 * See: apps/web/app/checkout/[slug]/page.tsx for current implementation.
 *
 * This function is kept for reference but should not be used in production.
 */
export async function buildUsdcTransferTransaction(params: {
  connection: Connection
  sender: PublicKey
  recipient: PublicKey
  amount: bigint
  reference: PublicKey
  memo?: string
}): Promise<Transaction> {
  const { connection, sender, recipient, amount, reference, memo } = params

  const instructions: TransactionInstruction[] = []

  // Get sender's USDC token account
  const senderTokenAccount = await getAssociatedTokenAddress(USDC_MINT, sender)

  // Get or create recipient's USDC token account
  const recipientTokenInfo = await getOrCreateTokenAccount(connection, sender, recipient, USDC_MINT)

  // Add create account instruction if needed
  if (recipientTokenInfo.instruction) {
    instructions.push(recipientTokenInfo.instruction)
  }

  // Add USDC transfer instruction
  const transferInstruction = createTransferCheckedInstruction(
    senderTokenAccount, // source
    USDC_MINT, // mint
    recipientTokenInfo.address, // destination
    sender, // owner
    amount, // amount in lamports (smallest unit)
    USDC_DECIMALS // decimals
  )

  // Add reference as a read-only key to the transfer instruction (Solana Pay standard)
  transferInstruction.keys.push({
    pubkey: reference,
    isSigner: false,
    isWritable: false,
  })

  instructions.push(transferInstruction)

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

// Verify a payment transaction on-chain
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

  try {
    // Find the transaction signature using the reference
    const signatureInfo = await findReference(connection, reference, { finality: 'confirmed' })

    // For SPL tokens, use validateTransfer from @solana/pay
    // For native SOL, manually verify to support memo instructions
    if (splToken) {
      const validateFields: ValidateTransferFields = {
        recipient,
        amount: new BigNumber(amount.toString()),
        splToken,
        reference,
      }

      await validateTransfer(connection, signatureInfo.signature, validateFields, {
        commitment: 'confirmed',
      })
    } else {
      // Manual verification for native SOL transfers (to support memo instructions)
      const tx = await connection.getTransaction(signatureInfo.signature, {
        commitment: 'confirmed',
        maxSupportedTransactionVersion: 0,
      })

      if (!tx) {
        throw new Error('Transaction not found')
      }

      // Verify transaction succeeded
      if (tx.meta?.err) {
        throw new Error('Transaction failed on-chain')
      }

      // Check recipient received the correct amount
      const preBalances = tx.meta?.preBalances || []
      const postBalances = tx.meta?.postBalances || []

      // Find recipient index in account keys (handle both legacy and versioned transactions)
      const accountKeys = 'accountKeys' in tx.transaction.message
        ? tx.transaction.message.accountKeys
        : tx.transaction.message.getAccountKeys().staticAccountKeys
      const recipientIndex = accountKeys.findIndex(key => key.equals(recipient))

      if (recipientIndex === -1) {
        throw new Error('Recipient not found in transaction')
      }

      // Calculate amount received by recipient (in lamports)
      const amountReceived = BigInt(postBalances[recipientIndex] - preBalances[recipientIndex])

      // Verify amount is at least what was expected (allows for slightly more due to rounding)
      if (amountReceived < amount) {
        throw new Error(`Incorrect amount: expected ${amount} lamports, got ${amountReceived} lamports`)
      }
    }

    // Get transaction details for timestamp
    const tx = await connection.getTransaction(signatureInfo.signature, {
      commitment: 'confirmed',
      maxSupportedTransactionVersion: 0,
    })

    return {
      signature: signatureInfo.signature,
      amount,
      timestamp: tx?.blockTime || Math.floor(Date.now() / 1000),
    }
  } catch (error) {
    if (error instanceof FindReferenceError) {
      throw new Error('Payment transaction not found. Please complete payment first.')
    }
    if (error instanceof ValidateTransferError) {
      throw new Error(`Payment validation failed: ${error.message}`)
    }
    throw error
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
