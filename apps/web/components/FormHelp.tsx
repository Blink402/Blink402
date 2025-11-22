import { cn } from '@/lib/utils'

interface FormHelpProps {
  children: React.ReactNode
  className?: string
}

/**
 * FormHelp component - Displays helper text below form fields
 * Use this to provide guidance, examples, and tips for form inputs
 */
export function FormHelp({ children, className }: FormHelpProps) {
  return (
    <p
      className={cn(
        'text-neon-grey text-xs font-mono mt-2 leading-relaxed',
        'flex items-start gap-1.5',
        className
      )}
    >
      <span className="text-neon-blue-light shrink-0" aria-hidden="true">
        💡
      </span>
      <span>{children}</span>
    </p>
  )
}
