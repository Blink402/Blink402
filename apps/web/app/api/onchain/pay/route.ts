import { NextRequest, NextResponse } from 'next/server'

/**
 * ONCHAIN Payment Endpoint
 * Handles Solana USDC payments via ONCHAIN aggregator API
 *
 * Flow:
 * 1. Client builds Solana USDC transaction
 * 2. Client sends base64 transaction as paymentHeader
 * 3. Backend calls ONCHAIN /v1/verify
 * 4. Backend calls ONCHAIN /v1/settle
 * 5. Returns result to client
 */

// Mark as dynamic route since it makes external API calls
export const dynamic = 'force-dynamic'

const ONCHAIN_API_KEY = process.env.NEXT_PUBLIC_ONCHAIN_API_KEY || process.env.ONCHAIN_API_KEY
const ONCHAIN_API_URL = process.env.ONCHAIN_API_URL || 'https://api.onchain.fi/v1'

export async function POST(req: NextRequest) {
  try {
    // Extract X-Payment header (x402-compliant payment payload)
    const xPaymentHeader = req.headers.get('x-payment')

    if (!xPaymentHeader) {
      return NextResponse.json(
        { error: 'Missing X-Payment header' },
        { status: 400 }
      )
    }

    const body = await req.json()
    const {
      sourceNetwork,
      destinationNetwork,
      expectedAmount,
      expectedToken,
      recipientAddress,
      priority = 'balanced'
    } = body

    if (!ONCHAIN_API_KEY) {
      return NextResponse.json(
        { error: 'ONCHAIN_API_KEY not configured' },
        { status: 500 }
      )
    }

    // Validate payment header format
    let decodedPaymentHeader = null;
    try {
      const json = Buffer.from(xPaymentHeader, 'base64').toString('utf8');
      decodedPaymentHeader = JSON.parse(json);
    } catch (e) {
      return NextResponse.json(
        { error: 'Invalid X-Payment header format' },
        { status: 400 }
      );
    }

    // Step 1: Verify payment with ONCHAIN
    // Pass X-Payment header unchanged as paymentHeader (x402 spec compliant)
    const verifyResponse = await fetch(`${ONCHAIN_API_URL}/verify`, {
      method: 'POST',
      headers: {
        'X-API-Key': ONCHAIN_API_KEY,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        paymentHeader: xPaymentHeader,
        sourceNetwork,
        destinationNetwork,
        expectedAmount,
        expectedToken,
        recipientAddress,
        priority
      })
    })

    const verifyData = await verifyResponse.json()

    if (!verifyResponse.ok) {
      return NextResponse.json(
        {
          error: 'Payment verification failed',
          details: verifyData
        },
        { status: verifyResponse.status }
      )
    }

    if (!verifyData.data?.valid) {
      return NextResponse.json(
        { error: 'Invalid payment', details: verifyData },
        { status: 402 }
      )
    }

    // Step 2: Settle payment with ONCHAIN

    const settleResponse = await fetch(`${ONCHAIN_API_URL}/settle`, {
      method: 'POST',
      headers: {
        'X-API-Key': ONCHAIN_API_KEY,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        paymentHeader: xPaymentHeader,
        sourceNetwork,
        destinationNetwork,
        priority
      })
    })

    const settleData = await settleResponse.json()

    if (!settleResponse.ok) {
      return NextResponse.json(
        {
          error: 'Payment settlement failed',
          details: settleData.error || settleData.message,
          verified: true, // Payment was verified but settlement failed
        },
        { status: settleResponse.status }
      )
    }

    // Return success
    return NextResponse.json({
      success: true,
      verified: true,
      settled: true,
      txHash: settleData.data?.txHash,
      facilitator: settleData.data?.facilitator || verifyData.data?.facilitator,
      from: verifyData.data?.from,
      verifyData: verifyData.data,
      settleData: settleData.data
    })

  } catch (error) {
    return NextResponse.json(
      {
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}
