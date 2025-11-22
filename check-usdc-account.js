// Quick script to check if a wallet has a USDC account
const { Connection, PublicKey } = require('@solana/web3.js');
const { getAssociatedTokenAddress, getAccount } = require('@solana/spl-token');

const USDC_MINT = new PublicKey('EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v'); // Mainnet

async function checkUSDC(walletAddress) {
  console.log('\n🔍 Checking USDC account for:', walletAddress);

  const connection = new Connection('https://api.mainnet-beta.solana.com', 'confirmed');
  const wallet = new PublicKey(walletAddress);

  try {
    // Get ATA address
    const ata = await getAssociatedTokenAddress(USDC_MINT, wallet);
    console.log('✅ ATA address:', ata.toBase58());

    // Check if account exists
    const accountInfo = await connection.getAccountInfo(ata);
    if (!accountInfo) {
      console.log('❌ USDC account does NOT exist');
      console.log('💡 Solution: Get USDC via https://jup.ag/');
      return false;
    }

    // Get account details
    const account = await getAccount(connection, ata);
    const balance = Number(account.amount) / 1_000_000;

    console.log('✅ USDC account EXISTS');
    console.log(`💰 Balance: ${balance} USDC`);

    if (balance === 0) {
      console.log('⚠️  Balance is 0 - need to add USDC');
      return false;
    }

    if (balance < 0.01) {
      console.log(`⚠️  Balance (${balance} USDC) is less than 0.01 USDC needed`);
      return false;
    }

    console.log('✅ Sufficient balance for payment!');
    return true;

  } catch (error) {
    console.log('❌ Error:', error.message);

    if (error.message.includes('could not find')) {
      console.log('\n💡 This wallet does NOT have a USDC token account.');
      console.log('   To fix: Swap SOL → USDC on https://jup.ag/');
    }
    return false;
  }
}

// Get wallet address from command line or use default
const walletAddress = process.argv[2] || 'PASTE_YOUR_WALLET_ADDRESS_HERE';

checkUSDC(walletAddress)
  .then(hasUSDC => {
    console.log('\n' + '='.repeat(60));
    console.log(hasUSDC ? '✅ READY FOR PAYMENT' : '❌ NOT READY - GET USDC FIRST');
    console.log('='.repeat(60) + '\n');
  })
  .catch(err => {
    console.error('Fatal error:', err);
  });
