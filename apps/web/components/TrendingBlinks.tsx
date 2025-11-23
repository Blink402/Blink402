"use client"
import React, { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { TrendingUp, Clock, Zap, ChevronLeft, ChevronRight } from 'lucide-react'
import { BlinkData } from '@blink402/types'
import { formatSol } from '@/lib/utils'

interface TrendingBlinksProps {
  blinks: BlinkData[]
}

const TrendingBlinks = React.memo(function TrendingBlinks({ blinks }: TrendingBlinksProps) {
  const [currentIndex, setCurrentIndex] = useState(0)
  const [isAutoPlaying, setIsAutoPlaying] = useState(true)
  const [visibleCards, setVisibleCards] = useState(4)
  const containerRef = useRef<HTMLDivElement>(null)

  // Adjust visible cards based on screen size
  useEffect(() => {
    const updateVisibleCards = () => {
      if (window.innerWidth < 640) {
        setVisibleCards(1)
      } else if (window.innerWidth < 768) {
        setVisibleCards(2)
      } else if (window.innerWidth < 1024) {
        setVisibleCards(3)
      } else {
        setVisibleCards(4)
      }
    }

    updateVisibleCards()
    window.addEventListener('resize', updateVisibleCards)
    return () => window.removeEventListener('resize', updateVisibleCards)
  }, [])

  // Auto-scroll effect
  useEffect(() => {
    if (!isAutoPlaying || blinks.length <= visibleCards) return

    const interval = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % Math.max(1, blinks.length - visibleCards + 1))
    }, 4000) // Auto-advance every 4 seconds

    return () => clearInterval(interval)
  }, [isAutoPlaying, blinks.length, visibleCards])

  const scrollToPrevious = () => {
    setIsAutoPlaying(false)
    setCurrentIndex((prev) => Math.max(0, prev - 1))
  }

  const scrollToNext = () => {
    setIsAutoPlaying(false)
    const maxIndex = Math.max(0, blinks.length - visibleCards)
    setCurrentIndex((prev) => Math.min(maxIndex, prev + 1))
  }

  if (blinks.length === 0) return null

  const canScrollPrev = currentIndex > 0
  const canScrollNext = currentIndex < blinks.length - visibleCards

  return (
    <div className="max-w-6xl mx-auto">
      <div className="flex items-center gap-2 sm:gap-3 mb-4 sm:mb-6">
        <TrendingUp className="w-4 h-4 sm:w-5 sm:h-5 text-neon-blue-light" />
        <h2 className="text-xl sm:text-2xl font-sans font-light text-neon-white" data-scramble>
          Trending Today
        </h2>
        <span className="px-1.5 sm:px-2 py-0.5 sm:py-1 bg-neon-blue-light/10 text-neon-blue-light rounded-full text-[10px] sm:text-xs font-mono whitespace-nowrap">
          Last 24h
        </span>
      </div>

      {/* Carousel container */}
      <div className="relative px-8 sm:px-12 md:px-14">
        <div className="overflow-hidden" ref={containerRef}>
          <div
            className="flex gap-3 sm:gap-4 transition-transform duration-500 ease-in-out"
            style={{ transform: `translateX(-${currentIndex * (100 / visibleCards)}%)` }}
          >
            {blinks.map((blink) => (
              <Link
                key={blink.id}
                href={`/blink/${blink.slug}`}
                className="group flex-shrink-0"
                style={{ width: `calc(${100 / visibleCards}% - ${(visibleCards - 1) * 14 / visibleCards}px)` }}
              >
                <div className="bg-neon-dark/50 backdrop-blur-sm border border-neon-grey/20 rounded-lg p-3 sm:p-4 transition-all hover:border-neon-blue-light/50 hover:bg-neon-dark/70 group-hover:shadow-neon min-h-[180px] sm:h-[200px] flex flex-col">
                  {/* Top row with badges */}
                  <div className="flex items-start justify-between mb-2 sm:mb-3 gap-2">
                    <div className="flex flex-wrap gap-1 flex-1 min-w-0">
                      {blink.payment_mode === 'reward' && (
                        <span className="inline-flex items-center gap-0.5 sm:gap-1 px-1.5 sm:px-2 py-0.5 bg-green-500/10 text-green-400 rounded-full text-[10px] sm:text-xs whitespace-nowrap">
                          Pays You
                        </span>
                      )}
                      {blink.badges?.includes('fast') && (
                        <span className="inline-flex items-center gap-0.5 sm:gap-1 px-1.5 sm:px-2 py-0.5 bg-neon-blue-light/10 text-neon-blue-light rounded-full text-[10px] sm:text-xs whitespace-nowrap">
                          <Zap className="w-2.5 h-2.5 sm:w-3 sm:h-3" />
                          Fast
                        </span>
                      )}
                      {blink.badges?.includes('verified') && (
                        <span className="inline-flex items-center gap-0.5 sm:gap-1 px-1.5 sm:px-2 py-0.5 bg-purple-500/10 text-purple-400 rounded-full text-[10px] sm:text-xs whitespace-nowrap">
                          Verified
                        </span>
                      )}
                    </div>
                    <div className="text-right flex-shrink-0 min-w-[60px] sm:min-w-[70px]">
                      <div className="text-xs sm:text-sm font-mono text-neon-white font-bold whitespace-nowrap">
                        {formatSol(parseFloat(blink.price_usdc))}
                      </div>
                      <div className="text-[10px] sm:text-xs text-neon-grey whitespace-nowrap">
                        USDC
                      </div>
                    </div>
                  </div>

                  {/* Title and Description */}
                  <h3 className="text-sm sm:text-base font-sans text-neon-white mb-1.5 sm:mb-2 line-clamp-1 group-hover:text-neon-blue-light transition-colors leading-snug">
                    {blink.title}
                  </h3>
                  <p className="text-[11px] sm:text-xs text-neon-grey font-mono mb-2 sm:mb-3 line-clamp-2 flex-grow leading-relaxed">
                    {blink.description}
                  </p>

                  {/* Stats */}
                  <div className="flex items-center justify-between text-[10px] sm:text-xs font-mono text-neon-grey mt-auto gap-2">
                    <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
                      <span className="flex items-center gap-0.5 sm:gap-1 whitespace-nowrap">
                        <TrendingUp className="w-2.5 h-2.5 sm:w-3 sm:h-3" />
                        {blink.runs} runs
                      </span>
                      {blink.avg_latency_ms && (
                        <span className="flex items-center gap-0.5 sm:gap-1 whitespace-nowrap">
                          <Clock className="w-2.5 h-2.5 sm:w-3 sm:h-3" />
                          {blink.avg_latency_ms}ms
                        </span>
                      )}
                    </div>
                    {blink.category && (
                      <span className="px-1.5 sm:px-2 py-0.5 bg-neon-dark rounded text-[10px] sm:text-xs whitespace-nowrap">
                        {blink.category}
                      </span>
                    )}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>

        {/* Navigation Arrows */}
        {blinks.length > visibleCards && (
          <>
            <button
              onClick={scrollToPrevious}
              disabled={!canScrollPrev}
              className={`absolute left-0 top-1/2 -translate-y-1/2 p-1.5 sm:p-2 md:p-2.5 rounded-full transition-all z-20 touch-manipulation min-h-[36px] min-w-[36px] flex items-center justify-center ${
                canScrollPrev
                  ? 'bg-neon-dark/90 backdrop-blur-sm border border-neon-blue-light/40 hover:bg-neon-blue-light/20 hover:scale-110 hover:border-neon-blue-light active:scale-95'
                  : 'bg-neon-dark/50 border border-neon-grey/20 opacity-50 cursor-not-allowed'
              }`}
              aria-label="Previous"
            >
              <ChevronLeft className={`w-4 h-4 sm:w-5 sm:h-5 ${canScrollPrev ? 'text-neon-blue-light' : 'text-neon-grey'}`} />
            </button>
            <button
              onClick={scrollToNext}
              disabled={!canScrollNext}
              className={`absolute right-0 top-1/2 -translate-y-1/2 p-1.5 sm:p-2 md:p-2.5 rounded-full transition-all z-20 touch-manipulation min-h-[36px] min-w-[36px] flex items-center justify-center ${
                canScrollNext
                  ? 'bg-neon-dark/90 backdrop-blur-sm border border-neon-blue-light/40 hover:bg-neon-blue-light/20 hover:scale-110 hover:border-neon-blue-light active:scale-95'
                  : 'bg-neon-dark/50 border border-neon-grey/20 opacity-50 cursor-not-allowed'
              }`}
              aria-label="Next"
            >
              <ChevronRight className={`w-4 h-4 sm:w-5 sm:h-5 ${canScrollNext ? 'text-neon-blue-light' : 'text-neon-grey'}`} />
            </button>
          </>
        )}
      </div>

      {/* View All Link */}
      <div className="text-center mt-4 sm:mt-6">
        <Link href="/catalog?sort=popular" className="inline-flex items-center gap-1.5 sm:gap-2 text-xs sm:text-sm font-mono text-neon-blue-light hover:text-neon-white transition-colors touch-manipulation py-2 px-3">
          View all trending Blinks
          <span aria-hidden="true">→</span>
        </Link>
      </div>
    </div>
  )
})

export default TrendingBlinks