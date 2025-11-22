// GET /api/health - Health check endpoint for monitoring

import { NextResponse } from 'next/server'

// Force dynamic rendering - don't pre-render during build
export const dynamic = 'force-dynamic'

export async function GET() {
  const checks = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    checks: {
      database: { status: 'unknown', message: '' },
      environment: { status: 'unknown', message: '' },
    },
  }

  let overallHealthy = true

  // Check database connection using the existing testConnection function
  try {
    const { testConnection } = await import('@/lib/db')
    const isConnected = await testConnection()
    
    if (isConnected) {
      checks.checks.database = {
        status: 'healthy',
        message: 'Database connection successful',
      }
    } else {
      checks.checks.database = {
        status: 'unhealthy', 
        message: 'Database connection failed',
      }
      overallHealthy = false
    }

    checks.checks.database = {
      status: 'healthy',
      message: 'Database connection successful',
    }
  } catch (error) {
    checks.checks.database = {
      status: 'unhealthy',
      message: error instanceof Error ? error.message : 'Database connection failed',
    }
    overallHealthy = false
  }

  // Check required environment variables
  try {
    const requiredVars = ['DATABASE_URL']
    const missing = requiredVars.filter(v => !process.env[v])

    if (missing.length > 0) {
      checks.checks.environment = {
        status: 'unhealthy',
        message: `Missing environment variables: ${missing.join(', ')}`,
      }
      overallHealthy = false
    } else {
      checks.checks.environment = {
        status: 'healthy',
        message: 'All required environment variables present',
      }
    }
  } catch (error) {
    checks.checks.environment = {
      status: 'unhealthy',
      message: 'Environment check failed',
    }
    overallHealthy = false
  }

  checks.status = overallHealthy ? 'healthy' : 'unhealthy'

  return NextResponse.json(checks, {
    status: overallHealthy ? 200 : 503,
  })
}
