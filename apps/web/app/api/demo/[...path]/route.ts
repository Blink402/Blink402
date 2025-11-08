import { NextRequest, NextResponse } from 'next/server'

// Use NEXT_PUBLIC_API_URL in production, fallback to localhost for dev
const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'

/**
 * Proxy all /api/demo/* requests to the backend API
 * This allows the frontend to call demo endpoints without CORS issues
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const { path } = await params
  const pathString = path.join('/')
  const url = `${API_URL}/demo/${pathString}`

  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    })

    const data = await response.json()
    return NextResponse.json(data, { status: response.status })
  } catch (error) {
    console.error('Demo proxy error:', error)
    return NextResponse.json(
      {
        success: false,
        error: 'Demo proxy failed',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const { path } = await params
  const pathString = path.join('/')
  const url = `${API_URL}/demo/${pathString}`

  try {
    const body = await request.text()

    // Only set Content-Type header if there's a body
    const headers: Record<string, string> = {}
    if (body) {
      headers['Content-Type'] = 'application/json'
    }

    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: body || undefined,
    })

    const data = await response.json()
    return NextResponse.json(data, { status: response.status })
  } catch (error) {
    console.error('Demo proxy error:', error)
    return NextResponse.json(
      {
        success: false,
        error: 'Demo proxy failed',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}
