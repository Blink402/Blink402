// GET /api/receipts/:id - Get receipt for a specific run

import { NextRequest, NextResponse } from 'next/server'

// Force dynamic rendering - don't pre-render during build
export const dynamic = 'force-dynamic'

type Params = {
  params: Promise<{ id: string }>
}

export async function GET(request: NextRequest, { params }: Params) {
  try {
    const { id } = await params

    // Dynamic import to avoid build-time database connection
    const { pool } = await import('@/lib/db')
    const dbPool = pool()

    // Query the database for the receipt
    const client = await dbPool.connect()
    try {
      const result = await client.query(
        `
        SELECT
          r.id,
          r.created_at,
          run.blink_id,
          run.reference,
          run.signature,
          run.payer,
          run.status,
          run.duration_ms,
          b.title as blink_title,
          b.price,
          b.icon_url,
          c.wallet as creator_wallet
        FROM receipts r
        JOIN runs run ON r.run_id = run.id
        JOIN blinks b ON run.blink_id = b.id
        JOIN creators c ON b.creator_id = c.id
        WHERE r.id = $1
        `,
        [id]
      )

      if (result.rows.length === 0) {
        return NextResponse.json(
          { success: false, error: 'Receipt not found' },
          { status: 404 }
        )
      }

      const receipt = result.rows[0]

      // Format the response
      const formattedReceipt = {
        id: receipt.id,
        createdAt: receipt.created_at,
        blink: {
          id: receipt.blink_id,
          title: receipt.blink_title,
          priceUsdc: receipt.price,
          iconUrl: receipt.icon_url,
        },
        transaction: {
          reference: receipt.reference,
          signature: receipt.signature,
          payer: receipt.payer,
          status: receipt.status,
          durationMs: receipt.duration_ms,
        },
        creator: {
          wallet: receipt.creator_wallet,
        },
      }

      return NextResponse.json({
        success: true,
        data: formattedReceipt,
      })
    } finally {
      client.release()
    }
  } catch (error) {
    console.error('Error fetching receipt:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to fetch receipt' },
      { status: 500 }
    )
  }
}
