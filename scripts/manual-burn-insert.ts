/**
 * Manually insert burn records for transactions that completed but weren't recorded
 */

import { getBlinkBySlug, createRun, recordBurn } from '@blink402/database'
import { B402_DECIMALS } from '@blink402/solana'

async function insertBurnRecords() {
  try {
    // Get a blink to associate with the burns
    const blink = await getBlinkBySlug('criptonews')
    if (!blink) {
      throw new Error('No blink found')
    }

    console.log('Found blink:', blink.title, blink.id)

    // Burn 1: 100,000 B402 (early test that completed on-chain but failed to record)
    const burn1Signature = '52wPWJDKpcUbEXhUBCprRfa6mQm7pj1agycSX8PuWa7ypa5H2Jum8THXjsA2xTw3KuEpXW6P4YVhWkW33n6kibND'
    const burn1Amount = BigInt(100_000 * Math.pow(10, B402_DECIMALS)) // 100,000 B402

    // Create run for burn 1
    const run1 = await createRun({
      blinkId: blink.id,
      reference: `manual-burn-1-${Date.now()}`,
      metadata: {
        manualInsert: true,
        description: 'Initial 100k B402 burn that succeeded on-chain',
        burnerWallet: '3BJb1QoZDr1ZPQ46YycuCqstMNuuvPvJeQAzZQPPXXqo',
      },
    })

    console.log('Created run 1:', run1.id)

    // Record burn 1
    await recordBurn({
      runId: run1.id,
      amountB402: burn1Amount,
      txSignature: burn1Signature,
    })

    console.log('✅ Recorded burn 1: 100,000 B402')

    // Burn 2: 100 B402 (recent test)
    const burn2Signature = '3WcYSkyBQknXJRuT1qmhc3FqGuH7DA8HaihWH4p4d35xsLnaubWqTsEZLxpCWaDgMkn6JZfmEhM756uJMM9yVxVU'
    const burn2Amount = BigInt(100 * Math.pow(10, B402_DECIMALS)) // 100 B402

    // Create run for burn 2
    const run2 = await createRun({
      blinkId: blink.id,
      reference: `manual-burn-2-${Date.now()}`,
      metadata: {
        manualInsert: true,
        description: '100 B402 test burn',
        burnerWallet: '3BJb1QoZDr1ZPQ46YycuCqstMNuuvPvJeQAzZQPPXXqo',
      },
    })

    console.log('Created run 2:', run2.id)

    // Record burn 2
    await recordBurn({
      runId: run2.id,
      amountB402: burn2Amount,
      txSignature: burn2Signature,
    })

    console.log('✅ Recorded burn 2: 100 B402')

    console.log('\n🔥 Successfully recorded 100,100 B402 in burns!')
    console.log('Homepage should now show burn statistics')

    process.exit(0)
  } catch (error) {
    console.error('Failed to insert burn records:', error)
    process.exit(1)
  }
}

insertBurnRecords()
