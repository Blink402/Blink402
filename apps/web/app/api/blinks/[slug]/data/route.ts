import { NextRequest, NextResponse } from 'next/server'
import { getBlinkBySlug } from '@/lib/db'

// Force dynamic rendering - don't pre-render during build
export const dynamic = 'force-dynamic'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params
    const blink = await getBlinkBySlug(slug)

    if (!blink) {
      return NextResponse.json({ error: 'Blink not found' }, { status: 404 })
    }

    return NextResponse.json(blink)
  } catch (error) {
    console.error('Error fetching blink:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}