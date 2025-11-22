"use client"

import NextImage, { ImageProps as NextImageProps } from 'next/image'
import { useState } from 'react'

type ImageWithFallbackProps = NextImageProps & {
  /** Fallback image source if primary fails */
  fallbackSrc?: string
  /** Fallback element to show instead of image */
  fallbackElement?: React.ReactNode
  /** Whether to show a placeholder with icon on error */
  showPlaceholder?: boolean
}

/**
 * Image component with comprehensive error handling
 * Provides graceful fallback when images fail to load
 */
export function ImageWithFallback({
  src,
  alt,
  fallbackSrc,
  fallbackElement,
  showPlaceholder = true,
  className,
  ...props
}: ImageWithFallbackProps) {
  const [error, setError] = useState(false)
  const [fallbackError, setFallbackError] = useState(false)

  // If primary image failed
  if (error) {
    // Try fallback image if provided
    if (fallbackSrc && !fallbackError) {
      return (
        <NextImage
          {...props}
          src={fallbackSrc}
          alt={alt}
          className={className}
          onError={() => setFallbackError(true)}
        />
      )
    }

    // Show custom fallback element if provided
    if (fallbackElement) {
      return <>{fallbackElement}</>
    }

    // Show default placeholder
    if (showPlaceholder) {
      return (
        <div
          className={`${className} flex items-center justify-center bg-neon-dark border border-neon-grey/30 rounded overflow-hidden`}
          style={{
            width: props.width || '100%',
            height: props.height || '100%',
          }}
          role="img"
          aria-label={alt}
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="text-neon-grey/50"
          >
            <rect width="18" height="18" x="3" y="3" rx="2" ry="2" />
            <circle cx="9" cy="9" r="2" />
            <path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21" />
          </svg>
        </div>
      )
    }

    // Don't render anything if no fallback options
    return null
  }

  // Render normal image with error handler
  return (
    <NextImage
      {...props}
      src={src}
      alt={alt}
      className={className}
      onError={() => setError(true)}
    />
  )
}
