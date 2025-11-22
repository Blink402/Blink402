// Encrypt private key for storage
import { Keypair } from '@solana/web3.js'
import bs58 from 'bs58'
import crypto from 'crypto'

const privateKeyBase58 = 'TuFrrvD4Ysrjvi1ws9p9cnPoqsDCa4NZnRaAYY7tBAgo7CSb2XMKsfBUpyQ7Lo6mjb8jsnCi8zECSrwWcGUZrVc'
const expectedPublicKey = 'F788AZHsgc8wWqL1wRMHZTixdQGLedHLnLh4UgXFRYpE'

// Get encryption key from environment
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || 'ca25b379aff81e16ae02dfd4e963d26ac0367719cefec4e292ac8014612e2d4e'

// Encryption function (matches packages/database/src/index.ts)
function encrypt(text) {
  const iv = crypto.randomBytes(16)
  const cipher = crypto.createCipheriv('aes-256-cbc', Buffer.from(ENCRYPTION_KEY, 'hex'), iv)
  let encrypted = cipher.update(text, 'utf8', 'base64')
  encrypted += cipher.final('base64')
  return iv.toString('base64') + ':' + encrypted
}

try {
  // Decode base58 private key to bytes
  const privateKeyBytes = bs58.decode(privateKeyBase58)

  // Create keypair from private key
  const keypair = Keypair.fromSecretKey(privateKeyBytes)

  // Verify public key
  const derivedPublicKey = keypair.publicKey.toBase58()

  console.log('Expected Public Key:', expectedPublicKey)
  console.log('Derived Public Key: ', derivedPublicKey)

  if (derivedPublicKey !== expectedPublicKey) {
    console.error('❌ ERROR: Private key does not match expected public key!')
    console.error('Private key belongs to:', derivedPublicKey)
    process.exit(1)
  }

  console.log('✅ Public key verified!')

  // Convert to JSON array format (matches how it's stored)
  const secretKeyArray = JSON.stringify(Array.from(privateKeyBytes))

  // Encrypt the secret key
  const encryptedKey = encrypt(secretKeyArray)

  console.log('\n✅ Encrypted private key:')
  console.log(encryptedKey)
  console.log('\n📋 SQL to update database:')
  console.log(`
-- Step 1: Check if creator exists
SELECT id, wallet, encrypted_payout_key IS NOT NULL as has_key
FROM creators
WHERE wallet = '${expectedPublicKey}';

-- Step 2: If creator doesn't exist, create it
INSERT INTO creators (wallet, created_at)
VALUES ('${expectedPublicKey}', NOW())
ON CONFLICT (wallet) DO NOTHING
RETURNING id, wallet;

-- Step 3: Update encrypted key
UPDATE creators
SET encrypted_payout_key = '${encryptedKey}'
WHERE wallet = '${expectedPublicKey}'
RETURNING id, wallet, LENGTH(encrypted_payout_key) as key_length;

-- Step 4: Update slot-machine blink to use this wallet
UPDATE blinks
SET
  payout_wallet = '${expectedPublicKey}',
  funded_wallet = '${expectedPublicKey}',
  creator_id = (SELECT id FROM creators WHERE wallet = '${expectedPublicKey}')
WHERE slug = 'slot-machine'
RETURNING id, slug, payout_wallet, funded_wallet;
`)

} catch (error) {
  console.error('❌ Error:', error.message)
  process.exit(1)
}
