import { ImageResponse } from 'next/og'
import { NextRequest } from 'next/server'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { getBlinkBySlug } from '@/lib/db'

// Use Node.js runtime to support database access
export const runtime = 'nodejs'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params

  try {
    // Get blink data directly from database
    const blink = await getBlinkBySlug(slug)

    if (!blink) {
      throw new Error('Blink not found')
    }

    // Load Geist fonts from filesystem
    const geistSansPath = join(process.cwd(), 'public/fonts/Geist-Light.ttf')
    const geistMonoPath = join(process.cwd(), 'public/fonts/GeistMono-Regular.ttf')
    const geistSansData = await readFile(geistSansPath)
    const geistMonoData = await readFile(geistMonoPath)

    // Determine category icon/emoji
    const categoryEmoji: Record<string, string> = {
      'analytics': '📊',
      'defi': '💰',
      'utility': '🔧',
      'nft': '🖼️',
      'social': '👥',
      'gaming': '🎮',
      'ai': '🤖',
    }

    const emoji = categoryEmoji[blink.category as string] || '✨'

    // Truncate description if too long
    const description = blink.description && blink.description.length > 80
      ? blink.description.substring(0, 80) + '...'
      : blink.description || 'Pay once, use instantly'

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
            backgroundColor: '#1e1e1e',
            backgroundImage: 'radial-gradient(circle at 25% 25%, rgba(91, 180, 255, 0.1) 0%, transparent 50%), radial-gradient(circle at 75% 75%, rgba(59, 143, 217, 0.1) 0%, transparent 50%)',
            padding: '40px',
          }}
        >
          {/* Neon border overlay - simplified for @vercel/og compatibility */}
          <div
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              background: 'linear-gradient(to bottom, rgba(91, 180, 255, 0.05) 0%, transparent 100%)',
              opacity: 0.3,
            }}
          />

          {/* Category emoji */}
          <div
            style={{
              fontSize: '120px',
              marginBottom: '20px',
              display: 'flex',
            }}
          >
            {emoji}
          </div>

          {/* Blink title */}
          <div
            style={{
              fontSize: '64px',
              fontWeight: 300,
              color: '#ffffff',
              textAlign: 'center',
              marginBottom: '16px',
              display: 'flex',
              fontFamily: 'Geist Sans',
              letterSpacing: '-0.02em',
            }}
          >
            {blink.title}
          </div>

          {/* Description */}
          <div
            style={{
              fontSize: '28px',
              color: '#9d9d9d',
              textAlign: 'center',
              maxWidth: '800px',
              display: 'flex',
              fontFamily: 'Geist Mono',
              lineHeight: 1.4,
            }}
          >
            {description}
          </div>

          {/* Price badge */}
          <div
            style={{
              marginTop: '32px',
              padding: '12px 24px',
              background: 'linear-gradient(135deg, rgba(91, 180, 255, 0.2) 0%, rgba(59, 143, 217, 0.2) 100%)',
              border: '2px dashed rgba(91, 180, 255, 0.5)',
              borderRadius: '8px',
              fontSize: '24px',
              color: '#5AB4FF',
              fontFamily: 'Geist Mono',
              display: 'flex',
            }}
          >
            ${blink.price_usdc} {blink.payment_token || 'USDC'}
          </div>

          {/* Bottom branding */}
          <div
            style={{
              position: 'absolute',
              bottom: '30px',
              right: '40px',
              fontSize: '20px',
              color: 'rgba(157, 157, 157, 0.6)',
              fontFamily: 'Geist Mono',
              display: 'flex',
            }}
          >
            blink402.dev
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
    console.error('Error generating OG image:', error)

    // Fallback image
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
            backgroundColor: '#1e1e1e',
            color: '#ffffff',
          }}
        >
          <div style={{ fontSize: '72px' }}>✨</div>
          <div style={{ fontSize: '48px', marginTop: '20px' }}>Blink402</div>
        </div>
      ),
      {
        width: 1200,
        height: 630,
      }
    )
  }
}
