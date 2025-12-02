"use client"

import { useEffect, useRef, useState } from 'react'

interface AnimatedGridProps {
  className?: string
  color?: string // Hex color or rgba string
}

/**
 * Animated grid background with moving lines
 * Creates a cyberpunk/terminal aesthetic
 * Performance optimized: 30fps, pauses when hidden, disabled on mobile
 */
export function AnimatedGrid({ className = '', color = '90, 180, 255' }: AnimatedGridProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [isMobile, setIsMobile] = useState(false)

  useEffect(() => {
    // Check if mobile device (disable animation on mobile for performance)
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768 || 'ontouchstart' in window)
    }
    checkMobile()
  }, [])

  useEffect(() => {
    // Don't animate on mobile
    if (isMobile) return

    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    // Check for prefers-reduced-motion
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (prefersReducedMotion) return

    // Set canvas size with throttled resize
    let resizeTimeout: NodeJS.Timeout
    const resize = () => {
      clearTimeout(resizeTimeout)
      resizeTimeout = setTimeout(() => {
        canvas.width = canvas.offsetWidth
        canvas.height = canvas.offsetHeight
      }, 100)
    }
    resize()
    window.addEventListener('resize', resize)

    // Grid configuration
    const gridSize = 40
    let offsetX = 0
    let offsetY = 0
    let lastFrameTime = 0
    const targetFPS = 30 // Reduced from 60fps
    const frameInterval = 1000 / targetFPS
    let animationId: number
    let isVisible = true

    // Page Visibility API - pause animation when tab is hidden
    const handleVisibilityChange = () => {
      isVisible = !document.hidden
      if (isVisible) {
        lastFrameTime = performance.now()
        animationId = requestAnimationFrame(animate)
      } else {
        cancelAnimationFrame(animationId)
      }
    }
    document.addEventListener('visibilitychange', handleVisibilityChange)

    // Parse color if it's a hex string, otherwise assume it's an RGB triplet string
    const rgbColor = color.startsWith('#')
      ? hexToRgb(color)
      : color

    // Animation loop with FPS throttling
    const animate = (currentTime: number) => {
      if (!ctx || !canvas || !isVisible) return

      // Throttle to 30fps
      const elapsed = currentTime - lastFrameTime
      if (elapsed < frameInterval) {
        animationId = requestAnimationFrame(animate)
        return
      }
      lastFrameTime = currentTime - (elapsed % frameInterval)

      // Clear canvas
      ctx.clearRect(0, 0, canvas.width, canvas.height)

      // Update offset for movement
      offsetX += 0.2
      offsetY += 0.1

      // Draw vertical lines
      ctx.strokeStyle = `rgba(${rgbColor}, 0.08)`
      ctx.lineWidth = 1
      for (let x = (offsetX % gridSize) - gridSize; x < canvas.width; x += gridSize) {
        ctx.beginPath()
        ctx.moveTo(x, 0)
        ctx.lineTo(x, canvas.height)
        ctx.stroke()
      }

      // Draw horizontal lines
      for (let y = (offsetY % gridSize) - gridSize; y < canvas.height; y += gridSize) {
        ctx.beginPath()
        ctx.moveTo(0, y)
        ctx.lineTo(canvas.width, y)
        ctx.stroke()
      }

      // Draw intersection dots
      ctx.fillStyle = `rgba(${rgbColor}, 0.15)`
      for (let x = (offsetX % gridSize) - gridSize; x < canvas.width; x += gridSize) {
        for (let y = (offsetY % gridSize) - gridSize; y < canvas.height; y += gridSize) {
          ctx.beginPath()
          ctx.arc(x, y, 1.5, 0, Math.PI * 2)
          ctx.fill()
        }
      }

      animationId = requestAnimationFrame(animate)
    }

    animationId = requestAnimationFrame(animate)

    return () => {
      window.removeEventListener('resize', resize)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      cancelAnimationFrame(animationId)
      clearTimeout(resizeTimeout)
    }
  }, [isMobile, color])

  return (
    <canvas
      ref={canvasRef}
      className={`pointer-events-none ${className}`}
      style={{
        position: 'absolute',
        inset: 0,
        width: '100%',
        height: '100%',
      }}
      aria-hidden="true"
    />
  )
}

// Helper to convert hex to rgb string "r, g, b"
function hexToRgb(hex: string): string {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
  return result
    ? `${parseInt(result[1], 16)}, ${parseInt(result[2], 16)}, ${parseInt(result[3], 16)}`
    : '90, 180, 255'
}
