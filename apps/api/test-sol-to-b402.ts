/**
 * Quick test: SOL → B402 swap only
 * Use existing SOL balance in wallet
 */

import { Keypair, Connection, PublicKey, VersionedTransaction } from '@solana/web3.js'
import { getAssociatedTokenAddress, getAccount } from '@solana/spl-token'
import dotenv from 'dotenv'

dotenv.config()

const JUPITER_QUOTE_API = 'https://quote-api.jup.ag/v6/quote'
const JUPITER_SWAP_API = 'https://quote-api.jup.ag/v6/swap'
const SOL_MINT = new PublicKey('So11111111111111111111111111111111111111112')
const B402_TOKEN_MINT = new PublicKey('2mESiwuVdfft9PxG7x36rvDvex6ccyY8m8BKCWJqpump')

async function main() {
  console.log('🚀 SOL → B402 Swap Test\n')

  const platformKeypairJson = process.env.LOTTERY_PLATFORM_KEYPAIR
  if (!platformKeypairJson) {
    console.error('❌ LOTTERY_PLATFORM_KEYPAIR not found')
    process.exit(1)
  }

  const platformKeypair = Keypair.fromSecretKey(Buffer.from(JSON.parse(platformKeypairJson)))
  const rpcUrl = process.env.SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com'
  const connection = new Connection(rpcUrl, 'confirmed')

  // Check SOL balance
  const solBalance = await connection.getBalance(platformKeypair.publicKey)
  const availableSol = BigInt(solBalance) - BigInt(5_000_000) // Reserve 0.005 SOL (~$1) for future transaction fees

  console.log(`💎 SOL Balance: ${(solBalance / 1e9).toFixed(6)} SOL`)
  console.log(`   Available: ${(Number(availableSol) / 1e9).toFixed(6)} SOL\n`)

  if (availableSol <= 0n) {
    console.error('❌ Insufficient SOL balance')
    process.exit(1)
  }

  // Get quote
  const quoteUrl = new URL(JUPITER_QUOTE_API)
  quoteUrl.searchParams.set('inputMint', SOL_MINT.toBase58())
  quoteUrl.searchParams.set('outputMint', B402_TOKEN_MINT.toBase58())
  quoteUrl.searchParams.set('amount', availableSol.toString())
  quoteUrl.searchParams.set('slippageBps', '1000') // 10% slippage

  console.log('📡 Getting quote from Jupiter...')
  const quoteResponse = await fetch(quoteUrl.toString())
  const quoteData = await quoteResponse.json()

  console.log(`✅ Quote: ${quoteData.outAmount} B402\n`)

  // Get swap transaction
  console.log('🔨 Building swap transaction...')
  const swapResponse = await fetch(JUPITER_SWAP_API, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      quoteResponse: quoteData,
      userPublicKey: platformKeypair.publicKey.toBase58(),
      wrapAndUnwrapSol: true,
      dynamicComputeUnitLimit: true,
      prioritizationFeeLamports: {
        priorityLevelWithMaxLamports: {
          maxLamports: 10_000_000,
          priorityLevel: 'high'
        }
      }
    })
  })

  const swapData = await swapResponse.json()

  // Sign and send
  console.log('✍️  Signing...')
  const transaction = VersionedTransaction.deserialize(Buffer.from(swapData.swapTransaction, 'base64'))
  transaction.sign([platformKeypair])

  console.log('📤 Sending transaction...')
  const txSignature = await connection.sendRawTransaction(transaction.serialize(), {
    skipPreflight: false,
    maxRetries: 3
  })

  console.log(`🔗 TX: ${txSignature}`)
  console.log(`   Explorer: https://solscan.io/tx/${txSignature}\n`)

  console.log('⏳ Confirming...')
  const confirmation = await connection.confirmTransaction(txSignature, 'confirmed')

  if (confirmation.value.err) {
    console.error('❌ Transaction failed:', confirmation.value.err)
    process.exit(1)
  }

  console.log('✅ Transaction confirmed!\n')

  // Check final B402 balance
  await new Promise(resolve => setTimeout(resolve, 2000))
  const b402ATA = await getAssociatedTokenAddress(B402_TOKEN_MINT, platformKeypair.publicKey)
  try {
    const b402Account = await getAccount(connection, b402ATA)
    const b402Balance = Number(b402Account.amount) / 1_000_000
    console.log(`🔥 B402 Balance: ${b402Balance.toFixed(2)} B402`)
    console.log('\n🎉 BUYBACK TEST COMPLETED SUCCESSFULLY!')
  } catch (err) {
    console.log('🔥 B402: 0.00 B402 (account creation pending)')
  }
}

main().catch(console.error)
