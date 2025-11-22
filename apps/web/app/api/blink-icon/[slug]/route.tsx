import { ImageResponse } from 'next/og'
import { NextRequest } from 'next/server'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { getBlinkBySlug } from '@/lib/db'

// Use Node.js runtime to support fs/promises for loading fonts and images
export const runtime = 'nodejs'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params

    // Get blink data directly from database
    const blink = await getBlinkBySlug(slug)

    if (!blink) {
      return new Response('Blink not found', { status: 404 })
    }

    // For specific blinks with custom images, return raw image without overlay
    if (slug === 'slot-machine' || slug === 'buy-b402' || slug === 'burn-b402') {
      let imageFilename = 'notext.png'
      if (slug === 'slot-machine') {
        imageFilename = 'SLOTS.png'
      } else if (slug === 'buy-b402') {
        imageFilename = 'Buy-b402.png'
      } else if (slug === 'burn-b402') {
        imageFilename = 'Burn-b402.png'
      }

      const imagePath = join(process.cwd(), `public/${imageFilename}`)
      const imageData = await readFile(imagePath)

      return new Response(imageData, {
        headers: {
          'Content-Type': 'image/png',
          'Cache-Control': 'public, max-age=31536000, immutable',
        },
      })
    }

    // Load background image from filesystem for other blinks
    const bgImagePath = join(process.cwd(), 'public/notext.png')
    const bgImageData = await readFile(bgImagePath)
    const bgBase64 = bgImageData.toString('base64')

    // Load Geist fonts from filesystem
    const geistSansPath = join(process.cwd(), 'public/fonts/Geist-Light.ttf')
    const geistMonoPath = join(process.cwd(), 'public/fonts/GeistMono-Regular.ttf')
    const geistSansData = await readFile(geistSansPath)
    const geistMonoData = await readFile(geistMonoPath)

    // Truncate title if too long for square format
    const maxTitleLength = 25
    const displayTitle = blink.title.length > maxTitleLength
      ? blink.title.substring(0, maxTitleLength - 3) + '...'
      : blink.title

    // Generate 512x512 square blink icon (Solana Actions standard)
    return new ImageResponse(
      (
        <div
          style={{
            height: '100%',
            width: '100%',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            alignItems: 'flex-start',
            backgroundImage: `url(data:image/png;base64,${bgBase64})`,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            backgroundRepeat: 'no-repeat',
            padding: '48px',
            position: 'relative',
          }}
        >
          {/* Content - positioned to avoid logo on right */}
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              maxWidth: '320px',
              gap: '16px',
            }}
          >
            {/* Blink Title - Neon white with blue glow */}
            <div
              style={{
                fontSize: '42px',
                fontFamily: 'Geist Sans',
                fontWeight: 300,
                color: '#ffffff',
                lineHeight: 1.1,
                letterSpacing: '-0.02em',
                textShadow: '0 0 20px rgba(90, 180, 255, 0.6)',
              }}
            >
              {displayTitle}
            </div>

            {/* Price Badge - Neon blue gradient */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                marginTop: '8px',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  padding: '12px 24px',
                  background: 'linear-gradient(135deg, #5AB4FF 0%, #3B8FD9 100%)',
                  borderRadius: '8px',
                  fontFamily: 'Geist Mono',
                  fontSize: '24px',
                  fontWeight: 700,
                  color: '#171717',
                  boxShadow: '0 0 20px rgba(90, 180, 255, 0.5)',
                }}
              >
                ${blink.price_usdc} {blink.payment_token || 'USDC'}
              </div>
            </div>
          </div>

          {/* Bottom branding - Neon grey */}
          <div
            style={{
              position: 'absolute',
              bottom: '32px',
              left: '48px',
              display: 'flex',
              fontFamily: 'Geist Mono',
              fontSize: '14px',
              color: '#9d9d9d',
              opacity: 0.8,
            }}
          >
            Blink402 • Pay-per-call APIs
          </div>
        </div>
      ),
      {
        width: 512,
        height: 512,
        fonts: [
          {
            name: 'Geist Sans',
            data: geistSansData,
            style: 'normal',
            weight: 300,
          },
          {
            name: 'Geist Mono',
            data: geistMonoData,
            style: 'normal',
            weight: 400,
          },
        ],
      }
    )
  } catch (error) {
    console.error('Error generating blink icon:', error)
    return new Response('Failed to generate icon', { status: 500 })
  }
}
