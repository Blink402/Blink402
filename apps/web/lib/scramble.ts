// Baffle.js text scramble on hover - Lazy loaded for performance
// Using local baffle package instead of CDN for security and performance
import { ANIMATION_CONSTANTS } from './constants'

export function mountScramble(selector = "[data-scramble]") {
  // Check for reduced motion preference
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    return
  }

  const elements = document.querySelectorAll<HTMLElement>(selector)

  // Lazy load baffle only when user hovers (saves initial load time)
  let baffleLoaded = false
  let baffleModule: any = null

  const loadBaffle = async () => {
    if (!baffleLoaded) {
      const module = await import("baffle")
      baffleModule = module.default
      baffleLoaded = true
    }
    return baffleModule
  }

  elements.forEach((el) => {
    let baffleInstance: any = null
    let hoverTimeout: NodeJS.Timeout | null = null
    let isInitialized = false

    el.addEventListener("mouseenter", async () => {
      try {
        if (hoverTimeout) clearTimeout(hoverTimeout)

        // Initialize baffle on first hover
        if (!isInitialized) {
          const baffle = await loadBaffle()
          baffleInstance = baffle(el, {
            characters: "01<>[]{}#_$",
            speed: ANIMATION_CONSTANTS.SCRAMBLE_SPEED,
          })
          isInitialized = true
        }

        hoverTimeout = setTimeout(() => {
          if (baffleInstance) {
            baffleInstance.start().reveal(ANIMATION_CONSTANTS.SCRAMBLE_REVEAL_DURATION)
          }
        }, ANIMATION_CONSTANTS.SCRAMBLE_HOVER_DEBOUNCE)
      } catch (error) {
        // Silent fail for scramble animations - text remains readable
        console.warn('Scramble animation failed:', error)
      }
    }, { passive: true })

    el.addEventListener("mouseleave", () => {
      if (hoverTimeout) clearTimeout(hoverTimeout)
    }, { passive: true })
  })
}
