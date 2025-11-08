// Performance monitoring utilities
// Helps identify animation bottlenecks in development

const PERFORMANCE_BUDGET = {
  ANIMATION_FRAME: 16, // 60fps budget in ms
  INTERACTION: 100, // User interaction response in ms
  LOAD: 3000, // Initial page load in ms
} as const

export function measureAnimationFrame(callback: () => void, label: string) {
  if (process.env.NODE_ENV !== 'development') {
    callback()
    return
  }

  const start = performance.now()
  callback()
  const duration = performance.now() - start

  if (duration > PERFORMANCE_BUDGET.ANIMATION_FRAME) {
    console.warn(
      `⚠️ [Performance] ${label} took ${duration.toFixed(2)}ms (budget: ${PERFORMANCE_BUDGET.ANIMATION_FRAME}ms)`
    )
  }
}

export function reportLongTask(duration: number, taskName: string) {
  if (duration > 50) {
    console.warn(`⚠️ [Long Task] ${taskName}: ${duration.toFixed(2)}ms`)
  }
}

// Debounce utility for expensive operations
export function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout | null = null

  return function(...args: Parameters<T>) {
    if (timeout) clearTimeout(timeout)
    timeout = setTimeout(() => func(...args), wait)
  }
}

// Throttle utility for scroll/resize handlers
export function throttle<T extends (...args: any[]) => any>(
  func: T,
  limit: number
): (...args: Parameters<T>) => void {
  let inThrottle: boolean = false

  return function(...args: Parameters<T>) {
    if (!inThrottle) {
      func(...args)
      inThrottle = true
      setTimeout(() => inThrottle = false, limit)
    }
  }
}
