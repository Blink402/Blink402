import { NextRequest, NextResponse } from 'next/server'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params
  const { searchParams } = new URL(request.url)
  const limit = searchParams.get('limit') || '5'
  const offset = searchParams.get('offset') || '0'

  try {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'
    const res = await fetch(
      `${apiUrl}/lottery/${slug}/history?limit=${limit}&offset=${offset}`,
      {
        headers: {
          'Content-Type': 'application/json',
        },
      }
    )

    const data = await res.json()

    if (!res.ok) {
      return NextResponse.json(data, { status: res.status })
    }

    return NextResponse.json(data)
  } catch (error) {
    console.error('Error fetching lottery history:', error)
    return NextResponse.json(
      { error: 'Failed to fetch lottery history' },
      { status: 500 }
    )
  }
}
