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

  // Static metadata for all blinks
  // TODO: Re-enable dynamic metadata after fixing build-time database access
  return generateSeoMetadata({
    title: 'Blink',
    description: 'View and run this pay-per-call API Blink.',
    path: `/blink/${slug}`,
  })
}

export default function BlinkLayout({ children }: Props) {
  return <>{children}</>
}
