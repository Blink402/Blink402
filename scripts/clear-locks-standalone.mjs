#!/usr/bin/env node
/**
 * Clear stuck payment locks from Redis (standalone version)
 * Usage: railway run node scripts/clear-locks-standalone.mjs [--all]
 */

import { createClient } from 'redis'

async function main() {
  const redisUrl = process.env.REDIS_URL

  if (!redisUrl) {
    console.error('❌ REDIS_URL environment variable not set')
    process.exit(1)
  }

  console.log('🔌 Connecting to Redis...')
  const redis = createClient({ url: redisUrl })

  redis.on('error', (err) => {
    console.error('❌ Redis error:', err.message)
  })

  await redis.connect()
  console.log('✅ Connected to Redis')

  const clearAll = process.argv[2] === '--all' || process.argv[2] === 'all'

  if (clearAll) {
    // Clear ALL payment locks
    const keys = await redis.keys('lock:payment:*')

    if (keys.length === 0) {
      console.log('✅ No payment locks found')
      await redis.quit()
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
      await redis.quit()
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

    console.log('\nTo clear ALL locks: railway run node scripts/clear-locks-standalone.mjs --all')
  }

  await redis.quit()
  console.log('👋 Disconnected from Redis')
}

main().catch((error) => {
  console.error('❌ Error:', error.message)
  process.exit(1)
})
