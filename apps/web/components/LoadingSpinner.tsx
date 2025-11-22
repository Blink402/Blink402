import { cn } from "@/lib/utils"

interface LoadingSpinnerProps {
  size?: 'sm' | 'md' | 'lg' | 'xl'
  className?: string
  variant?: 'default' | 'neon'
}

const sizeClasses = {
  sm: 'w-4 h-4 border-2',
  md: 'w-6 h-6 border-2',
  lg: 'w-8 h-8 border-[3px]',
  xl: 'w-12 h-12 border-[3px]',
}

/**
 * Loading spinner component with neon aesthetic
 * Used for inline loading states
 */
export function LoadingSpinner({
  size = 'md',
  className,
  variant = 'default',
}: LoadingSpinnerProps) {
  return (
    <div
      className={cn(
        "inline-block rounded-full animate-spin",
        sizeClasses[size],
        variant === 'default' && "border-neon-grey border-t-neon-blue-light",
        variant === 'neon' && "border-neon-blue-dark/30 border-t-neon-blue-light shadow-[0_0_8px_rgba(90,180,255,0.4)]",
        className
      )}
      role="status"
      aria-label="Loading"
    >
      <span className="sr-only">Loading...</span>
    </div>
  )
}

/**
 * Full-page loading spinner with centered layout
 */
export function LoadingPage({ message }: { message?: string }) {
  return (
    <div className="min-h-[60vh] flex flex-col items-center justify-center gap-6">
      <LoadingSpinner size="xl" variant="neon" />
      {message && (
        <p className="font-mono text-sm text-neon-grey animate-pulse">
          {message}
        </p>
      )}
    </div>
  )
}

/**
 * Inline loading state with optional text
 */
export function LoadingInline({
  text = "Loading...",
  size = 'sm',
}: {
  text?: string
  size?: 'sm' | 'md'
}) {
  return (
    <div className="inline-flex items-center gap-2">
      <LoadingSpinner size={size} />
      <span className="font-mono text-sm text-neon-grey">{text}</span>
    </div>
  )
}
