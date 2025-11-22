#!/usr/bin/env node
import { initRedis, getRedis, closeRedis } from '@blink402/redis'

console.log('🔌 Connecting to Redis...')
await initRedis()
const redis = getRedis()

const keys = await redis.keys('cache:blink:*')
console.log(`📋 Found ${keys.length} cached blink(s)`)

if (keys.length > 0) {
  for (const key of keys) {
    await redis.del(key)
    console.log(`✅ Cleared: ${key}`)
  }
  console.log(`\n🎉 Cleared ${keys.length} cached blinks!`)
} else {
  console.log('✅ No blink cache to clear')
}

await closeRedis()
process.exit(0)
