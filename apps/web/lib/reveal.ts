// Motion One reveal utility with IntersectionObserver
import { ANIMATION_CONSTANTS, INTERSECTION_OBSERVER_CONSTANTS } from './constants'

export async function mountReveals(selector = "[data-reveal]") {
  try {
    // Check for reduced motion preference
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      const els = Array.from(document.querySelectorAll<HTMLElement>(selector))
      els.forEach((el) => {
        el.style.opacity = "1"
        el.style.transform = "none"
      })
      return
    }

    const { animate } = await import("motion")
    const els = Array.from(document.querySelectorAll<HTMLElement>(selector))

  if (!("IntersectionObserver" in window)) {
    els.forEach((el) => {
      el.style.opacity = "1"
      el.style.transform = "none"
    })
    return
  }

  // Queue for batching animations to prevent performance issues
  let animationQueue: Element[] = []
  let animationFrameId: number | null = null

  const processAnimationQueue = () => {
    // Process ONE animation at a time with delays to prevent jank
    const element = animationQueue.shift()

    if (element) {
      animate(
        element as HTMLElement,
        { opacity: [0, 1], y: [16, 0] } as any,
        { duration: 0.3 } // Reduced from 0.4s for snappier feel
      )
    }

    // If there are more animations, schedule next one with delay
    if (animationQueue.length > 0) {
      // Use setTimeout for delay between animations (100ms stagger)
      setTimeout(() => {
        animationFrameId = requestAnimationFrame(processAnimationQueue)
      }, 100)
    } else {
      animationFrameId = null
    }
  }

  // Performance optimization: Use rootMargin to trigger animations slightly earlier
  // and higher threshold to reduce observer callbacks
  const io = new IntersectionObserver(
    (entries) => {
      entries.forEach((e) => {
        if (e.isIntersecting) {
          // Add to queue instead of animating immediately
          animationQueue.push(e.target)
          io.unobserve(e.target)

          // Start processing if not already running
          if (!animationFrameId) {
            animationFrameId = requestAnimationFrame(processAnimationQueue)
          }
        }
      })
    },
    {
      threshold: INTERSECTION_OBSERVER_CONSTANTS.REVEAL_THRESHOLD,
      rootMargin: INTERSECTION_OBSERVER_CONSTANTS.REVEAL_ROOT_MARGIN
    }
  )

    els.forEach((el) => io.observe(el))
  } catch (error) {
    // Fallback: immediately show all elements if animation fails
    console.warn('Reveal animations failed, showing content immediately:', error)
    const els = Array.from(document.querySelectorAll<HTMLElement>(selector))
    els.forEach((el) => {
      el.style.opacity = "1"
      el.style.transform = "none"
    })
  }
}
