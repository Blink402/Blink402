#!/usr/bin/env tsx
/**
 * Generate and encrypt a Solana keypair for slot machine payouts
 *
 * Usage:
 *   1. Ensure ENCRYPTION_KEY is set in your environment
 *   2. Run: pnpm tsx scripts/generate-encrypted-payout-key.ts
 *   3. Copy the encrypted key to Railway as SLOT_MACHINE_PAYOUT_ENCRYPTED_KEY
 *   4. Fund the public key with USDC for payouts
 */

import { Keypair } from '@solana/web3.js'
import { encrypt } from '../packages/database/src/encryption.js'

function main() {
  console.log('🎰 Generating Slot Machine Payout Keypair\n')

  // Check for ENCRYPTION_KEY
  if (!process.env.ENCRYPTION_KEY) {
    console.error('❌ ERROR: ENCRYPTION_KEY environment variable not set')
    console.error('   Set it first: export ENCRYPTION_KEY=your_64_char_hex_string')
    process.exit(1)
  }

  // Generate new Solana keypair
  const keypair = Keypair.generate()
  const publicKey = keypair.publicKey.toBase58()
  const privateKeyArray = Array.from(keypair.secretKey)
  const privateKeyJson = JSON.stringify(privateKeyArray)

  console.log('✅ Keypair Generated\n')
  console.log('📍 Public Key (fund this with USDC):')
  console.log(`   ${publicKey}\n`)

  // Encrypt the private key
  const encryptedKey = encrypt(privateKeyJson)

  console.log('🔒 Encrypted Private Key (add to Railway):')
  console.log(`   ${encryptedKey}\n`)

  console.log('📋 Railway Setup Instructions:')
  console.log('   1. Go to: https://railway.app (your project)')
  console.log('   2. Click on API service')
  console.log('   3. Go to Variables tab')
  console.log('   4. Click + New Variable')
  console.log('   5. Add:')
  console.log('      Name:  SLOT_MACHINE_PAYOUT_ENCRYPTED_KEY')
  console.log(`      Value: ${encryptedKey}`)
  console.log('   6. Click Add')
  console.log('   7. Railway will auto-deploy\n')

  console.log('💰 Fund the Payout Wallet:')
  console.log(`   Send USDC to: ${publicKey}`)
  console.log('   Recommended: At least 50 USDC (1000 max payouts of 0.05 USDC)\n')

  console.log('🧪 Testing:')
  console.log('   1. Visit: https://blink402.dev/slot-machine')
  console.log('   2. Click "Play Now"')
  console.log('   3. Pay 0.05 USDC')
  console.log('   4. Spin the reels')
  console.log('   5. If you win, verify payout arrives\n')

  console.log('⚠️  Security Reminder:')
  console.log('   - Store this encrypted key securely')
  console.log('   - Never commit to git')
  console.log('   - Keep ENCRYPTION_KEY backed up separately')
  console.log('   - If you lose ENCRYPTION_KEY, this encrypted key becomes unusable\n')

  console.log('✅ Setup Complete!')
}

main()
