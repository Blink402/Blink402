import type { Metadata } from 'next'
import { generateMetadata as generateSeoMetadata } from '@/lib/seo'

type Props = {
  params: Promise<{ slug: string }>
  children: React.ReactNode
}

// Use static metadata for build time
// Dynamic metadata will be set client-side or via API
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params

  // Generate dynamic OG image URL
  // Using blink-icon endpoint (512x512) temporarily until og endpoint (1200x630) is debugged
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://blink402.dev'
  const ogImageUrl = `${baseUrl}/api/blink-icon/${slug}`

  // Custom metadata for specific blinks
  if (slug === 'wallet-analyzer') {
    return generateSeoMetadata({
      title: 'Wallet X-RAY - Analyze any Solana Wallet',
      description: 'Deep analysis of any Solana wallet. Get token holdings, transaction history, tokens created, PnL, and more. Powered by Helius.',
      path: `/blink/${slug}`,
      image: ogImageUrl
    })
  }

  // Static metadata for all other blinks with dynamic OG image
  return generateSeoMetadata({
    title: 'Blink',
    description: 'View and run this pay-per-call API Blink.',
    path: `/blink/${slug}`,
    image: ogImageUrl
  })
}

export default function BlinkLayout({ children }: Props) {
  return <>{children}</>
}
