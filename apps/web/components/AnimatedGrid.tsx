"use client"

import { useEffect, useRef } from 'react'

interface AnimatedGridProps {
  className?: string
}

/**
 * Animated grid background with moving lines
 * Creates a cyberpunk/terminal aesthetic
 */
export function AnimatedGrid({ className = '' }: AnimatedGridProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    // Set canvas size
    const resize = () => {
      canvas.width = canvas.offsetWidth
      canvas.height = canvas.offsetHeight
    }
    resize()
    window.addEventListener('resize', resize)

    // Grid configuration
    const gridSize = 40
    let offsetX = 0
    let offsetY = 0

    // Animation
    const animate = () => {
      if (!ctx || !canvas) return

      // Clear canvas
      ctx.clearRect(0, 0, canvas.width, canvas.height)

      // Update offset for movement
      offsetX += 0.2
      offsetY += 0.1

      // Draw vertical lines
      ctx.strokeStyle = 'rgba(90, 180, 255, 0.08)'
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
      ctx.fillStyle = 'rgba(90, 180, 255, 0.15)'
      for (let x = (offsetX % gridSize) - gridSize; x < canvas.width; x += gridSize) {
        for (let y = (offsetY % gridSize) - gridSize; y < canvas.height; y += gridSize) {
          ctx.beginPath()
          ctx.arc(x, y, 1.5, 0, Math.PI * 2)
          ctx.fill()
        }
      }

      requestAnimationFrame(animate)
    }

    const animationId = requestAnimationFrame(animate)

    return () => {
      window.removeEventListener('resize', resize)
      cancelAnimationFrame(animationId)
    }
  }, [])

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
