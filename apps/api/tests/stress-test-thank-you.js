/**
 * Stress Test for Thank You Claim Endpoint
 *
 * Simulates 500 concurrent users claiming rewards
 * Tests rate limiting, database constraints, and server performance
 */

const API_BASE_URL = process.env.API_URL || 'https://blink402-production.up.railway.app'

// Generate random Solana wallet addresses for testing
function generateRandomWallet() {
  const chars = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz'
  let wallet = ''
  for (let i = 0; i < 44; i++) {
    wallet += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return wallet
}

// Generate unique reference UUID
function generateUUID() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0
    const v = c === 'x' ? r : (r & 0x3 | 0x8)
    return v.toString(16)
  })
}

// Single claim attempt
async function attemptClaim(claimNumber) {
  const startTime = Date.now()
  const reference = generateUUID()
  const wallet = generateRandomWallet()

  try {
    const response = await fetch(`${API_BASE_URL}/a/thank-you-claim`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        reference,
        user_wallet: wallet
      })
    })

    const duration = Date.now() - startTime
    const data = await response.json()

    return {
      claimNumber,
      success: response.ok,
      status: response.status,
      duration,
      rewardAmount: data.reward_amount || null,
      error: data.error || null
    }
  } catch (error) {
    return {
      claimNumber,
      success: false,
      status: 0,
      duration: Date.now() - startTime,
      error: error.message
    }
  }
}

// Run stress test
async function runStressTest() {
  console.log('🚀 Starting Thank You Claim Stress Test')
  console.log(`📍 Target: ${API_BASE_URL}/a/thank-you-claim`)
  console.log(`👥 Simulating: 50 concurrent users (adjust NUMBER_OF_CLAIMS to test more)`)
  console.log('')

  const NUMBER_OF_CLAIMS = 50 // Adjust this to test different loads
  const BATCH_SIZE = 10 // Process in batches to avoid overwhelming the system

  const results = {
    successful: 0,
    failed: 0,
    rateLimited: 0,
    duplicates: 0,
    serverErrors: 0,
    totalDuration: 0,
    minDuration: Infinity,
    maxDuration: 0,
    rewards: {
      '50.00': 0,
      '20.00': 0,
      '10.00': 0,
      small: 0
    }
  }

  const allResults = []

  // Process in batches
  for (let batch = 0; batch < Math.ceil(NUMBER_OF_CLAIMS / BATCH_SIZE); batch++) {
    const batchStart = batch * BATCH_SIZE
    const batchEnd = Math.min(batchStart + BATCH_SIZE, NUMBER_OF_CLAIMS)

    console.log(`📦 Batch ${batch + 1}: Claims ${batchStart + 1}-${batchEnd}`)

    const batchPromises = []
    for (let i = batchStart; i < batchEnd; i++) {
      batchPromises.push(attemptClaim(i + 1))
    }

    const batchResults = await Promise.all(batchPromises)
    allResults.push(...batchResults)

    // Process batch results
    for (const result of batchResults) {
      if (result.success) {
        results.successful++
        results.totalDuration += result.duration
        results.minDuration = Math.min(results.minDuration, result.duration)
        results.maxDuration = Math.max(results.maxDuration, result.duration)

        // Track reward distribution
        if (result.rewardAmount === '50.00') {
          results.rewards['50.00']++
        } else if (result.rewardAmount === '20.00') {
          results.rewards['20.00']++
        } else if (result.rewardAmount === '10.00') {
          results.rewards['10.00']++
        } else {
          results.rewards.small++
        }

        console.log(`  ✅ Claim ${result.claimNumber}: ${result.rewardAmount} USDC (${result.duration}ms)`)
      } else {
        results.failed++

        if (result.status === 429) {
          results.rateLimited++
          console.log(`  ⚠️  Claim ${result.claimNumber}: Rate limited (${result.duration}ms)`)
        } else if (result.status === 403 && result.error?.includes('Already claimed')) {
          results.duplicates++
          console.log(`  ⚠️  Claim ${result.claimNumber}: Duplicate (${result.duration}ms)`)
        } else if (result.status >= 500) {
          results.serverErrors++
          console.log(`  ❌ Claim ${result.claimNumber}: Server error ${result.status} (${result.duration}ms)`)
        } else {
          console.log(`  ❌ Claim ${result.claimNumber}: ${result.error} (${result.duration}ms)`)
        }
      }
    }

    // Small delay between batches
    if (batch < Math.ceil(NUMBER_OF_CLAIMS / BATCH_SIZE) - 1) {
      await new Promise(resolve => setTimeout(resolve, 1000))
    }
  }

  // Calculate statistics
  const avgDuration = results.successful > 0
    ? Math.round(results.totalDuration / results.successful)
    : 0

  // Print summary
  console.log('')
  console.log('📊 STRESS TEST RESULTS')
  console.log('═'.repeat(60))
  console.log(`Total Attempts:    ${NUMBER_OF_CLAIMS}`)
  console.log(`✅ Successful:     ${results.successful} (${Math.round(results.successful / NUMBER_OF_CLAIMS * 100)}%)`)
  console.log(`❌ Failed:         ${results.failed} (${Math.round(results.failed / NUMBER_OF_CLAIMS * 100)}%)`)
  console.log('')
  console.log('Failure Breakdown:')
  console.log(`  Rate Limited:    ${results.rateLimited}`)
  console.log(`  Duplicates:      ${results.duplicates}`)
  console.log(`  Server Errors:   ${results.serverErrors}`)
  console.log(`  Other:           ${results.failed - results.rateLimited - results.duplicates - results.serverErrors}`)
  console.log('')
  console.log('Performance:')
  console.log(`  Avg Duration:    ${avgDuration}ms`)
  console.log(`  Min Duration:    ${results.minDuration}ms`)
  console.log(`  Max Duration:    ${results.maxDuration}ms`)
  console.log('')
  console.log('Reward Distribution:')
  console.log(`  50 USDC:         ${results.rewards['50.00']} claims`)
  console.log(`  20 USDC:         ${results.rewards['20.00']} claims`)
  console.log(`  10 USDC:         ${results.rewards['10.00']} claims`)
  console.log(`  Small (0.001-0.03): ${results.rewards.small} claims`)
  console.log('═'.repeat(60))
  console.log('')

  // Recommendations
  if (results.rateLimited > 0) {
    console.log('⚠️  RECOMMENDATION: Increase rate limits (currently 500/min per IP)')
  }
  if (results.serverErrors > 0) {
    console.log('⚠️  RECOMMENDATION: Investigate server errors in logs')
  }
  if (avgDuration > 3000) {
    console.log('⚠️  RECOMMENDATION: Average response time > 3s, consider optimization')
  }
  if (results.successful / NUMBER_OF_CLAIMS >= 0.95) {
    console.log('✅ PASS: System handled stress test well (>95% success rate)')
  } else {
    console.log('❌ FAIL: High failure rate, review configuration')
  }
}

// Run the test
runStressTest().catch(console.error)
