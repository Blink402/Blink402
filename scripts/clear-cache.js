// Script to clear Redis cache for featured blinks
// Run with: node scripts/clear-cache.js

import { createClient } from 'redis'

async function clearCache() {
  try {
    // Try to connect to Redis
    const client = createClient({
      url: process.env.REDIS_URL || 'redis://localhost:6379'
    })

    client.on('error', (err) => {
      console.log('Redis Client Error:', err.message)
    })

    await client.connect()
    console.log('Connected to Redis')

    // Clear featured blinks cache
    await client.del('featured_blinks')
    console.log('✅ Cleared featured_blinks cache')

    // Clear trending blinks cache
    await client.del('trending_blinks_1')
    await client.del('trending_blinks_7')
    console.log('✅ Cleared trending_blinks cache')

    await client.quit()
    console.log('Cache cleared successfully!')
  } catch (error) {
    console.log('Note: Redis may not be running locally. The cache will refresh on next API restart.')
    console.log('You can restart the API server to ensure fresh data.')
  }
}

clearCache().catch(console.error)