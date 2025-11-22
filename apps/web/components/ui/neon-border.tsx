import React from 'react'
import { cn } from '@/lib/utils'

interface NeonBorderProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode
  borderWidth?: number
  borderRadius?: number
  neonColor?: string
}

export function NeonBorder({
  children,
  className,
  borderWidth = 1.5,
  borderRadius = 12,
  neonColor = 'var(--neon-blue-light)',
  ...props
}: NeonBorderProps) {
  return (
    <div
      className={cn('relative group', className)}
      style={{ borderRadius }}
      {...props}
    >
      {/* Gradient Border Layer */}
      <div
        className="absolute inset-0 rounded-[inherit] opacity-50 group-hover:opacity-100 transition-opacity duration-500"
        style={{
          padding: borderWidth,
          background: `linear-gradient(90deg, transparent, ${neonColor}, transparent)`,
          mask: 'linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)',
          maskComposite: 'exclude',
          WebkitMask: 'linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)',
          WebkitMaskComposite: 'xor',
        }}
      />
      
      {/* Glow Effect */}
      <div
        className="absolute inset-0 rounded-[inherit] opacity-0 group-hover:opacity-20 transition-opacity duration-500 blur-md"
        style={{
          background: neonColor,
        }}
      />

      {/* Content */}
      <div className="relative rounded-[inherit] bg-neon-dark/40 backdrop-blur-sm h-full">
        {children}
      </div>
    </div>
  )
}
