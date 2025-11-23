"use client"

import NextImage, { ImageProps as NextImageProps } from 'next/image'
import { useState } from 'react'
import { Image as ImageIcon } from 'lucide-react'

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
          <ImageIcon className="w-6 h-6 text-neon-grey/50" />
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
