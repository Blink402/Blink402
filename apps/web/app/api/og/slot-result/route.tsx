import { ImageResponse } from 'next/og'
import { NextRequest } from 'next/server'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'

// Use Node.js runtime to support fs/promises for loading fonts and images
export const runtime = 'nodejs'

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const reels = searchParams.get('reels')?.split(',') || ['?', '?', '?']
    const payout = searchParams.get('payout') || '0'
    const win = searchParams.get('win') === 'true'
    const multiplier = searchParams.get('multiplier') || '0'
    const error = searchParams.get('error') === 'true'

    // Load background image from filesystem
    const bgImagePath = join(process.cwd(), 'public/SLOTS.png')
    const bgImageData = await readFile(bgImagePath)
    const bgBase64 = bgImageData.toString('base64')

    // Load Geist fonts
    const geistSansPath = join(process.cwd(), 'public/fonts/Geist-Light.ttf')
    const geistMonoPath = join(process.cwd(), 'public/fonts/GeistMono-Regular.ttf')
    const geistSansData = await readFile(geistSansPath)
    const geistMonoData = await readFile(geistMonoPath)

    // Determine colors and title based on outcome
    let title = '🎰 Slot Machine'
    let titleColor = '#ffffff'
    let subtitleColor = '#9d9d9d'

    if (error) {
      title = '⚠️ Error'
      titleColor = '#ff5555'
    } else if (win) {
      title = '🎉 YOU WON!'
      titleColor = '#5AB4FF'
    } else {
      title = '😔 No Win'
      titleColor = '#9d9d9d'
    }

    // Generate OG image
    return new ImageResponse(
      (
        <div
          style={{
            height: '100%',
            width: '100%',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            alignItems: 'center',
            backgroundImage: `url(data:image/png;base64,${bgBase64})`,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            padding: '80px',
            position: 'relative',
          }}
        >
          {/* Content */}
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '32px',
              background: 'rgba(23, 23, 23, 0.9)',
              padding: '64px 80px',
              borderRadius: '16px',
              border: '2px dashed rgba(90, 180, 255, 0.5)',
            }}
          >
            {/* Title */}
            <div
              style={{
                fontSize: '56px',
                fontFamily: 'Geist Sans',
                fontWeight: 300,
                color: titleColor,
                textAlign: 'center',
                letterSpacing: '-0.02em',
              }}
            >
              {title}
            </div>

            {/* Reels */}
            {!error && (
              <div
                style={{
                  display: 'flex',
                  gap: '24px',
                  fontSize: '96px',
                  padding: '24px 40px',
                  background: '#171717',
                  borderRadius: '12px',
                  border: '2px solid #9d9d9d',
                }}
              >
                {reels.map((reel, i) => (
                  <div key={i} style={{ display: 'flex' }}>
                    {reel}
                  </div>
                ))}
              </div>
            )}

            {/* Payout Info */}
            {!error && win && Number(payout) > 0 && (
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: '16px',
                }}
              >
                <div
                  style={{
                    fontSize: '64px',
                    fontFamily: 'Geist Mono',
                    fontWeight: 700,
                    color: '#5AB4FF',
                  }}
                >
                  +{payout} USDC
                </div>
                <div
                  style={{
                    fontSize: '32px',
                    fontFamily: 'Geist Mono',
                    color: '#9d9d9d',
                  }}
                >
                  {multiplier}x multiplier
                </div>
              </div>
            )}

            {/* No win message */}
            {!error && !win && (
              <div
                style={{
                  fontSize: '28px',
                  fontFamily: 'Geist Mono',
                  color: subtitleColor,
                  textAlign: 'center',
                }}
              >
                Better luck next time!
              </div>
            )}

            {/* Error message */}
            {error && (
              <div
                style={{
                  fontSize: '28px',
                  fontFamily: 'Geist Mono',
                  color: '#ff5555',
                  textAlign: 'center',
                }}
              >
                Something went wrong
              </div>
            )}
          </div>

          {/* Bottom branding */}
          <div
            style={{
              position: 'absolute',
              bottom: '40px',
              display: 'flex',
              fontFamily: 'Geist Mono',
              fontSize: '18px',
              color: '#9d9d9d',
            }}
          >
            Blink402 • Provably Fair Slot Machine
          </div>
        </div>
      ),
      {
        width: 1200,
        height: 630,
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
    console.error('Error generating slot result OG image:', error)
    return new Response('Failed to generate image', { status: 500 })
  }
}
