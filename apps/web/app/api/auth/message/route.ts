// POST /api/auth/message - Generate an auth message for wallet to sign

import { NextRequest, NextResponse } from 'next/server'
import { generateAuthMessage } from '@/lib/auth'

// Force dynamic rendering - don't pre-render during build
export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { wallet } = body

    if (!wallet) {
      return NextResponse.json(
        { success: false, error: 'Wallet address is required' },
        { status: 400 }
      )
    }

    const { message, nonce } = generateAuthMessage(wallet)

    return NextResponse.json({
      success: true,
      message,
      nonce,
    })
  } catch (error) {
    console.error('Error generating auth message:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to generate auth message' },
      { status: 500 }
    )
  }
}
