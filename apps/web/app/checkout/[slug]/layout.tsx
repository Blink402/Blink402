import type { Metadata } from 'next'
import { generateMetadata as generateSeoMetadata } from '@/lib/seo'
import { getBlinkBySlug } from '@/lib/db'

type Props = {
  params: Promise<{ slug: string }>
  children: React.ReactNode
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params

  try {
    // Fetch blink data directly from database (same as OG image route)
    const blink = await getBlinkBySlug(slug)

    if (!blink) {
      return generateSeoMetadata({
        title: 'Blink Not Found',
        description: 'The requested blink could not be found',
        path: '/checkout'
      })
    }

    // Use dynamic OG image URL (same pattern as blink detail page)
    const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://blink402.dev'
    const ogImageUrl = `${baseUrl}/api/og/${slug}`

    return generateSeoMetadata({
      title: `${blink.title} - Checkout`,
      description: blink.description || `Pay $${blink.price_usdc} USDC to execute ${blink.title}`,
      path: `/checkout/${slug}`,
      image: ogImageUrl
    })
  } catch (error) {
    console.error('Error generating metadata for checkout:', error)
    return generateSeoMetadata({
      title: 'Checkout',
      description: 'Complete your payment to execute the API call',
      path: '/checkout'
    })
  }
}

export default function CheckoutLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return <>{children}</>
}
