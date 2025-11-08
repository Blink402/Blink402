// Application constants
// Magic numbers extracted for better maintainability and documentation

export const ANIMATION_CONSTANTS = {
  // Batch size for reveal animations (1 element at a time for smooth 60fps)
  REVEAL_BATCH_SIZE: 1,

  // Delay between reveal animations (in ms) - creates stagger effect
  REVEAL_STAGGER_DELAY: 100,

  // Duration for baffle.js text scramble effect (in ms)
  SCRAMBLE_REVEAL_DURATION: 500,

  // Debounce time for hover scramble (prevents excessive animations on rapid mouse movement)
  SCRAMBLE_HOVER_DEBOUNCE: 50,

  // Baffle.js animation speed (lower = faster)
  SCRAMBLE_SPEED: 50,
} as const

export const INTERSECTION_OBSERVER_CONSTANTS = {
  // Threshold for triggering reveal animations (15% of element must be visible)
  REVEAL_THRESHOLD: 0.15,

  // Root margin for IntersectionObserver (triggers 10% before element enters viewport)
  REVEAL_ROOT_MARGIN: "0px 0px -10% 0px",

  // Threshold for Lottie pause behavior (pause immediately when not visible)
  LOTTIE_PAUSE_THRESHOLD: 0,
} as const

export const TOUCH_TARGET_SIZES = {
  // Minimum touch target size for pointer devices (WCAG AAA recommendation)
  MIN_TOUCH_SIZE: 44,

  // Minimum touch target size for coarse pointers (mobile devices)
  MIN_COARSE_TOUCH_SIZE: 48,
} as const

export const PLATFORM_CONSTANTS = {
  // Platform fee in basis points (2.5%)
  PLATFORM_FEE_BPS: 250,

  // Calculate net amount after platform fee
  calculateNetAmount: (grossAmount: number) => grossAmount * (1 - 250 / 10000),
} as const

export const SCROLL_CONSTANTS = {
  // Scroll threshold for sticky nav background change (in pixels)
  NAV_SCROLL_THRESHOLD: 10,
} as const
