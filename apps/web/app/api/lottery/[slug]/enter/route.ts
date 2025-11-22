import { NextRequest, NextResponse } from 'next/server'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params
  const body = await request.json()

  // Extract X-Payment header for x402 payment verification
  const xPaymentHeader = request.headers.get('X-Payment')

  console.log('[LOTTERY PROXY] Request received:', {
    slug,
    hasXPaymentHeader: !!xPaymentHeader,
    headerLength: xPaymentHeader?.length,
    bodyKeys: Object.keys(body)
  })

  try {
    // Build headers object
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    }

    // Include X-Payment header if present (for x402 verification)
    if (xPaymentHeader) {
      headers['X-Payment'] = xPaymentHeader
      console.log('[LOTTERY PROXY] Forwarding X-Payment header to backend')
    } else {
      console.log('[LOTTERY PROXY] WARNING: No X-Payment header found!')
    }

    const response = await fetch(`${API_URL}/lottery/${slug}/enter`, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    })

    const data = await response.json()

    if (!response.ok) {
      return NextResponse.json(data, { status: response.status })
    }

    return NextResponse.json(data)
  } catch (error: any) {
    console.error('Lottery entry proxy error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to create lottery entry' },
      { status: 500 }
    )
  }
}
