"use client"

import { useState, useEffect } from 'react'
import { cn } from '@/lib/utils'

interface TypewriterTextProps {
  text: string
  speed?: number
  className?: string
  onComplete?: () => void
  delay?: number
}

/**
 * Typewriter effect for text
 * Characters appear one by one
 */
export function TypewriterText({
  text,
  speed = 50,
  className,
  onComplete,
  delay = 0
}: TypewriterTextProps) {
  const [displayedText, setDisplayedText] = useState('')
  const [currentIndex, setCurrentIndex] = useState(0)

  useEffect(() => {
    if (delay > 0) {
      const delayTimeout = setTimeout(() => {
        setCurrentIndex(0)
        setDisplayedText('')
      }, delay)
      return () => clearTimeout(delayTimeout)
    }
  }, [delay])

  useEffect(() => {
    if (currentIndex < text.length) {
      const timeout = setTimeout(() => {
        setDisplayedText((prev) => prev + text[currentIndex])
        setCurrentIndex((prev) => prev + 1)
      }, speed)

      return () => clearTimeout(timeout)
    } else if (currentIndex === text.length && onComplete) {
      onComplete()
    }
  }, [currentIndex, text, speed, onComplete])

  return (
    <span className={cn("inline-block", className)}>
      {displayedText}
      {currentIndex < text.length && (
        <span className="inline-block w-0.5 h-[1em] bg-neon-blue-light animate-pulse ml-0.5" />
      )}
    </span>
  )
}
