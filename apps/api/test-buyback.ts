/**
 * Standalone test script for B402 buyback flow
 * Tests: USDC → SOL → B402 via Jupiter aggregator
 *
 * Usage: npx tsx test-buyback.ts <amount_usdc>
 * Example: npx tsx test-buyback.ts 0.15
 */

import { Keypair, Connection, PublicKey, VersionedTransaction } from '@solana/web3.js'
import { getAssociatedTokenAddress, getAccount } from '@solana/spl-token'
import dotenv from 'dotenv'

// Load environment variables
dotenv.config() // Will load .env from current working directory

// Jupiter API endpoints
const JUPITER_QUOTE_API = 'https://quote-api.jup.ag/v6/quote'
const JUPITER_SWAP_API = 'https://quote-api.jup.ag/v6/swap'

// Token mints
const USDC_MINT = new PublicKey('EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v') // Mainnet USDC
const SOL_MINT = new PublicKey('So11111111111111111111111111111111111111112') // Wrapped SOL
const B402_TOKEN_MINT = new PublicKey('2mESiwuVdfft9PxG7x36rvDvex6ccyY8m8BKCWJqpump')

interface JupiterQuoteResponse {
  inputMint: string
  inAmount: string
  outputMint: string
  outAmount: string
  otherAmountThreshold: string
  swapMode: string
  slippageBps: number
  priceImpactPct: string
  routePlan: any[]
}

interface JupiterSwapResponse {
  swapTransaction: string
  lastValidBlockHeight: number
  prioritizationFeeLamports?: number
}

async function executeJupiterSwap(
  connection: Connection,
  inputMint: PublicKey,
  outputMint: PublicKey,
  amountAtomic: bigint,
  platformKeypair: Keypair,
  slippageBps: number
): Promise<string | null> {
  try {
    // Step 1: Get quote from Jupiter
    const quoteUrl = new URL(JUPITER_QUOTE_API)
    quoteUrl.searchParams.set('inputMint', inputMint.toBase58())
    quoteUrl.searchParams.set('outputMint', outputMint.toBase58())
    quoteUrl.searchParams.set('amount', amountAtomic.toString())
    quoteUrl.searchParams.set('slippageBps', slippageBps.toString())
    quoteUrl.searchParams.set('onlyDirectRoutes', 'false')

    console.log('\n📡 Requesting Jupiter quote...')
    console.log(`   Input: ${inputMint.toBase58()}`)
    console.log(`   Output: ${outputMint.toBase58()}`)
    console.log(`   Amount: ${amountAtomic.toString()}`)
    console.log(`   Slippage: ${slippageBps / 100}%`)

    let quoteResponse
    try {
      quoteResponse = await fetch(quoteUrl.toString(), {
        method: 'GET',
        headers: { 'Accept': 'application/json' },
      })
    } catch (fetchError: any) {
      console.error('❌ Fetch error:', fetchError.message)
      console.error('   Cause:', fetchError.cause || 'Unknown')
      return null
    }

    if (!quoteResponse.ok) {
      const errorText = await quoteResponse.text()
      console.error('❌ Jupiter quote failed:', errorText)
      return null
    }

    const quoteData = await quoteResponse.json() as JupiterQuoteResponse

    console.log('✅ Quote received:')
    console.log(`   In: ${quoteData.inAmount}`)
    console.log(`   Out: ${quoteData.outAmount}`)
    console.log(`   Price Impact: ${quoteData.priceImpactPct}%`)

    // Step 2: Get swap transaction
    console.log('\n🔨 Building swap transaction...')
    const swapResponse = await fetch(JUPITER_SWAP_API, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify({
        quoteResponse: quoteData,
        userPublicKey: platformKeypair.publicKey.toBase58(),
        wrapAndUnwrapSol: true,
        dynamicComputeUnitLimit: true,
        prioritizationFeeLamports: {
          priorityLevelWithMaxLamports: {
            maxLamports: 10_000_000, // 0.01 SOL max priority fee
            priorityLevel: 'high'
          }
        }
      })
    })

    if (!swapResponse.ok) {
      const errorText = await swapResponse.text()
      console.error('❌ Jupiter swap request failed:', errorText)
      return null
    }

    const swapData = await swapResponse.json() as JupiterSwapResponse

    // Step 3: Sign and send transaction
    console.log('✍️  Signing transaction...')
    const transaction = VersionedTransaction.deserialize(
      Buffer.from(swapData.swapTransaction, 'base64')
    )

    transaction.sign([platformKeypair])

    console.log('📤 Sending transaction to Solana...')
    const txSignature = await connection.sendRawTransaction(
      transaction.serialize(),
      {
        skipPreflight: false,
        maxRetries: 3,
      }
    )

    console.log(`🔗 Transaction sent: ${txSignature}`)
    console.log(`   Explorer: https://solscan.io/tx/${txSignature}`)

    // Wait for confirmation
    console.log('⏳ Waiting for confirmation...')
    const confirmation = await connection.confirmTransaction(txSignature, 'confirmed')

    if (confirmation.value.err) {
      console.error('❌ Transaction failed on-chain:', confirmation.value.err)
      return null
    }

    console.log('✅ Transaction confirmed!')
    return txSignature

  } catch (error: any) {
    console.error('❌ Exception during swap:', error.message)
    return null
  }
}

