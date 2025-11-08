import { ImageResponse } from '@vercel/og'
import { NextRequest } from 'next/server'

export const runtime = 'edge'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params
    
    // Fetch blink data from API route (Node.js runtime)
    const baseUrl = new URL(request.url).origin
    const response = await fetch(`${baseUrl}/api/blinks/${slug}/data`)
    
    if (!response.ok) {
      return new Response('Blink not found', { status: 404 })
    }
    
    const blink = await response.json()

    // Generate OG image with neon aesthetic
    return new ImageResponse(
      (
        <div
          style={{
            height: '100%',
            width: '100%',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: '#171717',
            backgroundImage: 'radial-gradient(circle at 25% 25%, rgba(43, 74, 107, 0.1) 0%, transparent 50%), radial-gradient(circle at 75% 75%, rgba(59, 158, 255, 0.1) 0%, transparent 50%)',
            padding: '60px',
            position: 'relative',
          }}
        >
          {/* Noise texture overlay effect */}
          <div
            style={{
              position: 'absolute',
              inset: 0,
              opacity: 0.15,
              backgroundImage: 'url(data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIzMDAiIGhlaWdodD0iMzAwIj48ZmlsdGVyIGlkPSJhIj48ZmVUdXJidWxlbmNlIGJhc2VGcmVxdWVuY3k9Ii43NSIgc3RpdGNoVGlsZXM9InN0aXRjaCIgdHlwZT0iZnJhY3RhbE5vaXNlIi8+PC9maWx0ZXI+PHBhdGggZD0iTTAgMGgzMDB2MzAwSDB6IiBmaWx0ZXI9InVybCgjYSkiIG9wYWNpdHk9Ii4wNSIvPjwvc3ZnPg==)',
            }}
          />

          {/* Dashed border */}
          <div
            style={{
              position: 'absolute',
              inset: '40px',
              border: '2px dashed #2B4A6B',
              borderRadius: '6px',
              boxShadow: '0 0 20px rgba(43, 74, 107, 0.3)',
            }}
          />

          {/* Content */}
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              textAlign: 'center',
              gap: '24px',
              zIndex: 1,
            }}
          >
            {/* Logo/Brand */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                marginBottom: '20px',
              }}
            >
              <div
                style={{
                  fontSize: '32px',
                  fontWeight: 300,
                  background: 'linear-gradient(135deg, #232732 0%, #2B4A6B 100%)',
                  backgroundClip: 'text',
                  color: 'transparent',
                  letterSpacing: '-0.02em',
                }}
              >
                Blink402
              </div>
            </div>

            {/* Blink Title */}
            <div
              style={{
                fontSize: '56px',
                fontWeight: 500,
                color: '#ffffff',
                maxWidth: '900px',
                lineHeight: 1.2,
                textShadow: '0 0 30px rgba(43, 74, 107, 0.3)',
              }}
            >
              {blink.title}
            </div>

            {/* Description */}
            <div
              style={{
                fontSize: '28px',
                color: '#8b8b8b',
                maxWidth: '800px',
                lineHeight: 1.4,
              }}
            >
              {blink.description}
            </div>

            {/* Price and Category */}
            <div
              style={{
                display: 'flex',
                gap: '32px',
                marginTop: '24px',
                alignItems: 'center',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '12px 24px',
                  border: '2px dashed #2B4A6B',
                  borderRadius: '6px',
                  background: 'rgba(43, 74, 107, 0.1)',
                }}
              >
                <span
                  style={{
                    fontSize: '32px',
                    fontWeight: 500,
                    background: 'linear-gradient(135deg, #232732 0%, #2B4A6B 100%)',
                    backgroundClip: 'text',
                    color: 'transparent',
                  }}
                >
                  ${blink.price_usdc} USDC
                </span>
              </div>

              <div
                style={{
                  fontSize: '24px',
                  color: '#8b8b8b',
                  textTransform: 'uppercase',
                  letterSpacing: '0.1em',
                }}
              >
                {blink.category}
              </div>
            </div>
          </div>

          {/* Bottom text */}
          <div
            style={{
              position: 'absolute',
              bottom: '40px',
              display: 'flex',
              fontSize: '20px',
              color: '#8b8b8b',
            }}
          >
            Pay-per-call API • Share anywhere
          </div>
        </div>
      ),
      {
        width: 1200,
        height: 630,
      }
    )
  } catch (error) {
    console.error('Error generating OG image:', error)
    return new Response('Failed to generate image', { status: 500 })
  }
}
