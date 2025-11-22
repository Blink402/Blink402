"use client"
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ChevronLeft, ChevronRight, Zap, CheckCircle, TrendingUp, Award, RefreshCw } from 'lucide-react'
import { BlinkData } from '@blink402/types'
import { formatSol } from '@/lib/utils'

interface FeaturedCarouselProps {
  blinks: BlinkData[]
}

const BadgeIcon = ({ badge }: { badge: string }) => {
  switch (badge) {
    case 'verified':
      return <CheckCircle className="w-3 h-3" />
    case 'fast':
      return <Zap className="w-3 h-3" />
    case 'reliable':
      return <CheckCircle className="w-3 h-3" />
    case 'reverse':
      return <RefreshCw className="w-3 h-3" />
    case 'trending':
      return <TrendingUp className="w-3 h-3" />
    case 'forkable':
      return <Award className="w-3 h-3" />
    default:
      return null
  }
}

const BadgeLabel = ({ badge }: { badge: string }) => {
  switch (badge) {
    case 'verified':
      return 'Verified Creator'
    case 'fast':
      return 'Fast <1.5s'
    case 'reliable':
      return '99%+ Success'
    case 'reverse':
      return 'Pays You'
    case 'forkable':
      return 'Forkable'
    case 'trending':
      return 'Trending'
    default:
      return badge
  }
}

