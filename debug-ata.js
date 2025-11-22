// Debug script to test ATA lookup that's failing in checkout
const { Connection, PublicKey } = require('@solana/web3.js');
const { getAssociatedTokenAddress, getAccount } = require('@solana/spl-token');

const USDC_MINT_MAINNET = new PublicKey('EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v');
const payerAddress = new PublicKey('5bmb4PnoTiHd4Qm1kphqmFiKDgQCZThuPTG5vm1MsNZ4');

async function testATA() {
  console.log('\n🔍 Testing ATA lookup for:', payerAddress.toBase58());

  // Use same RPC as frontend
  const connection = new Connection('https://mainnet.helius-rpc.com/?api-key=0e492ad2-d236-41dc-97e0-860d712bc03d', 'confirmed');

  try {
    console.log('📍 Step 1: Getting payer ATA...');
    const payerATA = await getAssociatedTokenAddress(USDC_MINT_MAINNET, payerAddress);
    console.log('✅ Payer ATA:', payerATA.toBase58());

    console.log('\n📍 Step 2: Calling getAccount()...');
    const payerAccount = await getAccount(connection, payerATA);
    const balance = Number(payerAccount.amount) / 1_000_000;
    console.log('✅ USDC balance:', balance, 'USDC');

    console.log('\n✅ SUCCESS - No TokenAccountNotFoundError!\n');
  } catch (error) {
    console.error('\n❌ ERROR:', error.message);
    console.error('Error name:', error.name);
    console.error('Full error:', error);

    if (error.message.includes('could not find')) {
      console.log('\n💡 This is the TokenAccountNotFoundError!');
      console.log('   But we verified the account EXISTS via RPC...');
      console.log('   This suggests a timing/caching issue or wrong network.');
    }
  }
}

testATA().catch(console.error);
