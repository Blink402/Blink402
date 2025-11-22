import Fastify from 'fastify'
import cors from '@fastify/cors'
import helmet from '@fastify/helmet'
import rateLimit from '@fastify/rate-limit'
import compress from '@fastify/compress'
import multipart from '@fastify/multipart'
import fastifyStatic from '@fastify/static'
import swagger from '@fastify/swagger'
import swaggerUi from '@fastify/swagger-ui'
import { join } from 'path'
import dotenv from 'dotenv'

// Load environment variables
dotenv.config()

// Validate required environment variables
function validateEnvironment() {
  const NODE_ENV = process.env.NODE_ENV || 'development'
  const requiredVars: string[] = ['DATABASE_URL', 'PORT']

  // Add production-specific required variables
  if (NODE_ENV === 'production') {
    requiredVars.push('REDIS_URL', 'SOLANA_RPC_URL', 'APP_URL')
  }

  const missing: string[] = []
  for (const varName of requiredVars) {
    if (!process.env[varName]) {
      missing.push(varName)
    }
  }

  if (missing.length > 0) {
    console.error('❌ Missing required environment variables:')
    for (const varName of missing) {
      console.error(`   - ${varName}`)
    }
    console.error('\nPlease check your .env file or environment configuration.')
    console.error('See .env.example for reference.\n')
    process.exit(1)
  }

  // Validate environment-specific values
  if (NODE_ENV === 'production') {
    // Validate database URL format
    if (!process.env.DATABASE_URL?.startsWith('postgresql://')) {
      console.error('❌ DATABASE_URL must start with postgresql://')
      process.exit(1)
    }

    // Validate Redis URL format
    if (!process.env.REDIS_URL?.startsWith('redis://') && !process.env.REDIS_URL?.startsWith('rediss://')) {
      console.error('❌ REDIS_URL must start with redis:// or rediss://')
      process.exit(1)
    }

    // Validate Solana RPC URL format
    if (!process.env.SOLANA_RPC_URL?.startsWith('http')) {
      console.error('❌ SOLANA_RPC_URL must be a valid HTTP(S) URL')
      process.exit(1)
    }
  }

  console.log('✅ Environment validation passed')
  if (NODE_ENV === 'production') {
    console.log('   - Running in PRODUCTION mode')
    console.log('   - Redis: enabled (required)')
    console.log('   - Database: PostgreSQL')
  } else {
    console.log('   - Running in DEVELOPMENT mode')
    console.log('   - Redis:', process.env.REDIS_URL ? 'enabled' : 'disabled (using in-memory fallback)')
  }
}

// Run validation before starting server
validateEnvironment()

// Import Redis utilities
import { initRedis, isRedisConnected, getRedis } from '@blink402/redis'

// Import routes
import { actionsMetadataRoutes } from './routes/actions-metadata.js'
import { proxyRoutes } from './routes/proxy.js'
import { proxyRoutesWithRedis } from './routes/proxy-with-redis.js'
import { blinksRoutes } from './routes/blinks.js'
import { catalogRoutes } from './routes/catalog.js'
import { dashboardRoutes } from './routes/dashboard.js'
import { receiptsRoutes } from './routes/receipts.js'
import { healthRoutes } from './routes/health.js'
import { twitterRoutes } from './routes/twitter.js'
import { jupiterRoutes } from './routes/jupiter.js'
import { demoRoutes } from './routes/demo.js'
import { adminRoutes } from './routes/admin.js'
import { galleryRoutes } from './routes/gallery.js'
import { profilesRoutes } from './routes/profiles.js'
import { walletAnalysisRoutes } from './routes/wallet-analysis.js'
import { tokenPriceRoutes } from './routes/token-price.js'
import { qrCodeRoutes } from './routes/qr-code.js'
import { aiServicesRoutes } from './routes/ai-services.js'
import { aiRoutes } from './routes/ai.js'
import { socialViewRoutes } from './routes/social-view.js'
import { thankYouClaimRoutes } from './routes/thank-you-claim.js'
import { slotsRoutes } from './routes/slots.js'
import { paymentsRoutes } from './routes/payments.js'
import { creatorPayoutKeyRoutes } from './routes/creator-payout-key.js'
import { actionsSlotMachineRoutes } from './routes/actions-slot-machine.js'
import { lotteryRoutes } from './routes/lottery.js'
import { actionsSubmitRoutes } from './routes/actions-submit.js'
import { referralRoutes } from './routes/referrals.js'
import { tokenRoutes } from './routes/token.js'

