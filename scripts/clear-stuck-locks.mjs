#!/usr/bin/env node
/**
 * Clear stuck payment locks from Redis
 * Usage: node scripts/clear-stuck-locks.mjs [reference]
 *
 * If reference is provided, clears that specific lock.
 * Otherwise, lists all payment locks and their TTLs.
 */

import { getRedis, isRedisConnected } from '@blink402/redis'

async function main() {
  const reference = process.argv[2]

  if (!isRedisConnected()) {
    console.error('❌ Redis not connected')
    process.exit(1)
  }

  const redis = getRedis()

  if (reference) {
    // Clear specific lock
    const lockKey = `lock:payment:${reference}`
    const result = await redis.del(lockKey)

    if (result === 1) {
      console.log(`✅ Cleared lock for reference: ${reference}`)
    } else {
      console.log(`⚠️  No lock found for reference: ${reference}`)
    }
  } else if (process.argv[2] === '--all' || process.argv[2] === 'all') {
    // Clear ALL payment locks
    const keys = await redis.keys('lock:payment:*')

    if (keys.length === 0) {
      console.log('✅ No payment locks found')
      return
    }

    console.log(`Found ${keys.length} payment lock(s), clearing all...`)

    let cleared = 0
    for (const key of keys) {
      const result = await redis.del(key)
      if (result === 1) {
        cleared++
        const reference = key.replace('lock:payment:', '')
        console.log(`✅ Cleared: ${reference}`)
      }
    }

    console.log(`\n✅ Successfully cleared ${cleared} of ${keys.length} locks`)
  } else {
    // List all payment locks
    const keys = await redis.keys('lock:payment:*')

    if (keys.length === 0) {
      console.log('✅ No stuck payment locks found')
      return
    }

    console.log(`Found ${keys.length} payment lock(s):\n`)

    for (const key of keys) {
      const ttl = await redis.ttl(key)
      const reference = key.replace('lock:payment:', '')

      if (ttl > 0) {
        console.log(`🔒 ${reference} (expires in ${ttl}s)`)
      } else if (ttl === -1) {
        console.log(`⚠️  ${reference} (NO EXPIRATION - STUCK!)`)
      } else {
        console.log(`⏰ ${reference} (expired but not yet cleaned up)`)
      }
    }

    console.log('\nTo clear a specific lock: node scripts/clear-stuck-locks.mjs <reference>')
    console.log('To clear ALL locks: node scripts/clear-stuck-locks.mjs --all')
  }

  process.exit(0)
}

main().catch((error) => {
  console.error('Error:', error)
  process.exit(1)
})
