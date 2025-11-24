/**
 * B402 Token Burn Functions
 * Implements deflationary tokenomics by burning B402 tokens with every blink execution
 */

import {
  Connection,
  Keypair,
  PublicKey,
  Transaction,
  sendAndConfirmTransaction,
  ComputeBudgetProgram,
} from '@solana/web3.js'
import {
  createBurnInstruction,
  getAssociatedTokenAddress,
  getAccount,
} from '@solana/spl-token'
import { getConnection } from './index'
import { B402_MINT, B402_DECIMALS } from './token-holder'
import { createLogger } from '@blink402/config'

const logger = createLogger('@blink402/burn')

/**
 * Get burner wallet configuration from environment variables
 */
function getBurnerWalletConfig(): {
  privateKey: string | undefined
  publicKey: string | undefined
  burnAmount: number
  enabled: boolean
} {
  return {
    privateKey: process.env.BURNER_WALLET_PRIVATE_KEY,
    publicKey: process.env.BURNER_WALLET_PUBLIC_KEY,
    burnAmount: parseInt(process.env.B402_BURN_AMOUNT || '100', 10),
    enabled: process.env.B402_BURN_ENABLED !== 'false',
  }
}

/**
 * Load burner wallet keypair from environment variable
 * Supports both JSON array format and Base64 format
 */
export function getBurnerWallet(): Keypair {
  const config = getBurnerWalletConfig()

  if (!config.privateKey) {
    throw new Error(
      'BURNER_WALLET_PRIVATE_KEY not configured. Set environment variable to enable auto-burns.'
    )
  }

  try {
    // Try JSON array format first: [31,174,117,179,...]
    if (config.privateKey.startsWith('[')) {
      const secretKeyArray = JSON.parse(config.privateKey)
      return Keypair.fromSecretKey(Uint8Array.from(secretKeyArray))
    }

    // Try Base64 format
    const secretKeyBuffer = Buffer.from(config.privateKey, 'base64')
    return Keypair.fromSecretKey(secretKeyBuffer)
  } catch (error) {
    logger.error('Failed to parse burner wallet private key', { error })
    throw new Error(
      'Invalid BURNER_WALLET_PRIVATE_KEY format. Must be JSON array or Base64 string.'
    )
  }
}

/**
 * Get burner wallet public key (for transparency/display)
 */
export function getBurnerWalletAddress(): string {
  const config = getBurnerWalletConfig()

  // If public key is explicitly configured, use it
  if (config.publicKey) {
    return config.publicKey
  }

  // Otherwise derive from private key
  try {
    const wallet = getBurnerWallet()
    return wallet.publicKey.toBase58()
  } catch (error) {
    logger.warn('Could not load burner wallet address', { error })
    return ''
  }
}

/**
 * Check if auto-burn is enabled
 */
export function isBurnEnabled(): boolean {
  const config = getBurnerWalletConfig()
  return config.enabled
}

/**
 * Get configured burn amount per blink execution
 */
export function getBurnAmount(): number {
  const config = getBurnerWalletConfig()
  return config.burnAmount
}

/**
 * Burn B402 tokens from burner wallet
 * Uses SPL Token burn instruction to permanently remove tokens from circulation
 *
 * @param amount - Number of B402 tokens to burn (in whole tokens, NOT base units)
 * @param connection - Optional Solana connection (uses default if not provided)
 * @returns Transaction signature of the burn transaction
 */