const PORT = parseInt(process.env.PORT || '3001', 10)
const HOST = process.env.HOST || '0.0.0.0'
const NODE_ENV = process.env.NODE_ENV || 'development'

// Create Fastify instance with logger
const fastify = Fastify({
  logger: {
    level: NODE_ENV === 'development' ? 'debug' : 'info',
    transport:
      NODE_ENV === 'development'
        ? {
            target: 'pino-pretty',
            options: {
              translateTime: 'HH:MM:ss Z',
              ignore: 'pid,hostname',
            },
          }
        : undefined,
  },
  requestIdHeader: 'x-request-id',
  disableRequestLogging: false,
  trustProxy: true,
})

// Register plugins
await fastify.register(helmet, {
  contentSecurityPolicy: NODE_ENV === 'production',
  crossOriginEmbedderPolicy: false,
  crossOriginResourcePolicy: false, // Allow images to be loaded from different origins
})

await fastify.register(cors, {
  origin: [
    'http://localhost:3000',
    'http://localhost:3500',
    'https://blink402.dev',
    'https://www.blink402.dev',
    /\.solana\.com$/,
    /^https:\/\/dial\.to/,
  ],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  exposedHeaders: [
    'Content-Length',
    'Content-Type',
    'X-PAYMENT',
    'X-PAYMENT-METADATA',
    'WWW-Authenticate',
    'X-Ratelimit-Limit',
    'X-Ratelimit-Remaining',
    'X-Ratelimit-Reset'
  ],
  allowedHeaders: [
    'Content-Type',
    'Authorization',
    'Accept',
    'x-uploader-wallet',
    'x-request-wallet',
    'x-wallet-signature',
    'x-wallet-address',
    'x-payment',
    'x-payment-metadata',
    'x-payment-type',
    'x-payment-tx',
    'idempotency-key',      // Fix Pack 5: Standard idempotency key header
    'x-idempotency-key'     // Fix Pack 5: Alternative idempotency key header
  ],
})

// ========== INITIALIZE REDIS ==========
// Initialize Redis connection before registering plugins
// This ensures Redis is available for rate limiting and caching
const redisClient = await initRedis(process.env.REDIS_URL || process.env.REDIS_PUBLIC_URL)

if (redisClient) {
  fastify.log.info('✅ Redis initialized successfully')
} else {
  fastify.log.warn('⚠️  Redis not available - continuing with degraded functionality')

  if (NODE_ENV === 'production') {
    fastify.log.error('⚠️  CRITICAL: Redis connection failed in production!')
    fastify.log.error('⚠️  Server will start but features will be degraded:')
    fastify.log.error('⚠️  - No distributed locking (race conditions possible)')
    fastify.log.error('⚠️  - No caching (slower performance)')
    fastify.log.error('⚠️  - Rate limiting will be in-memory only (not distributed)')
    fastify.log.error('⚠️')
    fastify.log.error('⚠️  ACTION REQUIRED: Check Redis service in Railway dashboard')
    fastify.log.error('⚠️  Verify REDIS_URL or REDIS_PUBLIC_URL environment variable')
  } else {
    fastify.log.warn('⚠️  Continuing without Redis in development mode')
    fastify.log.warn('⚠️  Some features (distributed locking, caching) will be disabled')
  }
}

// Configure rate limiting with Redis (if available)
const rateLimitConfig: any = {
  max: NODE_ENV === 'development' ? 1000 : 100,
  timeWindow: '1 minute',
}

