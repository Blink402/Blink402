// GET /api/dashboard - Get dashboard data for authenticated wallet

import { NextRequest, NextResponse } from 'next/server'
import { getDashboardData } from '@/lib/db'
import { getWalletFromRequest } from '@/lib/auth'
import { logger } from '@/lib/logger'

// Force dynamic rendering - don't pre-render during build
export const dynamic = 'force-dynamic'

// GET /api/dashboard - Get dashboard stats and blinks for authenticated wallet
export async function GET(request: NextRequest) {
  try {
    // Get wallet from auth token
    const authHeader = request.headers.get('authorization')
    const wallet = getWalletFromRequest(authHeader)

    if (!wallet) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized - valid auth token required' },
        { status: 401 }
      )
    }

    const dashboardData = await getDashboardData(wallet)

    return NextResponse.json({
      success: true,
      data: dashboardData,
    })
  } catch (error) {
    logger.error('Error fetching dashboard data:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to fetch dashboard data' },
      { status: 500 }
    )
  }
}
