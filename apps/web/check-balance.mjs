import { Connection, PublicKey } from '@solana/web3.js'
import { getAssociatedTokenAddress, getAccount } from '@solana/spl-token'

const SOLANA_RPC_URL = 'https://api.mainnet-beta.solana.com'
const USDC_MINT = new PublicKey('EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v')
const MERCHANT_WALLET = new PublicKey('F788AZHsgc8wWqL1wRMHZTixdQGLedHLnLh4UgXFRYpE')

const connection = new Connection(SOLANA_RPC_URL, 'confirmed')

async function checkBalance() {
  try {
    console.log('Checking USDC balance for:', MERCHANT_WALLET.toBase58())

    // Get the associated token account
    const merchantATA = await getAssociatedTokenAddress(USDC_MINT, MERCHANT_WALLET)
    console.log('USDC Token Account (ATA):', merchantATA.toBase58())

    // Get account info
    const accountInfo = await getAccount(connection, merchantATA)
    const balance = Number(accountInfo.amount) / 1_000_000

    console.log('\n✅ USDC Balance:', balance.toFixed(6), 'USDC')
    console.log('Owner:', accountInfo.owner.toBase58())

  } catch (error) {
    console.error('❌ Error checking balance:', error.message)
    if (error.message.includes('could not find')) {
      console.log('\n⚠️  No USDC token account found for this wallet!')
      console.log('This means the wallet has never received USDC.')
    }
  }
}

checkBalance()
