'use client'

import { HelpCircle } from 'lucide-react'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'

interface HelpTooltipProps {
  content: string | React.ReactNode
  className?: string
  side?: 'top' | 'right' | 'bottom' | 'left'
}

/**
 * HelpTooltip component - Shows a help icon (ⓘ) that displays explanatory text on hover
 * Use this to explain technical terms and jargon in a beginner-friendly way
 */
export function HelpTooltip({ content, className, side = 'top' }: HelpTooltipProps) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          className={cn(
            'inline-flex items-center justify-center',
            'text-neon-grey hover:text-neon-blue-light',
            'transition-colors duration-200',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neon-blue-light focus-visible:ring-offset-2',
            'rounded-full',
            className
          )}
          aria-label="Help"
        >
          <HelpCircle className="w-4 h-4" />
        </button>
      </TooltipTrigger>
      <TooltipContent
        side={side}
        className="max-w-xs bg-neon-dark border border-neon-blue-light/20 text-neon-white text-sm font-mono leading-relaxed shadow-lg"
        sideOffset={5}
      >
        {content}
      </TooltipContent>
    </Tooltip>
  )
}