// Use Redis for distributed rate limiting if connected
if (isRedisConnected()) {
  rateLimitConfig.redis = getRedis()
  fastify.log.info('Rate limiting: Using Redis for distributed rate limiting')
} else {
  if (NODE_ENV === 'production') {
    fastify.log.warn('⚠️  Rate limiting: Using in-memory store in production (not ideal for multiple instances)')
  } else {
    fastify.log.info('Rate limiting: Using in-memory store (development mode)')
  }
}

await fastify.register(rateLimit, rateLimitConfig)

await fastify.register(compress, {
  global: true,
})

// Register multipart for file uploads
await fastify.register(multipart, {
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB max file size
    files: 1, // Only one file at a time
  },
})

// Serve static files from the uploads directory
await fastify.register(fastifyStatic, {
  root: join(process.cwd(), 'uploads'),
  prefix: '/uploads/', // This will serve files at /uploads/*
  decorateReply: false, // We don't need the reply.sendFile decorator
  setHeaders: (res) => {
    // CORS headers for cross-origin access
    res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin')
    res.setHeader('Access-Control-Allow-Origin', '*')
    res.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS')
    // Cache images for 1 hour
    res.setHeader('Cache-Control', 'public, max-age=3600')
  },
})

// Swagger documentation (dev only)
if (NODE_ENV === 'development') {
  await fastify.register(swagger, {
    openapi: {
      info: {
        title: 'Blink402 API',
        description: 'Pay-per-API-call platform with Solana Actions',
        version: '0.1.0',
      },
      servers: [
        {
          url: 'http://localhost:3001',
          description: 'Development server',
        },
      ],
      tags: [
        { name: 'actions', description: 'Solana Actions endpoints' },
        { name: 'proxy', description: 'x402 proxy endpoints' },
        { name: 'blinks', description: 'Blink CRUD operations' },
        { name: 'catalog', description: 'Public catalog and featured Blinks' },
        { name: 'dashboard', description: 'Creator dashboard' },
        { name: 'payments', description: 'Payment status and verification' },
        { name: 'receipts', description: 'cNFT receipts' },
        { name: 'health', description: 'Health checks and monitoring metrics' },
        { name: 'twitter', description: 'Twitter OAuth and monetization' },
      ],
    },
  })

  await fastify.register(swaggerUi, {
    routePrefix: '/docs',
    uiConfig: {
      docExpansion: 'list',
      deepLinking: true,
    },
  })
}

// Register routes
await fastify.register(healthRoutes, { prefix: '/health' })

// Solana Actions metadata for Dialect unfurling (GET only - no POST transaction building)
// Actual payments use ONCHAIN x402 via /bazaar/:slug
await fastify.register(actionsMetadataRoutes, { prefix: '/api/actions' })
// Actions submit endpoint for Phantom to POST signed transactions
await fastify.register(actionsSubmitRoutes, { prefix: '/api/actions/submit' })

// Use Redis-backed proxy if Redis is connected, otherwise fall back to basic proxy
if (isRedisConnected()) {
  await fastify.register(proxyRoutesWithRedis, { prefix: '/bazaar' })
  fastify.log.info('✓ Using Redis-backed proxy with distributed locking')
} else {
  await fastify.register(proxyRoutes, { prefix: '/bazaar' })
  fastify.log.warn('⚠ Redis not connected - using fallback proxy (no distributed locking)')
}