async function main() {
  console.log('🚀 B402 Buyback Test Script\n')

  // Parse amount from command line
  const amountUsdc = parseFloat(process.argv[2] || '0.15')
  console.log(`💰 Testing with ${amountUsdc} USDC\n`)

  // Load platform keypair
  const platformKeypairJson = process.env.LOTTERY_PLATFORM_KEYPAIR
  if (!platformKeypairJson) {
    console.error('❌ LOTTERY_PLATFORM_KEYPAIR not found in environment')
    process.exit(1)
  }

  const platformKeypair = Keypair.fromSecretKey(
    Buffer.from(JSON.parse(platformKeypairJson))
  )
  const platformWallet = platformKeypair.publicKey.toBase58()

  console.log(`🔑 Platform Wallet: ${platformWallet}`)

  // Setup connection
  const rpcUrl = process.env.SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com'
  const connection = new Connection(rpcUrl, 'confirmed')

  // Check balances before
  console.log('\n📊 Checking balances BEFORE swap...')

  const solBalanceBefore = await connection.getBalance(platformKeypair.publicKey)
  console.log(`   SOL: ${(solBalanceBefore / 1e9).toFixed(4)} SOL`)

  const usdcATA = await getAssociatedTokenAddress(USDC_MINT, platformKeypair.publicKey)
  try {
    const usdcAccount = await getAccount(connection, usdcATA)
    const usdcBalanceBefore = Number(usdcAccount.amount) / 1_000_000
    console.log(`   USDC: ${usdcBalanceBefore.toFixed(2)} USDC`)

    if (usdcBalanceBefore < amountUsdc) {
      console.error(`\n❌ Insufficient USDC balance (need ${amountUsdc}, have ${usdcBalanceBefore.toFixed(2)})`)
      process.exit(1)
    }
  } catch (err) {
    console.error('   USDC: 0.00 USDC (account not found)')
    console.error('\n❌ No USDC available for testing')
    process.exit(1)
  }

  const b402ATA = await getAssociatedTokenAddress(B402_TOKEN_MINT, platformKeypair.publicKey)
  try {
    const b402Account = await getAccount(connection, b402ATA)
    const b402BalanceBefore = Number(b402Account.amount) / 1_000_000 // Assuming 6 decimals
    console.log(`   B402: ${b402BalanceBefore.toFixed(2)} B402`)
  } catch (err) {
    console.log('   B402: 0.00 B402 (account not found)')
  }

  // Execute buyback flow
  console.log('\n' + '='.repeat(60))
  console.log('STEP 1: USDC → SOL')
  console.log('='.repeat(60))

  const usdcAtomic = BigInt(Math.round(amountUsdc * 1_000_000))
  const usdcToSolSignature = await executeJupiterSwap(
    connection,
    USDC_MINT,
    SOL_MINT,
    usdcAtomic,
    platformKeypair,
    200 // 2% slippage
  )

  if (!usdcToSolSignature) {
    console.error('\n❌ Failed at USDC → SOL step')
    process.exit(1)
  }

  // Wait for state to settle
  console.log('\n⏸️  Waiting 2 seconds for state to settle...')
  await new Promise(resolve => setTimeout(resolve, 2000))

  // Check SOL balance after first swap
  const solBalanceAfterSwap = await connection.getBalance(platformKeypair.publicKey)
  const availableSol = BigInt(solBalanceAfterSwap) - BigInt(5_000_000) // Reserve 0.005 SOL (~$1) for future transaction fees
  console.log(`\n💎 SOL balance after swap: ${(solBalanceAfterSwap / 1e9).toFixed(6)} SOL`)
  console.log(`   Available for B402 swap: ${(Number(availableSol) / 1e9).toFixed(6)} SOL`)

  if (availableSol <= 0n) {
    console.error('❌ Insufficient SOL balance after USDC swap')
    process.exit(1)
  }

  console.log('\n' + '='.repeat(60))
  console.log('STEP 2: SOL → B402')
  console.log('='.repeat(60))

  const solToB402Signature = await executeJupiterSwap(
    connection,
    SOL_MINT,
    B402_TOKEN_MINT,
    availableSol,
    platformKeypair,
    1000 // 10% slippage (B402 is volatile)
  )

  if (!solToB402Signature) {
    console.error('\n❌ Failed at SOL → B402 step')
    process.exit(1)
  }

  // Check final balances
  console.log('\n' + '='.repeat(60))
  console.log('FINAL BALANCES')
  console.log('='.repeat(60))

  await new Promise(resolve => setTimeout(resolve, 2000))

  const solBalanceAfter = await connection.getBalance(platformKeypair.publicKey)
  console.log(`   SOL: ${(solBalanceAfter / 1e9).toFixed(4)} SOL`)

  try {
    const usdcAccount = await getAccount(connection, usdcATA)
    const usdcBalanceAfter = Number(usdcAccount.amount) / 1_000_000
    console.log(`   USDC: ${usdcBalanceAfter.toFixed(2)} USDC`)
  } catch (err) {
    console.log('   USDC: 0.00 USDC')
  }

  try {
    const b402Account = await getAccount(connection, b402ATA)
    const b402BalanceAfter = Number(b402Account.amount) / 1_000_000
    console.log(`   B402: ${b402BalanceAfter.toFixed(2)} B402`)
  } catch (err) {
    console.log('   B402: 0.00 B402')
  }

  console.log('\n' + '='.repeat(60))
  console.log('🎉 BUYBACK TEST COMPLETED SUCCESSFULLY!')
  console.log('='.repeat(60))
  console.log(`\n💸 Spent: ${amountUsdc} USDC`)
  console.log(`🔗 USDC→SOL: https://solscan.io/tx/${usdcToSolSignature}`)
  console.log(`🔗 SOL→B402: https://solscan.io/tx/${solToB402Signature}`)
  console.log(`\n🔥 B402 tokens are now held in platform wallet (burned by removing from circulation)`)
}

main()
  .then(() => process.exit(0))
  .catch(err => {
    console.error('\n💥 Fatal error:', err)
    process.exit(1)
  })
