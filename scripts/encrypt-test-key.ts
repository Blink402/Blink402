#!/usr/bin/env tsx
/**
 * Encrypt test wallet private key for slot machine
 */

import { encrypt } from '../packages/database/src/encryption.js'

const WALLET = 'Gk5mZUdomuc7JF9wAAioTSh8ajf98WsVLCyrofuvpUbM'
const PRIVATE_KEY = [114,135,238,79,148,239,136,61,70,190,202,214,220,19,68,161,138,48,51,45,111,159,240,59,124,17,23,153,139,130,219,72,233,232,171,145,163,161,253,211,141,152,184,203,119,166,145,136,166,193,128,251,86,2,195,128,234,132,151,104,55,65,166,60]

const privateKeyJson = JSON.stringify(PRIVATE_KEY)
console.log('Encrypting private key for wallet:', WALLET)

const encrypted = encrypt(privateKeyJson)

console.log('\nEncrypted key:', encrypted)
console.log('\nRun this SQL:\n')
console.log(`UPDATE creators
SET encrypted_payout_key = '${encrypted}'
WHERE wallet = '${WALLET}';`)

console.log('\nOR if creator doesn\'t exist yet:\n')
console.log(`INSERT INTO creators (wallet, encrypted_payout_key, created_at)
VALUES ('${WALLET}', '${encrypted}', NOW())
ON CONFLICT (wallet) DO UPDATE
SET encrypted_payout_key = EXCLUDED.encrypted_payout_key;`)
