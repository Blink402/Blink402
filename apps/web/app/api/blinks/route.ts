// GET /api/blinks - List all blinks
// POST /api/blinks - Create a new blink (authenticated)

import { NextRequest, NextResponse } from 'next/server'
import { getAllBlinks, createBlink } from '@/lib/db'
import { getWalletFromRequest } from '@/lib/auth'
import { applyRateLimit, createRateLimitResponse, getIpFromRequest, getClientIdentifier, RATE_LIMITS } from '@/lib/rate-limit'
import type { BlinkData } from '@/lib/types'

// Force dynamic rendering - don't pre-render during build
export const dynamic = 'force-dynamic'

// GET /api/blinks - List all blinks with optional filters
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const category = searchParams.get('category')
    const status = searchParams.get('status')
    const search = searchParams.get('search')
    const creator = searchParams.get('creator')

    let blinks = await getAllBlinks()

    // Apply filters
    if (category && category !== 'All') {
      blinks = blinks.filter(b => b.category === category)
    }

    if (status) {
      blinks = blinks.filter(b => b.status === status)
    }

    if (creator) {
      blinks = blinks.filter(b => b.creator?.wallet === creator)
    }

    if (search) {
      const searchLower = search.toLowerCase()
      blinks = blinks.filter(
        b =>
          b.title.toLowerCase().includes(searchLower) ||
          b.description.toLowerCase().includes(searchLower)
      )
    }

    return NextResponse.json({
      success: true,
      data: blinks,
      count: blinks.length,
    })
  } catch (error) {
    console.error('Error fetching blinks:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to fetch blinks' },
      { status: 500 }
    )
  }
}

// POST /api/blinks - Create a new blink (authenticated)
export async function POST(request: NextRequest) {
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

    // Apply rate limiting
    const ip = getIpFromRequest(request.headers)
    const identifier = getClientIdentifier(wallet, ip)
    const rateLimit = applyRateLimit(identifier, RATE_LIMITS.CREATE)

    if (!rateLimit.allowed) {
      return createRateLimitResponse(rateLimit.resetAt)
    }

    const body = await request.json()

    // Validate required fields
    const requiredFields = ['slug', 'title', 'description', 'price_usdc', 'endpoint_url', 'method', 'category']
    for (const field of requiredFields) {
      if (!body[field]) {
        return NextResponse.json(
          { success: false, error: `Missing required field: ${field}` },
          { status: 400 }
        )
      }
    }

    // Create the blink with authenticated wallet as creator
    const newBlink = await createBlink({
      slug: body.slug,
      title: body.title,
      description: body.description,
      price_usdc: body.price_usdc,
      icon_url: body.icon_url || '/lottie/Success-Checkmark-Green.lottie',
      endpoint_url: body.endpoint_url,
      method: body.method,
      category: body.category,
      status: body.status || 'active',
      payment_token: body.payment_token || 'USDC', // Default to USDC (required for PayAI x402)
      payment_mode: body.payment_mode || 'charge', // Default to charge mode (user pays creator)
      payout_wallet: body.payout_wallet || wallet, // Default to creator wallet if not specified
      creator: { wallet }, // Use authenticated wallet
    })

    return NextResponse.json(
      {
        success: true,
        data: newBlink,
        message: 'Blink created successfully',
      },
      { status: 201 }
    )
  } catch (error) {
    console.error('Error creating blink:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to create blink' },
      { status: 500 }
    )
  }
}
