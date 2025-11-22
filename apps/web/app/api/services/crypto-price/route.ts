import { NextRequest, NextResponse } from "next/server"

/**
 * Crypto Price Checker API
 * Returns mock SOL price data (in production, this would fetch from an oracle or API)
 */

// Simple in-memory cache
let cachedPrice: { price: number; timestamp: number } | null = null
const CACHE_DURATION = 60000 // 1 minute

function generateMockPrice(): number {
  // Generate a realistic SOL price between $140-$180 with some volatility
  const basePrice = 160
  const volatility = 20
  const randomFactor = Math.random() * 2 - 1 // -1 to 1
  return Math.round((basePrice + (volatility * randomFactor)) * 100) / 100
}

export async function GET(req: NextRequest) {
  try {
    const now = Date.now()

    // Check if we have a valid cached price
    if (cachedPrice && (now - cachedPrice.timestamp) < CACHE_DURATION) {
      return NextResponse.json({
        success: true,
        data: {
          symbol: "SOL",
          name: "Solana",
          price: cachedPrice.price,
          currency: "USD",
          cached: true,
          timestamp: new Date(cachedPrice.timestamp).toISOString()
        }
      })
    }

    // Generate new price
    const price = generateMockPrice()
    cachedPrice = { price, timestamp: now }

    return NextResponse.json({
      success: true,
      data: {
        symbol: "SOL",
        name: "Solana",
        price,
        currency: "USD",
        cached: false,
        timestamp: new Date(now).toISOString()
      }
    })
  } catch (error) {
    console.error("Crypto price error:", error)
    return NextResponse.json(
      { error: "Failed to fetch crypto price" },
      { status: 500 }
    )
  }
}

export async function POST(req: NextRequest) {
  // Support POST for consistency with other endpoints
  return GET(req)
}
