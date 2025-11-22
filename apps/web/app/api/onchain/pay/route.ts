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

    // Debug function to inspect payment header structure
    function debugPaymentHeader(paymentHeader: string) {
      const json = Buffer.from(paymentHeader, 'base64').toString('utf8');
      console.log('[DEBUG] Decoded header JSON:', json);
      try {
        const parsed = JSON.parse(json);
        console.log('[DEBUG] x402Version:', parsed.x402Version);
        console.log('[DEBUG] scheme:', parsed.scheme);
        console.log('[DEBUG] network:', parsed.network);
        console.log('[DEBUG] payload keys:', Object.keys(parsed.payload || {}));
        console.log('[DEBUG] payload.amount:', parsed.payload?.amount);
        console.log('[DEBUG] payload.asset:', parsed.payload?.asset);
        console.log('[DEBUG] payload.payTo:', parsed.payload?.payTo);
        console.log('[DEBUG] payload.validUntil:', parsed.payload?.validUntil);
        console.log('[DEBUG] payload.tx length:', parsed.payload?.tx?.length || 'N/A');

        // Decode the Solana transaction to inspect instructions
        if (parsed.payload?.tx) {
          try {
            const { Transaction } = require('@solana/web3.js');
            const txBuffer = Buffer.from(parsed.payload.tx, 'base64');
            const tx = Transaction.from(txBuffer);
            console.log('[DEBUG] Transaction has', tx.instructions.length, 'instruction(s)');
            tx.instructions.forEach((ix: any, i: number) => {
              console.log(`[DEBUG] Instruction ${i + 1}: programId =`, ix.programId.toBase58());
            });
          } catch (txErr) {
            console.error('[DEBUG] Failed to decode transaction:', txErr);
          }
        }

        return parsed;
      } catch (e) {
        console.error('[DEBUG] Failed to parse header JSON:', e);
        return null;
      }
    }

    // Decode and debug payment header
    const decodedPaymentHeader = debugPaymentHeader(xPaymentHeader);

    console.log('[ONCHAIN] Verifying payment...', {
      url: `${ONCHAIN_API_URL}/verify`,
      hasApiKey: !!ONCHAIN_API_KEY,
      sourceNetwork,
      destinationNetwork,
      expectedAmount,
      expectedToken,
      recipientAddress: recipientAddress?.substring(0, 8) + '...',
      paymentHeaderLength: xPaymentHeader.length
    })

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

    console.log('[ONCHAIN] Verify response:', {
      status: verifyResponse.status,
      statusText: verifyResponse.statusText,
      data: verifyData,
      fullResponse: JSON.stringify(verifyData, null, 2)
    })

    // Log detailed error if verification fails
    if (!verifyResponse.ok) {
      console.error('[ONCHAIN] Full error details:', {
        status: verifyResponse.status,
        errorData: verifyData,
        errorMessage: verifyData?.data?.reason || verifyData?.message || 'Unknown error',
        facilitator: verifyData?.data?.facilitator || 'none',
        requestSent: {
          paymentHeaderSample: xPaymentHeader.substring(0, 100) + '...',
          sourceNetwork,
          destinationNetwork,
          expectedAmount,
          expectedToken,
          recipientAddress
        }
      })
      return NextResponse.json(
        {
          error: 'Payment verification failed',
          details: verifyData
        },
        { status: verifyResponse.status }
      )
    }

    if (!verifyData.data?.valid) {
      console.error('[ONCHAIN] Payment invalid:', verifyData)
      return NextResponse.json(
        { error: 'Invalid payment', details: verifyData },
        { status: 402 }
      )
    }

    console.log('[ONCHAIN] Payment verified ✅', {
      facilitator: verifyData.data.facilitator,
      from: verifyData.data.from
    })

    // Step 2: Settle payment with ONCHAIN
    console.log('[ONCHAIN] Settling payment...')

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
      console.error('[ONCHAIN] Settlement failed:', settleData)
      return NextResponse.json(
        {
          error: 'Payment settlement failed',
          details: settleData.error || settleData.message,
          verified: true, // Payment was verified but settlement failed
        },
        { status: settleResponse.status }
      )
    }

    console.log('[ONCHAIN] Payment settled ✅', {
      txHash: settleData.data?.txHash,
      facilitator: settleData.data?.facilitator
    })

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
    console.error('[ONCHAIN] Payment error:', error)
    return NextResponse.json(
      {
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}
