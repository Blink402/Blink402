// SEO metadata utilities
import type { Metadata } from 'next'

const SITE_NAME = 'Blink402'
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://blink402.dev'
const TWITTER_HANDLE = '@Blinkx402'

export function generateMetadata({
  title,
  description,
  path = '',
  image,
}: {
  title: string
  description: string
  path?: string
  image?: string
}): Metadata {
  const url = `${SITE_URL}${path}`
  const ogImage = image || `${SITE_URL}/blink-402-webpreview.png`

  return {
    title: `${title} | ${SITE_NAME}`,
    description,
    openGraph: {
      title,
      description,
      url,
      siteName: SITE_NAME,
      images: [
        {
          url: ogImage,
          width: 1200,
          height: 630,
          alt: title,
        },
      ],
      locale: 'en_US',
      type: 'website',
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      site: TWITTER_HANDLE,
      creator: TWITTER_HANDLE,
      images: [ogImage],
    },
    alternates: {
      canonical: url,
    },
  }
}
