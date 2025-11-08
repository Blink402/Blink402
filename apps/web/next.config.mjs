/** @type {import('next').NextConfig} */
const nextConfig = {
  // Use standalone for Docker/Railway, Vercel ignores this
  output: process.env.RAILWAY_ENVIRONMENT ? 'standalone' : undefined,
  images: {
    unoptimized: true,
  },
  // Fix workspace detection warning
  outputFileTracingRoot: process.cwd(),
  // Transpile workspace packages
  transpilePackages: ['@blink402/types', '@blink402/solana', '@blink402/database', '@blink402/config'],
  // Bundle external packages for Edge Runtime (updated syntax)
  serverExternalPackages: ['pg'],
  // Enable production-ready type checking (no longer ignoring errors)
  typescript: {
    // During build, TypeScript errors will fail the build
    ignoreBuildErrors: false,
  },
  eslint: {
    // ESLint errors will fail the build in production
    ignoreDuringBuilds: false,
  },
  // Proxy Solana Actions and x402 routes to API backend
  async rewrites() {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'
    return [
      {
        source: '/actions.json',
        destination: `${apiUrl}/actions.json`,
      },
      {
        source: '/actions/:slug',
        destination: `${apiUrl}/actions/:slug`,
      },
      {
        source: '/bazaar/:slug',
        destination: `${apiUrl}/bazaar/:slug`,
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
