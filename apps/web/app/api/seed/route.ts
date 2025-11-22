import { NextResponse } from "next/server"
import { seedExampleBlinks } from "@/lib/seed"

/**
 * Seed endpoint for populating database with example Blinks
 * GET /api/seed - Seeds the 5 example Blinks into the database
 *
 * SECURITY: In production, protect this endpoint or remove it!
 */

// Force dynamic rendering - don't pre-render during build
export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    // Optional: Add authentication/protection here in production
    if (process.env.NODE_ENV === 'production' && !process.env.ALLOW_SEED) {
      return NextResponse.json(
        { error: 'Seeding is disabled in production' },
        { status: 403 }
      )
    }

    const results = await seedExampleBlinks()

    const successCount = results.filter(r => r.success).length
    const alreadyExist = results.filter(r => !r.success && (r as any).reason === 'already exists').length
    const failed = results.filter(r => !r.success && !(r as any).reason).length

    return NextResponse.json({
      success: true,
      message: `Seeded ${successCount} new Blinks`,
      stats: {
        created: successCount,
        alreadyExist,
        failed
      },
      results
    })
  } catch (error) {
    console.error('Seed error:', error)
    return NextResponse.json(
      {
        error: 'Failed to seed database',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}
