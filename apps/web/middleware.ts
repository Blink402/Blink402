// Next.js middleware for security headers and CORS
import { NextRequest, NextResponse } from 'next/server'

export function middleware(request: NextRequest) {
  const response = NextResponse.next()

  // Security Headers
  const headers = new Headers(response.headers)

  // Prevent clickjacking
  headers.set('X-Frame-Options', 'DENY')

  // Prevent MIME type sniffing
  headers.set('X-Content-Type-Options', 'nosniff')

  // Enable XSS protection
  headers.set('X-XSS-Protection', '1; mode=block')

  // Referrer Policy
  headers.set('Referrer-Policy', 'strict-origin-when-cross-origin')

  // Permissions Policy (formerly Feature Policy)
  headers.set(
    'Permissions-Policy',
    'accelerometer=(), camera=(), geolocation=(), gyroscope=(), magnetometer=(), microphone=(), payment=(), usb=()'
  )

  // Content Security Policy
  // Build connect-src with dynamic API URL support
  const isDev = process.env.NODE_ENV === 'development'
  const connectSrcDomains = [
    "'self'",
    "https://unpkg.com", // Lottie WASM files
    "https://cdn.jsdelivr.net", // Lottie CDN
    "https://*.railway.app", // Railway backend API
    "https://*.privy.io", // Privy auth
    "https://auth.privy.io", // Privy auth API
    "https://api.privy.io", // Privy API
    "https://explorer-api.walletconnect.com", // WalletConnect explorer
    "https://verify.walletconnect.com", // WalletConnect verification
    "https://verify.walletconnect.org", // WalletConnect verification
    "https://*.solana.com",
    "https://*.helius.xyz",
    "https://*.helius-rpc.com", // Helius RPC
    "https://mainnet.helius-rpc.com", // Helius mainnet
    "https://devnet.helius-rpc.com", // Helius devnet
    "https://api.mainnet-beta.solana.com",
    "https://api.devnet.solana.com",
    "https://rpc.ankr.com", // Ankr RPC
    "wss://*.solana.com",
    "wss://*.helius-rpc.com" // Helius WebSocket
  ]

  // In development, allow localhost connections
  if (isDev) {
    connectSrcDomains.push('http://localhost:*')
    connectSrcDomains.push('ws://localhost:*')
  }

  // Add custom API URL if defined
  const apiUrl = process.env.NEXT_PUBLIC_API_URL
  if (apiUrl && apiUrl.startsWith('http')) {
    try {
      const apiDomain = new URL(apiUrl).origin
      if (!connectSrcDomains.includes(apiDomain)) {
        connectSrcDomains.push(apiDomain)
      }
    } catch (e) {
      // Invalid URL, skip
    }
  }

  const csp = [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://cdn.jsdelivr.net https://unpkg.com", // unsafe-eval needed for baffle.js
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com",
    "img-src 'self' data: https: blob:",
    "media-src 'self' data: blob:",
    "object-src 'self' blob:",
    "worker-src 'self' blob:",
    `connect-src ${connectSrcDomains.join(' ')}`,
    "frame-src 'self' https://connect.solflare.com https://phantom.app https://auth.privy.io https://*.privy.io https://verify.walletconnect.com https://verify.walletconnect.org", // Allow wallet connection iframes
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
  ].join('; ')

  headers.set('Content-Security-Policy', csp)

  // HSTS (Strict-Transport-Security) - only in production
  if (process.env.NODE_ENV === 'production') {
    headers.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload')
  }

  return NextResponse.next({
    request,
    headers,
  })
}

// Configure which routes the middleware should run on
export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico, favicon.png (favicon files)
     * - public folder assets
     */
    '/((?!_next/static|_next/image|favicon\\.ico|favicon\\.png|.*\\.svg$|.*\\.png$|.*\\.jpg$|.*\\.jpeg$|.*\\.gif$|.*\\.webp$|.*\\.lottie$).*)',
  ],
}
