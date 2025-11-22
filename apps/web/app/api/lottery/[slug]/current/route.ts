import { NextRequest, NextResponse } from 'next/server'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params
  const { searchParams } = new URL(request.url)
  const wallet = searchParams.get('wallet')

  try {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'
    const url = wallet
      ? `${apiUrl}/lottery/${slug}/current?wallet=${wallet}`
      : `${apiUrl}/lottery/${slug}/current`

    const res = await fetch(url, {
      headers: {
        'Content-Type': 'application/json',
      },
    })

    const data = await res.json()

    if (!res.ok) {
      return NextResponse.json(data, { status: res.status })
    }

    return NextResponse.json(data)
  } catch (error) {
    console.error('Error fetching current lottery round:', error)
    return NextResponse.json(
      { error: 'Failed to fetch current round' },
      { status: 500 }
    )
  }
}
