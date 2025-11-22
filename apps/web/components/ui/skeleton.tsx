import { cn } from '@/lib/utils'

interface SkeletonProps extends React.ComponentProps<'div'> {
  variant?: 'default' | 'neon' | 'shimmer'
}

function Skeleton({ className, variant = 'default', ...props }: SkeletonProps) {
  return (
    <div
      data-slot="skeleton"
      className={cn(
        'rounded-md',
        variant === 'default' && 'bg-neon-grey/10 animate-pulse',
        variant === 'neon' && 'bg-neon-blue-dark/10 border border-dashed border-neon-blue-dark/30 animate-pulse',
        variant === 'shimmer' && 'bg-gradient-to-r from-neon-grey/5 via-neon-blue-dark/15 to-neon-grey/5 animate-[shimmer_2s_ease-in-out_infinite] bg-[length:200%_100%]',
        className
      )}
      {...props}
    />
  )
}

/**
 * Skeleton for Blink cards in catalog/gallery
 */
function SkeletonBlinkCard({ className }: { className?: string }) {
  return (
    <div className={cn("border border-dashed border-neon-grey/20 bg-neon-dark/50 rounded overflow-hidden", className)}>
      {/* Image skeleton */}
      <Skeleton variant="neon" className="h-48 w-full rounded-none" />

      <div className="p-4 space-y-3">
        {/* Title */}
        <Skeleton variant="shimmer" className="h-6 w-3/4" />

        {/* Description */}
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-4/5" />

        {/* Price and stats */}
        <div className="flex items-center justify-between mt-4 pt-4 border-t border-dashed border-neon-grey/20">
          <Skeleton className="h-5 w-24" />
          <Skeleton className="h-5 w-16" />
        </div>
      </div>
    </div>
  )
}

/**
 * Skeleton for text content
 */
function SkeletonText({ lines = 3, className }: { lines?: number; className?: string }) {
  return (
    <div className={cn("space-y-2", className)}>
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton
          key={i}
          className={cn("h-4", i === lines - 1 ? "w-3/4" : "w-full")}
        />
      ))}
    </div>
  )
}

/**
 * Skeleton for dashboard stats
 */
function SkeletonStats({ className }: { className?: string }) {
  return (
    <div className={cn("grid grid-cols-1 md:grid-cols-3 gap-6", className)}>
      {[1, 2, 3].map((i) => (
        <div
          key={i}
          className="border border-dashed border-neon-grey/20 bg-neon-dark/50 p-6 rounded"
        >
          <Skeleton className="h-4 w-24 mb-3" />
          <Skeleton variant="neon" className="h-8 w-32" />
        </div>
      ))}
    </div>
  )
}

export { Skeleton, SkeletonBlinkCard, SkeletonText, SkeletonStats }
