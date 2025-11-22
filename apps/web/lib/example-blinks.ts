/**
 * Example Blinks - Real, functional Blinks that serve as platform examples
 */

import { BlinkData } from "./types"

export const PLATFORM_WALLET = process.env.PLATFORM_WALLET || "11111111111111111111111111111111" // Replace with real wallet

export const EXAMPLE_BLINKS: Omit<BlinkData, "id">[] = [
  {
    slug: "sentiment-analyzer",
    title: "Text Sentiment Analyzer",
    description: "Analyze the sentiment of any text (positive, negative, or neutral) using AI-powered analysis. Perfect for social media monitoring and feedback analysis.",
    price_usdc: "0.01",
    icon_url: "/lottie/Success-Checkmark-Green.lottie",
    endpoint_url: "/api/services/sentiment",
    method: "POST",
    category: "AI/ML",
    runs: 0,
    status: "active",
    payment_token: "USDC",
    payment_mode: "charge",
    payout_wallet: PLATFORM_WALLET,
    creator_id: "00000000-0000-0000-0000-000000000000",
    creator: {
      wallet: PLATFORM_WALLET
    }
  },
  {
    slug: "qr-generator",
    title: "QR Code Generator",
    description: "Generate QR codes from any text or URL. Customize size and colors. Perfect for links, contact info, or product codes.",
    price_usdc: "0.005",
    icon_url: "/lottie/Wireframe-Globe.lottie",
    endpoint_url: "/api/services/qr-code",
    method: "POST",
    category: "Utilities",
    runs: 0,
    status: "active",
    payment_token: "USDC",
    payment_mode: "charge",
    payout_wallet: PLATFORM_WALLET,
    creator_id: "00000000-0000-0000-0000-000000000000",
    creator: {
      wallet: PLATFORM_WALLET
    }
  },
  {
    slug: "sol-price",
    title: "SOL Price Checker",
    description: "Get real-time Solana (SOL) price in USD. Cached for 1 minute for optimal performance. Great for trading bots and price alerts.",
    price_usdc: "0.002",
    icon_url: "/lottie/Success-Outline-Minimal.lottie",
    endpoint_url: "/api/services/crypto-price",
    method: "GET",
    category: "Data",
    runs: 0,
    status: "active",
    payment_token: "USDC",
    payment_mode: "charge",
    payout_wallet: PLATFORM_WALLET,
    creator_id: "00000000-0000-0000-0000-000000000000",
    creator: {
      wallet: PLATFORM_WALLET
    }
  },
  {
    slug: "json-formatter",
    title: "JSON Formatter & Validator",
    description: "Validate, prettify, and minify JSON data. Get detailed stats on your JSON structure. Essential tool for API developers.",
    price_usdc: "0.003",
    icon_url: "/lottie/Loading-Spinner-Minimal.lottie",
    endpoint_url: "/api/services/json-format",
    method: "POST",
    category: "API Tools",
    runs: 0,
    status: "active",
    payment_token: "USDC",
    payment_mode: "charge",
    payout_wallet: PLATFORM_WALLET,
    creator_id: "00000000-0000-0000-0000-000000000000",
    creator: {
      wallet: PLATFORM_WALLET
    }
  },
  {
    slug: "wallet-balance",
    title: "Solana Wallet Balance",
    description: "Check the SOL balance of any Solana wallet address on devnet or mainnet. Returns balance in both SOL and lamports.",
    price_usdc: "0.004",
    icon_url: "/lottie/Empty-State-Simple.lottie",
    endpoint_url: "/api/services/wallet-balance",
    method: "POST",
    category: "Web3",
    runs: 0,
    status: "active",
    payment_token: "USDC",
    payment_mode: "charge",
    payout_wallet: PLATFORM_WALLET,
    creator_id: "00000000-0000-0000-0000-000000000000",
    creator: {
      wallet: PLATFORM_WALLET
    }
  },
  {
    slug: "inspirational-quotes",
    title: "Daily Inspiration Generator",
    description: "Get a fresh dose of motivation! Generate inspirational quotes from famous leaders, entrepreneurs, and thinkers. Perfect for social media posts and daily motivation.",
    price_usdc: "0.002",
    icon_url: "/lottie/Success-Checkmark-Green.lottie",
    endpoint_url: "/api/services/inspirational-quotes",
    method: "GET",
    category: "Lifestyle",
    runs: 0,
    status: "active",
    payment_token: "USDC",
    payment_mode: "charge",
    payout_wallet: PLATFORM_WALLET,
    creator_id: "00000000-0000-0000-0000-000000000000",
    creator: {
      wallet: PLATFORM_WALLET
    }
  }
]

// Helper to get example Blink by slug
export function getExampleBlinkBySlug(slug: string): Omit<BlinkData, "id"> | undefined {
  return EXAMPLE_BLINKS.find(blink => blink.slug === slug)
}

// All example Blink slugs for quick checking
export const EXAMPLE_BLINK_SLUGS = EXAMPLE_BLINKS.map(b => b.slug)