await fastify.register(blinksRoutes, { prefix: '/blinks' })
await fastify.register(catalogRoutes) // No prefix, routes already have /catalog
await fastify.register(profilesRoutes, { prefix: '/profiles' })
await fastify.register(dashboardRoutes, { prefix: '/dashboard' })
await fastify.register(receiptsRoutes, { prefix: '/receipts' })
await fastify.register(twitterRoutes, { prefix: '/twitter' })
await fastify.register(jupiterRoutes, { prefix: '/api/jupiter' })
await fastify.register(demoRoutes, { prefix: '/demo' })
await fastify.register(adminRoutes, { prefix: '/admin' })
await fastify.register(galleryRoutes, { prefix: '/api/gallery' })
await fastify.register(walletAnalysisRoutes)
await fastify.register(tokenPriceRoutes, { prefix: '/token-price' })
await fastify.register(qrCodeRoutes, { prefix: '/qr-code' })
await fastify.register(aiServicesRoutes, { prefix: '/ai-services' })
await fastify.register(aiRoutes, { prefix: '/ai' })
await fastify.register(socialViewRoutes, { prefix: '/a' })
await fastify.register(thankYouClaimRoutes, { prefix: '/a' })
await fastify.register(slotsRoutes, { prefix: '/api/slots' })
await fastify.register(paymentsRoutes, { prefix: '/api/payments' })
await fastify.register(creatorPayoutKeyRoutes, { prefix: '/api/creator/payout-key' })
await fastify.register(lotteryRoutes, { prefix: '/lottery' })
await fastify.register(actionsSlotMachineRoutes, { prefix: '/actions/slot-machine' })
await fastify.register(referralRoutes, { prefix: '/referrals' })
await fastify.register(tokenRoutes, { prefix: '/token' })

// Root endpoint
fastify.get('/', async () => {
  return {
    name: 'Blink402 API',
    version: '0.1.0',
    status: 'running',
    docs: NODE_ENV === 'development' ? '/docs' : undefined,
  }
})

// Solana Actions discovery endpoint (for Dialect unfurling)
fastify.get('/actions.json', async () => {
  // Use relative paths with clean wildcard pattern
  return {
    rules: [
      // Map slot-machine to its action endpoint
      {
        pathPattern: '/slot-machine',
        apiPath: '/api/actions/slot-machine',
      },
      // Map all /blink/* URLs to /api/actions/* endpoints
      {
        pathPattern: '/blink/*',
        apiPath: '/api/actions/*',
      },
      // Map all /lottery/* URLs to /api/actions/* endpoints
      {
        pathPattern: '/lottery/*',
        apiPath: '/api/actions/*',
      },
      // Idempotent fallback: map all /api/actions/** to themselves
      {
        pathPattern: '/api/actions/**',
        apiPath: '/api/actions/**',
      },
    ],
  }
})

// Graceful shutdown
const signals = ['SIGINT', 'SIGTERM']
signals.forEach((signal) => {
  process.on(signal, async () => {
    fastify.log.info(`Received ${signal}, closing server...`)

    // Close Redis connection
    try {
      const { closeRedis } = await import('@blink402/redis')
      await closeRedis()
      fastify.log.info('✅ Redis connection closed')
    } catch (error) {
      fastify.log.warn({ error }, 'Redis already closed or not initialized')
    }

    await fastify.close()
    process.exit(0)
  })
})

// Start server
try {
  await fastify.listen({ port: PORT, host: HOST })
  fastify.log.info(`Server listening on http://${HOST}:${PORT}`)
  if (NODE_ENV === 'development') {
    fastify.log.info(`Swagger docs available at http://${HOST}:${PORT}/docs`)
  }

  // Start Jupiter executor worker (polls for paid buy-b402/burn-b402 runs)
  const { startJupiterExecutor } = await import('./workers/jupiter-executor.js')
  startJupiterExecutor(fastify.log)
  fastify.log.info('✅ Jupiter executor worker started')

  // Start lottery workers (scheduler + payout)
  const { startLotteryScheduler } = await import('./workers/lottery-scheduler.js')
  startLotteryScheduler(fastify.log)
  fastify.log.info('✅ Lottery scheduler worker started')

  const { startLotteryPayout } = await import('./workers/lottery-payout.js')
  startLotteryPayout(fastify.log)
  fastify.log.info('✅ Lottery payout worker started')

  const { startLotteryBuyback } = await import('./workers/lottery-buyback.js')
  startLotteryBuyback(fastify.log)
  fastify.log.info('✅ Lottery buyback worker started (automated B402 burn)')
} catch (err) {
  fastify.log.error(err)
  process.exit(1)
}
