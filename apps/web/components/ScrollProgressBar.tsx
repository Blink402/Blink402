"use client"

import { useState, useEffect } from 'react'

/**
 * Scroll progress bar at top of page
 * Shows reading/scroll progress with neon gradient
 */
export function ScrollProgressBar() {
  const [scrollProgress, setScrollProgress] = useState(0)

  useEffect(() => {
    const updateScrollProgress = () => {
      const scrollHeight = document.documentElement.scrollHeight - window.innerHeight
      const scrolled = window.scrollY
      const progress = scrollHeight > 0 ? (scrolled / scrollHeight) * 100 : 0
      setScrollProgress(progress)
    }

    updateScrollProgress()
    window.addEventListener('scroll', updateScrollProgress, { passive: true })

    return () => window.removeEventListener('scroll', updateScrollProgress)
  }, [])

  return (
    <div
      className="fixed top-0 left-0 right-0 h-1 z-[9999] pointer-events-none"
      role="progressbar"
      aria-valuenow={Math.round(scrollProgress)}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label="Page scroll progress"
    >
      <div
        className="h-full bg-gradient-to-r from-neon-blue-dark via-neon-blue-light to-neon-blue-glow transition-all duration-150 ease-out shadow-[0_0_10px_rgba(90,180,255,0.6)]"
        style={{ width: `${scrollProgress}%` }}
      />
    </div>
  )
}
