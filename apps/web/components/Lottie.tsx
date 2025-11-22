"use client"
import { DotLottieReact } from "@lottiefiles/dotlottie-react"
import { useState, useEffect, useCallback, useRef } from "react"
import type { DotLottie } from "@lottiefiles/dotlottie-react"
import { INTERSECTION_OBSERVER_CONSTANTS } from "@/lib/constants"

type LottieProps = {
  src: string
  loop?: boolean
  autoplay?: boolean
  width?: number
  height?: number
  className?: string
  /** Apply neon green color filter for theme consistency */
  applyNeonFilter?: boolean
  /** Apply chrome/metallic color filter for shiny silver effect */
  applyChromeFilter?: boolean
  /** Theme ID to use if the .lottie file has embedded themes */
  themeId?: string
  /** Custom theme data to override colors */
  themeData?: string
  /** Pause animation when tab is not visible (performance optimization) */
  pauseOnInvisible?: boolean
}

export default function Lottie({
  src,
  loop = true,
  autoplay = true,
  width = 220,
  height = 220,
  className = "",
  applyNeonFilter = false,
  applyChromeFilter = false,
  themeId,
  themeData,
  pauseOnInvisible = true,
}: LottieProps) {
  const [mounted, setMounted] = useState(false)
  const [dotLottie, setDotLottie] = useState<DotLottie | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isLoaded, setIsLoaded] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    setMounted(true)
  }, [])

  // Performance optimization: Pause animations when page is not visible
  useEffect(() => {
    if (!dotLottie || !pauseOnInvisible) return

    const handleVisibilityChange = () => {
      if (document.hidden) {
        dotLottie.pause()
      } else if (autoplay) {
        dotLottie.play()
      }
    }

    document.addEventListener("visibilitychange", handleVisibilityChange)
    return () => document.removeEventListener("visibilitychange", handleVisibilityChange)
  }, [dotLottie, autoplay, pauseOnInvisible])

  // Performance optimization: Use IntersectionObserver to pause when not in viewport
  useEffect(() => {
    if (!dotLottie || !containerRef.current || !pauseOnInvisible) return

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) {
            dotLottie.pause()
          } else if (autoplay) {
            dotLottie.play()
          }
        })
      },
      { threshold: INTERSECTION_OBSERVER_CONSTANTS.LOTTIE_PAUSE_THRESHOLD }
    )

    observer.observe(containerRef.current)
    return () => observer.disconnect()
  }, [dotLottie, autoplay, pauseOnInvisible])

  // Set up event listeners for proper error handling and loading states
  useEffect(() => {
    if (!dotLottie) return

    const onLoad = () => {
      setIsLoaded(true)
      setError(null)
    }

    const onLoadError = (event: any) => {
      // Animation load error - only log in development
      if (process.env.NODE_ENV === 'development') {
        console.error("Failed to load animation:", event)
      }
      setError("Failed to load animation")
      setIsLoaded(false)
    }

    // Listen to load and error events
    dotLottie.addEventListener("load", onLoad)
    dotLottie.addEventListener("loadError", onLoadError)

    return () => {
      dotLottie.removeEventListener("load", onLoad)
      dotLottie.removeEventListener("loadError", onLoadError)
    }
  }, [dotLottie])

  const dotLottieRefCallback = useCallback((instance: DotLottie | null) => {
    setDotLottie(instance)
  }, [])

  // Prevent hydration mismatch by not rendering until mounted
  if (!mounted) {
    return <div style={{ width, height }} className={className} />
  }

  // Show error state if animation failed to load
  if (error) {
    return (
      <div 
        style={{ width, height }} 
        className={`${className} flex items-center justify-center text-neon-grey text-xs`}
      >
        <span>Animation unavailable</span>
      </div>
    )
  }

  // Determine which filter class to apply (chrome takes priority)
  const filterClass = applyChromeFilter
    ? "chrome-lottie"
    : applyNeonFilter
    ? "neon-lottie"
    : ""

  return (
    <div
      ref={containerRef}
      style={{ width, height, backgroundColor: "transparent" }}
      className={`${className} ${filterClass}`}
    >
      <DotLottieReact
        src={src}
        loop={loop}
        autoplay={autoplay}
        style={{ width: "100%", height: "100%", backgroundColor: "transparent" }}
        dotLottieRefCallback={dotLottieRefCallback}
        themeId={themeId}
        themeData={themeData}
        backgroundColor="transparent"
      />
    </div>
  )
}
