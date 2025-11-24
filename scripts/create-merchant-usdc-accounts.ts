/**
 * Create USDC Associated Token Accounts for all merchant wallets
 * This script initializes USDC token accounts so merchants can receive payments
 */

import { Connection, PublicKey, Transaction, sendAndConfirmTransaction, Keypair } from '@solana/web3.js'
import { getAssociatedTokenAddress, createAssociatedTokenAccountInstruction } from '@solana/spl-token'
import { getConnection, USDC_MINT } from '@blink402/solana'
import { getPool } from '@blink402/database'

// Fee payer (needs SOL to pay for account creation ~0.002 SOL per account)
// You can use the burner wallet or any wallet with SOL
const FEE_PAYER_PRIVATE_KEY = process.env.BURNER_WALLET_PRIVATE_KEY || process.env.FEE_PAYER_PRIVATE_KEY

if (!FEE_PAYER_PRIVATE_KEY) {
  console.error('❌ FEE_PAYER_PRIVATE_KEY or BURNER_WALLET_PRIVATE_KEY required')
  process.exit(1)
}

async function createMerchantUsdcAccounts() {
  try {
    const connection = getConnection()
    const feePayer = Keypair.fromSecretKey(
      new Uint8Array(JSON.parse(FEE_PAYER_PRIVATE_KEY))
    )

    console.log('🔑 Fee Payer:', feePayer.publicKey.toBase58())
    console.log('💰 USDC Mint:', USDC_MINT.toBase58())
    console.log('')

    // Get all unique payout wallets from database
    const pool = getPool()
    const result = await pool.query(`
      SELECT DISTINCT payout_wallet
      FROM blinks
      WHERE payout_wallet IS NOT NULL
      AND status = 'active'
      ORDER BY payout_wallet
    `)

    const merchantWallets = result.rows.map(row => row.payout_wallet)
    console.log(`📋 Found ${merchantWallets.length} merchant wallets\n`)

    for (const walletAddress of merchantWallets) {
      try {
        const merchantPubkey = new PublicKey(walletAddress)

        // Get USDC ATA address
        const usdcAta = await getAssociatedTokenAddress(
          USDC_MINT,
          merchantPubkey
        )

        console.log(`\n🔍 Checking ${walletAddress}`)
        console.log(`   USDC ATA: ${usdcAta.toBase58()}`)

        // Check if account already exists
        const accountInfo = await connection.getAccountInfo(usdcAta)

        if (accountInfo) {
          console.log(`   ✅ USDC account already exists`)
          continue
        }

        console.log(`   ⚠️  USDC account does NOT exist - creating...`)

        // Create the ATA
        const instruction = createAssociatedTokenAccountInstruction(
          feePayer.publicKey,  // Fee payer
          usdcAta,              // ATA address
          merchantPubkey,       // Owner
          USDC_MINT             // Mint
        )

        const transaction = new Transaction().add(instruction)

        const signature = await sendAndConfirmTransaction(
          connection,
          transaction,
          [feePayer],
          { commitment: 'confirmed' }
        )

        console.log(`   ✅ USDC account created!`)
        console.log(`   📝 Tx: https://solscan.io/tx/${signature}`)

      } catch (error: any) {
        console.error(`   ❌ Error for ${walletAddress}:`, error.message)
      }
    }

    console.log('\n✨ Done! All merchant USDC accounts initialized.\n')
    process.exit(0)

  } catch (error) {
    console.error('❌ Failed to create merchant USDC accounts:', error)
    process.exit(1)
  }
}

createMerchantUsdcAccounts()
