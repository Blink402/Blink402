import * as React from 'react'
import { Slot } from '@radix-ui/react-slot'
import { cva, type VariantProps } from 'class-variance-authority'
import { useGSAP } from '@gsap/react'
import gsap from 'gsap'

import { cn } from '@/lib/utils'

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-all disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 shrink-0 [&_svg]:shrink-0 outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive",
  {
    variants: {
      variant: {
        default: 
          'bg-neon-blue-dark text-neon-white shadow-[0_0_15px_rgba(67,97,238,0.5)] hover:bg-neon-blue-light hover:shadow-[0_0_25px_rgba(76,201,240,0.6)] border border-transparent',
        destructive:
          'bg-destructive text-white hover:bg-destructive/90 focus-visible:ring-destructive/20 dark:focus-visible:ring-destructive/40 dark:bg-destructive/60',
        outline:
          'border border-neon-blue-light/50 bg-transparent text-neon-blue-light hover:bg-neon-blue-light/10 hover:border-neon-blue-light hover:shadow-[0_0_15px_rgba(76,201,240,0.3)]',
        secondary:
          'bg-secondary text-secondary-foreground hover:bg-secondary/80',
        ghost:
          'text-neon-grey hover:text-neon-white hover:bg-neon-white/5',
        link: 'text-primary underline-offset-4 hover:underline',
        glow: 'bg-gradient-to-r from-neon-blue-dark to-neon-purple text-white shadow-[0_0_20px_rgba(67,97,238,0.6)] hover:shadow-[0_0_30px_rgba(114,9,183,0.6)] border border-transparent',
      },
      size: {
        default: 'h-11 px-4 py-2 has-[>svg]:px-3 min-w-[44px]',
        sm: 'h-10 rounded-md gap-1.5 px-3 has-[>svg]:px-2.5',
        lg: 'h-12 rounded-md px-6 has-[>svg]:px-4 text-base',
        icon: 'size-11',
        'icon-sm': 'size-10',
        'icon-lg': 'size-12',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  },
)

function Button({
  className,
  variant,
  size,
  asChild = false,
  ...props
}: React.ComponentProps<'button'> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean
  }) {
  const Comp = asChild ? Slot : 'button'
  const buttonRef = React.useRef<HTMLButtonElement>(null)

  useGSAP(() => {
    if (!buttonRef.current || asChild) return

    const btn = buttonRef.current
    
    // Simple hover animation using GSAP
    const hoverAnim = gsap.to(btn, {
      scale: 1.05,
      duration: 0.2,
      paused: true,
      ease: "power1.out"
    })

    btn.addEventListener('mouseenter', () => hoverAnim.play())
    btn.addEventListener('mouseleave', () => hoverAnim.reverse())

    return () => {
      btn.removeEventListener('mouseenter', () => hoverAnim.play())
      btn.removeEventListener('mouseleave', () => hoverAnim.reverse())
    }
  }, { scope: buttonRef })

  return (
    <Comp
      data-slot="button"
      ref={buttonRef}
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Button, buttonVariants }
