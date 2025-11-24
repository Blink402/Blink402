/**
 * Quick test script to trigger a B402 burn
 */

import { Connection, PublicKey, Keypair, Transaction } from '@solana/web3.js'
import { getAssociatedTokenAddress, createBurnInstruction, TOKEN_PROGRAM_ID } from '@solana/spl-token'
import pg from 'pg'

const { Pool } = pg

async function testBurn() {
  console.log('🔥 Testing B402 Burn Function...\n')

  // Load environment
  const privateKeyArray = JSON.parse(process.env.BURNER_WALLET_PRIVATE_KEY)
  const burnerWallet = Keypair.fromSecretKey(new Uint8Array(privateKeyArray))
  const burnAmount = parseInt(process.env.B402_BURN_AMOUNT || '100')

  console.log('Burner Wallet:', burnerWallet.publicKey.toBase58())
  console.log('Burn Amount:', burnAmount, 'B402\n')

  // Setup connection
  const connection = new Connection(
    process.env.SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com',
    'confirmed'
  )

  // B402 mint address
  const B402_MINT = new PublicKey(process.env.B402_MINT_ADDRESS || '2mESiwuVdfft9PxG7x36rvDvex6ccyY8m8BKCWJqpump')
  const B402_DECIMALS = 6

  // Get burner's token account
  const tokenAccount = await getAssociatedTokenAddress(
    B402_MINT,
    burnerWallet.publicKey
  )

  console.log('Token Account:', tokenAccount.toBase58())

  // Check balance before
  try {
    const balance = await connection.getTokenAccountBalance(tokenAccount)
    console.log('Balance Before:', balance.value.uiAmount, 'B402\n')
  } catch (err) {
    console.error('Error checking balance:', err.message)
  }

  // Build burn transaction
  const amountToBeRemoved = BigInt(Math.floor(burnAmount * Math.pow(10, B402_DECIMALS)))

  const burnInstruction = createBurnInstruction(
    tokenAccount,
    B402_MINT,
    burnerWallet.publicKey,
    amountToBeRemoved,
    [],
    TOKEN_PROGRAM_ID
  )

  const transaction = new Transaction().add(burnInstruction)
  transaction.feePayer = burnerWallet.publicKey

  // Get recent blockhash
  const { blockhash } = await connection.getLatestBlockhash('confirmed')
  transaction.recentBlockhash = blockhash

  console.log('🔥 Signing and sending burn transaction...')

  // Sign and send
  transaction.sign(burnerWallet)
  const signature = await connection.sendRawTransaction(transaction.serialize())

  console.log('✅ Transaction sent!')
  console.log('📝 Signature:', signature)
  console.log('🔗 Solscan:', 'https://solscan.io/tx/' + signature + '\n')

  // Wait for confirmation
  console.log('⏳ Waiting for confirmation...')
  await connection.confirmTransaction(signature, 'confirmed')
  console.log('✅ Transaction confirmed!\n')

  // Check balance after
  try {
    const balance = await connection.getTokenAccountBalance(tokenAccount)
    console.log('Balance After:', balance.value.uiAmount, 'B402')
    console.log('🔥 Successfully burned', burnAmount, 'B402 tokens!\n')
  } catch (err) {
    console.error('Error checking final balance:', err.message)
  }

  // Record in database (create a test run first)
  console.log('📊 Recording burn in database...')
  const pool = new Pool({ connectionString: process.env.DATABASE_URL })

  try {
    // Create a test run entry
    const runResult = await pool.query(`
      INSERT INTO runs (blink_id, reference, payer, status, created_at)
      SELECT id, $1, $2, 'executed', NOW()
      FROM blinks
      LIMIT 1
      RETURNING id
    `, ['test-burn-' + Date.now(), burnerWallet.publicKey.toBase58()])

    const runId = runResult.rows[0].id

    // Record the burn
    await pool.query(`
      INSERT INTO burns (run_id, amount_b402, tx_signature, created_at)
      VALUES ($1, $2, $3, NOW())
    `, [runId, amountToBeRemoved.toString(), signature])

    console.log('✅ Burn recorded in database!')
    console.log('Run ID:', runId)
  } catch (dbError) {
    console.error('Database error:', dbError.message)
  } finally {
    await pool.end()
  }

  console.log('\n🎉 Test burn complete!')
  console.log('You can now check the homepage to see the burn stats!')

  return signature
}

testBurn().catch(console.error)
