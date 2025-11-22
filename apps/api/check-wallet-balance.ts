/**
 * Quick script to check platform wallet balances
 */
import { Keypair, Connection, PublicKey } from '@solana/web3.js'
import { getAssociatedTokenAddress, getAccount } from '@solana/spl-token'
import dotenv from 'dotenv'

dotenv.config() // Will load .env from current working directory

const USDC_MINT = new PublicKey('EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v')
const B402_MINT = new PublicKey('2mESiwuVdfft9PxG7x36rvDvex6ccyY8m8BKCWJqpump')

async function main() {
  const platformKeypairJson = process.env.LOTTERY_PLATFORM_KEYPAIR
  if (!platformKeypairJson) {
    console.error('❌ LOTTERY_PLATFORM_KEYPAIR not found')
    process.exit(1)
  }

  const platformKeypair = Keypair.fromSecretKey(
    Buffer.from(JSON.parse(platformKeypairJson))
  )

  const wallet = platformKeypair.publicKey
  console.log('🔑 Platform Wallet:', wallet.toBase58())
  console.log('🌐 Explorer:', `https://solscan.io/account/${wallet.toBase58()}`)

  const rpcUrl = process.env.SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com'
  const connection = new Connection(rpcUrl, 'confirmed')

  // Check SOL
  const solBalance = await connection.getBalance(wallet)
  console.log(`\n💎 SOL: ${(solBalance / 1e9).toFixed(4)} SOL`)

  // Check USDC
  const usdcATA = await getAssociatedTokenAddress(USDC_MINT, wallet)
  try {
    const usdcAccount = await getAccount(connection, usdcATA)
    const usdcBalance = Number(usdcAccount.amount) / 1_000_000
    console.log(`💵 USDC: ${usdcBalance.toFixed(2)} USDC`)
  } catch (err) {
    console.log('💵 USDC: 0.00 USDC (no account)')
  }

  // Check B402
  const b402ATA = await getAssociatedTokenAddress(B402_MINT, wallet)
  try {
    const b402Account = await getAccount(connection, b402ATA)
    const b402Balance = Number(b402Account.amount) / 1_000_000
    console.log(`🔥 B402: ${b402Balance.toFixed(2)} B402`)
  } catch (err) {
    console.log('🔥 B402: 0.00 B402 (no account)')
  }
}

main().catch(console.error)
