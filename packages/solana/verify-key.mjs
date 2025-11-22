// Verify private key matches expected public key
import { Keypair } from '@solana/web3.js'
import bs58 from 'bs58'

const privateKeyBase58 = 'TuFrrvD4Ysrjvi1ws9p9cnPoqsDCa4NZnRaAYY7tBAgo7CSb2XMKsfBUpyQ7Lo6mjb8jsnCi8zECSrwWcGUZrVc'
const expectedPublicKey = '2aNETu51eEDKASqFH5PPd6wBHzyq1ENG5afCsMfTiS7z'

try {
  // Decode base58 private key to bytes
  const privateKeyBytes = bs58.decode(privateKeyBase58)

  // Create keypair from private key
  const keypair = Keypair.fromSecretKey(privateKeyBytes)

  // Get the derived public key
  const derivedPublicKey = keypair.publicKey.toBase58()

  console.log('Expected Public Key:', expectedPublicKey)
  console.log('Derived Public Key: ', derivedPublicKey)
  console.log('Match:', derivedPublicKey === expectedPublicKey ? '✅ YES' : '❌ NO')

  if (derivedPublicKey === expectedPublicKey) {
    console.log('\n✅ Private key is correct!')
    console.log('Secret key as byte array (for encryption):')
    console.log(JSON.stringify(Array.from(privateKeyBytes)))
  } else {
    console.log('\n❌ WARNING: Private key does NOT match the expected public key!')
    console.log('This private key belongs to:', derivedPublicKey)
  }
} catch (error) {
  console.error('Error:', error.message)
}
