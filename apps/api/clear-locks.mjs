#!/usr/bin/env node
import { initRedis, getRedis } from '@blink402/redis'

console.log('🔌 Connecting to Redis...')
await initRedis()
const redis = getRedis()

const keys = await redis.keys('lock:payment:*')
console.log(`📋 Found ${keys.length} lock(s)`)

if (keys.length > 0) {
  for (const key of keys) {
    await redis.del(key)
    console.log(`✅ Cleared: ${key}`)
  }
  console.log(`\n🎉 Cleared ${keys.length} locks!`)
} else {
  console.log('✅ No locks to clear')
}

process.exit(0)
