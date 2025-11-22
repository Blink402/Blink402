/**
 * Test Jupiter API connectivity from Railway environment
 * Usage: npx tsx apps/api/test-jupiter-connectivity.ts
 */

const JUPITER_QUOTE_API = 'https://quote-api.jup.ag/v6/quote'
const USDC_MINT = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v'
const SOL_MINT = 'So11111111111111111111111111111111111111112'

async function testJupiterConnectivity() {
  console.log('🧪 Testing Jupiter API connectivity...\n')

  // Test DNS resolution
  console.log('1️⃣ Testing DNS resolution...')
  try {
    const dns = await import('dns').then(m => m.promises)
    const addresses = await dns.resolve4('quote-api.jup.ag')
    console.log('✅ DNS resolved:', addresses)
  } catch (dnsError: any) {
    console.error('❌ DNS resolution failed:', dnsError.message)
  }

  // Test HTTP connectivity
  console.log('\n2️⃣ Testing HTTP GET request...')
  try {
    const testUrl = new URL(JUPITER_QUOTE_API)
    testUrl.searchParams.set('inputMint', USDC_MINT)
    testUrl.searchParams.set('outputMint', SOL_MINT)
    testUrl.searchParams.set('amount', '525000') // 0.525 USDC
    testUrl.searchParams.set('slippageBps', '200')

    console.log('URL:', testUrl.toString())

    const response = await fetch(testUrl.toString(), {
      method: 'GET',
      headers: { 'Accept': 'application/json' },
      signal: AbortSignal.timeout(15000)
    })

    console.log('Status:', response.status, response.statusText)

    if (response.ok) {
      const data = await response.json()
      console.log('✅ Quote received!')
      console.log('   Input amount:', data.inAmount)
      console.log('   Output amount:', data.outAmount)
      console.log('   Price impact:', data.priceImpactPct)
    } else {
      const errorText = await response.text()
      console.error('❌ HTTP error:', errorText)
    }
  } catch (fetchError: any) {
    console.error('❌ Fetch failed:', {
      message: fetchError.message,
      code: fetchError.code,
      cause: fetchError.cause
    })
  }

  console.log('\n✅ Test complete')
}

testJupiterConnectivity().catch(console.error)
