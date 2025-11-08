import { NextRequest, NextResponse } from "next/server"
import { Connection, PublicKey, LAMPORTS_PER_SOL } from "@solana/web3.js"

/**
 * Wallet Balance Checker API
 * Checks SOL balance of any Solana wallet address
 */

// Use devnet for testing, mainnet-beta for production
const SOLANA_RPC_URL = process.env.SOLANA_RPC_URL || "https://api.devnet.solana.com"

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { address } = body

    if (!address || typeof address !== "string") {
      return NextResponse.json(
        { error: "Wallet address is required" },
        { status: 400 }
      )
    }

    // Validate the address
    let publicKey: PublicKey
    try {
      publicKey = new PublicKey(address)
    } catch (error) {
      return NextResponse.json(
        { error: "Invalid Solana wallet address" },
        { status: 400 }
      )
    }

    // Connect to Solana and get balance
    const connection = new Connection(SOLANA_RPC_URL, "confirmed")
    const balanceLamports = await connection.getBalance(publicKey)
    const balanceSOL = balanceLamports / LAMPORTS_PER_SOL

    // Get account info for additional details
    const accountInfo = await connection.getAccountInfo(publicKey)

    return NextResponse.json({
      success: true,
      data: {
        address,
        balance: {
          lamports: balanceLamports,
          sol: balanceSOL
        },
        exists: accountInfo !== null,
        executable: accountInfo?.executable || false,
        owner: accountInfo?.owner.toBase58() || null,
        network: SOLANA_RPC_URL.includes("devnet") ? "devnet" : "mainnet-beta"
      }
    })
  } catch (error) {
    console.error("Wallet balance error:", error)
    return NextResponse.json(
      {
        error: "Failed to fetch wallet balance",
        details: error instanceof Error ? error.message : "Unknown error"
      },
      { status: 500 }
    )
  }
}
