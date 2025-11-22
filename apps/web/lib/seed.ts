/**
 * Database seed script for example Blinks
 * Run this to populate the database with the 5 real example Blinks
 */

import { createBlink } from './db'
import { EXAMPLE_BLINKS } from './example-blinks'

export async function seedExampleBlinks() {
  console.log('🌱 Seeding example Blinks...')

  const results = []

  for (const blinkData of EXAMPLE_BLINKS) {
    try {
      console.log(`  Creating: ${blinkData.slug}`)
      const blink = await createBlink({
        ...blinkData,
      })
      results.push({ success: true, slug: blinkData.slug, id: blink.id })
      console.log(`  ✓ Created ${blinkData.slug} (ID: ${blink.id})`)
    } catch (error) {
      if (error instanceof Error && error.message.includes('duplicate key')) {
        console.log(`  ⚠ Skipped ${blinkData.slug} (already exists)`)
        results.push({ success: false, slug: blinkData.slug, reason: 'already exists' })
      } else {
        console.error(`  ✗ Failed to create ${blinkData.slug}:`, error)
        results.push({ success: false, slug: blinkData.slug, error })
      }
    }
  }

  const successCount = results.filter(r => r.success).length
  console.log(`\n✅ Seed complete: ${successCount}/${EXAMPLE_BLINKS.length} Blinks created`)

  return results
}

// Export for use in API routes and scripts
export default seedExampleBlinks
