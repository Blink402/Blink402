/**
 * Encrypt test wallet private key for slot machine
 */

const crypto = require('crypto')

const WALLET = 'Gk5mZUdomuc7JF9wAAioTSh8ajf98WsVLCyrofuvpUbM'
const PRIVATE_KEY = [114,135,238,79,148,239,136,61,70,190,202,214,220,19,68,161,138,48,51,45,111,159,240,59,124,17,23,153,139,130,219,72,233,232,171,145,163,161,253,211,141,152,184,203,119,166,145,136,166,193,128,251,86,2,195,128,234,132,151,104,55,65,166,60]
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY

if (!ENCRYPTION_KEY) {
  console.error('ERROR: ENCRYPTION_KEY environment variable not set')
  console.error('Set it first with your 64-char hex encryption key')
  process.exit(1)
}

// Validate encryption key
if (ENCRYPTION_KEY.length !== 64) {
  console.error('ERROR: ENCRYPTION_KEY must be 64 hex characters (32 bytes)')
  process.exit(1)
}

// Encryption function (MUST match packages/database/src/encryption.ts exactly!)
function encrypt(text) {
  const key = Buffer.from(ENCRYPTION_KEY, 'hex')
  const ALGORITHM = 'aes-256-gcm'
  const IV_LENGTH = 16
  const SALT_LENGTH = 64
  const TAG_LENGTH = 16

  const salt = crypto.randomBytes(SALT_LENGTH)
  const iv = crypto.randomBytes(IV_LENGTH)
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv)

  const encrypted = Buffer.concat([cipher.update(text, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()

  return Buffer.concat([salt, iv, tag, encrypted]).toString('base64')
}

const privateKeyJson = JSON.stringify(PRIVATE_KEY)
console.log('Encrypting private key for wallet:', WALLET)

const encrypted = encrypt(privateKeyJson)

console.log('\n✅ Encrypted key generated!')
console.log('\nRun this SQL:\n')
console.log(`INSERT INTO creators (wallet, encrypted_payout_key, created_at)
VALUES ('${WALLET}', '${encrypted}', NOW())
ON CONFLICT (wallet) DO UPDATE
SET encrypted_payout_key = '${encrypted}';`)

console.log('\n\nAfter running the SQL, try the slot machine again!')
