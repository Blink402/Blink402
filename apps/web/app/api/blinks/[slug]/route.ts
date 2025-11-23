// GET /api/blinks/[slug] - Get a specific blink
// PUT /api/blinks/[slug] - Update a blink (authenticated, owner only)
// DELETE /api/blinks/[slug] - Delete a blink (authenticated, owner only)

import { NextRequest, NextResponse } from 'next/server'
import { getBlinkBySlug, updateBlink, deleteBlink } from '@/lib/db'
import { getWalletFromRequest } from '@/lib/auth'

// Force dynamic rendering - don't pre-render during build
export const dynamic = 'force-dynamic'

type Params = {
  params: Promise<{ slug: string }>
}

// GET /api/blinks/[slug] - Get a specific blink by slug
export async function GET(request: NextRequest, { params }: Params) {
  try {
    const { slug } = await params
    const blink = await getBlinkBySlug(slug)

    if (!blink) {
      return NextResponse.json(
        { success: false, error: 'Blink not found' },
        { status: 404 }
      )
    }

    return NextResponse.json({
      success: true,
      data: blink,
    })
  } catch (error) {
    return NextResponse.json(
      { success: false, error: 'Failed to fetch blink' },
      { status: 500 }
    )
  }
}

// PUT /api/blinks/[slug] - Update a blink (authenticated, owner only)
export async function PUT(request: NextRequest, { params }: Params) {
  try {
    // Verify authentication
    const authHeader = request.headers.get('authorization')
    const wallet = getWalletFromRequest(authHeader)

    if (!wallet) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized - valid auth token required' },
        { status: 401 }
      )
    }

    const { slug } = await params

    // Check if blink exists and user owns it
    const existingBlink = await getBlinkBySlug(slug)
    if (!existingBlink) {
      return NextResponse.json(
        { success: false, error: 'Blink not found' },
        { status: 404 }
      )
    }

    if (existingBlink.creator.wallet !== wallet) {
      return NextResponse.json(
        { success: false, error: 'Forbidden - you do not own this blink' },
        { status: 403 }
      )
    }

    const body = await request.json()
    const updatedBlink = updateBlink(slug, body)

    return NextResponse.json({
      success: true,
      data: updatedBlink,
      message: 'Blink updated successfully',
    })
  } catch (error) {
    return NextResponse.json(
      { success: false, error: 'Failed to update blink' },
      { status: 500 }
    )
  }
}

// DELETE /api/blinks/[slug] - Delete a blink (authenticated, owner only)
export async function DELETE(request: NextRequest, { params }: Params) {
  try {
    // Verify authentication
    const authHeader = request.headers.get('authorization')
    const wallet = getWalletFromRequest(authHeader)

    if (!wallet) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized - valid auth token required' },
        { status: 401 }
      )
    }

    const { slug } = await params

    // Check if blink exists and user owns it
    const existingBlink = await getBlinkBySlug(slug)
    if (!existingBlink) {
      return NextResponse.json(
        { success: false, error: 'Blink not found' },
        { status: 404 }
      )
    }

    if (existingBlink.creator.wallet !== wallet) {
      return NextResponse.json(
        { success: false, error: 'Forbidden - you do not own this blink' },
        { status: 403 }
      )
    }

    const deleted = deleteBlink(slug)

    return NextResponse.json({
      success: true,
      message: 'Blink deleted successfully',
    })
  } catch (error) {
    return NextResponse.json(
      { success: false, error: 'Failed to delete blink' },
      { status: 500 }
    )
  }
}