export default function FeaturedCarousel({ blinks }: FeaturedCarouselProps) {
  const router = useRouter()
  const [currentIndex, setCurrentIndex] = useState(0)
  const [isAutoPlaying, setIsAutoPlaying] = useState(true)
  const [isForkingLoading, setIsForkingLoading] = useState(false)

  useEffect(() => {
    if (!isAutoPlaying || blinks.length <= 1) return

    const interval = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % blinks.length)
    }, 5000) // Auto-advance every 5 seconds

    return () => clearInterval(interval)
  }, [isAutoPlaying, blinks.length])

  const goToPrevious = () => {
    setIsAutoPlaying(false)
    setCurrentIndex((prev) => (prev - 1 + blinks.length) % blinks.length)
  }

  const goToNext = () => {
    setIsAutoPlaying(false)
    setCurrentIndex((prev) => (prev + 1) % blinks.length)
  }

  const handleFork = async (slug: string) => {
    setIsForkingLoading(true)
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'
      const response = await fetch(`${apiUrl}/blinks/${slug}/fork`)

      if (!response.ok) {
        const error = await response.json()
        alert(error.error || 'This blink cannot be forked')
        return
      }

      const { data } = await response.json()

      // Navigate to create page with fork data as URL params
      const params = new URLSearchParams({
        fork: 'true',
        title: data.title,
        description: data.description,
        endpoint_url: data.endpoint_url,
        method: data.method,
        price_usdc: data.price_usdc,
        category: data.category || '',
        icon_url: data.icon_url || '',
        payment_token: data.payment_token || 'SOL',
        fork_of_blink_id: data.fork_of_blink_id,
        original_creator: data.original_creator?.wallet || ''
      })

      router.push(`/create?${params.toString()}`)
    } catch (error) {
      console.error('Error forking blink:', error)
      alert('Failed to fork blink. Please try again.')
    } finally {
      setIsForkingLoading(false)
    }
  }

  if (blinks.length === 0) return null

  const currentBlink = blinks[currentIndex]

  return (
    <div className="relative max-w-4xl mx-auto px-14 md:px-16">
      {/* Main Carousel */}
      <div className="relative bg-neon-dark/50 backdrop-blur-sm border border-neon-blue-light/20 rounded-lg p-6 md:p-8 overflow-hidden min-h-[380px]">
        {/* Gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-br from-neon-blue-light/5 to-transparent pointer-events-none" />

        <div className="relative z-10">
          {/* Top row with badges and price */}
          <div className="flex justify-between items-start mb-4">
            <div className="flex flex-wrap gap-2">
              {currentBlink.badges?.map(badge => (
                <span
                  key={badge}
                  className="inline-flex items-center gap-1 px-2 py-1 bg-neon-blue-light/10 text-neon-blue-light rounded-full text-xs font-mono"
                >
                  <BadgeIcon badge={badge} />
                  <BadgeLabel badge={badge} />
                </span>
              ))}
              {currentBlink.is_forkable && (
                <span className="inline-flex items-center gap-1 px-2 py-1 bg-green-500/10 text-green-400 rounded-full text-xs font-mono">
                  <Award className="w-3 h-3" />
                  Forkable
                </span>
              )}
            </div>
            <div className="text-right">
              <div className="text-2xl font-mono text-neon-white">
                {formatSol(parseFloat(currentBlink.price_usdc))} USDC
              </div>
              <div className="text-xs text-neon-grey">per call</div>
            </div>
          </div>

          {/* Title and Description */}
          <h3 className="text-2xl font-sans font-light text-neon-white mb-2" data-scramble>
            {currentBlink.title}
          </h3>
          <p className="text-neon-grey font-mono text-sm mb-6 line-clamp-3 min-h-[4.5rem]">
            {currentBlink.description}
          </p>

          {/* Category and Stats */}
          <div className="flex items-center gap-4 mb-6 text-xs font-mono text-neon-grey">
            {currentBlink.category && (
              <span className="px-2 py-1 bg-neon-dark rounded">
                {currentBlink.category}
              </span>
            )}
            <span>{currentBlink.runs} runs</span>
            {currentBlink.success_rate_percent && (
              <span>{currentBlink.success_rate_percent.toFixed(1)}% success</span>
            )}
            {currentBlink.avg_latency_ms && (
              <span>{currentBlink.avg_latency_ms}ms avg</span>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3">
            <Link href={`/blink/${currentBlink.slug}`} className="flex-1">
              <button className="btn-primary w-full">
                Try This Blink
              </button>
            </Link>
            {currentBlink.is_forkable && (
              <button
                className="btn-ghost px-4"
                onClick={() => handleFork(currentBlink.slug)}
                disabled={isForkingLoading}
              >
                {isForkingLoading ? 'Forking...' : 'Fork'}
              </button>
            )}
          </div>
        </div>

      </div>

      {/* Navigation Arrows - Outside the card */}
      {blinks.length > 1 && (
        <>
          <button
            onClick={goToPrevious}
            className="absolute left-0 md:left-2 top-1/2 -translate-y-1/2 p-2 md:p-3 bg-neon-dark/90 backdrop-blur-sm border border-neon-blue-light/40 rounded-full hover:bg-neon-blue-light/20 transition-all hover:scale-110 hover:border-neon-blue-light z-30"
            aria-label="Previous"
          >
            <ChevronLeft className="w-5 h-5 md:w-6 md:h-6 text-neon-blue-light" />
          </button>
          <button
            onClick={goToNext}
            className="absolute right-0 md:right-2 top-1/2 -translate-y-1/2 p-2 md:p-3 bg-neon-dark/90 backdrop-blur-sm border border-neon-blue-light/40 rounded-full hover:bg-neon-blue-light/20 transition-all hover:scale-110 hover:border-neon-blue-light z-30"
            aria-label="Next"
          >
            <ChevronRight className="w-5 h-5 md:w-6 md:h-6 text-neon-blue-light" />
          </button>
        </>
      )}

      {/* Dots Indicator */}
      {blinks.length > 1 && (
        <div className="flex justify-center gap-2 mt-4">
          {blinks.map((_, index) => (
            <button
              key={index}
              onClick={() => {
                setIsAutoPlaying(false)
                setCurrentIndex(index)
              }}
              className={`w-2 h-2 rounded-full transition-all ${
                index === currentIndex
                  ? 'w-6 bg-neon-blue-light'
                  : 'bg-neon-grey/30 hover:bg-neon-grey/50'
              }`}
              aria-label={`Go to slide ${index + 1}`}
            />
          ))}
        </div>
      )}
    </div>
  )
}