export async function burnB402Tokens(
  amount: number,
  connection?: Connection
): Promise<string> {
  // Check if burns are enabled
  if (!isBurnEnabled()) {
    logger.info('Auto-burn is disabled via B402_BURN_ENABLED=false')
    throw new Error('Auto-burn is disabled')
  }

  const conn = connection || getConnection()
  const burnerWallet = getBurnerWallet()

  logger.info('Starting B402 burn', {
    amount,
    burnerAddress: burnerWallet.publicKey.toBase58(),
  })

  try {
    // Get burner's B402 token account
    const tokenAccount = await getAssociatedTokenAddress(
      B402_MINT,
      burnerWallet.publicKey
    )

    // Check token account exists and has sufficient balance
    const accountInfo = await getAccount(conn, tokenAccount)
    const currentBalance = Number(accountInfo.amount) / Math.pow(10, B402_DECIMALS)
    const amountInBaseUnits = BigInt(Math.floor(amount * Math.pow(10, B402_DECIMALS)))

    if (accountInfo.amount < amountInBaseUnits) {
      logger.error('Insufficient B402 balance in burner wallet', {
        currentBalance,
        requestedBurn: amount,
        tokenAccount: tokenAccount.toBase58(),
      })
      throw new Error(
        `Insufficient B402 balance. Current: ${currentBalance}, Requested: ${amount}`
      )
    }

    // Create burn instruction
    const burnInstruction = createBurnInstruction(
      tokenAccount, // Token account to burn from
      B402_MINT, // Token mint
      burnerWallet.publicKey, // Owner of token account
      amountInBaseUnits // Amount to burn (in base units)
    )

    // Add compute budget instructions for better reliability
    const computeUnitsInstruction = ComputeBudgetProgram.setComputeUnitLimit({
      units: 200_000,
    })
    const computePriceInstruction = ComputeBudgetProgram.setComputeUnitPrice({
      microLamports: 1,
    })

    // Build transaction
    const transaction = new Transaction().add(
      computeUnitsInstruction,
      computePriceInstruction,
      burnInstruction
    )

    // Send and confirm transaction
    const signature = await sendAndConfirmTransaction(
      conn,
      transaction,
      [burnerWallet],
      {
        commitment: 'confirmed',
        maxRetries: 3,
      }
    )

    logger.info('B402 burn successful', {
      amount,
      signature,
      burnerAddress: burnerWallet.publicKey.toBase58(),
      newBalance: currentBalance - amount,
    })

    return signature
  } catch (error: any) {
    logger.error('B402 burn failed', {
      amount,
      error: error.message,
      burnerAddress: burnerWallet.publicKey.toBase58(),
    })
    throw error
  }
}

/**
 * Get burner wallet balance (both SOL and B402)
 * Useful for monitoring and alerts
 */
export async function getBurnerWalletBalance(
  connection?: Connection
): Promise<{
  solBalance: number
  b402Balance: number
  b402BalanceRaw: bigint
}> {
  const conn = connection || getConnection()
  const burnerWallet = getBurnerWallet()

  try {
    // Get SOL balance
    const solBalanceLamports = await conn.getBalance(burnerWallet.publicKey)
    const solBalance = solBalanceLamports / 1e9

    // Get B402 token balance
    const tokenAccount = await getAssociatedTokenAddress(
      B402_MINT,
      burnerWallet.publicKey
    )

    const accountInfo = await getAccount(conn, tokenAccount)
    const b402BalanceRaw = accountInfo.amount
    const b402Balance = Number(b402BalanceRaw) / Math.pow(10, B402_DECIMALS)

    return {
      solBalance,
      b402Balance,
      b402BalanceRaw,
    }
  } catch (error: any) {
    logger.error('Failed to get burner wallet balance', {
      error: error.message,
      burnerAddress: burnerWallet.publicKey.toBase58(),
    })
    throw error
  }
}

/**
 * Estimate SOL cost of a burn transaction
 * Useful for calculating funding requirements
 */
export function estimateBurnCost(): number {
  // Typical burn transaction costs ~0.000005 SOL
  return 0.000005
}

/**
 * Calculate how many burns can be performed with current SOL balance
 */
export async function getEstimatedBurnsRemaining(
  connection?: Connection
): Promise<number> {
  const { solBalance } = await getBurnerWalletBalance(connection)
  const costPerBurn = estimateBurnCost()
  return Math.floor(solBalance / costPerBurn)
}
