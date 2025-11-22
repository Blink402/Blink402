"use client"

import { useState, useEffect, useRef, useCallback } from 'react'
import { cn } from '@/lib/utils'

interface AnimatedNumberProps {
  value: number
  duration?: number
  decimals?: number
  className?: string
  prefix?: string
  suffix?: string
  startOnView?: boolean
}

/**
 * Animated number that counts up to target value
 * Perfect for stats and metrics
 */
export function AnimatedNumber({
  value,
  duration = 2000,
  decimals = 0,
  className,
  prefix = '',
  suffix = '',
  startOnView = true
}: AnimatedNumberProps) {
  const [count, setCount] = useState(0)
  const [hasAnimated, setHasAnimated] = useState(false)
  const elementRef = useRef<HTMLSpanElement>(null)

  const animateCount = useCallback(() => {
    setHasAnimated(true)
    const startTime = Date.now()
    const startValue = 0

    const updateCount = () => {
      const now = Date.now()
      const progress = Math.min((now - startTime) / duration, 1)

      // Easing function (easeOutExpo)
      const easeProgress = progress === 1 ? 1 : 1 - Math.pow(2, -10 * progress)

      const currentValue = startValue + (value - startValue) * easeProgress
      setCount(currentValue)

      if (progress < 1) {
        requestAnimationFrame(updateCount)
      }
    }

    requestAnimationFrame(updateCount)
  }, [value, duration])

  useEffect(() => {
    if (!startOnView || !elementRef.current) {
      // Start animation immediately if not waiting for view
      if (!hasAnimated) {
        animateCount()
      }
      return
    }

    // Intersection Observer for scroll-triggered animation
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting && !hasAnimated) {
            animateCount()
          }
        })
      },
      { threshold: 0.5 }
    )

    observer.observe(elementRef.current)

    return () => observer.disconnect()
  }, [animateCount, hasAnimated, startOnView])

  return (
    <span ref={elementRef} className={cn("tabular-nums", className)}>
      {prefix}
      {count.toFixed(decimals)}
      {suffix}
    </span>
  )
}
