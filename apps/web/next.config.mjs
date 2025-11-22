/** @type {import('next').NextConfig} */
const nextConfig = {
  // Use standalone for Docker/Railway, Vercel ignores this
  output: process.env.RAILWAY_ENVIRONMENT ? 'standalone' : undefined,
  images: {
    unoptimized: true,
  },
  // Transpile workspace packages
  transpilePackages: ['@blink402/types', '@blink402/solana', '@blink402/database', '@blink402/config'],
  // Next.js 14 uses experimental for serverComponentsExternalPackages
  experimental: {
    serverComponentsExternalPackages: ['pg'],
  },
  // Enable production-ready type checking (no longer ignoring errors)
  typescript: {
    // During build, TypeScript errors will fail the build
    ignoreBuildErrors: false,
  },
  eslint: {
    // ESLint errors will fail the build in production
    ignoreDuringBuilds: false,
  },
  // Configure headers to allow wallet connection iframes
  async headers() {
    const isDev = process.env.NODE_ENV === 'development'
    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'Content-Security-Policy',
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-eval' 'unsafe-inline'",
              "style-src 'self' 'unsafe-inline'",
              "img-src 'self' data: https: blob:",
              "font-src 'self' data:",
              // In development, allow localhost connections; in production, allow only https
              // Allow Privy auth domains, WalletConnect, and Solana wallet connections
              isDev
                ? "connect-src 'self' http://localhost:* https: wss: ws: https://auth.privy.io https://api.privy.io https://explorer-api.walletconnect.com https://verify.walletconnect.com https://verify.walletconnect.org"
                : "connect-src 'self' https: wss: ws: https://auth.privy.io https://api.privy.io https://explorer-api.walletconnect.com https://verify.walletconnect.com https://verify.walletconnect.org",
              "frame-src 'self' https://connect.solflare.com https://phantom.app https://auth.privy.io https://verify.walletconnect.com https://verify.walletconnect.org",
              "worker-src 'self' blob:",
            ].join('; '),
          },
        ],
      },
    ]
  },
  // Proxy Solana Actions and x402 routes to API backend
  async rewrites() {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'
    return [
      // Solana Actions routes
      {
        source: '/actions.json',
        destination: `${apiUrl}/actions.json`,
      },
      {
        source: '/actions/:slug',
        destination: `${apiUrl}/actions/:slug`,
      },
      // API Actions routes (for Dialect unfurling)
      {
        source: '/api/actions/:slug',
        destination: `${apiUrl}/api/actions/:slug`,
      },
      // Actions callback endpoint for Phantom signature submission
      {
        source: '/api/actions/submit/:reference',
        destination: `${apiUrl}/api/actions/submit/:reference`,
      },
      // Payment proxy route
      {
        source: '/bazaar/:slug',
        destination: `${apiUrl}/bazaar/:slug`,
      },
      // API routes for frontend
      {
        source: '/blinks',
        destination: `${apiUrl}/blinks`,
      },
      {
        source: '/blinks/:slug',
        destination: `${apiUrl}/blinks/:slug`,
      },
      {
        source: '/dashboard',
        destination: `${apiUrl}/dashboard`,
      },
      {
        source: '/profiles/:path*',
        destination: `${apiUrl}/profiles/:path*`,
      },
      {
        source: '/receipts/:id',
        destination: `${apiUrl}/receipts/:id`,
      },
      // Receipt viewer endpoints (by transaction signature and reference)
      {
        source: '/receipts/tx/:signature',
        destination: `${apiUrl}/receipts/tx/:signature`,
      },
      {
        source: '/receipts/ref/:reference',
        destination: `${apiUrl}/receipts/ref/:reference`,
      },
      // Slots API routes
      {
        source: '/api/slots/:path*',
        destination: `${apiUrl}/api/slots/:path*`,
      },
    ]
  },
  webpack: (config, { isServer }) => {
    // Fix for Solana wallet adapters and Node.js polyfills
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        path: false,
        stream: false,
        crypto: false,
        process: false,
        http: false,
        https: false,
        zlib: false,
        os: false,
        util: false,
      }
    }

    // Handle pino-pretty missing dependency
    config.resolve.alias = {
      ...config.resolve.alias,
      'pino-pretty': false,
    }

    // Ensure proper resolution of Solana packages
    config.resolve.extensionAlias = {
      '.js': ['.js', '.ts', '.tsx'],
      '.mjs': ['.mjs', '.mts'],
      '.cjs': ['.cjs', '.cts'],
    }

    return config
  },
}

export default nextConfig
