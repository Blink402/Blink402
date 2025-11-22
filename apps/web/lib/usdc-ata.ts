/**
 * USDC ATA (Associated Token Account) Utilities
 * For ONCHAIN x402 EXACT-SVM compatibility
 */

import {
  Connection,
  PublicKey,
  Transaction,
  SystemProgram,
} from "@solana/web3.js"
import {
  getAssociatedTokenAddress,
  createAssociatedTokenAccountInstruction,
  TOKEN_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
} from "@solana/spl-token"

// Mainnet USDC Mint
export const USDC_MINT = new PublicKey("EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v")

/**
 * Check if a wallet has a USDC Associated Token Account
 */
export async function checkUsdcAtaExists(
  connection: Connection,
  walletAddress: string
): Promise<{ exists: boolean; ataAddress: string }> {
  try {
    const wallet = new PublicKey(walletAddress)
    const ataAddress = await getAssociatedTokenAddress(USDC_MINT, wallet)

    const accountInfo = await connection.getAccountInfo(ataAddress)

    return {
      exists: accountInfo !== null,
      ataAddress: ataAddress.toBase58()
    }
  } catch (error) {
    console.error('Error checking USDC ATA:', error)
    throw new Error(`Failed to check USDC account: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }
}

/**
 * Create a USDC Associated Token Account
 * Returns the transaction that needs to be signed and sent
 */
export async function createUsdcAtaTransaction(
  connection: Connection,
  walletAddress: string,
  payerAddress: string
): Promise<Transaction> {
  try {
    const wallet = new PublicKey(walletAddress)
    const payer = new PublicKey(payerAddress)
    const ataAddress = await getAssociatedTokenAddress(USDC_MINT, wallet)

    // Get recent blockhash
    const { blockhash } = await connection.getLatestBlockhash()

    // Create the ATA instruction
    const createAtaIx = createAssociatedTokenAccountInstruction(
      payer,        // payer
      ataAddress,   // ata
      wallet,       // owner
      USDC_MINT     // mint
    )

    // Build transaction
    const transaction = new Transaction({
      feePayer: payer,
      recentBlockhash: blockhash,
    }).add(createAtaIx)

    return transaction
  } catch (error) {
    console.error('Error creating USDC ATA transaction:', error)
    throw new Error(`Failed to create USDC account transaction: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }
}

/**
 * Get USDC ATA address for a wallet (without checking if it exists)
 */
export async function getUsdcAtaAddress(walletAddress: string): Promise<string> {
  try {
    const wallet = new PublicKey(walletAddress)
    const ataAddress = await getAssociatedTokenAddress(USDC_MINT, wallet)
    return ataAddress.toBase58()
  } catch (error) {
    throw new Error(`Invalid wallet address: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }
}
